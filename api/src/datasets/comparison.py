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
