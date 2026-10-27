"""Paired row previews and SDV evaluation reports for synthetic jobs."""

from __future__ import annotations

import json
import random
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from loguru import logger

from src.datasets import service, storage, synthetic
from src.datasets.dtos import SyntheticRequest
from src.datasets.service import DatasetNotFoundError

EVALUATION_SAMPLE_SIZE = 10_000
ML_EVALUATION_SAMPLE_SIZE = 5_000

_EVALUATION_LOCK = threading.Lock()


class ComparisonUnavailableError(Exception):
    """The job cannot be compared yet, or predates comparison support."""


class EvaluationError(Exception):
    """The SDV reports could not be generated."""


def _completed_job(dataset_id: UUID | str, job_id: str) -> dict[str, Any]:
    job = synthetic.get_status(dataset_id, job_id)
    if job.get("status") != "completed":
        raise ComparisonUnavailableError(
            "Synthetic generation has not completed for this job."
        )
    return job


def _job_request(job: dict[str, Any]) -> SyntheticRequest:
    raw = job.get("request")
    if not isinstance(raw, dict):
        raise ComparisonUnavailableError(
            "This synthetic job predates comparison support. Generate it again."
        )
    try:
        return SyntheticRequest.model_validate(raw)
    except Exception as exc:  # noqa: BLE001 - stored job data may be stale
        raise ComparisonUnavailableError(
            "This synthetic job has invalid comparison metadata. Generate it again."
        ) from exc


def _read_window(
    path: Path,
    offset: int,
    limit: int,
    indexes: list[int] | None = None,
) -> list[list[str | None]]:
    if limit <= 0 or not path.is_file():
        return []

    rows: list[list[str | None]] = []
    with path.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle):
            if index < offset:
                continue
            if len(rows) >= limit:
                break
            row = json.loads(line)
            if indexes is None:
                rows.append(row)
            else:
                rows.append(
                    [
                        row[column] if column < len(row) else None
                        for column in indexes
                    ]
                )
    return rows


def _comparison_columns(
    meta: dict[str, Any], request: SyntheticRequest
) -> list[dict[str, Any]]:
    by_index = {column["index"]: column for column in meta["columns"]}
    columns: list[dict[str, Any]] = []
    for config in request.columns:
        info = by_index.get(config.index, {})
        columns.append(
            {
                "index": config.index,
                "header": info.get("header")
                or f"Column {config.index + 1}",
                "sdtype": config.sdtype,
            }
        )
    return columns


def get_comparison(
    dataset_id: UUID | str, job_id: str, offset: int, limit: int
) -> dict[str, Any]:
    """Return original and synthetic rows paired by row index."""
    job = _completed_job(dataset_id, job_id)
    request = _job_request(job)
    meta = service.get_meta(dataset_id)
    indexes = [config.index for config in request.columns]

    original_total = int(meta.get("total_rows", 0))
    synthetic_total = int(job.get("output_rows") or 0)
    total = max(original_total, synthetic_total)

    original_rows = _read_window(
        storage.rows_path(dataset_id), offset, limit, indexes
    )
    synthetic_rows = _read_window(
        storage.synthetic_rows_path(dataset_id, job_id), offset, limit
    )

    empty = [None] * len(indexes)
    paired: list[dict[str, Any]] = []
    slots = min(limit, max(0, total - offset))
    for index in range(slots):
        paired.append(
            {
                "original": (
                    original_rows[index]
                    if index < len(original_rows)
                    else empty
                ),
                "synthetic": (
                    synthetic_rows[index]
                    if index < len(synthetic_rows)
                    else empty
                ),
            }
        )

    return {
        "offset": offset,
        "limit": limit,
        "total": total,
        "original_total": original_total,
        "synthetic_total": synthetic_total,
        "columns": _comparison_columns(meta, request),
        "rows": paired,
    }


def _sample_indexes(total: int, sample_size: int) -> set[int] | None:
    if total <= sample_size:
        return None
    rng = random.Random(0)
    return set(rng.sample(range(total), sample_size))


