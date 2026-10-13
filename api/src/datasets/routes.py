from pathlib import Path
from uuid import UUID, uuid7

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from starlette.concurrency import run_in_threadpool

from src.auth.deps import CurrentUser
from src.datasets import service
from src.datasets.dtos import DatasetPreview, RowsPage
from src.datasets.service import DatasetNotFoundError

datasets_router = APIRouter(prefix="/datasets", tags=["datasets"])

ALLOWED_SUFFIXES = {".xlsx"}


@datasets_router.post("", response_model=DatasetPreview)
async def upload_dataset(
    user: CurrentUser, file: UploadFile = File(...)
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
    dataset_id: UUID, user: CurrentUser
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
    user: CurrentUser,
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
