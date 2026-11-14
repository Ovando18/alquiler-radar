"""Cache por (filtros, portal) e contador de uso — PostgreSQL do Supabase via asyncpg.
Sem DATABASE_URL, usa memória (desenvolvimento/testes)."""
from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import datetime, timedelta, timezone

from .models import SearchFilters

log = logging.getLogger("db")


def filters_hash(f: SearchFilters) -> str:
    """Hash estável dos filtros que afetam o resultado de UM portal (exclui a lista de portais)."""
    data = f.model_dump(exclude={"portales"})
    for k, v in list(data.items()):
        if isinstance(v, list):
            data[k] = sorted(v)
        elif isinstance(v, str):
            data[k] = v.strip().lower()
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def cache_key(fhash: str, portal: str) -> str:
    return hashlib.sha256(f"{fhash}:{portal}".encode()).hexdigest()


class Store:
    def __init__(self, database_url: str | None, ttl_hours: float):
        self.url = database_url
        self.ttl = timedelta(hours=ttl_hours)
        self.pool = None
        self._mem: dict[str, tuple[float, list[dict]]] = {}
        self.usage_mem: list[dict] = []

    async def connect(self) -> None:
        if not self.url:
            log.warning("DATABASE_URL ausente — cache em memória")
            return
        import asyncpg

        # statement_cache_size=0: compatível com o pooler (pgbouncer) do Supabase em modo transaction
        self.pool = await asyncpg.create_pool(self.url, min_size=1, max_size=5, statement_cache_size=0)

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()

    async def get(self, fhash: str, portal: str) -> list[dict] | None:
        key = cache_key(fhash, portal)
        if not self.pool:
            hit = self._mem.get(key)
            return hit[1] if hit and hit[0] > time.time() else None
        row = await self.pool.fetchrow(
            "select results from public.search_cache where cache_key = $1 and expires_at > now()", key
        )
        if not row:
            return None
        res = row["results"]
        return json.loads(res) if isinstance(res, str) else res

    async def put(self, fhash: str, portal: str, filters: SearchFilters, results: list[dict]) -> None:
        key = cache_key(fhash, portal)
        if not self.pool:
            self._mem[key] = (time.time() + self.ttl.total_seconds(), results)
            return
        expires = datetime.now(timezone.utc) + self.ttl
        await self.pool.execute(
            """
            insert into public.search_cache (cache_key, filters_hash, portal, filters, results, result_count, created_at, expires_at)
            values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, now(), $7)
            on conflict (cache_key) do update
              set results = excluded.results, result_count = excluded.result_count,
                  created_at = now(), expires_at = excluded.expires_at
            """,
            key, fhash, portal, filters.model_dump_json(), json.dumps(results, ensure_ascii=False), len(results), expires,
        )

    async def log_usage(self, *, provider: str, portal: str, url: str | None, success: bool,
                        status_code: int | None, duration_ms: int | None, error: str | None) -> None:
        if not self.pool:
            self.usage_mem.append(dict(provider=provider, portal=portal, success=success, status_code=status_code))
            return
        await self.pool.execute(
            "insert into public.scraping_usage (provider, portal, url, success, status_code, duration_ms, error) "
            "values ($1,$2,$3,$4,$5,$6,$7)",
            provider, portal, url, success, status_code, duration_ms, error,
        )