def _load_sampled_frame(
    path: Path,
    request: SyntheticRequest,
    names: dict[int, str],
    total: int,
    source_indexes: list[int],
) -> tuple[Any, int]:
    """Load a uniform row sample and cast it according to the request."""
    import pandas as pd

    if not path.is_file():
        raise EvaluationError("The generated rows are missing for this job.")

    selected = _sample_indexes(total, EVALUATION_SAMPLE_SIZE)
    raw: dict[str, list[str | None]] = {
        names[config.index]: [] for config in request.columns
    }
    collected = 0

    with path.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle):
            if selected is not None and index not in selected:
                continue
            row = json.loads(line)
            for config, source_index in zip(request.columns, source_indexes):
                raw[names[config.index]].append(
                    row[source_index] if source_index < len(row) else None
                )
            collected += 1
            if selected is not None and collected >= len(selected):
                break

    if collected == 0:
        raise EvaluationError("There are no rows to evaluate.")

    data = {
        names[config.index]: synthetic._cast_column(
            config.sdtype, raw[names[config.index]]
        )
        for config in request.columns
    }
    return pd.DataFrame(data), collected


def _native(value: Any) -> Any:
    """Convert pandas/numpy values into JSON-serializable Python values."""
    import pandas as pd

    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        value = value.item()
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, (bool, int, float, str)):
        return value
    return str(value)


def _table(frame: Any) -> dict[str, Any]:
    return {
        "columns": [str(column) for column in frame.columns],
        "rows": [
            [_native(value) for value in row]
            for row in frame.itertuples(index=False, name=None)
        ],
    }


def _plot(
    report: Any, property_name: str, table_name: str | None
) -> dict[str, Any] | None:
    try:
        figure = report.get_visualization(property_name, table_name)
        return json.loads(figure.to_json())
    except Exception:  # noqa: BLE001 - some properties have no visualization
        logger.debug(
            f"[SYNTHETIC] no visualization for {property_name}",
            exc_info=True,
        )
        return None


def _report(report: Any, report_name: str) -> dict[str, Any]:
    table_names = getattr(report, "table_names", None) or []
    table_name = table_names[0] if table_names else None
    properties: list[dict[str, Any]] = []
    scores = report.get_properties().to_dict(orient="records")
    for record in scores:
        property_name = str(record.get("Property"))
        score = _native(record.get("Score"))
        if score is None:
            continue
        try:
            details = _table(report.get_details(property_name))
        except Exception:  # noqa: BLE001 - skipped properties have no details
            logger.debug(
                f"[SYNTHETIC] no details for {property_name}",
                exc_info=True,
            )
            details = {"columns": [], "rows": []}
        properties.append(
            {
                "property": property_name,
                "score": score,
                "details": details,
                "plot": _plot(report, property_name, table_name),
            }
        )

    return {
        "report": report_name,
        "score": _native(report.get_score()),
        "properties": properties,
    }


