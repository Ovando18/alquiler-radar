"""Orquestra a busca: cache por portal → scraping paralelo e resiliente → pós-filtro → deduplicação."""
from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone

from . import dedup, postfilter
from .db import Store, filters_hash
from .fetcher import AntiBotFetcher, BlockedError, FetchError
from .models import RawListing, SearchFilters, SearchResponse, SourceStatus
from .scrapers.base import BaseScraper, UnsupportedSearch

log = logging.getLogger("service")


class SearchService:
    def __init__(self, fetcher: AntiBotFetcher, store: Store, scrapers: dict[str, BaseScraper], portal_timeout_s: float):
        self.fetcher = fetcher
        self.store = store
        self.scrapers = scrapers
        self.portal_timeout_s = portal_timeout_s

    async def _one(self, portal: str, f: SearchFilters, fhash: str) -> tuple[list[RawListing], SourceStatus]:
        t0 = time.perf_counter()
        ms = lambda: int((time.perf_counter() - t0) * 1000)  # noqa: E731
        scraper = self.scrapers.get(portal)
        if not scraper:
            return [], SourceStatus(portal=portal, status="skipped", error="portal desconhecido")

        try:
            cached = await self.store.get(fhash, portal)
        except Exception:  # noqa: BLE001 — cache indisponível não derruba a busca
            log.exception("cache get falhou")
            cached = None
        if cached is not None:
            items = [RawListing(**x) for x in cached]
            await self._safe_usage(provider="cache", portal=portal, url=None, success=True, status_code=None, duration_ms=ms(), error=None)
            return items, SourceStatus(portal=portal, status="cached", count=len(items), duration_ms=ms())

        try:
            items = await asyncio.wait_for(scraper.search(f, self.fetcher), timeout=self.portal_timeout_s)
        except UnsupportedSearch as e:
            return [], SourceStatus(portal=portal, status="skipped", error=str(e), duration_ms=ms())
        except asyncio.TimeoutError:
            return [], SourceStatus(portal=portal, status="timeout", error=f"sem resposta em {self.portal_timeout_s:.0f}s", duration_ms=ms())
        except BlockedError as e:
            return [], SourceStatus(portal=portal, status="blocked", error=str(e)[:300], duration_ms=ms())
        except FetchError as e:
            return [], SourceStatus(portal=portal, status="error", error=str(e)[:300], duration_ms=ms())
        except Exception as e:  # noqa: BLE001 — bug num parser afeta só o próprio portal
            log.exception("%s falhou", portal)
            return [], SourceStatus(portal=portal, status="error", error=f"{type(e).__name__}: {e}"[:300], duration_ms=ms())

        try:
            await self.store.put(fhash, portal, f, [x.model_dump() for x in items])
        except Exception:  # noqa: BLE001
            log.exception("cache put falhou")
        return items, SourceStatus(portal=portal, status="ok", count=len(items), duration_ms=ms())

    async def _safe_usage(self, **kw) -> None:
        try:
            await self.store.log_usage(**kw)
        except Exception:  # noqa: BLE001
            log.exception("usage log falhou")

    async def search(self, f: SearchFilters) -> SearchResponse:
        fhash = filters_hash(f)
        portals = list(dict.fromkeys(f.portales))
        results = await asyncio.gather(*(self._one(p, f, fhash) for p in portals))

        raw: list[RawListing] = []
        statuses: list[SourceStatus] = []
        for items, st in results:
            kept = postfilter.apply(items, f)
            st.count = len(kept)
            raw.extend(kept)
            statuses.append(st)

        listings = dedup.rank(dedup.group(raw))
        return SearchResponse(
            results=listings,
            sources=statuses,
            filters_hash=fhash,
            generated_at=datetime.now(timezone.utc).isoformat(),
            total_raw=len(raw),
        )
