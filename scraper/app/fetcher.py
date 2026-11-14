"""
AntiBotFetcher — cliente HTTP central. Todo acesso aos portais passa por aqui.

Regras:
  * Portais protegidos (Idealista, Fotocasa, Milanuncios, ...) NUNCA são acessados
    a partir do IP do servidor: só via ZenRows ou ScraperAPI. Sem chave => BlockedError.
  * Provedor primário = SCRAPING_PROVIDER; o outro é usado como fallback se tiver chave.
  * Portais não protegidos podem cair para HTTPX direto e, opcionalmente, Playwright.
  * Cada tentativa é registrada via `usage_logger` (tabela scraping_usage).
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass
from typing import Awaitable, Callable

import httpx

from .config import Settings

log = logging.getLogger("fetcher")

ZENROWS_ENDPOINT = "https://api.zenrows.com/v1/"
SCRAPERAPI_ENDPOINT = "https://api.scraperapi.com/"

# Marcadores de página de desafio (DataDome, Cloudflare, PerimeterX, Akamai)
BLOCK_MARKERS = (
    "captcha-delivery.com",
    "geo.captcha-delivery",
    "datadome",
    "cf-browser-verification",
    "challenge-platform",
    "px-captcha",
    "_Incapsula_Resource",
    "Access Denied</title>",
    "Pardon Our Interruption",
)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

UsageLogger = Callable[..., Awaitable[None]]


class FetchError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class BlockedError(FetchError):
    """Página de desafio anti-bot ou nenhum provedor disponível para alvo protegido."""


@dataclass
class FetchResult:
    html: str
    status_code: int
    provider: str
    url: str


def looks_blocked(html: str, status: int) -> bool:
    if status in (401, 403, 429):
        return True
    head = html[:20000]
    if len(html) < 2500 and any(m.lower() in head.lower() for m in BLOCK_MARKERS):
        return True
    # Desafios do DataDome às vezes vêm com 200 e um iframe pequeno
    return "geo.captcha-delivery.com" in head or "ct.captcha-delivery.com" in head


def build_zenrows_params(url: str, api_key: str, *, js_render: bool = True, wait_for: str | None = None) -> dict[str, str]:
    params = {
        "apikey": api_key,
        "url": url,
        "js_render": "true" if js_render else "false",
        "antibot": "true",
        "premium_proxy": "true",
        "proxy_country": "es",
    }
    if js_render and wait_for:
        params["wait_for"] = wait_for
    return params


def build_scraperapi_params(url: str, api_key: str, *, render: bool = True, ultra_premium: bool = False) -> dict[str, str]:
    params = {
        "api_key": api_key,
        "url": url,
        "render": "true" if render else "false",
        "country_code": "es",
    }
    # premium e ultra_premium são mutuamente exclusivos na ScraperAPI
    params["ultra_premium" if ultra_premium else "premium"] = "true"
    return params


class AntiBotFetcher:
    def __init__(self, settings: Settings, usage_logger: UsageLogger | None = None, client: httpx.AsyncClient | None = None):
        self.s = settings
        self._log_usage = usage_logger
        self._client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(settings.request_timeout_s, connect=15.0),
            follow_redirects=True,
            headers={"User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9"},
        )
        self._sem = asyncio.Semaphore(settings.max_concurrency)

    async def aclose(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------ providers
    def providers(self) -> list[str]:
        available = {
            "zenrows": bool(self.s.zenrows_api_key),
            "scraperapi": bool(self.s.scraperapi_key),
        }
        primary = self.s.scraping_provider
        secondary = "scraperapi" if primary == "zenrows" else "zenrows"
        order = [primary] + ([secondary] if self.s.scraping_fallback_enabled else [])
        return [p for p in order if available[p]]

    async def fetch(
        self,
        url: str,
        portal: str,
        *,
        protected: bool = True,
        js_render: bool = True,
        wait_for: str | None = None,
    ) -> FetchResult:
        async with self._sem:
            errors: list[str] = []
            for provider in self.providers():
                for attempt in range(self.s.retries_per_provider + 1):
                    try:
                        return await self._via_provider(provider, url, portal, js_render=js_render, wait_for=wait_for)
                    except FetchError as e:
                        errors.append(f"{provider}#{attempt + 1}: {e}")
                        # 4xx de configuração (chave inválida, sem créditos) não melhora com retry
                        if e.status_code in (401, 402):
                            break
                        await asyncio.sleep(1.5 * (attempt + 1) + random.random())

            if protected:
                if not self.providers():
                    raise BlockedError(
                        f"{portal}: portal protegido e nenhuma chave ZENROWS_API_KEY/SCRAPERAPI_KEY configurada "
                        "(requisição direta bloqueada por política)"
                    )
                raise BlockedError(" | ".join(errors)[:500])

            # Não protegido: HTTPX direto → Playwright
            try:
                return await self._direct(url, portal)
            except FetchError as e:
                errors.append(f"direct: {e}")
            if self.s.playwright_fallback:
                try:
                    return await self._playwright(url, portal, wait_for)
                except FetchError as e:
                    errors.append(f"playwright: {e}")
            raise FetchError(" | ".join(errors)[:500])

    # ------------------------------------------------------------------ backends
    async def _via_provider(self, provider: str, url: str, portal: str, *, js_render: bool, wait_for: str | None) -> FetchResult:
        if provider == "zenrows":
            endpoint, params = ZENROWS_ENDPOINT, build_zenrows_params(url, self.s.zenrows_api_key or "", js_render=js_render, wait_for=wait_for)
        else:
            endpoint, params = SCRAPERAPI_ENDPOINT, build_scraperapi_params(
                url, self.s.scraperapi_key or "", render=js_render, ultra_premium=self.s.scraperapi_ultra_premium
            )
        return await self._get(endpoint, params, provider=provider, portal=portal, target=url)

    async def _direct(self, url: str, portal: str) -> FetchResult:
        return await self._get(url, None, provider="direct", portal=portal, target=url)

    async def _get(self, endpoint: str, params: dict | None, *, provider: str, portal: str, target: str) -> FetchResult:
        t0 = time.perf_counter()
        status: int | None = None
        try:
            r = await self._client.get(endpoint, params=params)
            status = r.status_code
            html = r.text
            if status >= 400:
                raise FetchError(f"HTTP {status}: {html[:160]}", status)
            if looks_blocked(html, status):
                raise BlockedError("página de desafio anti-bot detectada", status)
            await self._usage(provider, portal, target, True, status, t0)
            return FetchResult(html=html, status_code=status, provider=provider, url=target)
        except FetchError as e:
            await self._usage(provider, portal, target, False, status, t0, str(e))
            raise
        except httpx.TimeoutException as e:
            await self._usage(provider, portal, target, False, status, t0, "timeout")
            raise FetchError(f"timeout: {e}") from e
        except httpx.HTTPError as e:
            await self._usage(provider, portal, target, False, status, t0, str(e))
            raise FetchError(str(e)) from e

    async def _playwright(self, url: str, portal: str, wait_for: str | None) -> FetchResult:
        t0 = time.perf_counter()
        try:
            from playwright.async_api import async_playwright  # import tardio: dependência opcional
        except ImportError as e:
            raise FetchError("playwright não instalado") from e
        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                page = await browser.new_page(user_agent=UA, locale="es-ES")
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=int(self.s.request_timeout_s * 1000))
                if wait_for:
                    await page.wait_for_selector(wait_for, timeout=15000)
                html = await page.content()
                status = resp.status if resp else 200
                await browser.close()
            if looks_blocked(html, status):
                raise BlockedError("página de desafio anti-bot detectada (playwright)", status)
            await self._usage("playwright", portal, url, True, status, t0)
            return FetchResult(html=html, status_code=status, provider="playwright", url=url)
        except FetchError:
            await self._usage("playwright", portal, url, False, None, t0, "blocked")
            raise
        except Exception as e:  # noqa: BLE001
            await self._usage("playwright", portal, url, False, None, t0, str(e))
            raise FetchError(f"playwright: {e}") from e

    async def _usage(self, provider: str, portal: str, url: str, ok: bool, status: int | None, t0: float, err: str | None = None) -> None:
        if not self._log_usage:
            return
        try:
            await self._log_usage(
                provider=provider, portal=portal, url=url, success=ok, status_code=status,
                duration_ms=int((time.perf_counter() - t0) * 1000), error=(err or None) and err[:300],
            )
        except Exception:  # noqa: BLE001 — logging nunca derruba a busca
            log.exception("falha ao registrar uso")