def _compute_evaluation(
    dataset_id: UUID | str, job_id: str
) -> dict[str, Any]:
    from sdv.evaluation import evaluate_quality, run_diagnostic

    job = _completed_job(dataset_id, job_id)
    request = _job_request(job)
    meta = service.get_meta(dataset_id)
    names = synthetic._column_names(meta)
    metadata = synthetic._build_metadata(meta, request)

    original_total = int(meta.get("total_rows", 0))
    synthetic_total = int(job.get("output_rows") or 0)
    original, original_sample = _load_sampled_frame(
        storage.rows_path(dataset_id),
        request,
        names,
        original_total,
        [config.index for config in request.columns],
    )
    generated, synthetic_sample = _load_sampled_frame(
        storage.synthetic_rows_path(dataset_id, job_id),
        request,
        names,
        synthetic_total,
        list(range(len(request.columns))),
    )

    quality = evaluate_quality(
        original, generated, metadata, verbose=False
    )
    diagnostic = run_diagnostic(
        original, generated, metadata, verbose=False
    )

    return {
        "quality": _report(quality, "quality"),
        "diagnostic": _report(diagnostic, "diagnostic"),
        "sampled": (
            original_sample < original_total
            or synthetic_sample < synthetic_total
        ),
        "sample_rows": max(original_sample, synthetic_sample),
        "original_sample_rows": original_sample,
        "synthetic_sample_rows": synthetic_sample,
        "original_rows": original_total,
        "synthetic_rows": synthetic_total,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def get_evaluation(
    dataset_id: UUID | str, job_id: str
) -> dict[str, Any]:
    """Return a cached SDV evaluation, computing it on first access."""
    path = storage.synthetic_evaluation_path(dataset_id, job_id)
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))

    with _EVALUATION_LOCK:
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
        try:
            result = _compute_evaluation(dataset_id, job_id)
        except (ComparisonUnavailableError, DatasetNotFoundError):
            raise
        except Exception as exc:  # noqa: BLE001 - surface report failures
            logger.exception(
                f"[SYNTHETIC] evaluation failed for job {job_id}"
            )
            raise EvaluationError(str(exc)) from exc

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(result, ensure_ascii=False), encoding="utf-8"
        )
        return result


def _load_frames_for_evaluation(
    dataset_id: UUID | str, job_id: str, sample_size: int = EVALUATION_SAMPLE_SIZE
) -> tuple[Any, Any, SyntheticRequest, dict[int, str]]:
    """Load original and synthetic dataframes for evaluation."""
    job = _completed_job(dataset_id, job_id)
    request = _job_request(job)
    meta = service.get_meta(dataset_id)
    names = synthetic._column_names(meta)

    original_total = int(meta.get("total_rows", 0))
    synthetic_total = int(job.get("output_rows") or 0)

    original, _ = _load_sampled_frame(
        storage.rows_path(dataset_id),
        request,
        names,
        original_total,
        [config.index for config in request.columns],
        sample_size=sample_size,
    )
    generated, _ = _load_sampled_frame(
        storage.synthetic_rows_path(dataset_id, job_id),
        request,
        names,
        synthetic_total,
        list(range(len(request.columns))),
        sample_size=sample_size,
    )

    return original, generated, request, names


def _load_sampled_frame(
    path: Path,
    request: SyntheticRequest,
    names: dict[int, str],
    total: int,
    source_indexes: list[int],
    sample_size: int = EVALUATION_SAMPLE_SIZE,
) -> tuple[Any, int]:
    """Load a uniform row sample and cast it according to the request."""
    import pandas as pd

    if not path.is_file():
        raise EvaluationError("The generated rows are missing for this job.")

    selected = _sample_indexes(total, sample_size)
    raw: dict[str, list[str | None]] = {
        names[config.index]: [] for config in request.columns
    }
    collected = 0

    with path.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle):
            if selected is not None and index not in selected:
                continue
            row = json.loads(line)
            for config, source_index in zip(request.columns, source_indexes):
                raw[names[config.index]].append(
                    row[source_index] if source_index < len(row) else None
                )
            collected += 1
            if selected is not None and collected >= len(selected):
                break

    if collected == 0:
        raise EvaluationError("There are no rows to evaluate.")

    data = {
        names[config.index]: synthetic._cast_column(
            config.sdtype, raw[names[config.index]]
        )
        for config in request.columns
    }
    return pd.DataFrame(data), collected


def _sample_indexes(total: int, sample_size: int) -> set[int] | None:
    if total <= sample_size:
        return None
    rng = random.Random(0)
    return set(rng.sample(range(total), sample_size))


