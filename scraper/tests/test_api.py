import asyncio

import pytest
from fastapi.testclient import TestClient

from app.db import Store
from app.fetcher import BlockedError, FetchError
from app.models import RawListing
from app.scrapers.base import BaseScraper
from app.service import SearchService


class Fake(BaseScraper):
    base_url = "https://fake"
    contratos = {"larga"}

    def __init__(self, portal, behavior):
        self.portal = portal
        self.behavior = behavior
        self.calls = 0

    def build_urls(self, f):
        return ["https://fake/1"]

    async def search(self, f, fetcher):
        self.calls += 1
        if self.behavior == "error":
            raise FetchError("HTTP 500")
        if self.behavior == "blocked":
            raise BlockedError("datadome")
        if self.behavior == "slow":
            await asyncio.sleep(5)
        return [RawListing(portal=self.portal, url=f"https://{self.portal}/1", title="Piso en Centro, calle Mayor", price=900, rooms=2, size_m2=70)]


@pytest.fixture
def client(monkeypatch):
    from app import main

    scrapers = {
        "idealista": Fake("idealista", "ok"),
        "fotocasa": Fake("fotocasa", "ok"),       # mesmo imóvel → deduplica
        "milanuncios": Fake("milanuncios", "blocked"),
        "habitaclia": Fake("habitaclia", "error"),
        "pisos": Fake("pisos", "slow"),
    }
    with TestClient(main.app) as c:
        store = Store(None, 6)
        main.app.state.service = SearchService(main.app.state.fetcher, store, scrapers, portal_timeout_s=0.5)
        c.scrapers = scrapers
        yield c


BODY = {"ciudad": "Elche / Elx", "provincia": "Alicante", "portales": ["idealista", "fotocasa", "milanuncios", "habitaclia", "pisos", "spotahome"]}
H = {"X-Internal-Token": "dev-token-change-me"}


def test_requires_token(client):
    assert client.post("/search", json=BODY).status_code == 401


def test_resilience_dedup_and_cache(client):
    r = client.post("/search", json=BODY, headers=H)
    assert r.status_code == 200
    j = r.json()
    st = {s["portal"]: s["status"] for s in j["sources"]}
    assert st == {"idealista": "ok", "fotocasa": "ok", "milanuncios": "blocked", "habitaclia": "error", "pisos": "timeout", "spotahome": "skipped"}
    assert len(j["results"]) == 1 and len(j["results"][0]["sources"]) == 2 and j["total_raw"] == 2

    r2 = client.post("/search", json=BODY, headers=H).json()
    st2 = {s["portal"]: s["status"] for s in r2["sources"]}
    assert st2["idealista"] == "cached" and st2["fotocasa"] == "cached"
    assert client.scrapers["idealista"].calls == 1          # não gastou crédito de novo
    assert client.scrapers["habitaclia"].calls == 2         # falhas não são cacheadas
