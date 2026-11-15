"""Hosted mode: one server serves the API and the built frontend."""

import importlib

from fastapi.testclient import TestClient


def test_serves_frontend_and_api(tmp_path, monkeypatch):
    (tmp_path / "index.html").write_text("<!doctype html><title>Canopy</title>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    monkeypatch.setenv("STATIC_DIR", str(tmp_path))
    import app.main as main

    main = importlib.reload(main)
    with TestClient(main.app) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        assert "Canopy" in client.get("/").text
        assert client.get("/assets/app.js").text == "console.log(1)"
        # Unknown paths fall back to the app shell; paths outside the folder never leak.
        assert "Canopy" in client.get("/some/deep/link").text
        assert "Canopy" in client.get("/..%2F..%2Fpyproject.toml").text
        assert client.get("/api/parks").status_code == 200
        assert client.get("/api/no-such-route").status_code == 404
    monkeypatch.delenv("STATIC_DIR")
    importlib.reload(main)
