# Bright Spots: full build specification

Nov 13, 2026 · @Purva Bansod

## 1. Start here

Bright Spots is a web app that gives any place on Earth a live "check-up" from NASA satellite data. A person types a place, a 3D globe flies there, and in about 30 seconds the app says whether the land has changed, how much, whether the change is statistically real, and whether it is more than the weather explains.

This document is written for a coding agent with no prior context. Build exactly what is described. Where a choice is left open it is marked **Decide**. Where a fact needs checking it is listed in section 13.

### The problem it solves

When someone says "this place is getting greener" or "our project restored this land", one of three things is true:

1. The place really improved.
2. It simply rained more in those years.
3. It is greener because water is being drained to pay for it (for example, pumped groundwater).

Most people cannot tell which. Checking today needs a specialist with mapping software. Bright Spots gives a free first answer for any coordinate, using published scientific methods, in plain language.

### The hackathon track it answers

NASA Space Apps Challenge 2026, challenge **"Be An Earth System Trend Detective!"**. The challenge asks for a tool that can:

- select variables measured by Earth science missions or models,
- visualize how they change over time,
- determine **what** is changing, **where**, **how much**, and whether the change is statistically **significant**,
- and show that the same process can push a variable up in one place and down in another.

Every feature below maps to one of those requirements. The app is a general trend tool first. It is not a farming app, a city app or a site-screening app, although it works for all three.

### What the app produces for a place

| Output | What it is |
| --- | --- |
| Headline verdict | One sentence, chosen from a fixed list (section 7.8) |
| 5-Year Change score | A number from -100 to +100 comparing the last 5 complete years with 2001 to 2015 |
| Five vital signs | Greener?, Beyond the rain?, Water bank, Surface heat, Land-cover guard |
| Two context badges | Steadiness (experimental), Future climate |
| Hero chart | "Rain-only vs reality": what greenness rain alone predicts against what satellites saw |
| Then / Now / Next | Early imagery, recent imagery, and the projected climate type for 2041 to 2070 |
| Simulations | Rain slider, water bucket, time machine, future climate dial |
| Share card | A downloadable image summarising the result |
| Methods and limits | Every dataset, method, citation and caveat |

### Non-negotiable principles

1. **Everything is computed live.** A judge will type any place. Nothing may be faked or hard-coded per place. Cached results are allowed and must be labelled "cached".
2. **Never claim cause.** Satellites show what changed, not who caused it or why. Use only the fixed wording in section 7.8.
3. **Label every scale.** Each number states the area it describes (a 250 m square, a 1 km square, a 50 km grid cell, a 300 km region).
4. **Show uncertainty.** Every result states whether it is statistically certain.
5. **Say "cannot judge" when true.** Oceans, ice, deserts and dense cities get an honest message, not a made-up verdict.
6. **Measured vs illustration.** Every chart and simulation carries one of two labels: "Measured" or "Illustration".
7. **Open source, NASA data.** MIT licence. All core data comes from NASA or partner agencies.

### Scope levels

- **MVP (must ship):** globe with fly-to, place search, live loading sequence, Greener?, Beyond the rain?, Water bank, 5-Year Change score, headline verdict, hero chart, methods page.
- **Core (ship if MVP is done by Saturday 3 pm):** Surface heat, Land-cover guard, Future climate badge, rain slider, water bucket, share card, measurement picker.
- **Stretch:** Steadiness badge, time machine imagery, places like mine, city mode, project start year (before and after), multi-place table, PDF report.

## 2. Glossary

Use these plain definitions in tooltips and on the methods page.

| Term | Plain meaning |
| --- | --- |
| NDVI | A satellite number from about -1 to 1 for how green and leafy the ground is. Higher means more living plants. |
| Trend | The general direction a number moves over many years, ignoring short ups and downs. |
| Statistically significant | A test says the trend is unlikely to be chance. We use p below 0.05, meaning under a 5% chance it is luck. |
| Mann-Kendall test | A test that asks "do values mostly go up (or down) over time?" without assuming a straight line. |
| Hamed-Rao correction | An adjustment to that test so that years resembling their neighbours do not fake a significant result. |
| Theil-Sen slope | The typical yearly change, taken as the median of all pairwise slopes, so one odd year cannot distort it. |
| Baseline | The "normal" comparison period. Here it is 2001 to 2015. |
| Residual | What is left of greenness after subtracting what rainfall alone would predict. |
| RESTREND | "Residual trend": testing whether that leftover part is trending. |
| Land surface temperature (LST) | How hot the ground or rooftops are, as seen from space. It is not the air temperature people feel. |
| Terrestrial water storage (TWS) | All water in a region (groundwater, soil water, lakes, snow), weighed from space by the GRACE satellites. |
| Root-zone wetness | A model estimate, 0 to 1, of how wet the top metre of soil is. |
| Land cover | What the surface is: forest, cropland, grassland, city, water, bare ground. |
| Koppen-Geiger class | A standard label for climate type, such as "hot semi-arid" or "temperate oceanic". |
| Lag-1 autocorrelation (AC1) | How much one reading resembles the one before it. Rising AC1 can mean land recovers from shocks more slowly. |
| z-score | How many "typical yearly swings" a value sits above or below the baseline average. |
| MODIS / VIIRS | NASA satellite instruments that image the whole Earth every day. VIIRS is the newer one. |
| GRACE / GRACE-FO | Twin-satellite missions that measure tiny gravity changes to weigh water. |
| NASA POWER | A NASA service giving weather history for any point since 1981. |
| ORNL DAAC | NASA's Oak Ridge data centre, which serves MODIS and VIIRS values for any point. |
| GIBS | NASA's map-tile service for satellite imagery. |
| SSE (Server-Sent Events) | A simple way for a server to push progress messages to a browser over one connection. |

## 3. User journey

This is the full experience in order. Section 8 specifies each screen in detail.

1. **Landing.** A dark page with a slowly rotating 3D Earth. A search box sits centred near the top: "Type any place on Earth". Under it, three example chips. A small line reads "Places checked live today: N".
2. **Search.** The person types a place name or pastes coordinates such as `13.5, 7.1`. A dropdown shows up to five matches. They pick one, or click anywhere on the globe.
3. **Fly-to.** The globe stops rotating, spins to the place and zooms in over about 3.5 seconds. A pin drops. A small outlined square shows the exact 250 m area analysed.
4. **Live loading.** A panel slides in from the right with a checklist. Each line names a NASA source and ticks when its data arrives. A counter such as "Greenness 37/60" updates as requests return. Fast items (rain, water, climate) tick within 3 seconds.
5. **Early results.** As soon as rain, water and climate data are in, their vital-sign rows appear. The person is never staring at a blank screen.
6. **Headline.** When greenness finishes, the headline card animates in: the verdict sentence, the 5-Year Change dial, and one caveat line.
7. **Vital signs.** Five rows, each with an icon, a plain result, a sparkline, a coloured status pill and an "Explain" control that expands a two-sentence method note with its citation.
8. **Hero chart.** "Rain-only vs reality": two lines over 25 years. The gap between them is the part rain does not explain.
9. **5-Year Change.** Four semicircle dials with a dot plot under each showing baseline years against recent years.
10. **Then / Now / Next.** Three panels: imagery from the early record, recent imagery, and the projected climate type.
11. **Simulations.** Interactive panels, each labelled "Measured" or "Illustration".
12. **Methods and limits.** A link opens a page listing every dataset, method, citation and caveat.
13. **Share.** A button downloads a postcard image with the place name, verdict, score and data credits.
14. **Try another.** The search box stays pinned at the top. A new search flies the globe to the next place.

### Two reading modes

A toggle in the header switches wording only, never numbers:

- **Explorer** (default): short, friendly sentences for the public and students.
- **Analyst**: the same results with numbers, units, p-values and confidence intervals shown inline.

## 4. Architecture and tech stack

The app is a React single-page front end talking to one Python service. The Python service fetches NASA data in parallel, runs the statistics, and streams progress and results back to the browser.

```
 Browser (React + TypeScript)
   |  1. GET /api/geocode?q=...            (place name -> coordinates)
   |  2. GET /api/checkup/stream?lat&lon   (Server-Sent Events)
   v
 Python backend (FastAPI)
   |-- geocode.py     -> OpenStreetMap Nominatim (cached)
   |-- fetch_ornl.py  -> NASA ORNL DAAC subset API   (greenness, surface heat, land cover)
   |-- fetch_power.py -> NASA POWER API              (rain, air temperature, soil wetness)
   |-- grace.py       -> bundled GRACE file on disk  (regional water storage)
   |-- koppen.py      -> bundled climate-class files (now and 2041-2070)
   |-- science/*.py   -> trends, rain adjustment, score, verdict
   |-- cache.py       -> SQLite (results keyed by rounded coordinates)
   v
 Browser receives: progress events -> partial results -> final result JSON
   |-- MapLibre globe: fly-to, pin, NASA GIBS imagery tiles (loaded directly from NASA)
   |-- Charts and simulations: computed in the browser from the result JSON
```

### Why this split

- NASA calls go through the backend because one check needs about 75 requests, some services may not allow browser calls, and caching must be shared.
- Simulations run in the browser from numbers already in the result JSON, so sliders respond instantly with no server round trip.
- Imagery tiles load straight from NASA GIBS into the map. The backend never proxies images.

