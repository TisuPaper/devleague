"""Application configuration using pydantic-settings"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # App settings
    APP_NAME: str = "Financial Email Receiver"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Google Cloud settings
    GOOGLE_CLOUD_PROJECT_ID: str = ""
    GMAIL_PUBSUB_TOPIC: str = "finance-mail"

    # Optional shared-secret check on the Pub/Sub push webhook.
    # If set, incoming requests must include a matching ?token= query param.
    # Leave blank only for local hackathon testing; see README "Security Notes".
    PUBSUB_VERIFICATION_TOKEN: str = ""
    
    # Gemini AI settings
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Gmail settings
    GMAIL_USER_ID: str = "me"
    GMAIL_SCOPES: list = ["https://www.googleapis.com/auth/gmail.readonly"]
    
    # File paths
    DOWNLOAD_DIR: str = "downloads"
    CREDENTIALS_FILE: str = "credentials.json"
    TOKEN_FILE: str = "token.json"
    STATE_FILE: str = "gmail_state.json"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


def get_settings() -> Settings:
    """Get application settings"""
    return Settings()


def ensure_directories():
    """Ensure required directories exist"""
    settings = get_settings()
    download_dir = Path(settings.DOWNLOAD_DIR)
    download_dir.mkdir(exist_ok=True)
