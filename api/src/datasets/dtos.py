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
    "NUMERIC",
    "TEXT",
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
    # Date range over the column as ISO strings (None when it holds no ISO
    # dates); pre-fills the allowed range for datetime columns in synthetic
    # generation. Optional so datasets stored before this field existed still
    # validate.
    datetime_min: str | None = None
    datetime_max: str | None = None
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


class SyntheticColumnConfig(BaseModel):
    index: int
    sdtype: str = Field(min_length=1)
    pii: bool = False
    # Allowed range for the generated values. Strings so the same field
    # carries numbers and ISO dates; only meaningful for numerical and
    # datetime columns.
    min_value: str | None = None
    max_value: str | None = None


class SyntheticRequest(BaseModel):
    table_name: str = Field(min_length=1, max_length=63)
    primary_key: int | None = None
    num_rows: int = Field(default=100, ge=1, le=1_000_000)
    columns: list[SyntheticColumnConfig]


class SyntheticColumnDefaults(BaseModel):
    index: int
    header: str | None
    sdtype: str
    pii: bool
    min_value: str | None = None
    max_value: str | None = None


class SyntheticDefaults(BaseModel):
    table_name: str
    suggested_primary_key: int | None
    default_num_rows: int
    columns: list[SyntheticColumnDefaults]


class SyntheticStatus(BaseModel):
    job_id: str
    status: Literal["running", "completed", "failed"]
    progress: float
    phase: str
    total_rows: int
    error: str | None = None
    export_filename: str | None = None
    output_rows: int | None = None
