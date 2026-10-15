import os


def _flag(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    app_env: str
    app_secret: str
    jwt_secret: str
    jwt_expires_seconds: int
    jwt_refresh_expires_seconds: int
    seed_staff: bool
    seed_staff_password: str
    cors_origins: list[str]
    login_fail_limit: int
    login_fail_window: int
    register_limit: int
    register_window: int
    reset_limit: int
    reset_window: int
    redis_url: str
    redis_password: str
    redis_db: int
    allow_create_all: bool
    mfa_required_roles: set[str]
    enable_hsts: bool
    public_app_url: str
    smtp_host: str
    smtp_port: int
    smtp_username: str
    smtp_password: str
    smtp_from: str
    smtp_use_tls: bool
    storage_backend: str
    storage_local_path: str
    storage_endpoint: str
    storage_bucket: str
    storage_region: str
    storage_access_key: str
    storage_secret_key: str
    max_upload_bytes: int
    zk_enabled: bool
    zk_host: str
    zk_port: int
    zk_timeout: int
    zk_password: int
    zk_force_udp: bool

    def __init__(self) -> None:
        self.app_env = os.getenv("APP_ENV", "development").strip().lower()
        self.app_secret = os.getenv("APP_SECRET") or os.getenv("JWT_SECRET", "dev-only-change-me")
        self.jwt_secret = os.getenv("JWT_SECRET", "dev-only-change-me")
        self.jwt_expires_seconds = int(os.getenv("JWT_EXPIRES_SECONDS", "7200"))
        self.jwt_refresh_expires_seconds = int(os.getenv("JWT_REFRESH_EXPIRES_SECONDS", "7200"))
        self.seed_staff = _flag("SEED_STAFF", "true" if self.app_env != "production" else "false")
        self.seed_staff_password = os.getenv("SEED_STAFF_PASSWORD", "ChangeMe!")
        raw = os.getenv("CORS_ORIGINS") or os.getenv("ALLOWED_ORIGINS") or (
            "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
        )
        self.cors_origins = [item.strip() for item in raw.split(",") if item.strip()]
        if self.app_env == "production":
            for origin in (
                "https://ms.apptriangle.com",
                "https://www.ms.apptriangle.com",
            ):
                if origin not in self.cors_origins:
                    self.cors_origins.append(origin)
        self.login_fail_limit = int(os.getenv("LOGIN_FAIL_LIMIT", "8"))
        self.login_fail_window = int(os.getenv("LOGIN_FAIL_WINDOW_SECONDS", "900"))
        self.register_limit = int(os.getenv("REGISTER_LIMIT", "10"))
        self.register_window = int(os.getenv("REGISTER_WINDOW_SECONDS", "3600"))
        self.reset_limit = int(os.getenv("RESET_LIMIT", "5"))
        self.reset_window = int(os.getenv("RESET_WINDOW_SECONDS", "3600"))
        self.redis_url = os.getenv("REDIS_URL", "redis://127.0.0.1:6380/0")
        self.redis_password = os.getenv("REDIS_PASSWORD", "")
        self.redis_db = int(os.getenv("REDIS_DB", "0"))
        self.allow_create_all = _flag("ALLOW_CREATE_ALL", "false")
        roles = os.getenv("MFA_REQUIRED_ROLES", "")
        self.mfa_required_roles = {item.strip() for item in roles.split(",") if item.strip()}
        self.enable_hsts = _flag("ENABLE_HSTS", "false")
        self.public_app_url = os.getenv("PUBLIC_APP_URL", "http://localhost:3000").rstrip("/")
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_username = os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from = os.getenv("SMTP_FROM", "")
        self.smtp_use_tls = _flag("SMTP_USE_TLS", "true")
        self.storage_backend = os.getenv("STORAGE_BACKEND", "local").strip().lower()
        self.storage_local_path = os.getenv("STORAGE_LOCAL_PATH", "/var/lib/rab-mess/files")
        self.storage_endpoint = os.getenv("STORAGE_ENDPOINT", "")
        self.storage_bucket = os.getenv("STORAGE_BUCKET", "")
        self.storage_region = os.getenv("STORAGE_REGION", "us-east-1")
        self.storage_access_key = os.getenv("STORAGE_ACCESS_KEY", "")
        self.storage_secret_key = os.getenv("STORAGE_SECRET_KEY", "")
        self.max_upload_bytes = int(os.getenv("MAX_UPLOAD_BYTES", str(32 * 1024 * 1024)))
        self.zk_enabled = _flag("ZK_ENABLED", "true")
        self.zk_host = os.getenv("ZK_HOST", "192.168.9.111").strip()
        self.zk_port = int(os.getenv("ZK_PORT", "4370") or "4370")
        self.zk_timeout = int(os.getenv("ZK_TIMEOUT", "10") or "10")
        try:
            self.zk_password = int(os.getenv("ZK_PASSWORD", "0") or "0")
        except ValueError:
            self.zk_password = 0
        self.zk_force_udp = _flag("ZK_FORCE_UDP", "false")

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    def assert_secure(self) -> None:
        if not self.is_production:
            return
        weak = {
            "",
            "dev-only-change-me",
            "local-dev-cc-jwt-secret-change-me",
            "change-this-to-a-long-random-string",
            "ChangeMe!",
            "mess",
            "password",
            "secret",
        }
        if self.jwt_secret in weak or len(self.jwt_secret) < 32:
            raise RuntimeError("JWT_SECRET must be a long random value in production")
        if self.app_secret in weak or len(self.app_secret) < 32:
            raise RuntimeError("APP_SECRET must be a long random value in production")
        if not self.redis_password or self.redis_password in weak:
            raise RuntimeError("REDIS_PASSWORD is required in production")
        db_password = os.getenv("POSTGRES_PASSWORD") or os.getenv("DATABASE_PASSWORD") or ""
        if db_password in weak:
            raise RuntimeError("DATABASE_PASSWORD / POSTGRES_PASSWORD must be strong in production")
        if "*" in self.cors_origins:
            raise RuntimeError("CORS_ORIGINS must be explicit in production (no *)")
        if self.storage_backend == "s3" and not self.storage_secret_key:
            raise RuntimeError("STORAGE_SECRET_KEY is required when STORAGE_BACKEND=s3")


settings = Settings()
