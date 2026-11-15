"""Favourite-city climate for trip match (SPEC: "favourite city" temperature via
NASA POWER). The one live lookup the front end makes besides place search."""

from __future__ import annotations

import calendar
import statistics

import httpx
from pydantic import BaseModel

from app.atlas.power import monthly_mean_of_daily
from app.http import get_json

URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
DAILY_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
NORMAL = (1991, 2020)
# Daytime high comes from the daily endpoint (mean of daily maxima): the monthly
# T2M_MAX is the month's hottest day.
PARAMS = {"RH2M": "rh", "PRECTOTCORR": "precip"}


class CityMonth(BaseModel):
    month: int
    tmax: float | None  # mean daily daytime high, C
    rh: float | None  # %
    precip: float | None  # mm per month


class CityNormals(BaseModel):
    lat: float
    lon: float
    period: str
    months: list[CityMonth]


def parse(body: dict, daily: dict) -> list[CityMonth]:
    """Monthly 1991-2020 means: humidity and rain (as monthly totals) from a POWER
    monthly response, daytime high from the mean of daily maxima."""
    params = body["properties"]["parameter"]
    acc: dict[str, dict[int, list[float]]] = {v: {} for v in [*PARAMS.values(), "tmax"]}
    for (y, m), v in monthly_mean_of_daily(
        daily["properties"]["parameter"]["T2M_MAX"]
    ).items():
        if NORMAL[0] <= y <= NORMAL[1]:
            acc["tmax"].setdefault(m, []).append(v)
    for p, var in PARAMS.items():
        for key, v in params[p].items():
            y, m = int(key[:4]), int(key[4:])
            if m == 13 or v == -999 or not NORMAL[0] <= y <= NORMAL[1]:
                continue
            if var == "precip":
                v = v * calendar.monthrange(y, m)[1]
            acc[var].setdefault(m, []).append(v)

    def mean(var: str, m: int) -> float | None:
        xs = acc[var].get(m)
        return round(statistics.fmean(xs), 2) if xs else None

    return [
        CityMonth(
            month=m, tmax=mean("tmax", m), rh=mean("rh", m), precip=mean("precip", m)
        )
        for m in range(1, 13)
    ]


async def city_normals(
    client: httpx.AsyncClient, lat: float, lon: float
) -> CityNormals:
    params = {"parameters": ",".join(PARAMS), "community": "RE",
              "latitude": round(lat, 3), "longitude": round(lon, 3),
              "start": NORMAL[0], "end": NORMAL[1], "format": "JSON"}  # fmt: skip
    daily_params = {"parameters": "T2M_MAX", "community": "RE",
                    "latitude": round(lat, 3), "longitude": round(lon, 3),
                    "start": f"{NORMAL[0]}0101", "end": f"{NORMAL[1]}1231", "format": "JSON"}  # fmt: skip
    body = await get_json(client, URL, params)
    daily = await get_json(client, DAILY_URL, daily_params)
    return CityNormals(
        lat=lat, lon=lon, period=f"{NORMAL[0]}-{NORMAL[1]}", months=parse(body, daily)
    )
