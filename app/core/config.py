"""
app/core/config.py
──────────────────
Centralised settings loaded from environment / .env file.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Groq ───────────────────────────────────────────────────────────────────
    groq_api_key: str = ""

    # ── Google Gemini (kept for future) ───────────────────────────────────────
    gemini_api_key: str = ""
    gemini_model:   str = "gemini-2.0-flash"

    # ── OpenAI (optional) ─────────────────────────────────────────────────────
    openai_api_key: str = ""

    # ── Database ───────────────────────────────────────────────────────────────
    database_url: str = "sqlite:///./career_accelerator.db"

    # ── App ────────────────────────────────────────────────────────────────────
    app_env:            str = "development"
    log_level:          str = "INFO"
    max_pdf_size_bytes: int = 10 * 1024 * 1024

    # ── Auth ───────────────────────────────────────────────────────────────────
    secret_key:                  str = "change-me-in-production"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days:   int = 7
    algorithm:                   str = "HS256"

    # ── Phase 3: Email (Resend) ────────────────────────────────────────────────
    resend_api_key:  str = ""
    email_from:      str = "noreply@careerai.dev"
    frontend_url:    str = "http://localhost:3000"
    api_base_url:    str = "http://localhost:8000"

    # ── Phase 3: Auto-matching ─────────────────────────────────────────────────
    auto_match_enabled:        bool = True
    auto_match_min_score:      int  = 70
    auto_match_interval_hours: int  = 24


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()