def get_column_plot(
    dataset_id: UUID | str, job_id: str, column_name: str
) -> dict[str, Any] | None:
    """Generate a column distribution comparison plot using SDV."""
    from sdv.evaluation import get_column_plot

    job = _completed_job(dataset_id, job_id)
    request = _job_request(job)
    meta = service.get_meta(dataset_id)
    names = synthetic._column_names(meta)
    metadata = synthetic._build_metadata(meta, request)

    original_total = int(meta.get("total_rows", 0))
    synthetic_total = int(job.get("output_rows") or 0)

    original, _ = _load_sampled_frame(
        storage.rows_path(dataset_id),
        request,
        names,
        original_total,
        [config.index for config in request.columns],
    )
    generated, _ = _load_sampled_frame(
        storage.synthetic_rows_path(dataset_id, job_id),
        request,
        names,
        synthetic_total,
        list(range(len(request.columns))),
    )

    # Find the actual column name in the dataframes (they use the header names)
    if column_name not in original.columns or column_name not in generated.columns:
        return None

    try:
        figure = get_column_plot(
            real_data={request.table_name: original},
            synthetic_data={request.table_name: generated},
            metadata=metadata,
            table_name=request.table_name,
            column_name=column_name,
        )
        return json.loads(figure.to_json())
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            f"[SYNTHETIC] column plot failed for {column_name}: {exc}",
            exc_info=True,
        )
        return None


