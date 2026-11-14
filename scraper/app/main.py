"""AlquilerRadar — microserviço de scraping (FastAPI)."""
from __future__ import annotations

import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException

from .config import get_settings
from .db import Store
from .fetcher import AntiBotFetcher
from .models import SearchFilters, SearchResponse
from .scrapers.registry import SCRAPERS
from .service import SearchService

settings = get_settings()
logging.basicConfig(level=settings.log_level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = Store(settings.database_url, settings.cache_ttl_hours)
    await store.connect()
    fetcher = AntiBotFetcher(settings, usage_logger=store.log_usage)
    app.state.store = store
    app.state.fetcher = fetcher
    app.state.service = SearchService(fetcher, store, SCRAPERS, settings.portal_timeout_s)
    yield
    await fetcher.aclose()
    await store.close()


app = FastAPI(title="AlquilerRadar Scraper", version="1.0.0", lifespan=lifespan)


def require_token(x_internal_token: str = Header(default="")) -> None:
    if not hmac.compare_digest(x_internal_token, settings.scraper_internal_token):
        raise HTTPException(status_code=401, detail="invalid token")


@app.get("/health")
async def health():
    fetcher: AntiBotFetcher = app.state.fetcher
    return {
        "ok": True,
        "providers": fetcher.providers(),
        "primary": settings.scraping_provider,
        "cache": "postgres" if app.state.store.pool else "memory",
    }


@app.get("/portals", dependencies=[Depends(require_token)])
async def portals():
    return [
        {"portal": s.portal, "protected": s.protected, "js_render": s.js_render, "contratos": sorted(s.contratos)}
        for s in SCRAPERS.values()
    ]


@app.post("/search", response_model=SearchResponse, dependencies=[Depends(require_token)])
async def search(filters: SearchFilters) -> SearchResponse:
    if not filters.place:
        raise HTTPException(status_code=400, detail="Informe ciudad ou provincia")
    return await app.state.service.search(filters)
