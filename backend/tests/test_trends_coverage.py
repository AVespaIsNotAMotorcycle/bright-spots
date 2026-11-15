from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_atlas_reports_real_coverage():
    cov = client.get("/api/trends/atlas").json()["coverage"]
    assert cov["first_year"] == 1981
    assert 1 <= cov["last_month"] <= 12
    # The last full year is never after the latest month on record.
    assert cov["last_full_year"] <= cov["last_year"]


def test_grace_per_park():
    r = client.get("/api/trends/grace/zion").json()
    assert r["land"] is True
    assert r["meta"]["resolution_km"] == 300
    assert len(r["years"]) == len(r["values"]) >= 15
    # The 2017-2018 gap between GRACE and GRACE-FO leaves those years out.
    assert 2017 not in r["years"]
    assert r["verdict"] in {"real", "possible", "none"}
    # Ocean cells (American Samoa) have no land value.
    assert client.get("/api/trends/grace/npsa").json()["land"] is False
    assert client.get("/api/trends/grace/nope").status_code == 404
