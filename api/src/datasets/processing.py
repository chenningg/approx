"""Background processing jobs that apply column transformations server-side.

Job status lives in two places: an in-memory registry (source of truth for
running jobs, updated as chunks stream past) and a small JSON file per job
under ``{dataset}/jobs/`` (survives restarts). A status file that still says
"running" but whose job is no longer in the registry was interrupted by a
restart and is reported as failed so the client can offer a retry.
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

from src.datasets import storage, transforms
from src.datasets.dtos import ProcessColumnConfig, ProcessRequest
from src.datasets.service import DatasetNotFoundError

_ACTIVE: dict[str, dict[str, Any]] = {}
_LOCK = threading.Lock()
_PROGRESS_CHUNK = 1000


def _write_status(dataset_id: UUID | str, job: dict[str, Any]) -> None:
    path = storage.job_path(dataset_id, job["job_id"])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")


def _resolve_columns(
    meta: dict[str, Any], request: ProcessRequest
) -> dict[int, ProcessColumnConfig]:
    by_index = {column.index: column for column in request.columns}
    resolved: dict[int, ProcessColumnConfig] = {}
    for column in meta["columns"]:
        index = column["index"]
        config = by_index.get(index)
        resolved[index] = (
            config
            if config is not None
            else ProcessColumnConfig(index=index, action="keep")
        )
    return resolved


def start_job(
    dataset_id: UUID, meta: dict[str, Any], request: ProcessRequest
) -> dict[str, Any]:
    job_id = str(uuid7())
    job: dict[str, Any] = {
        "job_id": job_id,
        "dataset_id": str(dataset_id),
        "status": "running",
        "progress": 0.0,
        "phase": "Starting",
        "processed_rows": 0,
        "total_rows": int(meta.get("total_rows", 0)),
        "error": None,
        "export_filename": None,
        "output_columns": None,
        "output_rows": None,
    }
    configs = _resolve_columns(meta, request)
    with _LOCK:
        _ACTIVE[job_id] = job
    _write_status(dataset_id, job)
    asyncio.create_task(run_in_threadpool(_run_job, dataset_id, meta, configs, job))
    return dict(job)


def get_status(dataset_id: UUID | str, job_id: str) -> dict[str, Any]:
    with _LOCK:
        job = _ACTIVE.get(job_id)
        if job is not None:
            return dict(job)

    path = storage.job_path(dataset_id, job_id)
    if not path.is_file():
        raise DatasetNotFoundError(job_id)
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    if data.get("status") == "running":
        # The server restarted while this job was in flight.
        data["status"] = "failed"
        data["error"] = (
            "Processing was interrupted (the server restarted). Try again."
        )
        _write_status(dataset_id, data)
    return data


def export_file(
    dataset_id: UUID | str, job_id: str
) -> tuple[Path, str] | None:
    with _LOCK:
        if job_id in _ACTIVE:
            return None
    status_path = storage.job_path(dataset_id, job_id)
    if not status_path.is_file():
        return None
    data: dict[str, Any] = json.loads(status_path.read_text(encoding="utf-8"))
    if data.get("status") != "completed":
        return None
    path = storage.processed_path(dataset_id, job_id)
    filename = data.get("export_filename") or f"{job_id}.xlsx"
    if not path.is_file():
        return None
    return path, filename


def _transform(
    column_meta: dict[str, Any], value: str | None, config: ProcessColumnConfig
) -> str | None:
    if config.action == "redact":
        return transforms.mask_value(
            column_meta.get("detected_type", "UNKNOWN"),
            value,
            config.redact.mode,
            config.redact.percentage,
        )
    if config.action == "generalize":
        general = config.generalize
        return transforms.generalize_value(
            column_meta,
            value,
            general.method,
            general.age_band,
            general.dob_width,
            general.buckets,
        )
    return value


def _run_job(
    dataset_id: UUID,
    meta: dict[str, Any],
    configs: dict[int, ProcessColumnConfig],
    job: dict[str, Any],
) -> None:
    job_id = job["job_id"]
    try:
        total = int(meta.get("total_rows", 0))
        columns_by_index = {column["index"]: column for column in meta["columns"]}
        kept = [
            (index, config)
            for index, config in sorted(configs.items())
            if config.action != "remove"
        ]
        with _LOCK:
            job.update(phase="Transforming rows", progress=0.05, total_rows=total)

        out_rows: list[list[str | None]] = []
        processed = 0
        with storage.rows_path(dataset_id).open("r", encoding="utf-8") as handle:
            for line in handle:
                row = json.loads(line)
                out_rows.append(
                    [
                        _transform(
                            columns_by_index[index],
                            row[index] if index < len(row) else None,
                            config,
                        )
                        for index, config in kept
                    ]
                )
                processed += 1
                if processed % _PROGRESS_CHUNK == 0:
                    fraction = processed / max(total, 1)
                    with _LOCK:
                        job.update(
                            processed_rows=processed,
                            progress=min(0.9, 0.05 + 0.85 * fraction),
                        )

        with _LOCK:
            job.update(phase="Writing file", progress=0.92, processed_rows=processed)

        from openpyxl import Workbook

        workbook = Workbook(write_only=True)
        worksheet = workbook.create_sheet(
            title=str(meta.get("sheet") or "Sheet")[:31]
        )
        worksheet.append(
            [columns_by_index[index].get("header") for index, _ in kept]
        )
        for row in out_rows:
            worksheet.append(row)
        export_path = storage.processed_path(dataset_id, job_id)
        export_path.parent.mkdir(parents=True, exist_ok=True)
        workbook.save(str(export_path))

        stem = Path(str(meta.get("filename") or "dataset")).stem
        export_filename = f"{stem}_transformed.xlsx"
        with _LOCK:
            job.update(
                status="completed",
                phase="Done",
                progress=1.0,
                output_rows=len(out_rows),
                output_columns=len(kept),
                export_filename=export_filename,
            )
        logger.info(
            f"[PROCESS] job {job_id}: {processed} rows -> {export_filename}"
        )
    except Exception as exc:  # noqa: BLE001 - surface any failure to the client
        logger.exception(f"[PROCESS] job {job_id} failed")
        with _LOCK:
            job.update(status="failed", phase="Failed", error=str(exc))
    finally:
        with _LOCK:
            snapshot = dict(job)
        _write_status(dataset_id, snapshot)
        with _LOCK:
            _ACTIVE.pop(job_id, None)