### Backend stack (Python 3.11+)

| Need | Library | Notes |
| --- | --- | --- |
| Web framework | `fastapi`, `uvicorn` | Async endpoints |
| Streaming progress | `sse-starlette` | Server-Sent Events |
| HTTP client | `httpx` (async) | One shared client, connection pool, timeouts |
| Concurrency limit | `asyncio.Semaphore` | Max 8 parallel ORNL requests |
| Arrays and tables | `numpy`, `pandas` |  |
| Trend tests | `pymannkendall` | `hamed_rao_modification_test`, `sens_slope` |
| Other statistics | `scipy` | `linregress`, `pearsonr`, `mannwhitneyu`, `kendalltau` |
| Seasonal decomposition | `statsmodels` | `STL`, stretch badge only |
| Bundled grid files | `xarray`, `netCDF4`, `rasterio` | Used by the one-off preparation scripts |
| Cache | `sqlite3` (standard library) | One file, `cache.db` |
| Settings | `pydantic-settings` | Environment variables |
| Tests | `pytest`, `pytest-asyncio`, `respx` | Mock HTTP in tests |

### Front-end stack

| Need | Library | Notes |
| --- | --- | --- |
| Build | Vite + React 18 + TypeScript |  |
| Globe and map | `maplibre-gl` v5 or later | Globe projection and `flyTo` built in; open source, no token |
| Charts | `recharts` | Line, area, scatter, reference lines |
| Motion | `motion` (Framer Motion) | Panel transitions, number count-up, spring physics |
| Simulation drawing | SVG plus `requestAnimationFrame` | No game engine needed |
| Scales and maths helpers | `d3-scale`, `d3-array` | For custom SVG dials and dot plots |
| State | `zustand` | One store for the current check-up |
| Styling | Tailwind CSS | Design tokens in section 9 |
| Icons | `lucide-react` |  |
| Share card | `html-to-image` | Renders a hidden DOM node to PNG |
| Routing | `react-router-dom` | `/`, `/place/:lat/:lon`, `/methods` |

### Repository layout

```
bright-spots/
  README.md  LICENSE (MIT)  .env.example
  backend/
    pyproject.toml
    app/
      main.py            # FastAPI app, routes, CORS
      config.py          # settings
      models.py          # pydantic response models (section 6)
      cache.py
      geocode.py
      fetch_ornl.py
      fetch_power.py
      grace.py
      koppen.py
      pipeline.py        # orchestrates one check-up and emits events
      science/
        annual.py        # 16-day values -> yearly values
        trend.py         # Mann-Kendall, Sen slope
        restrend.py      # rain adjustment
        water.py
        heat.py
        landcover.py
        change_score.py  # 5-Year Change
        steadiness.py    # stretch
        verdict.py       # decision rules and wording keys
    data/
      grace_1deg.npz         # prepared by scripts/prepare_grace.py
      koppen_now_0p5.npy     # prepared by scripts/prepare_koppen.py
      koppen_future_0p5.npy
      koppen_legend.json
    scripts/
      prepare_grace.py  prepare_koppen.py  prewarm.py
    tests/
  frontend/
    package.json  vite.config.ts  tailwind.config.ts
    src/
      main.tsx  App.tsx
      api/        # client, SSE hook, types mirroring models.py
      store/      # zustand store
      components/ # one folder per component in section 8
      sims/       # simulations in section 10
      copy/       # all user-facing strings, Explorer and Analyst
      styles/
```

### Running locally

- Backend: `uvicorn app.main:app --reload --port 8000`
- Front end: `npm run dev` on port 5173, with a Vite proxy sending `/api` to port 8000.
- CORS: allow the front-end origin only.

### Deployment

**Decide:** any host that runs a long-lived Python process and allows streaming responses (for example Render, Fly.io or Railway) for the backend, and any static host for the front end. Serverless functions with short timeouts are not suitable, because one check can run 40 seconds.

## 5. Data sources

Six sources feed the app. Two are live NASA web services with no login, two are files bundled with the backend, one is a place-name lookup, and one is imagery tiles loaded by the map.

| # | Source | Gives | Scale | Access |
| --- | --- | --- | --- | --- |
| 1 | NASA ORNL DAAC subset API | Greenness, surface heat, land cover | 250 m to 1 km | Live, no login |
| 2 | NASA POWER API | Rain, air temperature, root-zone wetness | about 50 km | Live, no login |
| 3 | GRACE / GRACE-FO mascons | Regional water storage | about 300 km | Bundled file |
| 4 | Koppen-Geiger maps (Beck et al. 2023) | Climate type now and 2041 to 2070 | 0.5 degree | Bundled file |
| 5 | OpenStreetMap Nominatim | Place name to coordinates | n/a | Live, rate limited |
| 6 | NASA GIBS | Satellite imagery tiles | n/a | Live, from the browser |

### 5.1 NASA ORNL DAAC subset API (greenness, heat, land cover)

Base URL: `https://modis.ornl.gov/rst/api/v1/`. Send header `Accept: application/json`.

**List available dates for a point**

```
GET /{product}/dates?latitude={lat}&longitude={lon}
-> {"dates":[{"modis_date":"A2000049","calendar_date":"2000-02-18"}, ...]}
```

**Get values for a date range (maximum 10 dates per request)**

```
GET /{product}/subset?latitude={lat}&longitude={lon}
      &startDate=A2001001&endDate=A2001145
      &kmAboveBelow=0&kmLeftRight=0
-> {"subset":[{"band":"250m_16_days_NDVI","modis_date":"A2001001",
               "calendar_date":"2001-01-01","data":[4312]}, ...],
    "scale":"0.0001", ...}
```

`kmAboveBelow=0&kmLeftRight=0` returns the single pixel containing the point. Every band of the product comes back in the response; filter by `band` in code.

| Product | Used for | Band to read | Scale | Quality band | Keep when |
| --- | --- | --- | --- | --- | --- |
| `MOD13Q1` | Greenness (NDVI), 250 m, every 16 days, from Feb 2000 | `250m_16_days_NDVI` | multiply by 0.0001 | `250m_16_days_pixel_reliability` | reliability is 0 or 1 |
| `MOD11A2` | Surface heat, 1 km, every 8 days | `LST_Day_1km` | multiply by 0.02, result in Kelvin | `QC_Day` | value is not 0 |
| `MCD12Q1` | Land cover, 500 m, yearly | `LC_Type1` | class code 1 to 17 | none | always |
| `VNP13A1` | Greenness fallback (VIIRS), 500 m, from 2012 | `500_m_16_days_NDVI` | multiply by 0.0001 | pixel reliability band | reliability is 0 or 1 |

Fill values to drop: NDVI `-3000`; LST `0`.

**Call plan for greenness.** Call `/MOD13Q1/dates` once. Keep dates from 2001-01-01 to the end of the last complete year. Split into chunks of 10 consecutive dates. That is about 58 chunks. Request them with at most 8 running at once. Emit a progress event after each chunk returns.

**Call plan for surface heat.** From POWER data (5.2), find the warmest calendar month at the point. For each year request only the four 8-day composites centred on that month. That is about 100 dates, so about 10 to 25 requests depending on how the dates group.

**Call plan for land cover.** Request the first available year (2001) and the latest available year. Two requests.

**Robustness.** Timeout 20 seconds per request. Retry twice with backoff of 1 and 3 seconds. If more than 20% of greenness chunks fail, report greenness as unavailable and try `VNP13A1`.

### 5.2 NASA POWER API (rain, air temperature, soil wetness)

One request returns everything.

```
GET https://power.larc.nasa.gov/api/temporal/monthly/point
      ?parameters=PRECTOTCORR,T2M,GWETROOT
      &community=AG&longitude={lon}&latitude={lat}
      &start=2000&end={last_complete_year}&format=JSON
-> properties.parameter.PRECTOTCORR = {"200001": 1.82, ..., "200013": 2.10}
```

| Parameter | Meaning | Unit | Handling |
| --- | --- | --- | --- |
| `PRECTOTCORR` | Rainfall | mm per day, monthly mean | Multiply by days in month, sum to a yearly total in mm |
| `T2M` | Air temperature at 2 m | degrees C | Monthly means; used for warm-season choice and heat adjustment |
| `GWETROOT` | Root-zone soil wetness (model) | 0 to 1 | Yearly mean |

Keys ending in `13` are annual values; ignore them and compute yearly values yourself. Missing value is `-999`; drop it.

### 5.3 GRACE / GRACE-FO water storage (bundled)

Source file: the CSR RL06.3 mascon grid, a single NetCDF with variable `lwe_thickness` (liquid water equivalent thickness, in cm), monthly from April 2002, on a 0.25 degree grid.

`scripts/prepare_grace.py` runs once before the build and writes `data/grace_1deg.npz`:

1. Open the NetCDF with `xarray`.
2. Average 4 by 4 cells to a 1 degree grid (180 by 360).
3. Save arrays `lwe` (time, lat, lon) as float32, `time` as year-month strings, `lat`, `lon`.

At run time `grace.py` loads the file into memory at startup and returns the monthly series of the cell containing the point. Months missing between the two missions (roughly mid-2017 to mid-2018) stay missing. Ocean cells return "no data".

