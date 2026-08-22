"""
Application configuration.
Loads all configuration from environment variables (.env locally, container vars in production).
"""
from pydantic import model_validator
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
    # Database (async driver)
    # ==========================================================
    DATABASE_URL: str = ""
    TEST_DATABASE_URL: str = "postgresql+asyncpg://epicare:epicare@localhost:5432/epicare_test"
    REDIS_URL: str = "redis://localhost:6379"

    # ==========================================================
    # JWT
    # ==========================================================
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_EXPIRY_MINUTES: int = 30
    JWT_REFRESH_EXPIRY_DAYS: int = 7
    JWT_ISSUER: str = "epicare-api"
    JWT_AUDIENCE: str = "epicare-client"

    # ==========================================================
    # Proxy / Network Security
    # ==========================================================
    TRUST_PROXY_HEADERS: bool = False
    TRUSTED_PROXY_IPS: str = "127.0.0.1"

    # ==========================================================
    # CORS
    # ==========================================================
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    VITE_FRONTEND_URL: str = "http://localhost:5173"

    # ==========================================================
    # Storage
    # ==========================================================
    STORAGE_PROVIDER: str = ""
    LOCAL_STORAGE_PATH: str = "storage"
    EEG_MAX_SIZE_MB: int = 200
    ALLOWED_EEG_EXTENSIONS: str = ""

    # ==========================================================
    # AWS S3 (only when STORAGE_PROVIDER=s3)
    # ==========================================================
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET_NAME: str = ""
    AWS_ENDPOINT_URL: str = ""

    # ==========================================================
    # Model Registry + ONNX Runtime
    # ==========================================================
    MODEL_ROOT: str = "models/seizure_detector"
    MODEL_NAME: str = "EpiCareFusion"
    ONNX_INTRA_OP_THREADS: int = 4
    ONNX_INTER_OP_THREADS: int = 2

    # ==========================================================
    # AI / LLM (OpenAI-compatible)
    # ==========================================================
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = ""
    EMBEDDING_MODEL: str = ""

    # ==========================================================
    # pgvector
    # ==========================================================
    VECTOR_DIMENSION: int = 1536

    # ==========================================================
    # Emergency SOS
    # ==========================================================
    SOS_PROVIDER: str = "firebase"  # 'email', 'firebase', 'whatsapp', or 'twilio'
    
    # Firebase Cloud Messaging & Web Push
    FIREBASE_CREDENTIALS_PATH: str = ""
    FIREBASE_PROJECT_ID: str = "epicare-2fc46"
    FIREBASE_WEB_API_KEY: str = ""
    FIREBASE_WEB_AUTH_DOMAIN: str = ""
    FIREBASE_STORAGE_BUCKET: str = ""
    FIREBASE_MESSAGING_SENDER_ID: str = ""
    FIREBASE_WEB_APP_ID: str = ""
    FIREBASE_WEB_VAPID_KEY: str = ""
    
    # WhatsApp (Meta Cloud API)
    WHATSAPP_TOKEN: str = ""
    WHATSAPP_PHONE_ID: str = ""
    
    # Twilio (Legacy/Optional)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # ==========================================================
    # APScheduler
    # ==========================================================
    SCHEDULER_ENABLED: bool = True
    SCHEDULER_JOBSTORE_URL: str = ""

    # ==========================================================
    # Email / Mailer
    # ==========================================================
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = ""
    MAIL_SERVER: str = ""
    MAIL_PORT: int = 587
    MAIL_FROM_NAME: str = "EpiCare"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False

    # Gmail API over HTTPS (used when SMTP is blocked, e.g. on Railway)
    GMAIL_CLIENT_ID: str = ""
    GMAIL_CLIENT_SECRET: str = ""
    GMAIL_REFRESH_TOKEN: str = ""

    # ==========================================================
    # Admin diagnostics and Superuser
    # ==========================================================
    ADMIN_API_KEY: str = ""
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    ADMIN_PHONE_NUMBER: str = ""
    ADMIN_FULL_NAME: str = ""

    # ==========================================================
    # Background Jobs
    # ==========================================================
    # (legacy flag kept for compatibility; scheduler uses SCHEDULER_ENABLED)

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        """Fail-secure validation for production environment (Finding 8)."""
        if self.APP_ENV == "production":
            if not self.JWT_SECRET or len(self.JWT_SECRET) < 32:
                raise ValueError("JWT_SECRET must be at least 32 characters in production")
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production")
            if not self.DATABASE_URL or "sqlite" in self.DATABASE_URL:
                raise ValueError("DATABASE_URL is required and cannot be SQLite in production")
            if not self.CORS_ORIGINS or "localhost" in self.CORS_ORIGINS or "*" in self.CORS_ORIGINS:
                raise ValueError("Production CORS_ORIGINS must be explicit and cannot allow localhost or wildcard")
            
            # Validate selected SOS provider credentials
            if self.SOS_PROVIDER == "whatsapp":
                if not self.WHATSAPP_TOKEN or not self.WHATSAPP_PHONE_ID:
                    raise ValueError("WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are required when SOS_PROVIDER='whatsapp'")
            elif self.SOS_PROVIDER == "twilio":
                if not self.TWILIO_ACCOUNT_SID or not self.TWILIO_AUTH_TOKEN or not self.TWILIO_FROM_NUMBER:
                    raise ValueError("Twilio credentials (SID, AUTH_TOKEN, FROM_NUMBER) are required when SOS_PROVIDER='twilio'")
            elif self.SOS_PROVIDER == "firebase":
                if not self.FIREBASE_CREDENTIALS_PATH and not self.FIREBASE_PROJECT_ID:
                    raise ValueError("Firebase credentials are required when SOS_PROVIDER='firebase'")
            elif self.SOS_PROVIDER == "email":
                if not self.MAIL_SERVER and not self.GMAIL_REFRESH_TOKEN:
                    raise ValueError("Email transport credentials (MAIL_SERVER or GMAIL_REFRESH_TOKEN) required when SOS_PROVIDER='email'")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
