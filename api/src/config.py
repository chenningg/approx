from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    database_url: str = "postgresql+asyncpg://approx:approx@localhost:5432/approx"
    redis_url: str = "redis://localhost:6379/0"

    auth_session_cookie_name: str = "approx_sid"
    auth_session_ttl_seconds: int = 7 * 24 * 60 * 60  # 7 days


# Export as a singleton object
config = Config()
