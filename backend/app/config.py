"""Application configuration loaded from environment / .env file."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "Verdict"
    secret_key: str = "dev-insecure-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    environment: str = "development"

    database_url: str = "sqlite:///./data/app.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # LLM providers: anthropic | openai | gemini | mock
    llm_provider: str = "mock"
    llm_model: str = "gemini-2.5-flash"
    llm_base_url: str = "https://openrouter.ai/api/v1"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""

    # STT
    groq_api_key: str = ""
    stt_model: str = "whisper-large-v3"
    max_audio_mb: int = 25

    # Uploads
    upload_dir: str = "./uploads"
    max_upload_mb: int = 15

    # Rate limit
    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def effective_provider(self) -> str:
        """Fall back to mock if the selected live provider has no API key."""
        provider = self.llm_provider.strip().lower()
        if provider == "anthropic" and not self.anthropic_api_key.strip():
            return "mock"
        if provider == "openai" and not self.openai_api_key.strip():
            return "mock"
        if provider == "gemini" and not self.gemini_api_key.strip():
            return "mock"
        if provider in {"anthropic", "openai", "gemini", "mock"}:
            return provider
        return "mock"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()