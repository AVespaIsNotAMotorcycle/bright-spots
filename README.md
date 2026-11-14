# Bright Spots

A web app that gives any place on Earth a live "check-up" from NASA satellite data.
See `SPEC.pdf` for the full specification.

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
curl localhost:8000/hello
```

Frontend (port 5173, proxies `/api` to the backend):

```sh
cd frontend
npm install
npm run dev
```

### Data dashboard

The frontend currently opens a dataset dashboard (a scratch tool ahead of the
main spec build). Datasets are listed by `GET /api/datasets`; each has a panel
registered in `frontend/src/datasets/registry.ts`.

- **NOAA Global Summary of the Month** (`/api/datasets/gsom/stations`,
  `/api/datasets/gsom/series`): find stations near a lat/lon, chart monthly
  temperature, precipitation, degree days, etc. Uses NCEI's token-free
  search and access-data services; responses are cached in memory for 6 h.

Live smoke test of the NOAA client: `cd backend && uv run python scripts/try_gsom.py 51.48 -0.45`

Tests:

```sh
cd backend && uv run pytest
```

## Licence

MIT
