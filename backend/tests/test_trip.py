"""Trip planner: chips, must/nice, best month, relax, maths helpers."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.parks import trip as trip_mod
from app.parks.trip import AVOIDS, WANTS, Ctx, day_length, f_stars, new_moons, parse_chips, tri

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


def test_touching_bands_merge_into_one_range():
    from app.parks.trip import merge_bands

    assert merge_bands([(24, 30), (15, 24)]) == [(15, 30)]
    assert merge_bands([(0, 15), (24, 30)]) == [(0, 15), (24, 30)]


def test_warmth_peaks_in_the_middle_so_parks_do_not_tie():
    from app.parks.trip import EDGE, warmth

    comfy = [(15, 24), (24, 30)]
    assert warmth(22.5, comfy) == 1.0
    assert warmth(15, comfy) == EDGE
    assert warmth(20, comfy) > warmth(28, comfy) > warmth(31, comfy) > 0
    assert warmth(40, comfy) == 0.0


def test_rain_gray_and_muggy_always_count_unless_picked():
    from fastapi.testclient import TestClient

    from app.main import app

    c = TestClient(app)
    r = c.get("/api/parks/trip", params={"months": "7", "bands": "15:24,24:30"}).json()
    top = r["parks"][0]
    assert {x["key"] for x in top["reasons"] if x["kind"] == "base"} <= {"rain", "gray", "muggy"}
    scores = [p["score"] for p in r["parks"] if p["score"] is not None]
    assert scores.count(max(scores)) <= 3  # no 30-way tie at 100
    r2 = c.get("/api/parks/trip", params={"months": "7", "bands": "15:30", "avoid": "rain"}).json()
    rows = r2["parks"][0]["reasons"]
    assert [x["kind"] for x in rows if x["key"] == "rain"] == ["avoid"]


def test_best_days_are_not_all_tied():
    from fastapi.testclient import TestClient

    from app.main import app

    c = TestClient(app)
    r = c.get("/api/parks/best-days", params={"park_ids": "big-bend", "month": 1, "t_lo": 15, "t_hi": 30}).json()
    days = r["parks"]["big-bend"]["days"]
    scores = {round(d["score"]) for d in days if d["score"] is not None}
    assert len(scores) > 3  # day scores move with the daily weather, not one flat 100


def _stars_ctx(park_id: str) -> Ctx:
    park = {"id": park_id, "lat": 40.0}
    return Ctx(park, 10, {"cloud": 20.0}, {}, {}, None, set())


def test_stars_blend_in_night_glow_and_fall_back_without_it(monkeypatch):
    monkeypatch.setattr(trip_mod, "night_lights", lambda: {"dark": {"glow": 0.0}, "city": {"glow": 0.8}})
    base = f_stars(_stars_ctx("nodata"))
    dark, city = f_stars(_stars_ctx("dark")), f_stars(_stars_ctx("city"))
    assert dark[0] > base[0] > city[0]  # no glow data keeps the old score
    assert dark[1] == base[1] == city[1] == 20.0
    for r in (base, dark, city):
        assert 0.0 <= r[0] <= 1.0


def test_trip_api_reports_night_glow_as_estimate():
    parks = get(months="10", feels="mild")["parks"]
    glows = [p["night_glow"] for p in parks if p["night_glow"]]
    assert glows
    assert all(0 <= g["glow"] <= 1 and g["level"] in ("low", "medium", "high") for g in glows)
    assert all("NASA Black Marble" in g["why"] for g in glows)


def test_park_year_needs_no_settings():
    r = client.get("/api/parks/arches/year")
    assert r.status_code == 200, r.text
    ms = r.json()["months"]
    assert [m["month"] for m in ms] == list(range(1, 13))
    jan, jul = ms[0], ms[6]
    assert jul["tmax"] > jan["tmax"]
    assert "freezing" in jan["bad"] and "heat" in jul["bad"]
    assert all(len(m["good"]) <= trip_mod.YEAR_TOP for m in ms)
    assert not any(k in trip_mod.YEAR_SKIP for m in ms for k in m["good"] + m["bad"])
    assert client.get("/api/parks/nope/year").status_code == 404
