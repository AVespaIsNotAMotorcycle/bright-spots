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
main spec build). Pick a place once (search via Nominatim, a preset, your
location, or type `lat, lon`), then switch between dataset tabs. Datasets are
listed by `GET /api/datasets`; each has a panel in
`frontend/src/datasets/registry.ts`.

| Tab | Endpoint(s) | Access |
|---|---|---|
| NASA POWER | `/api/datasets/power/monthly` | live |
| ORNL DAAC MODIS/VIIRS | `/api/datasets/modis/series`, `/api/datasets/modis/landcover` | live |
| GRACE / GRACE-FO | `/api/datasets/grace/series` | bundled file |
| Köppen-Geiger | `/api/datasets/koppen/lookup` | bundled file |
| Rainfall vs pre-2000 trend | `/api/datasets/raindiv/grid`, `/api/datasets/raindiv/point` | bundled file |
| NASA GIBS | tile URLs from `/api/datasets`, loaded by the browser | browser |
| NOAA GSOM | `/api/datasets/gsom/stations`, `/api/datasets/gsom/series` | live |

Place search: `/api/geocode?q=` (Nominatim, ≤1 req/s, cached 30 days). Set
`BRIGHT_SPOTS_NOMINATIM_CONTACT` in `backend/.env` to an email or URL so the
User-Agent identifies you, per Nominatim's usage policy.

Live responses are cached in memory for 6 h (30 days for geocoding).

#### Bundled data files

`backend/data/koppen_0p5.npz` and `koppen_legend.json` are committed (small).
`backend/data/grace_1deg.npz` (~21 MB) is gitignored; build it once:

```sh
cd backend
mkdir -p data/raw/grace data/raw/koppen
B=https://download.csr.utexas.edu/outgoing/grace/RL0603_mascons
curl -L -o data/raw/grace/CSR_GRACE_GRACE-FO_RL0603_Mascons_all-corrections.nc $B/CSR_GRACE_GRACE-FO_RL0603_Mascons_all-corrections.nc
curl -L -o data/raw/grace/CSR_GRACE_GRACE-FO_RL06_Mascons_v02_LandMask.nc $B/CSR_GRACE_GRACE-FO_RL06_Mascons_v02_LandMask.nc
uv run python scripts/prepare_grace.py

# Köppen (only needed to rebuild the committed files)
curl -L -o data/raw/koppen/koppen_geiger_tif.zip https://ndownloader.figshare.com/files/61012822
(cd data/raw/koppen && unzip -o koppen_geiger_tif.zip 1991_2020/koppen_geiger_0p5.tif 2041_2070/ssp245/koppen_geiger_0p5.tif legend.txt)
uv run python scripts/prepare_koppen.py
```

Rainfall divergence map (GPCC Full v2025 via NOAA PSL). The two small map
layers are committed; the annual series used by the cell chart are gitignored:

```sh
cd backend
mkdir -p data/raw/gpcc data/raw/gpcc25
P=https://downloads.psl.noaa.gov/Datasets/gpcc/full_v2025
curl -L -o data/raw/gpcc/precip.mon.total.1x1.v2025.nc $P/precip.mon.total.1x1.v2025.nc
curl -L -o data/raw/gpcc25/precip.mon.total.2.5x2.5.v2025.nc $P/precip.mon.total.2.5x2.5.v2025.nc
uv run python scripts/prepare_rain_divergence.py --res 1
uv run python scripts/prepare_rain_divergence.py --res 2.5
```

The PSL 1° file has 2020–2024 as fill placeholders and a Dec 2019 slice
identical to Jan 1891; the script drops both, so the 1° layer covers
2000–2018. The 2.5° layer runs to 2025.

Live smoke tests: `cd backend && uv run python scripts/try_sources.py [lat lon]`
(all sources in parallel) and `uv run python scripts/try_gsom.py [lat lon]`.

Charts draw a dashed linear least-squares trend per series (toggle per card).
Sub-annual series are deseasonalized first (calendar-month means removed), so
the seasonal cycle doesn't leak into the slope; see `frontend/src/trend.ts`.

Tests:

```sh
cd backend && uv run pytest
cd ../frontend && npm test
```

## Licence

MIT
