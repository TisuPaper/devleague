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
    
    # Gmail settings
    GMAIL_USER_ID: str = "me"
    GMAIL_SCOPES: list = ["https://www.googleapis.com/auth/gmail.readonly"]
    
    # File paths
    DOWNLOAD_DIR: str = "downloads"
    PROCESSED_DIR: str = "processed"
    CREDENTIALS_FILE: str = "credentials.json"
    TOKEN_FILE: str = "token.json"
    STATE_FILE: str = "gmail_state.json"

    # Reject attachments larger than this before extraction, as a guard
    # against decompression-bomb style files (e.g. a tiny .xlsx that expands
    # to gigabytes) tying up the server on untrusted, sender-supplied input.
    MAX_ATTACHMENT_SIZE_MB: int = 25

    # Gemini API settings for the financial-analysis step. Leave
    # GEMINI_API_KEY blank to skip AI analysis entirely (pipeline still runs
    # extraction/redaction and logs that analysis was skipped).
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"

    # Comma-separated sender-domain allowlist (e.g. "n2nconnect.com,other.com").
    # Blank (default) means no filtering -- every message in the watched
    # inbox gets processed. Case-insensitive.
    ALLOWED_SENDER_DOMAINS: str = ""

    # Optional display names for known client domains, so the dashboard can
    # show a proper legal entity name instead of a bare domain. Format:
    # "domain=Name,domain2=Name 2". Only affects presentation -- the domain
    # remains the identifier everything is keyed on.
    CLIENT_DISPLAY_NAMES: str = "n2nconnect.com=N2NConnect Sdn Bhd"

    # Optional industry labels per domain, same format as CLIENT_DISPLAY_NAMES.
    CLIENT_INDUSTRIES: str = "n2nconnect.com=Financial Technology"

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
    Path(settings.DOWNLOAD_DIR).mkdir(exist_ok=True)
    Path(settings.PROCESSED_DIR).mkdir(exist_ok=True)
