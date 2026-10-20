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

Sensitivity = Literal[
    "PII", "INDIRECT_PII", "SENSITIVE", "NON_SENSITIVE", "UNKNOWN"
]

ColumnAction = Literal[
    "keep", "remove", "redact", "generalize"
]


class ColumnInfo(BaseModel):
    index: int
    header: str | None
    detected_type: DetectedType
    sensitivity: Sensitivity
    confidence: float
    sample_values: list[str]
    # Numeric range over the column (None when it holds no numbers); drives
    # bucket boundaries for generalize in the frontend. Optional so datasets
    # stored before these fields existed still validate.
    numeric_min: float | None = None
    numeric_max: float | None = None
    # Sensitivity x categorizability default (see src/datasets/actions.py).
    # Optional so datasets stored before this field existed still validate.
    default_action: ColumnAction | None = None


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
