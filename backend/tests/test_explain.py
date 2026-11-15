import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.config import settings
from app.explain import router as explain
from app.main import app

client = TestClient(app)

BODY = {
    "park": "Crater Lake",
    "label": "Daytime high",
    "unit": "°F",
    "period": "annual",
    "sen_per_decade": 0.69,
    "mean": 52.7,
    "first_year": 1981,
    "last_year": 2025,
    "verdict": "real",
    "q": 0.04,
}


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    explain._cache.clear()
    explain._calls.clear()
    monkeypatch.setattr(settings, "anthropic_api_key", "")


def test_template_when_no_key():
    r = client.post("/api/explain", json=BODY)
    assert r.status_code == 200
    j = r.json()
    assert j["source"] == "template"
    assert "goes up" in j["text"] and "0.69°F" in j["text"] and "real change" in j["text"]


def test_none_verdict_never_claims_a_direction():
    r = client.post("/api/explain", json={**BODY, "verdict": "none", "sen_per_decade": 0.02})
    assert "goes up by" not in r.json()["text"]


def test_rejects_oversized_text():
    assert client.post("/api/explain", json={**BODY, "label": "x" * 500}).status_code == 422


@respx.mock
def test_uses_model_when_key_set(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    route = respx.post("https://api.anthropic.com/v1/messages").mock(
        return_value=httpx.Response(200, json={"content": [{"type": "text", "text": "It is getting warmer."}]})
    )
    j = client.post("/api/explain", json=BODY).json()
    assert j == {"text": "It is getting warmer.", "source": "ai"}
    assert route.calls.last.request.headers["x-api-key"] == "test-key"


@respx.mock
def test_falls_back_when_model_fails(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    respx.post("https://api.anthropic.com/v1/messages").mock(return_value=httpx.Response(500))
    assert client.post("/api/explain", json=BODY).json()["source"] == "template"
