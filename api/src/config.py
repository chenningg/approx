from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    auth_session_cookie_name: str = "approx_sid"
    auth_session_ttl_seconds: int = 7 * 24 * 60 * 60  # 7 days
    auth_enabled: bool = False
    # Need to add NoDecode to prevent Pydantic from auto parsing as JSON
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    data_dir: str = "data"
    db_url: str = "postgresql+asyncpg://approx:approx@localhost:5432/approx"
    redis_url: str = "redis://localhost:6379/0"
    # laya-serve (POST /v1/systemone). Host-side default; in Docker use
    # LAYA_BASE_URL=http://laya-serve:8000 (see .env.example).
    laya_base_url: str = "http://127.0.0.1:8000"
    # Column detection consults laya-serve only for uncertain columns; failures
    # degrade to heuristics. min_confidence gates Laya's answers (abstentions
    # keep the heuristic result), timeout is the per-call client timeout (s).
    laya_detect_enabled: bool = True
    laya_detect_min_confidence: float = 0.5
    laya_detect_timeout: float = 30.0
    laya_api_key: str | None = None

    # Read in lists of strings
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_str_list(cls, value):
        if isinstance(value, str):
            return [x.strip() for x in value.split(",") if x.strip()]
        return value


# Export as a singleton object
config = Config()
