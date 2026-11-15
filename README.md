# Canopy

**Go when the park is at its best.**

Canopy helps you pick the best month to visit a US national park. It uses
40+ years of NASA Earth data to show how each park's weather is changing.
Built for the NASA Space Apps Challenge 2026, "Be an Earth System Trend
Detective". `SPEC.md` is the research spec.

## What you can do

| Tab | What it does |
|---|---|
| Home | Pick a month and see parks that are good right now |
| Plan | Trip planner: choose months, moods and must-haves; parks are ranked by real data, with best dates |
| Cases | Short trend-detective quizzes about one park; ends with "Plan a trip" to that park |
| Saved | Parks you hearted |
| Passport | Stamps for the cases you solved |
| Research (optional) | Atlas, map, analogs, families, opposites, seasons, compare, robust trends, community notes |

Research tabs show only if you turn on "research tools" at sign-in.

## Data

| Source | Used for |
|---|---|
| NASA POWER (daily, per park) | Temperature, humidity, rain, clouds, this year so far |
| Daymet V4 (NASA ORNL DAAC, via Earth Engine) | 1 km monthly climate since 1980, trends |
| NASA GRACE / GRACE-FO | Water storage trends |
| NASA FIRMS | Fire and smoke season |
| MODIS / ESA CCI land cover | Land cover change |
| NOAA GHCN-Daily | Checks our NASA temperature trends against weather stations |
| WorldClim CMIP6 | 2050 projections |
| NPS visitor counts | Crowds |
| EPA ecoregions | Forest and landscape type |

Daylight and moon phase are computed with sun and moon maths. Anything that
is an estimate is labelled as one in the app.

## Layout

```
backend/    FastAPI service (Python 3.11+, managed with uv)
  app/        API: parks, trip planner, trends, datasets, community
  scripts/    data pipeline, step0_* to step10_*
  data/       committed, ready-to-serve JSON
frontend/   React 18 + TypeScript single-page app (Vite)
```

## Run locally

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

If the browser shows "Failed to fetch dynamically imported module", clear
Vite's cache and hard-reload (⌘⇧R):

```sh
cd frontend && rm -rf node_modules/.vite && npm run dev
```

The app runs from committed files in `backend/data/`. Rebuilding them is only
needed to refresh the data; run the `backend/scripts/step*.py` scripts in
order (step 1 needs an Earth Engine account).

## Main API routes

| Route | What it returns |
|---|---|
| `GET /api/parks` | Park list |
| `GET /api/parks/trip` | Ranked parks for trip settings |
| `GET /api/parks/best-days` | Best dates in a month for a park |
| `GET /api/parks/{park_id}/daily` | Daily normals for one park |
| `GET /api/trends/atlas` | Trend for every park and variable |
| `GET /api/trends/parks/{park_id}` | One park's trend series |
| `GET /api/trends/validation` | NASA vs NOAA station check |
| `GET /api/community/posts` | Community notes |

## Tests

```sh
cd backend && uv run pytest && uv run ruff check app tests
cd frontend && npm run lint && npx tsc -p tsconfig.json --noEmit && npm test
```

CI runs the same checks on every push.

## Licence

MIT. Park list from Wikipedia (CC BY-SA 4.0). NASA data is public domain;
other sources keep their own terms.