### 5.4 Koppen-Geiger climate maps (bundled)

Source: Beck et al. 2023, files at 0.5 degree for 1991 to 2020 and for 2041 to 2070 under scenario SSP2-4.5.

`scripts/prepare_koppen.py` converts both to `uint8` arrays of shape 360 by 720 and writes `koppen_legend.json` mapping codes 1 to 30 to a short code and a plain name, for example `{"4": {"code": "BWh", "name": "Hot desert"}}`. Code 0 means no data (ocean).

### 5.5 Place search (Nominatim)

```
GET https://nominatim.openstreetmap.org/search?q={text}&format=jsonv2&limit=5
Headers: User-Agent: BrightSpots/0.1 (contact email)
```

Rules: call only from the backend, at most one request per second, cache every query for 30 days. If the input parses as two numbers, treat it as latitude and longitude and skip the lookup. Each match returns `display_name`, `lat`, `lon` and `boundingbox`.

### 5.6 NASA GIBS imagery tiles (browser)

Used as the globe's surface and for the time machine. Tile URL pattern for MapLibre raster sources (note the y-before-x order):

```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{Layer}/default/{Time}/{TileMatrixSet}/{z}/{y}/{x}.{ext}
```

| Use | Layer | Time | TileMatrixSet | ext |
| --- | --- | --- | --- | --- |
| Globe base | `BlueMarble_ShadedRelief_Bathymetry` | `default` | `GoogleMapsCompatible_Level8` | jpeg |
| Time machine | `MODIS_Terra_CorrectedReflectance_TrueColor` | a date, for example `2003-07-15` | `GoogleMapsCompatible_Level9` | jpg |

Set `maxzoom` on each source to the level in its TileMatrixSet name so MapLibre over-zooms instead of requesting missing tiles. Show the credit line "Imagery: NASA GIBS" on the map.

## 6. Backend

The backend exposes four endpoints. The main one streams a check-up as a sequence of events so the browser can show progress and partial results.

### 6.1 Endpoints

| Method and path | Purpose | Returns |
| --- | --- | --- |
| `GET /api/health` | Liveness and data-file check | `{"ok": true, "grace": true, "koppen": true}` |
| `GET /api/geocode?q={text}` | Place search | List of up to 5 matches |
| `GET /api/checkup/stream?lat={lat}&lon={lon}&name={optional}` | Run one check-up, streaming | Server-Sent Events (6.3) |
| `GET /api/checkup?lat={lat}&lon={lon}` | Fetch a finished check-up from cache | Result JSON (6.4) or 404 |
| `GET /api/stats` | Counter for the landing page | `{"checked_today": 37}` |

Validate inputs: latitude -90 to 90, longitude -180 to 180. Round both to 4 decimal places before use.

### 6.2 The pipeline, step by step

`pipeline.py` runs these steps for one coordinate. Steps marked (parallel) start together.

1. **Cache check.** Key is `round(lat, 3), round(lon, 3)` plus a data version string. If a result under 30 days old exists, emit it as `result` with `"source": "cached"` and stop.
2. **Instant lookups** (no network): Koppen class now and future; GRACE monthly series. Emit `partial` events for `future_climate` and raw water data.
3. **POWER request** (parallel with step 4). On return, compute yearly rain, yearly wetness, monthly temperature climatology and the warmest month. Emit `stage` done.
4. **Greenness dates request**, then the chunked greenness requests (parallel, 8 at a time). Emit a `progress` event after each chunk.
5. **Land-cover requests** (parallel with step 4).
6. **Surface-heat requests.** Start as soon as step 3 has given the warmest month.
7. **Water bank computation.** Needs only GRACE and POWER, so it finishes early. Emit `partial` for `water`.
8. **Greenness computation** when step 4 completes: yearly NDVI, trend. Emit `partial` for `greener`.
9. **Rain adjustment** (needs steps 3 and 8). Emit `partial` for `beyond_rain`.
10. **Surface heat computation** (needs steps 3 and 6). Emit `partial` for `heat`.
11. **Land-cover guard** (needs step 5). Emit `partial` for `landcover`.
12. **5-Year Change scores** for each vital sign and the capped overall score.
13. **Verdict** from the decision rules in section 7.8.
14. **Emit `result`** with the full JSON, store it in the cache, increment the daily counter.

If any step fails, record the failure in that vital sign's `status` and continue. A check-up always ends with a `result` event, even if parts are unavailable.

### 6.3 Server-Sent Events

Each event has a name and a JSON body.

| Event | Body | When |
| --- | --- | --- |
| `stage` | `{"id": "power", "label": "Rain and temperature since 2000 (NASA POWER)", "state": "started" or "done" or "failed", "host": "power.larc.nasa.gov", "ms": 812}` | Start and end of each data source |
| `progress` | `{"id": "greenness", "done": 37, "total": 58}` | After each greenness or heat chunk |
| `partial` | `{"key": "water", "data": { vital sign object }}` | When one vital sign is ready |
| `result` | Full result object (6.4) | Once, at the end |
| `error` | `{"message": "...", "fatal": true}` | Only if nothing can be returned |

Stage ids, in display order: `geocode`, `climate` (Koppen), `water` (GRACE), `power`, `greenness`, `landcover`, `heat`, `analysis`.

Send a comment line every 10 seconds as a keep-alive.

### 6.4 Result JSON

This is the contract between backend and front end. Mirror it in `models.py` (pydantic) and `api/types.ts`.

```json
{
  "version": "1.0",
  "source": "live",
  "computed_at": "2026-11-14T18:22:05Z",
  "elapsed_ms": 24310,
  "place": {
    "name": "Maradi, Niger", "lat": 13.5, "lon": 7.1,
    "pixel_bounds": [[13.499, 7.099], [13.501, 7.101]],
    "surface": "land"
  },
  "period": {"start_year": 2001, "end_year": 2025,
             "baseline": [2001, 2015], "recent": [2021, 2025]},
  "verdict": {
    "key": "greener_beyond_rain",
    "headline": "Greener beyond the rain",
    "sentence": "Greenness here has risen since 2001, more than rainfall explains, and the wider region's water bank is not falling.",
    "caveat": "Satellites show what changed, not who or why.",
    "tone": "better",
    "warnings": []
  },
  "overall_score": {"value": 38, "label": "Somewhat better", "capped": false,
                    "cap_reason": null, "certain": true},
  "vitals": {
    "greener": { "...see vital sign object..." },
    "beyond_rain": {}, "water": {}, "heat": {}, "landcover": {}
  },
  "badges": {
    "steadiness": {"status": "skipped"},
    "future_climate": {
      "status": "ok",
      "now": {"code": "BSh", "name": "Hot semi-arid"},
      "future": {"code": "BWh", "name": "Hot desert"},
      "changes": true, "scenario": "SSP2-4.5", "future_period": "2041-2070",
      "scale": "about 50 km grid"
    }
  },
  "series": {
    "years": [2001, 2002],
    "ndvi": [0.21, 0.22],
    "ndvi_valid_counts": [21, 23],
    "rain_mm": [412, 388],
    "ndvi_predicted_by_rain": [0.20, 0.19],
    "ndvi_residual": [0.01, 0.03],
    "wetness": [0.31, 0.29],
    "lst_minus_air_c": [9.1, 8.7],
    "water_months": ["2002-04"], "water_cm": [1.2],
    "water_cm_deseasoned": [0.4]
  },
  "rain_fit": {"applicable": true, "intercept": 0.12, "slope_per_mm": 0.00023,
               "r": 0.71, "p": 0.0004, "rain_min": 250, "rain_max": 640,
               "rain_recent_mean": 455},
  "sources": [
    {"id": "greenness", "name": "NASA MODIS MOD13Q1 via ORNL DAAC",
     "scale": "250 m square", "requests": 58, "failed": 0}
  ],
  "limits": ["The greenness square covers about 6 hectares around the point."]
}
```

**Vital sign object** (same shape for every vital sign):

```json
{
  "status": "ok",
  "status_note": null,
  "scale": "250 m square",
  "answer": "yes",
  "plain": "Greenness has risen steadily since 2001.",
  "analyst": "Sen slope +0.0041 NDVI/yr (95% CI 0.0022 to 0.0060), Mann-Kendall p = 0.003, n = 25",
  "tone": "better",
  "trend": {"slope_per_year": 0.0041, "ci_low": 0.0022, "ci_high": 0.0060,
            "p": 0.003, "significant": true, "direction": "up",
            "percent_change": 31.5, "n_years": 25, "unit": "NDVI"},
  "change_5yr": {"z": 0.82, "score": 39, "label": "Somewhat better",
                 "p": 0.011, "certain": true,
                 "baseline_mean": 0.22, "recent_mean": 0.26,
                 "baseline_values": [0.21], "recent_values": [0.26]},
  "sparkline": [0.21, 0.22],
  "method": "Yearly average NDVI, Mann-Kendall test with Hamed-Rao correction, Theil-Sen slope.",
  "citation": "UNCCD Good Practice Guidance for SDG 15.3.1, v2 (2021)"
}
```

