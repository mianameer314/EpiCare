"""
Application configuration.
Loads all configuration from environment variables (.env locally, container vars in production).
Mirrors the BRANDING-SYSTEM config pattern (pydantic-settings + sectioned fields).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ==========================================================
    # Application
    # ==========================================================
    APP_NAME: str = "EpiCare AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # ==========================================================
    # Database
    # ==========================================================
    DATABASE_URL: str = "postgresql://epicare:epicare@localhost:5432/epicare"
    REDIS_URL: str = "redis://localhost:6379"

    # ==========================================================
    # JWT
    # ==========================================================
    JWT_SECRET: str = "change_me_in_production_at_least_32_chars_long"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRY_MINUTES: int = 30
    JWT_REFRESH_EXPIRY_DAYS: int = 7

    # ==========================================================
    # CORS
    # ==========================================================
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    VITE_FRONTEND_URL: str = "http://localhost:5173"

    # ==========================================================
    # Storage
    # ==========================================================
    STORAGE_PROVIDER: str = "local"
    LOCAL_STORAGE_PATH: str = "storage"
    EEG_MAX_SIZE_MB: int = 200
    ALLOWED_EEG_EXTENSIONS: str = ".edf,.csv"

    # ==========================================================
    # AWS S3 (only when STORAGE_PROVIDER=s3)
    # ==========================================================
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET_NAME: str = ""
    AWS_ENDPOINT_URL: str = ""

    # ==========================================================
    # Model Registry
    # ==========================================================
    MODEL_ROOT: str = "models/seizure_detector"
    MODEL_NAME: str = "EpiCareFusion"

    # ==========================================================
    # AI / LLM (OpenAI-compatible)
    # ==========================================================
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # ==========================================================
    # Twilio (SOS SMS)
    # ==========================================================
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # ==========================================================
    # Background Jobs
    # ==========================================================
    SCHEDULER_ENABLED: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
