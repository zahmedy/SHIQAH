from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_root_env_file() -> str:
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / ".env"
        if candidate.exists():
            return str(candidate)
    return ".env"


ROOT_ENV_FILE = _resolve_root_env_file()

class Settings(BaseSettings):
    ENV: str = "dev"

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    DATABASE_URL: str

    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 30

    OPENSEARCH_URL: str = "http://localhost:9200"
    OPENSEARCH_INDEX: str = "autointel_cars"

    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "autointel-media"
    S3_PRESIGN_BASE_URL: str | None = None
    S3_PUBLIC_BASE_URL: str = "http://localhost:9000/autointel-media"

    OPENAI_API_KEY: str | None = None
    OPENAI_TEXT_MODEL: str = "gpt-4o-mini"
    VIN_SCAN_DEBUG: bool = False
    VIN_OCR_PROVIDER: str = "auto"
    VIN_OCR_AWS_REGION: str = "us-east-1"
    VIN_OCR_AWS_ACCESS_KEY_ID: str | None = None
    VIN_OCR_AWS_SECRET_ACCESS_KEY: str | None = None
    VIN_OCR_AWS_SESSION_TOKEN: str | None = None
    VIN_OCR_MIN_CONFIDENCE: float = 45.0
    TESSERACT_CMD: str | None = None

    model_config = SettingsConfigDict(
        env_file=(ROOT_ENV_FILE, ".env"),
        extra="ignore",
    )

settings = Settings()