- `status` is one of `ok`, `not_applicable`, `insufficient_data`, `unavailable`, `skipped`.
- `tone` is one of `better`, `worse`, `same`, `neutral`, `unknown`. It drives colour.
- `answer` is a short machine value per vital sign (`yes`, `no`, `unclear`, `rising`, `falling`, `steady`, `changed`, `stable`).

### 6.5 Caching

- SQLite table `checkups(key TEXT PRIMARY KEY, lat REAL, lon REAL, result_json TEXT, created_at TEXT)`.
- Table `http_cache(url TEXT PRIMARY KEY, body TEXT, created_at TEXT)` for raw ORNL and POWER responses, kept 30 days. This makes a repeated or nearby check fast and protects the demo if a service slows down.
- Table `geocode_cache(q TEXT PRIMARY KEY, body TEXT, created_at TEXT)`.
- Table `counter(day TEXT PRIMARY KEY, n INTEGER)`.

### 6.6 Pre-warming is not staging

`scripts/prewarm.py` runs the real pipeline for a list of about 20 well-known places before the demo so they load instantly. The result still carries `"source": "cached"` and the interface shows a "cached" tag. Any place not in the cache runs fully live.

### 6.7 Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `ORNL_CONCURRENCY` | 8 | Parallel ORNL requests |
| `HTTP_TIMEOUT_S` | 20 | Per-request timeout |
| `CACHE_DAYS` | 30 | Cache lifetime |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `CONTACT_EMAIL` | none | Sent in the Nominatim User-Agent |
| `LAST_COMPLETE_YEAR` | 2025 | End of the analysis period |

## 7. Science

Every calculation uses a published method. Implement them exactly as written. All thresholds are constants in one file, `science/constants.py`.

### 7.0 Why these checks belong together

The set follows two established frameworks. The UN land-degradation indicator (SDG 15.3.1) judges land by vegetation productivity and land cover. Earth-system science adds that plants trade water for growth and change surface temperature. So the checks are: is plant life changing, is that more than the weather, what does it cost in water, what does it do to surface heat, and did the land type change.

| Vital sign | Scientific name | Key reference |
| --- | --- | --- |
| Greener? | Vegetation productivity trend | UNCCD Good Practice Guidance for SDG 15.3.1, v2 (2021) |
| Beyond the rain? | Residual trend (RESTREND) | Evans and Geerken (2004); Burrell, Evans and Liu (2017) |
| Water bank | Terrestrial water storage trend | Rodell et al. (2018); Feng et al. (2016) |
| Surface heat | Land surface temperature trend relative to air temperature | Li et al. (2015) |
| Land-cover guard | Land-cover transition | SDG 15.3.1 land-cover sub-indicator |
| Steadiness (badge) | Lag-1 autocorrelation trend | Scheffer et al. (2009); Smith, Traxl and Boers (2022) |
| Future climate (badge) | Koppen-Geiger class shift | Beck et al. (2023) |
| 5-Year Change | Recent state against baseline | SDG 15.3.1 productivity "State"; Weatherhead et al. (1998) |

### 7.1 Shared helpers

**Analysis years.** 2001 to `LAST_COMPLETE_YEAR` (2025). Baseline B = 2001 to 2015. Recent R = the last 5 complete years (2021 to 2025).

**Trend function** `trend(years, values)`:

1. Drop missing years. If fewer than 15 values remain, return `insufficient_data`.
2. Run `pymannkendall.hamed_rao_modification_test(values)`. Take `p`, `trend` direction, and `slope` (Theil-Sen).
3. Get the slope confidence interval from `scipy.stats.theilslopes(values, years, 0.95)`.
4. `significant = p < 0.05`.
5. `percent_change = slope * (n - 1) / abs(mean of first 5 values) * 100`.

**Deseasonalise monthly series:** subtract each calendar month's long-term mean.

### 7.2 Greener? (yearly greenness trend)

1. From MOD13Q1, keep composites with reliability 0 or 1 and NDVI not equal to fill. Scale by 0.0001.
2. For each calendar year, yearly NDVI = mean of valid composites. If a year has fewer than 12 valid composites of 23, mark that year missing.
3. If the mean of all yearly NDVI is below 0.10, set status `not_applicable` with note "Not enough plant life to judge" and stop. This covers deserts, ice, water and dense city cores.
4. Run `trend`. Answer: `yes` if significant and up, `no` if significant and down, otherwise `unclear`.
5. Tone: up is `better`, down is `worse`, otherwise `same`.

Plain wording: "Greenness has risen steadily since 2001." / "Greenness has fallen since 2001." / "No clear change in greenness since 2001."

### 7.3 Beyond the rain? (rain adjustment)

1. Yearly rain in mm from POWER (section 5.2).
2. **Applicability test.** Over all analysis years compute `scipy.stats.pearsonr(rain, ndvi)`. The rain adjustment applies only if `r > 0` and `p < 0.05`. Otherwise set status `not_applicable` with note "Plants here are not mainly limited by rain, so a rain adjustment does not apply." This is expected in wet, cold or irrigated places.
3. **Fit.** `scipy.stats.linregress(rain, ndvi)` over all analysis years gives `intercept` and `slope_per_mm`.
4. **Predicted greenness** for each year = `intercept + slope_per_mm * rain`. Save as `ndvi_predicted_by_rain`.
5. **Residual** = actual minus predicted. Save as `ndvi_residual`.
6. Run `trend` on the residuals. Answer: `yes` if significant and up (greener than rain explains), `no` if significant and down, otherwise `unclear` (in step with rain).
7. Save `rain_fit` for the hero chart and rain slider, including the observed rain range.

Plain wording: "Greener than the rain explains." / "Less green than the rain would predict." / "Greenness moves in step with the rain."

### 7.4 Water bank

1. GRACE monthly series for the 1 degree cell. If the cell is ocean or has fewer than 120 valid months, status `unavailable`.
2. Deseasonalise. Compute yearly means (need at least 8 valid months in a year).
3. Run `trend` on yearly means, with the minimum lowered to 12 years because the record starts in 2002. Unit: cm of water per year.
4. Answer: `falling` if significant and down, `rising` if significant and up, else `steady`. Tone: falling is `worse`, rising is `better`, steady is `same`.
5. Also run `trend` on yearly POWER root-zone wetness and report it as a secondary line: "Model estimate of local soil wetness: rising / falling / steady".
6. Scale label: "the wider region, about 300 km across". Never describe this as the water under one field or one building.

### 7.5 Surface heat

1. Warm season = the warmest calendar month by POWER `T2M` climatology, plus the month either side.
2. From MOD11A2, convert `LST_Day_1km` to Celsius: `value * 0.02 - 273.15`. Drop zeros.
3. For each year, warm-season LST = mean of valid composites in the warm season (need at least 2).
4. For each year, warm-season air temperature = mean POWER `T2M` over the same months.
5. Yearly value = LST minus air temperature. This removes background climate warming so the result reflects the local surface.
6. Run `trend`. Answer `rising`, `falling` or `steady`.
7. **Tone depends on latitude.** If absolute latitude is under 45 degrees: falling is `better`, rising is `worse`. At 45 degrees or more, tone is always `neutral`, because more tree cover can warm the surface there. Add the note "At this latitude, a cooler surface is not always a sign of healthier land."

### 7.6 Land-cover guard

1. Read MCD12Q1 `LC_Type1` for the first and latest year.
2. Map the 17 IGBP codes to groups: Forest (1-5), Shrub and savanna (6-9), Grassland (10), Wetland (11), Cropland (12, 14), Built-up (13), Snow and ice (15), Bare (16), Water (17).
3. Answer `changed` if the group differs, else `stable`. Report both names.
4. Tone is `neutral` for stable. For changed, tone is `unknown` and a warning is added to the verdict: "Land use changed from X to Y, so greenness changes may reflect a different kind of land, not healthier land."
5. If the latest group is Built-up, add the warning "Mostly built-up land. Greenness here mainly reflects construction and parks."
6. If the latest group is Water or Snow and ice, set place `surface` accordingly (section 11).

### 7.7 The 5-Year Change score

A 5-year trend line is statistically weak, so the score compares levels: the last 5 years against the baseline.

For a yearly series `x`:

```latex
z = \frac{\operatorname{mean}(x_R) - \operatorname{mean}(x_B)}{\operatorname{sd}(x_B)}
\qquad
S = \operatorname{round}\left(100 \cdot \tanh\left(\frac{z}{2}\right)\right)
```

- `sd` is the sample standard deviation of the baseline years. If it is zero or fewer than 10 baseline years are valid, return `insufficient_data`.
- Certainty: `scipy.stats.mannwhitneyu(recent, baseline, alternative="two-sided")`; `certain = p < 0.05`.
- For surface heat below 45 degrees latitude, flip the sign of `z` so that cooler scores positive. At 45 degrees or more, report the raw change with label "Changed" and no better or worse colour.

| z | Label | Colour token |
| --- | --- | --- |
| 1.5 or more | Clearly better | `better-strong` |
| 0.5 to 1.5 | Somewhat better | `better` |
| -0.5 to 0.5 | About the same | `same` |
| -1.5 to -0.5 | Somewhat worse | `worse` |
| -1.5 or less | Clearly worse | `worse-strong` |

When `certain` is false, append "(not statistically certain)".

**Four dials.** Compute the score for: rain-adjusted greenness (the residual series; if the rain adjustment is not applicable, use raw greenness and say so), raw greenness, water bank, surface heat.

