"""Live smoke test of the NOAA GSOM client.

Usage: uv run python scripts/try_gsom.py [lat] [lon]
"""

import asyncio
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.datasets import noaa_gsom


async def main(lat: float, lon: float) -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        stations = await noaa_gsom.find_stations(client, lat, lon)
        print(f"{len(stations)} stations within 50 km of ({lat}, {lon})")
        for s in stations[:5]:
            print(
                f"  {s.id}  {s.distance_km:6.1f} km  {s.start_date}..{s.end_date}  {s.name}"
            )
        if not stations:
            return
        best = next((s for s in stations if "TAVG" in s.variables), stations[0])
        series = await noaa_gsom.get_series(
            client, best.id, ["TAVG", "PRCP"], "2023-01-01", "2023-12-31"
        )
        print(f"\n{best.id} 2023:")
        for p in series.points:
            print(f"  {p.date}  {p.values}")


if __name__ == "__main__":
    args = [float(a) for a in sys.argv[1:3]] or [40.78, -73.97]
    asyncio.run(main(*args))
