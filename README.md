# Park visit planner

Which US national parks suit you in a given month, by temperature, humidity,
rain, bugs, clear skies for stargazing and the snowmelt season (waterfalls,
wildflowers): this year measured, next year forecast, 2050 projected.
`SPEC.md` is the research spec; its last section describes the MVP as built.

## Layout

```
backend/    FastAPI service (Python 3.11+, managed with uv)
frontend/   React 18 + TypeScript single-page app (Vite)
```

## Running locally

Backend (port 8000):

```sh
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

Frontend (port 5173, proxies `/api` to the backend):

```sh
cd frontend
npm install
npm run dev
```

The planner needs only the committed files `backend/data/parks/parks.json` and
`park_climate.json`. To rebuild them (about 1 minute; downloads ~650 MB of
WorldClim GeoTIFFs once into the gitignored `backend/data/raw/parks/`):

```sh
cd backend
uv run python scripts/prepare_parks.py              # all 63 parks
uv run python scripts/prepare_parks.py --only zion  # one park, for a quick check
```

API: `GET /api/parks` (park list) and `GET /api/parks/plan?month=7&t_lo=18&t_hi=28`
with optional `rh_max` (%), `rain_max` (mm/month), `avoid_bugs`, `stars`,
`snowmelt` (true/false) and `scenario` (`ssp245` or `ssp585`).

Tests:

```sh
cd backend && uv run pytest
cd ../frontend && npm test
```

The earlier Bright Spots dataset endpoints (`/api/datasets/...`, `/api/geocode`)
and their prep scripts are still in the backend but no longer used by the
frontend.

## Licence

MIT. Park list from Wikipedia (CC BY-SA 4.0).