def run_ml_evaluation(
    dataset_id: UUID | str,
    job_id: str,
    target_column: str,
    test_size: float = 0.2,
) -> dict[str, Any]:
    """Run logistic regression comparison on original vs synthetic data."""
    from sklearn.linear_model import LogisticRegression, LinearRegression
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import (
        accuracy_score,
        precision_score,
        recall_score,
        f1_score,
        roc_auc_score,
        mean_squared_error,
        r2_score,
        confusion_matrix,
    )
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    import pandas as pd
    import numpy as np

    original, generated, request, names = _load_frames_for_evaluation(
        dataset_id, job_id, sample_size=ML_EVALUATION_SAMPLE_SIZE
    )

    if target_column not in original.columns or target_column not in generated.columns:
        raise EvaluationError(f"Target column '{target_column}' not found in data.")

    # Determine if classification or regression
    # Check unique values in target column
    original_target = original[target_column].dropna()
    synthetic_target = generated[target_column].dropna()

    if len(original_target) == 0 or len(synthetic_target) == 0:
        raise EvaluationError("Target column has no valid values.")

    # Check if target is numeric (continuous) or categorical
    is_numeric = pd.api.types.is_numeric_dtype(original_target)
    unique_values = original_target.nunique()

    # Heuristic: if numeric with many unique values, treat as regression
    # If few unique values or non-numeric, treat as classification
    is_classification = not is_numeric or unique_values <= 20

    # Prepare features (all other columns)
    feature_columns = [c for c in original.columns if c != target_column]

    # Handle missing values and encode categorical features
    def prepare_data(df: pd.DataFrame, target_col: str, feature_cols: list[str], encoders: dict | None = None):
        df = df.copy()
        # Drop rows where target is NaN
        df = df.dropna(subset=[target_col])
        y = df[target_col].copy()
        X = df[feature_cols].copy()

        # Encode categorical features
        if encoders is None:
            encoders = {}
        for col in feature_cols:
            if col not in X.columns:
                continue
            if pd.api.types.is_object_dtype(X[col]) or pd.api.types.is_categorical_dtype(X[col]):
                if col not in encoders:
                    encoders[col] = LabelEncoder()
                    # Fit on combined data to handle all categories
                    combined = pd.concat([original[col], generated[col]], ignore_index=True).dropna()
                    if len(combined) > 0:
                        encoders[col].fit(combined.astype(str))
                # Transform
                mask = X[col].notna()
                if mask.any():
                    X.loc[mask, col] = encoders[col].transform(X.loc[mask, col].astype(str))
                X[col] = pd.to_numeric(X[col], errors='coerce')

        # Fill remaining NaN with median/mode
        for col in X.columns:
            if X[col].isna().any():
                if pd.api.types.is_numeric_dtype(X[col]):
                    X[col] = X[col].fillna(X[col].median())
                else:
                    X[col] = X[col].fillna(X[col].mode().iloc[0] if not X[col].mode().empty else 0)

        # Encode target if classification
        target_encoder = None
        if is_classification:
            if target_col not in encoders:
                target_encoder = LabelEncoder()
                combined_target = pd.concat([original[target_col], generated[target_col]], ignore_index=True).dropna()
                if len(combined_target) > 0:
                    target_encoder.fit(combined_target.astype(str))
            else:
                target_encoder = encoders[target_col]
            y = target_encoder.transform(y.astype(str))

        return X, y, encoders, target_encoder

    # Prepare original data
    X_orig, y_orig, encoders, target_encoder = prepare_data(original, target_column, feature_columns)
    # Prepare synthetic data using same encoders
    X_synth, y_synth, _, _ = prepare_data(generated, target_column, feature_columns, encoders)

    if len(X_orig) == 0 or len(X_synth) == 0:
        raise EvaluationError("Not enough data after preprocessing.")

    # Split data
    X_orig_train, X_orig_test, y_orig_train, y_orig_test = train_test_split(
        X_orig, y_orig, test_size=test_size, random_state=42, stratify=y_orig if is_classification else None
    )
    X_synth_train, X_synth_test, y_synth_train, y_synth_test = train_test_split(
        X_synth, y_synth, test_size=test_size, random_state=42, stratify=y_synth if is_classification else None
    )

    # Scale features
    scaler = StandardScaler()
    X_orig_train_scaled = scaler.fit_transform(X_orig_train)
    X_orig_test_scaled = scaler.transform(X_orig_test)
    X_synth_train_scaled = scaler.transform(X_synth_train)
    X_synth_test_scaled = scaler.transform(X_synth_test)

    results = {
        "target_column": target_column,
        "task_type": "classification" if is_classification else "regression",
        "n_features": len(feature_columns),
        "n_samples_original": len(X_orig),
        "n_samples_synthetic": len(X_synth),
        "train_size_original": len(X_orig_train),
        "test_size_original": len(X_orig_test),
        "train_size_synthetic": len(X_synth_train),
        "test_size_synthetic": len(X_synth_test),
        "class_labels": target_encoder.classes_.tolist() if target_encoder is not None else None,
    }

    if is_classification:
        # Multi-class logistic regression
        n_classes = len(np.unique(y_orig))
        model_orig = LogisticRegression(
            multi_class='multinomial' if n_classes > 2 else 'auto',
            solver='lbfgs',
            max_iter=1000,
            random_state=42,
            class_weight='balanced'
        )
        model_synth = LogisticRegression(
            multi_class='multinomial' if n_classes > 2 else 'auto',
            solver='lbfgs',
            max_iter=1000,
            random_state=42,
            class_weight='balanced'
        )

        # Train on original, test on both
        model_orig.fit(X_orig_train_scaled, y_orig_train)
        y_orig_pred = model_orig.predict(X_orig_test_scaled)
        y_synth_pred_from_orig = model_orig.predict(X_synth_test_scaled)

        # Train on synthetic, test on both
        model_synth.fit(X_synth_train_scaled, y_synth_train)
        y_synth_pred = model_synth.predict(X_synth_test_scaled)
        y_orig_pred_from_synth = model_synth.predict(X_orig_test_scaled)

        # Probabilities for ROC-AUC
        try:
            y_orig_proba = model_orig.predict_proba(X_orig_test_scaled)
            y_synth_proba_from_orig = model_orig.predict_proba(X_synth_test_scaled)
            y_synth_proba = model_synth.predict_proba(X_synth_test_scaled)
            y_orig_proba_from_synth = model_synth.predict_proba(X_orig_test_scaled)
        except Exception:
            y_orig_proba = y_synth_proba_from_orig = y_synth_proba = y_orig_proba_from_synth = None

        # Metrics
        def compute_clf_metrics(y_true, y_pred, y_proba=None, prefix=""):
            metrics = {
                f"{prefix}accuracy": float(accuracy_score(y_true, y_pred)),
                f"{prefix}precision_macro": float(precision_score(y_true, y_pred, average='macro', zero_division=0)),
                f"{prefix}recall_macro": float(recall_score(y_true, y_pred, average='macro', zero_division=0)),
                f"{prefix}f1_macro": float(f1_score(y_true, y_pred, average='macro', zero_division=0)),
                f"{prefix}precision_weighted": float(precision_score(y_true, y_pred, average='weighted', zero_division=0)),
                f"{prefix}recall_weighted": float(recall_score(y_true, y_pred, average='weighted', zero_division=0)),
                f"{prefix}f1_weighted": float(f1_score(y_true, y_pred, average='weighted', zero_division=0)),
            }
            if y_proba is not None:
                try:
                    if n_classes == 2:
                        metrics[f"{prefix}roc_auc"] = float(roc_auc_score(y_true, y_proba[:, 1]))
                    else:
                        metrics[f"{prefix}roc_auc_ovr"] = float(roc_auc_score(y_true, y_proba, multi_class='ovr', average='macro'))
                        metrics[f"{prefix}roc_auc_ovo"] = float(roc_auc_score(y_true, y_proba, multi_class='ovo', average='macro'))
                except Exception:
                    pass
            return metrics

        results["original_train_original_test"] = compute_clf_metrics(y_orig_test, y_orig_pred, y_orig_proba, "orig_")
        results["original_train_synthetic_test"] = compute_clf_metrics(y_synth_test, y_synth_pred_from_orig, y_synth_proba_from_orig, "orig_")
        results["synthetic_train_synthetic_test"] = compute_clf_metrics(y_synth_test, y_synth_pred, y_synth_proba, "synth_")
        results["synthetic_train_original_test"] = compute_clf_metrics(y_orig_test, y_orig_pred_from_synth, y_orig_proba_from_synth, "synth_")

        # Confusion matrices
        results["confusion_matrix_orig_train_orig_test"] = confusion_matrix(y_orig_test, y_orig_pred).tolist()
        results["confusion_matrix_orig_train_synth_test"] = confusion_matrix(y_synth_test, y_synth_pred_from_orig).tolist()
        results["confusion_matrix_synth_train_synth_test"] = confusion_matrix(y_synth_test, y_synth_pred).tolist()
        results["confusion_matrix_synth_train_orig_test"] = confusion_matrix(y_orig_test, y_orig_pred_from_synth).tolist()

    else:
        # Linear regression
        model_orig = LinearRegression()
        model_synth = LinearRegression()

        # Train on original, test on both
        model_orig.fit(X_orig_train_scaled, y_orig_train)
        y_orig_pred = model_orig.predict(X_orig_test_scaled)
        y_synth_pred_from_orig = model_orig.predict(X_synth_test_scaled)

        # Train on synthetic, test on both
        model_synth.fit(X_synth_train_scaled, y_synth_train)
        y_synth_pred = model_synth.predict(X_synth_test_scaled)
        y_orig_pred_from_synth = model_synth.predict(X_orig_test_scaled)

        def compute_reg_metrics(y_true, y_pred, prefix=""):
            return {
                f"{prefix}mse": float(mean_squared_error(y_true, y_pred)),
                f"{prefix}rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
                f"{prefix}r2": float(r2_score(y_true, y_pred)),
            }

        results["original_train_original_test"] = compute_reg_metrics(y_orig_test, y_orig_pred, "orig_")
        results["original_train_synthetic_test"] = compute_reg_metrics(y_synth_test, y_synth_pred_from_orig, "orig_")
        results["synthetic_train_synthetic_test"] = compute_reg_metrics(y_synth_test, y_synth_pred, "synth_")
        results["synthetic_train_original_test"] = compute_reg_metrics(y_orig_test, y_orig_pred_from_synth, "synth_")

    return results
