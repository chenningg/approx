"""Synthetic data generation jobs backed by the SDV.

Mirrors :mod:`src.datasets.processing`: an in-memory registry tracks running
jobs, a per-job JSON file survives restarts, and the CPU-heavy SDV work runs in
a threadpool. The SDV does not expose progress callbacks, so progress advances
in coarse phases instead of per row.
"""

from __future__ import annotations

import asyncio
import json
import threading
from pathlib import Path
from typing import Any
from uuid import UUID, uuid7

from fastapi.concurrency import run_in_threadpool
from loguru import logger

from src.datasets import actions, storage
from src.datasets.dtos import SyntheticRequest
from src.datasets.service import DatasetNotFoundError

_ACTIVE: dict[str, dict[str, Any]] = {}
_LOCK = threading.Lock()

#: Detected-type -> (SDV sdtype, is-PII). The frontend lets users override
#: these suggestions before generation.
_SDTYPE_MAP: dict[str, tuple[str, bool]] = {
    "EMAIL": ("email", True),
    "PHONE": ("phone_number", True),
    "ADDRESS": ("street_address", True),
    "NAME": ("first_name", True),
    "CARD": ("credit_card_number", True),
    "NRIC": ("id", False),
    "PASSPORT": ("id", False),
    "DRIVING_LICENSE": ("id", False),
    "IP_ADDRESS": ("ipv4_address", False),
    "URL": ("categorical", False),
    "DOB": ("datetime", False),
    "DATE": ("datetime", False),
    "AGE": ("numerical", False),
    "GENDER": ("categorical", False),
    "TITLE": ("categorical", False),
    "UNKNOWN": ("categorical", False),
}

#: Sdtypes that accept SDV's ``pii`` flag. For these, ``pii=True`` means values
#: are anonymized; ``pii=False`` means the original values may be reused.
_PII_SDTYPES = {
    "address",
    "administrative_unit",
    "city",
    "country_code",
    "credit_card_number",
    "email",
    "first_name",
    "iban",
    "ipv4_address",
    "ipv6_address",
    "last_name",
    "license_plate",
    "mac_address",
    "passport_number",
    "phone_number",
    "postcode",
    "secondary_address",
    "ssn",
    "state_abbr",
    "street_address",
    "swift11",
    "swift8",
    "user_agent_string",
    "vin",
}

_DATE_FORMAT = "%Y-%m-%d"


def _column_names(meta: dict[str, Any]) -> dict[int, str]:
    """Resolve unique, non-empty column names for SDV metadata."""
    names: dict[int, str] = {}
    used: set[str] = set()
    for column in meta["columns"]:
        base = (column.get("header") or "").strip() or (
            f"column_{column['index'] + 1}"
        )
        name = base
        suffix = 2
        while name in used:
            name = f"{base}_{suffix}"
            suffix += 1
        used.add(name)
        names[column["index"]] = name
    return names


def _table_name(meta: dict[str, Any]) -> str:
    name = str(meta.get("sheet") or "").strip()
    return name[:63] or "table"


def suggest_metadata(meta: dict[str, Any]) -> dict[str, Any]:
    """Build the pre-filled metadata form for a dataset."""
    names = _column_names(meta)
    columns = []
    suggested_primary_key: int | None = None
    for column in meta["columns"]:
        sdtype, pii = _SDTYPE_MAP.get(
            column.get("detected_type", "UNKNOWN"), ("categorical", False)
        )
        if suggested_primary_key is None and sdtype == "id":
            suggested_primary_key = column["index"]
        columns.append(
            {
                "index": column["index"],
                "header": names[column["index"]],
                "sdtype": sdtype,
                "pii": pii,
            }
        )
    return {
        "table_name": _table_name(meta),
        "suggested_primary_key": suggested_primary_key,
        "default_num_rows": int(meta.get("total_rows", 0)),
        "columns": columns,
    }


def start_job(
    dataset_id: UUID, meta: dict[str, Any], request: SyntheticRequest
) -> dict[str, Any]:
    job_id = str(uuid7())
    job: dict[str, Any] = {
        "job_id": job_id,
        "dataset_id": str(dataset_id),
        "status": "running",
        "progress": 0.0,
        "phase": "Starting",
        "total_rows": request.num_rows,
        "error": None,
        "export_filename": None,
        "output_rows": None,
    }
    with _LOCK:
        _ACTIVE[job_id] = job
    _write_status(dataset_id, job)
    asyncio.create_task(
        run_in_threadpool(_run_job, dataset_id, meta, request, job)
    )
    return dict(job)


def get_status(dataset_id: UUID | str, job_id: str) -> dict[str, Any]:
    with _LOCK:
        job = _ACTIVE.get(job_id)
        if job is not None:
            return dict(job)

    path = storage.synthetic_job_path(dataset_id, job_id)
    if not path.is_file():
        raise DatasetNotFoundError(job_id)
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    if data.get("status") == "running":
        # The server restarted while this job was in flight.
        data["status"] = "failed"
        data["error"] = (
            "Generation was interrupted (the server restarted). Try again."
        )
        _write_status(dataset_id, data)
    return data