**Overall score.** Start with the rain-adjusted greenness score. If the water bank or surface heat dial is "Clearly worse", cap the overall score at 0 and label it "About the same (capped)", with `cap_reason` naming the dial. Do not average dials: averaging lets a good score hide a bad one.

### 7.8 Verdict rules and fixed wording

Evaluate in this order and take the first match.

| # | Condition | Key | Headline | Tone |
| --- | --- | --- | --- | --- |
| 1 | Surface is ocean | `ocean` | This point is ocean | unknown |
| 2 | Surface is ice or snow | `ice` | Ice and snow: not enough plant life to judge | unknown |
| 3 | Greenness unavailable | `no_data` | Greenness data could not be loaded | unknown |
| 4 | Mean NDVI below 0.10 | `too_bare` | Not enough plant life to judge | unknown |
| 5 | Greenness trend significant and down, or residual trend significant and down | `less_green` | Less green than before | worse |
| 6 | Greenness up, or residual up, and water bank falling | `greener_water_falling` | Greener, but the region's water bank is falling | worse |
| 7 | Rain adjustment applicable and residual trend significant and up | `greener_beyond_rain` | Greener beyond the rain | better |
| 8 | Greenness significant and up, rain adjustment applicable, residual not significant | `greener_with_rain` | Greener, mostly in step with the rain | same |
| 9 | Greenness significant and up, rain adjustment not applicable | `greener` | Greener than before | better |
| 10 | Otherwise | `no_clear_change` | No clear change | same |

Then append warnings, which never change the key: land-cover change, built-up land, high-latitude heat note, low data quality (any year with under 12 valid composites).

Every verdict carries the caveat line **"Satellites show what changed, not who or why."**

**Words that must never appear** in generated text: "caused by", "because of the project", "success", "failure", "healthy", "unhealthy", "proves", "sustainable", "unsustainable". Use "consistent with", "more than rain explains", "worth a closer look".

### 7.9 Steadiness badge (stretch, experimental)

1. Build a regular 16-day NDVI series from MODIS only. Linearly interpolate gaps of up to 3 composites.
2. Decompose with `statsmodels.tsa.seasonal.STL(period=23)`. Keep the residual.
3. In rolling windows of 5 years (115 composites), stepping 1 year, compute lag-1 autocorrelation.
4. `scipy.stats.kendalltau` of AC1 against window index. If tau is positive and p under 0.05, badge reads "Recovering more slowly from shocks". If negative and significant, "Recovering faster". Else "No clear change".
5. Always show the label "Research-grade signal, not a diagnosis". This badge never changes the verdict or the score.

### 7.10 Future climate badge

Look up the 0.5 degree cell in both Koppen arrays. Report the class now, the class for 2041 to 2070 under SSP2-4.5, and whether they differ. Wording when different: "Today: Hot semi-arid. By 2041 to 2070 under a middle scenario: Hot desert." When the same: "Climate type is projected to stay Hot semi-arid." Always add "This is a scenario, not a prediction."

### 7.11 Measurement picker (answers "select variables")

The same `trend` and 5-Year Change functions run on any yearly series. Expose these as selectable measurements in the interface (section 8.9): greenness, rain-adjusted greenness, rainfall, air temperature, root-zone wetness, regional water storage, surface heat. For each, the app shows what is changing, how much, and whether it is significant.

## 8. Front end

The interface is one page with two layers: a full-screen globe behind, and a results panel that slides over the right side. On screens narrower than 900 px the panel becomes a bottom sheet over the globe.

### 8.1 App states

The store holds one `phase` value. Every component renders from it.

| Phase | Globe | Panel |
| --- | --- | --- |
| `idle` | Auto-rotating, zoomed out | Hidden. Search box centred. |
| `flying` | Animating to the place | Hidden. Search box moves to the top bar. |
| `loading` | Still, zoomed in, pin shown | Loading checklist, then vital signs as they arrive |
| `ready` | Still | Full check-up |
| `cannot_judge` | Still | Explanation card (section 11) with whatever data exists |
| `error` | Still | Error card with a retry button |

### 8.2 Layout wireframes

**Idle (landing)**

```
+--------------------------------------------------------------------------+
| BRIGHT SPOTS                                  [Explorer|Analyst] Methods |
|                                                                          |
|                 Is this place really getting better?                     |
|        +----------------------------------------------------+            |
|        | (search icon)  Type any place on Earth             |            |
|        +----------------------------------------------------+            |
|          [Maradi, Niger]  [Punjab, India]  [Seattle, USA]                |
|                                                                          |
|                         .-''''''''-.                                     |
|                      .'   rotating   '.                                  |
|                     /      Earth       \                                 |
|                     \                  /                                 |
|                      '.              .'                                  |
|                         '-........-'                                     |
|                                                                          |
|  Places checked live today: 37                 Imagery: NASA GIBS        |
+--------------------------------------------------------------------------+
```

**Loading and ready (desktop, 1280 px or wider)**

```
+--------------------------------------------------------------------------+
| BRIGHT SPOTS  [ search box, compact ]         [Explorer|Analyst] Methods |
+-----------------------------------+--------------------------------------+
|                                   |  Maradi, Niger            [live]     |
|                                   |  13.50 N, 7.10 E        [Share]      |
|        globe, zoomed in           |  ----------------------------------  |
|                                   |  HEADLINE CARD                       |
|             (pin)                 |  Greener beyond the rain      (+38)  |
|            [250 m]                |  Satellites show what changed,       |
|                                   |  not who or why.                     |
|                                   |  ----------------------------------  |
|                                   |  VITAL SIGNS                         |
|                                   |  (leaf)  Greener?        Yes   ~~~~  |
|                                   |  (rain)  Beyond rain?    Yes   ~~~~  |
|                                   |  (drop)  Water bank    Steady  ~~~~  |
|                                   |  (temp)  Surface heat  Cooler  ~~~~  |
|                                   |  (grid)  Land cover    Stable        |
|                                   |  ----------------------------------  |
|                                   |  RAIN-ONLY VS REALITY  (chart)       |
|  [Then] [Now]  year slider        |  5-YEAR CHANGE  (four dials)         |
|                                   |  THEN / NOW / NEXT                   |
|                                   |  SIMULATIONS                         |
|                                   |  WHAT THIS CANNOT TELL YOU           |
+-----------------------------------+--------------------------------------+
```

Panel width is 520 px on desktop. The panel scrolls; the globe does not. A thin sticky header in the panel keeps the place name and the Share button visible while scrolling.

### 8.3 Component list

| Component | File | Purpose |
| --- | --- | --- |
| `Globe` | `components/Globe/` | MapLibre globe, rotation, fly-to, pin, pixel square, imagery layer |
| `TopBar` | `components/TopBar/` | Logo, compact search, reading-mode toggle, Methods link |
| `SearchBox` | `components/SearchBox/` | Input, suggestions, coordinate parsing, example chips |
| `ResultsPanel` | `components/ResultsPanel/` | Container, scroll, section order |
| `LoadingChecklist` | `components/LoadingChecklist/` | Live stages and progress |
| `HeadlineCard` | `components/HeadlineCard/` | Verdict, overall score dial, caveat, warnings |
| `VitalSignRow` | `components/VitalSignRow/` | One row, expandable |
| `Sparkline` | `components/Sparkline/` | 80 by 24 px line |
| `RainVsRealityChart` | `components/RainVsRealityChart/` | Hero chart |
| `ChangeDials` | `components/ChangeDials/` | Four semicircle dials and dot plots |
| `ThenNowNext` | `components/ThenNowNext/` | Imagery pair and future climate |
| `MeasurementPicker` | `components/MeasurementPicker/` | Choose any variable and see its trend |
| `Simulations` | `sims/` | Section 10 |
| `LimitsCard` | `components/LimitsCard/` | "What this cannot tell you" |
| `ShareCard` | `components/ShareCard/` | Hidden node rendered to PNG |
| `MethodsPage` | `components/MethodsPage/` | Route `/methods` |
| `CannotJudgeCard` | `components/CannotJudgeCard/` | Ocean, ice, bare, error states |

### 8.4 Globe

- Create the map with a style containing one raster source (GIBS Blue Marble, section 5.6) and a dark background colour. After the style loads, call `map.setProjection({type: 'globe'})`.
- Add a faint atmosphere using MapLibre's sky or fog settings if available in the installed version; otherwise skip it.
- **Idle rotation:** on each animation frame, move the centre longitude east by 3 degrees per second. Stop on any user interaction, on search, and when the browser reports `prefers-reduced-motion`.
- **Fly-to:** `map.flyTo({center: [lon, lat], zoom: 9, speed: 0.6, curve: 1.6, essential: true})`. When the `moveend` event fires, set phase to `loading`.
- **Pin:** a custom HTML marker, a 14 px circle with a 2 px white ring and a soft pulsing halo (CSS animation, 2 s loop).
- **Pixel square:** a GeoJSON polygon from `place.pixel_bounds`, drawn as a 1.5 px white outline with a label "250 m area analysed" shown at zoom 11 and above.
- **Click to check:** a click on the globe in `idle` or `ready` starts a check at that coordinate, with the name "Selected point".
- **Imagery controls** (bottom left, shown in `ready`): a segmented control "Then | Now" and a year slider. These swap the GIBS true-colour layer date (section 10.3).
- Start the check-up request at the same moment as the fly-to, so data loads during the animation.

