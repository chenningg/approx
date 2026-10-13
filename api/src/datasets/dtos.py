from typing import Literal
from uuid import UUID

from pydantic import BaseModel

DetectedType = Literal[
    "NRIC",
    "CARD",
    "DOB",
    "GENDER",
    "ADDRESS",
    "NAME",
    "UNKNOWN",
]


class ColumnInfo(BaseModel):
    index: int
    header: str | None
    detected_type: DetectedType
    confidence: float
    sample_values: list[str]


class DatasetPreview(BaseModel):
    id: UUID
    filename: str
    size: int
    sheet: str
    sheets: list[str]
    total_rows: int
    columns: list[ColumnInfo]
    rows: list[list[str | None]]


class RowsPage(BaseModel):
    offset: int
    limit: int
    total: int
    rows: list[list[str | None]]
