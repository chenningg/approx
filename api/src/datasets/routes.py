from pathlib import Path
from uuid import UUID, uuid7

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from src.auth.deps import AuthUserDep
from src.datasets import processing, service, synthetic
from src.datasets.dtos import (
    DatasetPreview,
    ProcessRequest,
    ProcessStatus,
    RowsPage,
    SyntheticDefaults,
    SyntheticRequest,
    SyntheticStatus,
)
from src.datasets.service import DatasetNotFoundError

datasets_router = APIRouter(prefix="/datasets", tags=["datasets"])

ALLOWED_SUFFIXES = {".xlsx"}


@datasets_router.post("", response_model=DatasetPreview)
async def upload_dataset(
    auth_user: AuthUserDep, file: UploadFile = File(...)
) -> DatasetPreview:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .xlsx Excel files are supported.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    dataset_id = uuid7()
    try:
        result = await run_in_threadpool(
            service.create_dataset,
            dataset_id,
            file.filename or f"{dataset_id}{suffix}",
            suffix,
            content,
        )
    except Exception as exc:  # noqa: BLE001 - surface parse errors to client
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse workbook: {exc}",
        ) from exc

    return DatasetPreview.model_validate(result)


@datasets_router.get("/{dataset_id}", response_model=DatasetPreview)
async def get_dataset(
    dataset_id: UUID, auth_user: AuthUserDep
) -> DatasetPreview:
    try:
        result = await run_in_threadpool(service.get_dataset, dataset_id)
    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        ) from exc
    return DatasetPreview.model_validate(result)


@datasets_router.get("/{dataset_id}/rows", response_model=RowsPage)
async def get_dataset_rows(
    dataset_id: UUID,
    auth_user: AuthUserDep,
    offset: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
) -> RowsPage:
    try:
        result = await run_in_threadpool(
            service.get_rows, dataset_id, offset, limit
        )
    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        ) from exc
    return RowsPage.model_validate(result)


@datasets_router.post("/{dataset_id}/process", response_model=ProcessStatus)
async def process_dataset(
    dataset_id: UUID, request: ProcessRequest, auth_user: AuthUserDep
) -> ProcessStatus:
    try:
        meta = await run_in_threadpool(service.get_meta, dataset_id)
    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        ) from exc

    valid = {column["index"] for column in meta["columns"]}
    unknown = [column.index for column in request.columns if column.index not in valid]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown column indexes: {unknown}",
        )

    job = processing.start_job(dataset_id, meta, request)
    return ProcessStatus.model_validate(job)


@datasets_router.get(
    "/{dataset_id}/process/{job_id}", response_model=ProcessStatus
)
async def get_process_status(
    dataset_id: UUID, job_id: str, auth_user: AuthUserDep
) -> ProcessStatus:
    try:
        job = await run_in_threadpool(processing.get_status, dataset_id, job_id)
    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processing job not found",
        ) from exc
    return ProcessStatus.model_validate(job)


@datasets_router.get("/{dataset_id}/process/{job_id}/export")
async def export_processed(
    dataset_id: UUID, job_id: str, auth_user: AuthUserDep
) -> FileResponse:
    found = await run_in_threadpool(processing.export_file, dataset_id, job_id)
    if found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Processed file not found",
        )
    path, filename = found
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )


@datasets_router.get(
    "/{dataset_id}/synthetic/suggest", response_model=SyntheticDefaults
)
async def suggest_synthetic_metadata(
    dataset_id: UUID, auth_user: AuthUserDep
) -> SyntheticDefaults:
    try:
        meta = await run_in_threadpool(service.get_meta, dataset_id)
    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        ) from exc
    return SyntheticDefaults.model_validate(synthetic.suggest_metadata(meta))


@datasets_router.post("/{dataset_id}/synthetic", response_model=SyntheticStatus)
async def generate_synthetic(
    dataset_id: UUID, request: SyntheticRequest, auth_user: AuthUserDep
) -> SyntheticStatus:
    if not request.table_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Table name is required",
        )
    try:
        meta = await run_in_threadpool(service.get_meta, dataset_id)
    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found"
        ) from exc

    valid = {column["index"] for column in meta["columns"]}
    unknown = [column.index for column in request.columns if column.index not in valid]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown column indexes: {unknown}",
        )
    if request.primary_key is not None and request.primary_key not in valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown primary key column index: {request.primary_key}",
        )
    try:
        synthetic.resolve_bounds(request)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    job = synthetic.start_job(dataset_id, meta, request)
    return SyntheticStatus.model_validate(job)


@datasets_router.get(
    "/{dataset_id}/synthetic/{job_id}", response_model=SyntheticStatus
)
async def get_synthetic_status(
    dataset_id: UUID, job_id: str, auth_user: AuthUserDep
) -> SyntheticStatus:
    try:
        job = await run_in_threadpool(synthetic.get_status, dataset_id, job_id)
    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Synthetic generation job not found",
        ) from exc
    return SyntheticStatus.model_validate(job)


@datasets_router.get("/{dataset_id}/synthetic/{job_id}/export")
async def export_synthetic(
    dataset_id: UUID, job_id: str, auth_user: AuthUserDep
) -> FileResponse:
    found = await run_in_threadpool(synthetic.export_file, dataset_id, job_id)
    if found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Synthetic file not found",
        )
    path, filename = found
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=filename,
    )