### 8.5 Search box

- Debounce typing by 350 ms, then call `/api/geocode`. Show up to 5 results with the place name in bold and the region in muted text.
- If the text matches two numbers separated by a comma or space, show one row: "Go to 13.5000, 7.1000".
- Keyboard: arrow keys move through results, Enter selects, Escape closes.
- Example chips fill the box and submit immediately.
- Empty result: "No place found. Try a nearby town or paste coordinates."

### 8.6 Loading checklist

One line per stage from the `stage` events, in the order given in section 6.3.

```
  (check)  Climate type, now and 2041-2070        local file        12 ms
  (check)  Regional water storage (GRACE)         local file        18 ms
  (check)  Rain and temperature (NASA POWER)      power.larc.nasa.gov  0.9 s
  (spin)   25 years of greenness (NASA MODIS)     modis.ornl.gov    37 / 58
           [=====================-----------]
  (spin)   Surface heat (NASA MODIS)              modis.ornl.gov     4 / 12
  (dot)    Analysis
```

- States: pending (grey dot), running (spinner), done (check, fades to muted), failed (warning icon with "skipped").
- Each line shows the host name and elapsed time. This is the proof that results are live.
- When a result came from cache, show a single line: "Loaded from cache, computed on 14 Nov 2026" with a "Run again live" link that calls the stream with `&fresh=1`.
- As each `partial` event arrives, its vital-sign row appears below the checklist with a 250 ms fade and 8 px upward slide.
- When `result` arrives, the checklist collapses into one line, "Computed live in 24 s from 75 NASA requests", which expands on click.

### 8.7 Headline card

```
+--------------------------------------------------------------+
|  Greener beyond the rain                          .---.      |
|  Greenness here has risen since 2001, more than  /  +38 \    |
|  rainfall explains, and the wider region's water |       |   |
|  bank is not falling.                            '-------'   |
|                                             Somewhat better  |
|  (i) Satellites show what changed, not who or why.           |
|  (!) Land use changed from Grassland to Cropland ...         |
+--------------------------------------------------------------+
```

- Headline: 24 px, weight 600. Sentence: 15 px. Left border 4 px in the tone colour.
- Score dial: a 96 px semicircle gauge from -100 to +100, needle and number animated from 0 over 900 ms. Label under it.
- If capped, show a small lock icon and the reason: "Capped because the region's water bank is clearly worse."
- Warnings list under the caveat, each with a warning icon, amber text.

### 8.8 Vital sign row

Collapsed, 64 px tall: icon (20 px), name, plain result, sparkline, status pill. Expanded on click: the scale label, the Analyst line, a two-sentence method note, the citation, and a 160 px tall chart of the yearly series with the trend line and the baseline and recent periods shaded.

| Vital sign | Icon (lucide) | Pill text examples |
| --- | --- | --- |
| Greener? | `Leaf` | Yes / No / Unclear |
| Beyond the rain? | `CloudRain` | Yes / In step with rain / Does not apply |
| Water bank | `Droplets` | Rising / Steady / Falling |
| Surface heat | `Thermometer` | Cooler / Steady / Hotter |
| Land-cover guard | `LayoutGrid` | Stable / Changed |

States other than `ok` render the row in muted style with the `status_note` in place of the result, and no sparkline.

### 8.9 Measurement picker

A row of selectable chips: Greenness, Rain-adjusted greenness, Rainfall, Air temperature, Soil wetness, Regional water, Surface heat. Selecting one shows a 220 px chart of that yearly series with its trend line, and four facts in a grid: **What** (the variable and unit), **How much** (slope per decade and percent change), **Significant?** (yes or no with p in Analyst mode), **Last 5 years** (label and score). This component is the direct answer to the challenge statement and must be visible without opening anything.

### 8.10 Rain-only vs reality chart (hero)

- X axis: years 2001 to 2025. Y axis: NDVI, auto-scaled with 10% padding.
- Line 1, dashed, muted: `ndvi_predicted_by_rain`, legend "What rain alone predicts".
- Line 2, solid, 2.5 px: `ndvi`, legend "What satellites saw".
- Area between the two lines filled: `better` colour at 25% opacity where actual is above predicted, `worse` colour where below.
- Faint bars along the bottom showing yearly rain on a secondary axis.
- Vertical band shading the recent 5 years, labelled "Last 5 years".
- Tooltip per year: actual, predicted, difference, rain in mm.
- Caption, one sentence, generated from the residual trend, for example "Since about 2010 this place has been greener than its rainfall predicts."
- On first render, draw the predicted line first (600 ms), then the actual line (900 ms), then fade in the fill.
- If the rain adjustment is not applicable, show only the actual line and the note from section 7.3.
- Label: "Measured".

### 8.11 Change dials

Four semicircle gauges in a 2 by 2 grid: "Plant life, rain-adjusted", "Greenness", "Water bank", "Surface heat". Each has the score, the label, and under it a dot plot: baseline years as small grey dots, recent years as larger coloured dots, on one horizontal axis with the baseline mean marked. One sentence under the grid follows this template: "Compared with 2001 to 2015, the last five years here were **{label}** for plant life, even after accounting for rain (score {S})."

### 8.12 Then / Now / Next

Three equal cards.

- **Then:** a static map image of the place from the earliest clear true-colour year, labelled with the year.
- **Now:** the same view from the latest year.
- **Next:** no image. A large climate-type name, an arrow from the current type to the future type, and the scenario note from section 7.10.

A "Compare" control overlays Then and Now with a draggable vertical divider.

### 8.13 Limits card

Title "What this cannot tell you". Bullets come from `result.limits` plus these fixed lines: who or what caused a change; anything smaller than the square analysed; the air temperature people feel; the water under a single property; whether a change is good for wildlife or people.

### 8.14 Share card

A 1200 by 630 px hidden node: dark background, place name, coordinates, a small still of the globe view, the headline, the overall score dial, the five pills, the date, and "Data: NASA MODIS, POWER, GRACE. Method: brightspots (open source)". The Share button renders it with `html-to-image` and downloads `bright-spots-{place}.png`.

### 8.15 Methods page

Static page at `/methods` with: the problem in three sentences; a table of each vital sign with its dataset, scale, method and citation (from section 7.0); the 5-Year Change formula; the verdict rules table; the full limits list; data credits; a link to the source repository.

### 8.16 Copy

All strings live in `src/copy/` as two dictionaries keyed by the same ids, `explorer` and `analyst`. Components never contain literal user-facing text. Use sentence case everywhere. No exclamation marks.

## 9. Visual design system

The look is a dark, calm "mission control" interface: the globe is the only saturated element, and colour in the panel always carries meaning. Put these values in `tailwind.config.ts` as named tokens and use only the tokens.

### 9.1 Colour tokens

Better is blue and worse is orange, not green and red, so the result is readable with colour-blindness.

| Token | Hex | Use |
| --- | --- | --- |
| `bg` | `#070B14` | Page and space behind the globe |
| `surface` | `#0F1626` | Panel background |
| `surface-2` | `#172033` | Cards inside the panel |
| `border` | `#26324A` | Hairlines, card borders |
| `text` | `#E9EEF7` | Primary text |
| `text-muted` | `#9AA8C0` | Secondary text, axis labels |
| `accent` | `#7CC4FF` | Links, focus rings, active chip |
| `better-strong` | `#2F80ED` | Clearly better |
| `better` | `#8DBEF5` | Somewhat better |
| `same` | `#8A93A6` | About the same, steady |
| `worse` | `#F5B36B` | Somewhat worse |
| `worse-strong` | `#E8761E` | Clearly worse |
| `unknown` | `#5B657A` | Cannot judge, not applicable |
| `warning` | `#F2C94C` | Warning icons and text |

Pills use the tone colour at 18% opacity as background and the full tone colour as text.

### 9.2 Type

- Font: Inter, loaded from Google Fonts with weights 400, 500, 600. Fallback `system-ui`.
- Numbers use `font-variant-numeric: tabular-nums`.
- Sizes: page title 32 px / 600; headline 24 px / 600; section title 13 px / 600, upper-case with 0.08 em letter spacing, `text-muted`; body 15 px / 400, line height 1.55; small 13 px; micro 11 px (labels only).

### 9.3 Space and shape

- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px.
- Card radius 14 px; pill radius 999 px; input radius 12 px.
- Card padding 20 px. Gap between panel sections 24 px.
- Borders 1 px `border`. No drop shadows except the panel edge: `-24px 0 48px rgba(0,0,0,0.35)`.
- Panel background is `surface` at 92% opacity with a 12 px backdrop blur, so the globe shows faintly behind it.

### 9.4 Labels for data honesty

Two small tags appear at the top right of every chart and simulation:

- **Measured**: outlined tag, `accent` colour.
- **Illustration**: outlined tag, `warning` colour.

A third tag, **cached** or **live**, appears next to the place name.

### 9.5 Motion

