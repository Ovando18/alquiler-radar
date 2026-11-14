from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Segurança entre Next.js e este serviço
    scraper_internal_token: str = "dev-token-change-me"

    # Anti-bloqueio
    scraping_provider: Literal["zenrows", "scraperapi"] = "zenrows"
    zenrows_api_key: str | None = None
    scraperapi_key: str | None = None
    scraping_fallback_enabled: bool = True          # tenta o outro provedor se o primário falhar
    scraperapi_ultra_premium: bool = False          # para alvos muito protegidos (custa mais)
    playwright_fallback: bool = False               # apenas portais não protegidos
    max_concurrency: int = 6
    request_timeout_s: float = 90.0
    portal_timeout_s: float = 100.0
    retries_per_provider: int = 1

    # Cache (PostgreSQL do Supabase). Sem DATABASE_URL usa cache em memória.
    database_url: str | None = None
    cache_ttl_hours: float = 6.0

    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