def export_file(
    dataset_id: UUID | str, job_id: str
) -> tuple[Path, str] | None:
    with _LOCK:
        if job_id in _ACTIVE:
            return None
    status_path = storage.synthetic_job_path(dataset_id, job_id)
    if not status_path.is_file():
        return None
    data: dict[str, Any] = json.loads(status_path.read_text(encoding="utf-8"))
    if data.get("status") != "completed":
        return None
    path = storage.synthetic_output_path(dataset_id, job_id)
    filename = data.get("export_filename") or f"{job_id}.xlsx"
    if not path.is_file():
        return None
    return path, filename


def _write_status(dataset_id: UUID | str, job: dict[str, Any]) -> None:
    path = storage.synthetic_job_path(dataset_id, job["job_id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")


def _cast_column(sdtype: str, values: list[str | None]) -> list[Any]:
    if sdtype == "numerical":
        return [
            actions.parse_number(value) if value is not None else None
            for value in values
        ]
    if sdtype == "boolean":
        lookup = {
            "true": True,
            "false": False,
            "yes": True,
            "no": False,
            "1": True,
            "0": False,
        }
        return [lookup.get((value or "").strip().lower()) for value in values]
    return values


def _load_dataframe(
    dataset_id: UUID, meta: dict[str, Any], request: SyntheticRequest
) -> Any:
    """Load all dataset rows and cast them according to the chosen sdtypes."""
    import pandas as pd

    configs = {column.index: column for column in request.columns}
    indexes = [column.index for column in request.columns]
    names = _column_names(meta)
    column_meta = {column["index"]: column for column in meta["columns"]}

    raw: dict[int, list[str | None]] = {index: [] for index in indexes}
    with storage.rows_path(dataset_id).open("r", encoding="utf-8") as handle:
        for line in handle:
            row = json.loads(line)
            for index in indexes:
                raw[index].append(row[index] if index < len(row) else None)

    data: dict[str, Any] = {}
    for index, config in configs.items():
        if index not in column_meta:
            raise ValueError(f"Unknown column index: {index}")
        data[names[index]] = _cast_column(config.sdtype, raw[index])

    return pd.DataFrame(data)


def _build_metadata(meta: dict[str, Any], request: SyntheticRequest) -> Any:
    from sdv.metadata import Metadata

    names = _column_names(meta)
    metadata = Metadata()
    metadata.add_table(table_name=request.table_name)

    for config in request.columns:
        name = names[config.index]
        sdtype = config.sdtype.strip()
        # A primary key must use an id-like sdtype, so override the user's
        # choice for that column (it is generated as fresh identifiers).
        if request.primary_key == config.index:
            sdtype = "id"
            pii = False
        else:
            pii = config.pii
        kwargs: dict[str, Any] = {}
        if sdtype == "datetime":
            kwargs["datetime_format"] = _DATE_FORMAT
        if sdtype in _PII_SDTYPES:
            kwargs["pii"] = pii
        metadata.add_column(
            column_name=name, sdtype=sdtype, table_name=request.table_name, **kwargs
        )

    if request.primary_key is not None:
        metadata.set_primary_key(
            column_name=names[request.primary_key], table_name=request.table_name
        )

    metadata.validate()
    return metadata


def _run_job(
    dataset_id: UUID,
    meta: dict[str, Any],
    request: SyntheticRequest,
    job: dict[str, Any],
) -> None:
    job_id = job["job_id"]
    try:
        with _LOCK:
            job.update(phase="Loading data", progress=0.05)
        data = _load_dataframe(dataset_id, meta, request)

        with _LOCK:
            job.update(phase="Preparing metadata", progress=0.25)
        metadata = _build_metadata(meta, request)

        with _LOCK:
            job.update(phase="Training model", progress=0.4)
        from sdv.single_table import GaussianCopulaSynthesizer

        synthesizer = GaussianCopulaSynthesizer(metadata)
        synthesizer.fit({request.table_name: data})

        with _LOCK:
            job.update(phase="Generating synthetic data", progress=0.75)
        synthetic = synthesizer.sample(num_rows=request.num_rows)[
            request.table_name
        ]

        with _LOCK:
            job.update(phase="Writing file", progress=0.9)
        export_path = storage.synthetic_output_path(dataset_id, job_id)
        export_path.parent.mkdir(parents=True, exist_ok=True)
        synthetic.to_excel(export_path, index=False)

        stem = Path(str(meta.get("filename") or "dataset")).stem
        export_filename = f"{stem}_synthetic.xlsx"
        with _LOCK:
            job.update(
                status="completed",
                phase="Done",
                progress=1.0,
                output_rows=len(synthetic),
                export_filename=export_filename,
            )
        logger.info(
            f"[SYNTHETIC] job {job_id}: generated {len(synthetic)} rows"
        )
    except Exception as exc:  # noqa: BLE001 - surface any failure to the client
        logger.exception(f"[SYNTHETIC] job {job_id} failed")
        with _LOCK:
            job.update(status="failed", phase="Failed", error=str(exc))
    finally:
        with _LOCK:
            snapshot = dict(job)
        _write_status(dataset_id, snapshot)
        with _LOCK:
            _ACTIVE.pop(job_id, None)