| Element | Motion | Duration and easing |
| --- | --- | --- |
| Panel entering | Slide from right 40 px and fade | 350 ms, ease-out |
| Vital sign row appearing | Fade and rise 8 px | 250 ms, ease-out, 60 ms stagger |
| Score number | Count from 0 | 900 ms, ease-out |
| Dial needle | Spring to value | stiffness 120, damping 18 |
| Chart lines | Draw left to right | 600 to 900 ms |
| Checklist tick | Scale 0.6 to 1 | 180 ms |
| Globe fly-to | MapLibre `flyTo` | about 3.5 s |

Respect `prefers-reduced-motion`: disable globe rotation, replace fly-to with `jumpTo`, and set all durations to 0.

### 9.6 Accessibility

- Text contrast at least 4.5 to 1 against its background.
- Never rely on colour alone: every pill has a word, every dial has a label.
- All controls reachable by keyboard with a visible 2 px `accent` focus ring.
- Charts have a text summary in an `aria-label` built from the plain sentence.
- The loading checklist is an `aria-live="polite"` region.

## 10. Simulations and animation

There are four simulations. Each runs entirely in the browser from numbers in the result JSON, and each is labelled "Measured" or "Illustration". None calls the server.

### 10.0 Library choices

| Job | Recommended | Why | Alternatives considered |
| --- | --- | --- | --- |
| Globe, spin and zoom | MapLibre GL JS v5 | Open source, no access token, built-in globe and `flyTo`, loads NASA tiles as a normal raster source | CesiumJS: true 3D terrain and the most cinematic fly-in, but heavier and a steeper learning curve. globe.gl (three.js): very pretty from far out, but cannot zoom to street level with map tiles. |
| Charts | Recharts | Simple React components, enough for lines, areas and bars | Plotly: more features, much larger bundle. visx: more control, more code. |
| Interface motion | Motion (Framer Motion) | Springs, layout transitions and number tweens in a few lines | CSS transitions only: fine for fades, awkward for springs. |
| Simulation drawing | SVG driven by React state and `requestAnimationFrame` | Crisp at any size, easy to style with the design tokens, no new dependency | HTML canvas: faster for thousands of particles, which these simulations do not need. A physics or game engine: unnecessary. |

**Decide:** keep MapLibre unless the team has someone experienced with CesiumJS. Do not switch globe library after Saturday morning.

### 10.1 Rain slider (Measured)

**Question it answers:** "How green would this place typically be with more or less rain?"

**Inputs:** `rain_fit.intercept`, `rain_fit.slope_per_mm`, `rain_fit.rain_min`, `rain_fit.rain_max`, `rain_fit.rain_recent_mean`, and the yearly `rain_mm` and `ndvi` arrays.

**Layout:**

```
  RAIN SLIDER                                        [Measured]
  If a year brings  [-----------O---------]  455 mm of rain
                    250 mm              640 mm

  typical greenness would be    0.22   (this place's own pattern)
  last 5 years actually were    0.26   -> 0.04 greener than rain predicts

   NDVI |            o   o
        |        o  o  /o      o = one year (rain, greenness)
        |     o   /o           / = fitted line
        |  o  / o              | = slider position
        +-----------------------
                  rain (mm)
```

**Behaviour:**

- A scatter plot of every year (x = rain, y = NDVI). Recent years are larger and coloured.
- The fitted straight line drawn across the observed rain range only.
- The slider moves a vertical marker; a dot rides the line; the predicted value updates live: `predicted = intercept + slope_per_mm * rain`.
- The slider is limited to the observed minimum and maximum. Do not extrapolate. Show "Outside the range seen here" at the ends.
- A small ground strip under the plot changes tint from tan to green with the predicted value, for a visual cue.
- Hidden when the rain adjustment is not applicable, replaced by the note from section 7.3.

### 10.2 Water bucket (Illustration)

**Question it answers:** "What does a falling water bank mean over time?"

**Model.** A single bucket stands for the region's stored water. Each simulated year:

```latex
S_{t+1} = S_t + P - E - U
```

- `S` is storage in cm. Start at 100 (an arbitrary full mark, shown as a percentage, not as real depth).
- `P` is water in from rain. `E` is water used by plants and evaporation. `U` is extra use such as pumping.
- The simulation does not estimate `P`, `E` and `U` separately. It sets the net yearly change `P - E - U` equal to the **measured** GRACE trend for this region, in cm per year, and lets the person adjust it.

**Layout:**

```
  WATER BUCKET                                   [Illustration]
      rain                                Measured trend here:
      | | |                               -1.8 cm per year
   +---------+   plants and evaporation   (the wider region,
   |         |-->                          about 300 km across)
   |~~~~~~~~~|   extra use (pumping)
   |  water  |-->                         [ Play ]  [ Reset ]
   +---------+
   Year 0 ......................... Year 30

   Extra use:   less [-------O-----] more
```

**Behaviour:**

- Pressing Play animates 30 years in 8 seconds. The water level moves by the net change each year; three arrows (rain in, plant use out, extra use out) pulse.
- The "Extra use" slider shifts the net change between half and double the measured trend. At the measured value the tick is marked "measured".
- If the measured trend is rising or steady, the bucket holds or fills, and the caption says so.
- A line chart to the right plots level against year as it runs.
- Fixed caption: "This is a simple picture of what the measured trend would mean if it continued. Real aquifers are more complex, and trends can change."
- Never display a "runs out in year X" statement. The bucket's full mark is arbitrary.

### 10.3 Time machine (Measured)

**Question it answers:** "What did this place look like across the years?"

- A year slider from 2001 to the latest year sits at the bottom left of the globe.
- Moving it changes the date of the GIBS true-colour raster layer to 15 July of that year in the northern hemisphere and 15 January in the southern hemisphere.
- Implement by adding one raster source per requested year and cross-fading layer opacity over 400 ms, then removing the old source. Keep at most 3 sources alive.
- A Play button steps one year every 700 ms.
- Clouds will cover some dates. Show the note "Single-day images can be cloudy. The charts use many images per year." Offer a "Try another date" control that shifts the day by 8.
- In sync with the slider, a marker moves along the hero chart so the image and the numbers line up.

### 10.4 Future climate dial (Scenario)

**Question it answers:** "What kind of climate is this place heading into?"

- A two-position dial: "1991 to 2020" and "2041 to 2070".
- Each position shows the climate type name, a one-line description from a lookup table (for example Hot desert: "Very dry all year, hot summers"), and a coloured band.
- If the type changes, an arrow animates between the two, and the text reads as in section 7.10.
- Label it "Scenario" using the warning-colour tag, with the line "Based on a middle emissions pathway. Not a prediction."

### 10.5 Ball in a cup (Illustration, stretch)

Shown only if the Steadiness badge was computed. A ball sits in a valley drawn as a curve. A "Nudge" button pushes it; it rolls back. The valley's steepness is set from the latest AC1 value: lower AC1 gives a steep valley and a fast return, higher AC1 a shallow valley and a slow return. Use a damped spring from the Motion library. Caption: "When land recovers more slowly from shocks, readings stay off-balance for longer. This picture shows the idea only."

### 10.6 "Same cause, opposite result" card (Measured, core)

This card answers the challenge's point that one process can produce opposite trends. After a check-up finishes, show a card comparing this place with one contrasting place from the pre-warmed list that has the same greenness direction but the opposite water-bank direction (or the reverse). Two columns, each with the place name, the greenness pill and the water pill, and one sentence: "Both places got greener. Here the region's water held steady; there it fell." If no contrasting cached place exists, hide the card.

## 11. Edge cases, errors and honesty rules

A judge will try unusual places. Every case below must produce a clear, truthful screen, never a crash and never an invented verdict.

### 11.1 Places that cannot be judged

| Input | How to detect | What the app shows |
| --- | --- | --- |
| Open ocean | Koppen code is 0 and the GRACE cell is ocean, or the greenness dates request returns no land data | "This point is ocean. Bright Spots checks land." Offer a button "Go to the nearest coast" only if a land point lies within 50 km; otherwise suggest searching a place name. |
| Ice sheet or permanent snow | Latest land cover is Snow and ice | "Ice and snow: there is not enough plant life to judge greenness." Still show the regional water (ice mass) trend and the future climate badge. |
| Desert or bare ground | Mean yearly NDVI below 0.10 | "Not enough plant life to judge." Still show rain, water bank and future climate. |
| Dense city centre | Latest land cover is Built-up | Normal check-up plus the built-up warning. If mean NDVI is below 0.10, treat as bare. |
| Lake or inland water | Latest land cover is Water | "This point is water." Same handling as ocean. |
| High latitude (45 degrees or more) | Absolute latitude | Normal check-up; surface heat shown without better or worse colour, with the latitude note. |
| Very wet or irrigated place | Rain adjustment fails the applicability test | Normal check-up; "Beyond the rain?" shows "Does not apply here" with the reason. |
| A tiny site | Always | The limits card states the size of the square analysed. |
| Coordinates out of range | Validation | Inline error under the search box: "Latitude must be between -90 and 90." |

In every "cannot judge" case the panel still opens, shows the explanation card first, then any vital signs that do apply.

### 11.2 Service problems

