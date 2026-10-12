from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Need to add NoDecode to prevent Pydantic from auto parsing as JSON
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    db_url: str = "postgresql+asyncpg://approx:approx@localhost:5432/approx"
    redis_url: str = "redis://localhost:6379/0"

    auth_session_cookie_name: str = "approx_sid"
    auth_session_ttl_seconds: int = 7 * 24 * 60 * 60  # 7 days

    # Read in lists of strings
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_str_list(cls, value):
        if isinstance(value, str):
            return [x.strip() for x in value.split(",") if x.strip()]
        return value


# Export as a singleton object
config = Config()
