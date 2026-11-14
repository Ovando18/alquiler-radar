import httpx
import pytest
import respx

from app.config import Settings
from app.fetcher import (
    SCRAPERAPI_ENDPOINT,
    ZENROWS_ENDPOINT,
    AntiBotFetcher,
    BlockedError,
    build_scraperapi_params,
    build_zenrows_params,
    looks_blocked,
)

GOOD = "<html>" + "<article class='item'>ok</article>" * 200 + "</html>"
DATADOME = '<html><body><iframe src="https://geo.captcha-delivery.com/captcha/?initialCid=x"></iframe></body></html>'


def settings(**kw):
    base = dict(scraping_provider="zenrows", zenrows_api_key="ZR", scraperapi_key="SA", retries_per_provider=0, request_timeout_s=5)
    base.update(kw)
    return Settings(**base)


def test_zenrows_params_have_evasion_flags():
    p = build_zenrows_params("https://www.idealista.com/x", "K", wait_for="article.item")
    assert p == {"apikey": "K", "url": "https://www.idealista.com/x", "js_render": "true", "antibot": "true",
                 "premium_proxy": "true", "proxy_country": "es", "wait_for": "article.item"}


def test_scraperapi_params():
    assert build_scraperapi_params("u", "K") == {"api_key": "K", "url": "u", "render": "true", "country_code": "es", "premium": "true"}
    assert "ultra_premium" in build_scraperapi_params("u", "K", ultra_premium=True)


def test_block_detection():
    assert looks_blocked(DATADOME, 200)
    assert looks_blocked("x", 403)
    assert not looks_blocked(GOOD, 200)


@pytest.mark.asyncio
@respx.mock(assert_all_called=False)
async def test_protected_portal_never_goes_direct_without_keys(respx_mock):
    direct = respx_mock.get("https://www.idealista.com/x").mock(return_value=httpx.Response(200, text=GOOD))
    f = AntiBotFetcher(settings(zenrows_api_key=None, scraperapi_key=None))
    with pytest.raises(BlockedError):
        await f.fetch("https://www.idealista.com/x", "idealista", protected=True)
    assert not direct.called
    await f.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_zenrows_primary_success(respx_mock):
    route = respx_mock.get(ZENROWS_ENDPOINT).mock(return_value=httpx.Response(200, text=GOOD))
    usage = []

    async def logger(**kw):
        usage.append(kw)

    f = AntiBotFetcher(settings(), usage_logger=logger)
    res = await f.fetch("https://www.idealista.com/x", "idealista")
    assert res.provider == "zenrows"
    q = dict(route.calls[0].request.url.params)
    assert q["proxy_country"] == "es" and q["antibot"] == "true" and q["premium_proxy"] == "true" and q["js_render"] == "true"
    assert usage[0]["success"] and usage[0]["provider"] == "zenrows" and "apikey" not in (usage[0]["url"] or "")
    await f.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_falls_back_to_scraperapi_when_zenrows_blocked(respx_mock):
    respx_mock.get(ZENROWS_ENDPOINT).mock(return_value=httpx.Response(200, text=DATADOME))
    sa = respx_mock.get(SCRAPERAPI_ENDPOINT).mock(return_value=httpx.Response(200, text=GOOD))
    f = AntiBotFetcher(settings())
    res = await f.fetch("https://www.fotocasa.es/x", "fotocasa")
    assert res.provider == "scraperapi"
    q = dict(sa.calls[0].request.url.params)
    assert q["country_code"] == "es" and q["render"] == "true" and q["premium"] == "true"
    await f.aclose()


@pytest.mark.asyncio
@respx.mock
async def test_unprotected_portal_may_go_direct(respx_mock):
    respx_mock.get("https://www.pisos.com/x").mock(return_value=httpx.Response(200, text=GOOD))
    f = AntiBotFetcher(settings(zenrows_api_key=None, scraperapi_key=None))
    res = await f.fetch("https://www.pisos.com/x", "pisos", protected=False)
    assert res.provider == "direct"
    await f.aclose()
