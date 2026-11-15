"""Trip planner: chips, must/nice, best month, relax, maths helpers."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.parks.trip import AVOIDS, WANTS, day_length, new_moons, parse_chips, tri

client = TestClient(app)


def get(**q):
    r = client.get("/api/parks/trip", params=q)
    assert r.status_code == 200, r.text
    return r.json()


def test_parse_chips_levels_and_unknowns():
    assert parse_chips("stars,camping!,nope", WANTS) == {"stars": "nice", "camping": "must"}
    assert parse_chips(None, AVOIDS) == {}


def test_day_length_and_moon():
    assert day_length(0, 3) == pytest.approx(12, abs=0.2)
    assert day_length(45, 6) > 15 > day_length(45, 12) + 5
    assert day_length(70, 6) == 24.0
    # Known new moons: 2026-01-18, 2026-02-17 (UTC); mean synodic month is within a day.
    assert any(abs(d - 18) <= 1 for d in new_moons(2026, 1))
    assert any(abs(d - 17) <= 1 for d in new_moons(2026, 2))
    assert tri(5, 0, 10) == 1 and tri(0, 0, 10) == 0


def test_every_chip_runs_on_every_park():
    d = get(months="1,4,7,10", bands="10:30", want=",".join(WANTS), avoid=",".join(AVOIDS))
    assert len(d["parks"]) >= 60
    for p in d["parks"]:
        keys = {r["key"] for r in p["reasons"]}
        assert keys == {"temperature", *WANTS, *AVOIDS}
        for r in p["reasons"]:
            assert r["score"] is None or 0 <= r["score"] <= 1
        assert p["best_month"] in (1, 4, 7, 10)
        assert len(p["month_scores"]) == 12


def test_best_month_is_the_best_of_the_chosen_months():
    d = get(months="6,7,8", bands="15:24")
    for p in d["parks"][:10]:
        chosen = [p["month_scores"][m - 1]["score"] for m in (6, 7, 8)]
        assert p["score"] == max(s for s in chosen if s is not None)


def test_must_drops_parks_and_relax_says_which_one():
    loose = get(months="7", want="snow_play")
    strict = get(months="7", want="snow_play!")
    assert strict["matches"] < loose["matches"]
    dropped = [p for p in strict["parks"] if not p["ok"]]
    assert dropped and all("snow_play" in p["failed"] for p in dropped)
    assert strict["relax"][0]["key"] == "snow_play"
    # Passing parks come first.
    oks = [p["ok"] for p in strict["parks"]]
    assert oks == sorted(oks, reverse=True)


def test_fall_colours_only_in_autumn_forests():
    d = get(months="10", want="fall")
    fall = {p["park"]["id"]: next(r for r in p["reasons"] if r["key"] == "fall")["score"] for p in d["parks"]}
    assert fall["death-valley"] == 0
    assert fall["great-smoky-mountains"] > 0.3
    # Rain-fed wildflowers are a spring thing, not a warm November.
    nov = get(months="11", want="wildflowers")
    sag = next(p for p in nov["parks"] if p["park"]["id"] == "saguaro")
    assert next(r for r in sag["reasons"] if r["key"] == "wildflowers")["score"] == 0
    july = get(months="7", want="fall")
    assert all(next(r for r in p["reasons"] if r["key"] == "fall")["score"] in (0, None) for p in july["parks"])


def test_fire_is_unknown_outside_the_firms_file():
    d = get(months="8", avoid="fire")
    samoa = next(p for p in d["parks"] if p["park"]["id"] == "american-samoa")
    assert next(r for r in samoa["reasons"] if r["key"] == "fire")["score"] is None


def test_bad_input():
    assert client.get("/api/parks/trip", params={"months": "13"}).status_code == 422
    assert client.get("/api/parks/trip", params={"months": "1", "bands": "30:10"}).status_code == 422
