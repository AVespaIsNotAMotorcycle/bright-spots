from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_atlas_reports_real_coverage():
    cov = client.get("/api/trends/atlas").json()["coverage"]
    assert cov["first_year"] == 1981
    assert 1 <= cov["last_month"] <= 12
    # The last full year is never after the latest month on record.
    assert cov["last_full_year"] <= cov["last_year"]