| Problem | Handling |
| --- | --- |
| ORNL slow | Show POWER, GRACE and climate results immediately. Checklist keeps counting. After 45 seconds show "NASA's greenness service is slow right now. Still trying." |
| More than 20% of greenness chunks fail | Retry failed chunks once. If still failing, try VIIRS (`VNP13A1`) and label the result "VIIRS, 2012 onward, shorter record". With under 15 valid years, greenness is `insufficient_data`. |
| POWER fails | Greenness still runs. "Beyond the rain?" and surface heat become `unavailable`. Verdict falls back to rules that do not need rain. |
| Geocoder fails or is rate limited | Message: "Place search is busy. Paste coordinates or click the globe." |
| Stream disconnects | The front end reconnects once, then falls back to polling `GET /api/checkup` every 3 seconds for up to 60 seconds. |
| Bundled file missing | `/api/health` reports it; that vital sign or badge is `unavailable`; the app still runs. |
| Browser has no WebGL | Replace the globe with a static world image and a note; search and results still work. |

### 11.3 Honesty rules for all text

1. Use only the verdict headlines in section 7.8.
2. Every vital sign shows its scale label.
3. Every statistical statement says whether it is certain.
4. The caveat "Satellites show what changed, not who or why" appears on every headline card and every share card.
5. The water bank is always described as regional.
6. Model estimates (root-zone wetness, future climate) are labelled as model estimates or scenarios.
7. No text names a person, community or organisation as responsible for a change.
8. If the app generates any sentence with a language model (not required), the sentence may only restate numbers already in the result JSON, and must pass a check that every number in it appears in that JSON.

### 11.4 Privacy and conduct

- Do not store who searched for what. The counter stores a daily total only.
- Send no user data to third parties. Nominatim receives only the search text.
- Respect the Nominatim usage policy: identify the app, cache, and never exceed one request per second.

## 12. Build order, testing and demo

Build in the order below so there is a working, demonstrable app at the end of every stage.

### 12.1 Build stages

- [ ] **Stage 0, verify (1 hour).** Run every check in section 13. Adjust this spec where reality differs.
- [ ] **Stage 1, skeleton.** Repo layout, FastAPI with `/api/health`, React app with the globe rendering and rotating.
- [ ] **Stage 2, search and fly-to.** `/api/geocode`, search box, coordinate parsing, fly-to, pin.
- [ ] **Stage 3, first live data.** `fetch_power.py`, `/api/checkup/stream` emitting `stage` events for POWER only, loading checklist showing it.
- [ ] **Stage 4, greenness.** `fetch_ornl.py` with chunking, concurrency, retries and `progress` events; `annual.py`; `trend.py`; the Greener? row.
- [ ] **Stage 5, rain adjustment.** `restrend.py`; Beyond the rain? row; the hero chart.
- [ ] **Stage 6, water.** `prepare_grace.py`, `grace.py`, `water.py`; Water bank row.
- [ ] **Stage 7, score and verdict.** `change_score.py`, `verdict.py`; headline card; change dials. **This completes the MVP.**
- [ ] **Stage 8, cache and pre-warm.** SQLite cache, `prewarm.py`, cached and live tags.
- [ ] **Stage 9, core extras.** Surface heat, land-cover guard, future climate badge, measurement picker, rain slider, water bucket, limits card, methods page, share card.
- [ ] **Stage 10, edge cases.** Every row of section 11.1 and 11.2.
- [ ] **Stage 11, stretch.** Time machine, same-cause card, steadiness badge, city mode, before-and-after, multi-place table.
- [ ] **Stage 12, polish.** Motion, reduced-motion, keyboard access, mobile bottom sheet, deploy.

### 12.2 Tests

**Unit tests (backend, no network):**

| Test | Check |
| --- | --- |
| `trend` on a rising synthetic series with noise | significant, direction up, slope within 10% of the true slope |
| `trend` on white noise, 1000 runs | significant in roughly 5% of runs (accept 2% to 9%) |
| `annual` with 11 valid composites in a year | that year is missing |
| RESTREND where NDVI is exactly a linear function of rain | residual trend not significant; verdict `greener_with_rain` if rain rises |
| RESTREND where NDVI rises and rain is flat noise | applicability fails or residual significant up, as constructed |
| 5-Year Change with recent equal to baseline | z about 0, label "About the same" |
| 5-Year Change with z = 2 | score 76 |
| Overall score with water "Clearly worse" | capped at 0, `cap_reason` set |
| Verdict table | one test per row of section 7.8 |
| Heat tone at latitude 60 | `neutral` |
| Forbidden words | no generated string contains any word in the list in section 7.8 |

**Integration tests (mocked HTTP with `respx`):** a full pipeline run returns a valid result object; a run with 30% failed chunks falls back; a run with POWER failing still returns a result.

**Front-end checks:** the result JSON type-checks against `types.ts`; each phase renders; the panel renders correctly with every vital sign in every status.

### 12.3 Reality checks on known places

Run these live and compare with what published studies describe. These are expectations to test, not answers to hard-code. If a result differs, investigate the method first, then report honestly what the data shows.

| Place | Coordinates | Expected pattern from the literature |
| --- | --- | --- |
| Maradi region, Niger | 13.50, 7.10 | Greener than rain explains (farmer-managed tree regrowth) |
| Punjab, India | 30.90, 75.85 | Greener, with the region's water storage falling |
| Central Valley, California | 36.60, -119.80 | Irrigated; rain adjustment may not apply; water storage falling |
| Loess Plateau, China | 36.80, 109.50 | Strong greening; water result contested in the literature |
| Central Sahara | 23.00, 12.00 | Not enough plant life to judge |
| Mid-Pacific | 0.00, -150.00 | Ocean |
| Greenland interior | 72.00, -40.00 | Ice |
| Seattle, USA | 47.61, -122.33 | Built-up warning; high-latitude heat note |
| Eastern Washington, USA | 47.23, -119.85 | Irrigated farmland; useful local contrast for the demo |

### 12.4 Demo preparation

1. Deploy by Sunday 9 am. Run `prewarm.py` for about 20 places on every inhabited continent.
2. Confirm three uncached places run live end to end on the venue network.
3. Record a 90-second screen capture of a full live run as a fallback.
4. Demo script: landing, type a known place, fly-to, narrate the checklist filling, headline, hero chart, rain slider, then invite a judge to name any place.
5. Keep the methods page open in a second tab for questions.

### 12.5 Definition of done (MVP)

- A place typed by a stranger produces a truthful result or a truthful "cannot judge" in under 60 seconds.
- The loading checklist shows real hosts, counts and times.
- The headline, score, three vital signs and hero chart render from live data.
- No text breaks the honesty rules in section 11.3.
- The repository has an MIT licence, a README with run instructions, and data credits.

## 13. Open items to verify

These were not confirmed when this spec was written. Check them in Stage 0 and update the spec.

- [ ] **ORNL response time and throttling.** Time one subset request, then 8 in parallel. If parallel requests are throttled, lower `ORNL_CONCURRENCY`. The 10 to 40 second estimate for greenness is a planning assumption.
- [ ] **ORNL product list.** `GET /api/v1/products` and confirm `MOD13Q1`, `MOD11A2`, `MCD12Q1` and `VNP13A1` are offered, with the exact band names in section 5.1 (`GET /api/v1/{product}/bands`).
- [ ] **A monthly greenness product.** If `MOD13A3` (monthly, 1 km) is offered, it cuts greenness requests from about 58 to about 30. Consider it as a faster fallback.
- [ ] **Latest MOD13Q1 dates.** Confirm data runs through the end of 2025. Terra MODIS is near end of life; if 2025 is incomplete, set `LAST_COMPLETE_YEAR` to 2024.
- [ ] **POWER parameters.** Confirm `PRECTOTCORR`, `T2M` and `GWETROOT` return on the monthly endpoint with `community=AG`, and confirm the unit of monthly `PRECTOTCORR`.
- [ ] **GRACE file.** Download the CSR RL06.3 mascon NetCDF. Confirm the variable name, units and file size, and that `prepare_grace.py` output is under 100 MB.
- [ ] **Koppen files.** Download the Beck et al. (2023) 0.5 degree files for 1991 to 2020 and 2041 to 2070 SSP2-4.5. Confirm the class-code legend.
- [ ] **GIBS layers.** Confirm the layer names, tile matrix sets and file extensions in section 5.6 against the GIBS capabilities document, and that MapLibre loads them with the y-before-x template.
- [ ] **MapLibre globe.** Confirm the installed version supports `setProjection({type: 'globe'})` with raster sources.
- [ ] **Nominatim limits.** Read the current usage policy. If it is too strict for a live demo, switch to Photon (`photon.komoot.io`) with the same response mapping.
- [ ] **Hackathon rules.** Confirm that preparing bundled data files before the event is allowed, and the rule on use of AI tools.
- [ ] **Citations.** Before presenting, open each reference in section 7.0 and confirm the wording used on the methods page.

### Known scientific limits to state openly

- The greenness square is 250 m wide, about 6 hectares. Smaller sites blur into their surroundings.
- Regional water storage describes an area about 300 km across.
- Rainfall and soil wetness come from a weather model on a grid of about 50 km.
- Greener is not always better: plantations, irrigation and invasive plants also look green.
- The rain adjustment assumes a straight-line link between yearly rain and greenness, which fails after abrupt changes.
- Five years is a short window. The score shows where recent years sit against the past, not a forecast.
- The steadiness signal is debated among scientists and is shown as experimental.
