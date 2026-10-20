from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

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


class RedactSettings(BaseModel):
    mode: Literal["type_aware", "custom"] = "type_aware"
    percentage: int = Field(default=100, ge=0, le=100)


class GeneralizeSettings(BaseModel):
    method: Literal["age", "dob", "numeric"] = "numeric"
    age_band: int = Field(default=10, ge=1)
    dob_width: Literal["month", "quarter", "year", "decade"] = "year"
    buckets: int = Field(default=5, ge=1)


class ProcessColumnConfig(BaseModel):
    index: int
    action: ColumnAction = "keep"
    redact: RedactSettings = RedactSettings()
    generalize: GeneralizeSettings = GeneralizeSettings()


class ProcessRequest(BaseModel):
    columns: list[ProcessColumnConfig]


class ProcessStatus(BaseModel):
    job_id: str
    status: Literal["running", "completed", "failed"]
    progress: float
    phase: str
    processed_rows: int
    total_rows: int
    error: str | None = None
    export_filename: str | None = None
    output_columns: int | None = None
    output_rows: int | None = None
