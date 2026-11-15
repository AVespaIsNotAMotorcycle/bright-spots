import calendar
import json
from pathlib import Path

from app.parks.bestdays import best_days
from app.parks.scoring import Prefs

DATA = Path(__file__).resolve().parents[1] / "data" / "parks"


def _inputs(park: str):
    climate = json.loads((DATA / "park_climate.json").read_text())[park]
    daily = json.loads((DATA / "daily" / f"{park}.json").read_text())
    return daily, climate


def test_every_day_of_the_month_gets_a_score():
    daily, climate = _inputs("zion")
    prefs = Prefs(5, 18.0, 28.0)
    for horizon in ("this_year", "next_year", "y2050"):
        r = best_days(daily, climate, prefs, "ssp245", horizon)
        assert len(r["days"]) == calendar.monthrange(2001, 5)[1]
        assert all(0 <= d["score"] <= 100 for d in r["days"])
        assert len(r["best_days"]) == 5
        w = r["window"]
        assert w["end"] - w["start"] == 4


def test_best_days_follow_the_preferred_temperature():
    daily, climate = _inputs("zion")
    cool = best_days(daily, climate, Prefs(5, 10.0, 15.0), "ssp245", "next_year")
    warm = best_days(daily, climate, Prefs(5, 28.0, 34.0), "ssp245", "next_year")
    # Zion warms through May: cool-lovers should get earlier days than heat-lovers.
    assert sum(cool["best_days"]) < sum(warm["best_days"])


def test_no_2050_projection_says_so():
    daily, climate = _inputs("dry-tortugas")
    r = best_days(daily, climate, Prefs(5, 18.0, 28.0), "ssp245", "y2050")
    assert r["days"] is None and "No 2050 projection" in r["note"]
