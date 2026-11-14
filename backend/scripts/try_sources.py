"""Live smoke test of every spec data source, run in parallel.

Usage: uv run python scripts/try_sources.py [lat] [lon]
"""

import asyncio
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets import bundled, cci_landcover, nominatim, ornl, power
from app.datasets.router import DATASETS


async def timed(name: str, coro) -> tuple[str, float, object]:
    t = time.monotonic()
    try:
        result = await coro
    except Exception as e:  # noqa: BLE001 - report, don't crash the smoke test
        result = e
    return name, time.monotonic() - t, result


async def gibs_tile(client: httpx.AsyncClient) -> str:
    layer = next(d for d in DATASETS if d["id"] == "gibs")["layers"]["truecolor"]
    url = layer["tiles"].format(time="2023-07-15", z=3, y=2, x=2)
    r = await client.get(url)
    return f"{r.status_code} {r.headers.get('content-type')} {len(r.content)} bytes"


async def main(lat: float, lon: float) -> None:
    sem = asyncio.Semaphore(8)
    async with httpx.AsyncClient(timeout=20) as c:
        results = await asyncio.gather(
            timed("power", power.get_monthly(c, lat, lon, 2022, 2023)),
            timed(
                "modis NDVI", ornl.get_series(c, sem, "MOD13Q1", lat, lon, 2024, 2024)
            ),
            timed(
                "modis LST", ornl.get_series(c, sem, "MOD11A2", lat, lon, 2024, 2024)
            ),
            timed("modis landcover", ornl.get_landcover(c, sem, lat, lon)),
            timed("cci landcover", asyncio.to_thread(cci_landcover.lookup, lat, lon)),
            timed("grace", asyncio.to_thread(bundled.grace_series, lat, lon)),
            timed("koppen", asyncio.to_thread(bundled.koppen_lookup, lat, lon)),
            timed("nominatim", nominatim.search(c, "Nairobi")),
            timed("gibs tile", gibs_tile(c)),
        )
    for name, dt, r in results:
        if isinstance(r, Exception):
            summary = f"ERROR {type(r).__name__}: {r}"[:200]
        elif isinstance(r, power.PowerResult):
            summary = f"{len(r.monthly)} months, yearly={r.yearly[-1]}"
        elif isinstance(r, ornl.ProductSeries):
            kept = [o for o in r.observations if o.kept]
            summary = (
                f"{r.requests} req, {r.failed_requests} failed, "
                f"{len(r.observations)} obs, {len(kept)} kept, first={kept[:1]}"
            )
        elif isinstance(r, bundled.GraceResult):
            vals = [m for m in r.months if m.lwe_cm is not None]
            summary = f"land={r.land} cell=({r.cell_lat},{r.cell_lon}) {len(vals)} months, last={vals[-1:]}"
        elif isinstance(r, list):
            summary = f"{len(r)} results, first={r[:1]}"
        else:
            summary = str(r)
        print(f"{name:16} {dt:6.1f}s  {summary}")


if __name__ == "__main__":
    args = [float(a) for a in sys.argv[1:3]] or [40.78, -73.97]
    asyncio.run(main(*args))
