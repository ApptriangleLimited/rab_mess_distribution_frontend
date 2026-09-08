from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    tz: str = "Asia/Dhaka"
    database_url: str = "postgresql+psycopg://mess:mess@127.0.0.1:5432/mess"
    redis_url: str = "redis://127.0.0.1:6379/0"
    jwt_secret: str = "change-me-in-prod-use-32b-plus-secret"
    jwt_expires_in: int = 28800
    seed_staff_password: str = "ChangeMe!"
    seed_on_start: bool = True
    cors_origins: str = "http://localhost:3000"
    prom_enable: bool = True
    log_level: str = "INFO"
    zk_demo: bool = False
    zk_host: str = "192.168.1.50"
    zk_port: int = 4370
    docs_dir: str = "data/docs"
    backup_dir: str = "data/backups"
    backup_keep_days: int = 28
    qr_secret: str = ""
    qr_ttl_seconds: int = 7 * 24 * 3600
    register_token_required: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
