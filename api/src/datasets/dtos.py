from typing import Literal
from uuid import UUID

from pydantic import BaseModel

DetectedType = Literal[
    "NRIC",
    "PASSPORT",
    "DRIVING_LICENSE",
    "CARD",
    "PHONE",
    "EMAIL",
    "URL",
    "IP_ADDRESS",
    "DOB",
    "DATE",
    "AGE",
    "GENDER",
    "TITLE",
    "ADDRESS",
    "NAME",
    "UNKNOWN",
]

Sensitivity = Literal["PII", "INDIRECT_PII", "SENSITIVE", "UNKNOWN"]


class ColumnInfo(BaseModel):
    index: int
    header: str | None
    detected_type: DetectedType
    sensitivity: Sensitivity
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
