# A park-visit planner on NASA and USGS data: this year measured, next year forecast, 25 years projected, and the honesty each horizon needs

*Prepared by Stardust for a NASA Space Apps team, Sat 14 Nov 2026. Every feed, resolution and finding below was read from the provider's own page or a paper that day through our research protocol (Stardust Scholar #186 and Builder #187). What we did not verify is said at the end.*

## The one-paragraph answer

Each thing a visitor cares about has one authoritative open feed for "now", one long record for "normal", and one honest limit on prediction. Waterfall flow is a USGS gauge (13,500 real-time locations, a REST API, daily statistics back decades). Wildflower bloom is the USA National Phenology Network's observations and its growing-degree-day forecast maps, plus the desert reports that watch autumn rain. Fall foliage is NASA's MODIS and VIIRS land-cover-dynamics products, which give the senescence date of every 500 m cell every year, back to 2001. Caves are the one place where the answer barely changes, and the literature says why. Temperature and humidity are NOAA's 1991 to 2020 normals, PRISM back to 1895 and Daymet at 1 km daily since 1980. For 25 years out, NASA's NEX-GDDP-CMIP6 gives daily downscaled projections to 2100 from 35 models under five scenarios, at a quarter degree. The trap is the middle horizon: a next-year forecast of a bloom or a peak-flow week is not a forecast from a model, it is this year's measured state plus a climatology, and the app should say so in those words. The science is unambiguous about direction: in the West, snowmelt and peak flow have moved two to three weeks earlier in thirty years; warming delays leaf colouring and drought advances it; flowering has moved earlier almost everywhere measured.

## Part 1. The data, by the thing the visitor asks about

| visitor asks | now (this year) | normal (the record) | 25 years out | source pages |
|---|---|---|---|---|
| **Waterfall flow** | USGS Water Data APIs: real-time streamflow and gauge height for 13,500 locations, OGC-compliant REST, WaterAlert text or email when conditions change. The old `waterservices.usgs.gov` shuts down 22 Feb 2027; build on `api.waterdata.usgs.gov`. | USGS daily statistics (mean, median, min, max per day of year) on approved data | not a streamflow projection; use the climate projections' precipitation and temperature plus the published direction of change (below) | https://api.waterdata.usgs.gov/ , https://waterdata.usgs.gov/nwis , https://waterservices.usgs.gov/ |
| **Snow feeding the falls** | NOAA NOHRSC National Snow Analysis (page read, no detail rendered) | Daymet snow water equivalent, 1 km daily, 1980 to present, continental North America and Hawaii, REST subset API | the same projections | https://daymet.ornl.gov/ , https://www.nohrsc.noaa.gov/nsa/ |
| **Wildflower bloom** | Wildflower Search (wildflowersearch.org) finds species by coordinates, elevation and observation time, which is a bloom-by-place-and-week lookup already built; USA-NPN Nature's Notebook observations and its real-time and forecast maps: accumulated growing degree days (AGDD) with short-term forecasts, Pheno Forecasts at 6 days, land-surface phenology from MODIS; DesertUSA's season reports (autumn rain triggers desert germination; a bloom calculator) | USA-NPN historical phenological transition dates; nearly 200 papers rest on the database | projections' temperature and precipitation, with the measured direction of change | https://usanpn.org/data/maps , https://usanpn.org/data/observational , https://www.desertusa.com/wildflo/wildupdates.html , https://www.wildflowersearch.org/ |
| **Fall foliage** | MODIS MCD12Q2 v061 Land Cover Dynamics, yearly, 500 m, global: green-up, maturity, senescence and dormancy dates per cell (Friedl, Gray and Sulla-Menashe 2022, DOI 10.5067/MODIS/MCD12Q2.061, openly shared); VIIRS VNP22Q2 the same from Suomi NPP (DOI 10.5067/VIIRS/VNP22Q2.001); subset either with AppEEARS; the Smoky Mountains prediction map exists and says itself that "no tool can be 100% accurate" | the MODIS record from 2001 gives twenty-plus senescence dates per cell | projections, with the direction from the leaf-senescence literature | https://lpdaac.usgs.gov/products/mcd12q2v061/ , https://lpdaac.usgs.gov/products/vnp22q2v002/ , https://appeears.earthdatacloud.nasa.gov/ , https://smokymountains.com/fall-foliage-map/ |
| **Caverns** | NPS Caves and Karst, the parks, the management reports, Cave Week in June | the literature below: cave temperature follows the surface mean with lag or not at all | caves are the stable place; say so | https://www.nps.gov/subjects/caves/index.htm |
| **Temperature and humidity preference** | NASA POWER (free, low latency, daily); PRISM month-to-date daily grids | NOAA US Climate Normals 1991 to 2020, about 15,000 stations, annual, monthly, daily and hourly, CSV folders; PRISM 800 m and 4 km, daily since 1981, monthly since 1895, 30-year normals; Daymet vapour pressure for humidity | NEX-GDDP-CMIP6: daily 1950 to 2100, quarter degree, 8 variables, 35 models, five experiments (historical, SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5) | https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals , https://prism.oregonstate.edu/ , https://power.larc.nasa.gov/ , https://doi.org/10.1038/s41597-022-01393-4 |
| **The parks themselves** | NPS API (an API key from the developer page), the NPS app; NPS Visitor Use Statistics | visitation by park and month back decades | the visitation-climate paper below | https://www.nps.gov/subjects/developer/index.htm , https://irma.nps.gov/Stats/ |
| **Drought and air** | Drought.gov data and tools, AirNow air quality for 500+ cities | ACIS temperature and precipitation charts | | https://www.drought.gov/data-maps-tools |
| **Imagery for the map** | NASA GIBS tiles | | | https://gibs.earthdata.nasa.gov/ |

## Part 2. What the measurement literature says about each horizon

| finding | evidence | what the app should do with it |
|---|---|---|
| **Snowmelt and peak flow have moved earlier, a lot.** | Colorado, 29 water years: snowmelt and streamflow timing shifted earlier by a median of 2 to 3 weeks; November-to-May temperatures rose 0.9 °C per decade (Clow 2010, 536 citations, https://doi.org/10.1175/2009jcli2951.1). Western US, 50 years: spring peak flows earlier, more rain and less snow, strongest at low elevation and in the Pacific Northwest (Regonda et al. 2005, 507, https://doi.org/10.1175/jcli-3272.1). | For a waterfall, "peak week" is a moving target; show this year's gauge against the day-of-year median, and show the trend line on the normal. |
| **Snowmelt rate, not just amount, sets the flow.** | Faster melt raises subsurface flow; the mechanism and correlations across the West 1950 to 2013 (Barnhart et al. 2016, 401, https://doi.org/10.1002/2016gl069690). | Use SWE and its rate of loss from Daymet or NOHRSC, not SWE alone. |
| **Flowering has moved earlier; the field is large and measured.** | Review of plant phenology under climate change, start and end of season from ground and satellite data (Piao et al. 2019, 2,261 citations, https://doi.org/10.1111/gcb.14619). Subalpine community flowering reshaped by shifts (CaraDonna et al. 2014, 611, https://doi.org/10.1073/pnas.1323073111). | A bloom date is a distribution with a trend, not a date. Show the window and which way it is drifting. |
| **Citizen phenology data are usable for models.** | USA-NPN data versus long-term research sites: comparable parameter estimates and out-of-sample error with trade-offs on scale and observer variance (Taylor et al. 2018, 51, https://doi.org/10.1002/ecy.2568). | Build on USA-NPN; it is the only continental bloom record, and it is good enough. |
| **Autumn colour: warming delays it, drought advances it.** | Photoperiod and temperature control senescence; "climatic warming will delay and drought will advance leaf senescence", varying by species and region (Estiarte and Peñuelas 2015, 479, https://doi.org/10.1111/gcb.12804). A century of warming in Ohio delayed autumn phenology and lengthened the growing season (2023, 28, https://doi.org/10.1371/journal.pone.0282635). | Foliage "peak" prediction needs both the temperature trend and this year's drought; the two push opposite ways. |
| **Satellite phenology products are validated, with known limits.** | MODIS NDVI and EVI green-up products intercompared and interpreted (2017, 146, https://doi.org/10.1016/j.ecolind.2017.02.024); the land cover dynamics product assessed against TIMESAT (2019, 47, https://doi.org/10.3390/rs11192201). | MCD12Q2's senescence date is a per-cell proxy for colour; validate against a few parks' own reports before you promise a week. |
| **Caves barely follow the weather.** | Three thermal patterns in caves: tracking the surface mean, tracking it with delay, or inverted with extreme delay (2023, 43, https://doi.org/10.1038/s41598-023-48014-7); caves as semi-closed systems of "remarkable thermal stability" (Mammola et al. 2019, 185, https://doi.org/10.1177/2053019619851594). | Show a cave as the constant: its published temperature, and that it is the visit that does not depend on the forecast. |
| **Park visitation tracks temperature, and it has been modelled 25 years out.** | 340 parks, 1979 to 2013: a temperature model explains 69% of the variation in visitation; projections for 2041 to 2060 under two warming scenarios (Fisichelli et al. 2015, 169, https://doi.org/10.1371/journal.pone.0128226). Summer visitation vulnerability to temperature and precipitation extremes framed and tested at Glacier, Yellowstone, Grand Teton and Rocky Mountain (2017, 47, https://doi.org/10.1080/14616688.2017.1377283). | Crowding is a predictable layer: warm shoulder seasons get busier. Show it beside the bloom. |
| **Seasonal forecasts months ahead have real but limited skill.** | GloSea5: improved year-to-year prediction of the major modes (ENSO, NAO, AO) and useful skill for a few regional patterns (MacLachlan et al. 2015, 767, https://doi.org/10.1002/qj.2396). | A "next year" number is not a weather forecast. It is climatology plus this year's state plus the trend, with a stated range. |
| **Downscaled projections exist, daily, to 2100.** | NEX-GDDP-CMIP6 (Thrasher et al. 2022, 847, https://doi.org/10.1038/s41597-022-01393-4). | For "25 years from now", show the ensemble spread across models and at least two scenarios, never one line. |
| **Tourists do use weather and climate information, and apps are where they look.** | Weather and climate information for tourism (Scott and Lemieux 2010, 416, https://doi.org/10.1016/j.proenv.2010.09.034); the smartphone app in travel (Wang, Xiang and Fesenmaier 2012, 404, https://doi.org/10.1080/13683500.2012.718380). | The audience is proven; the gap is honesty about horizons. |

## Part 3. The three horizons, and what each may honestly say

1. **This year, measured.** Gauge reading today against the day-of-year median; this week's AGDD and the USA-NPN forecast; this year's MODIS senescence date when it is out; the normals for the dates chosen. Every number carries its date and source.
2. **Next year, forecast.** Say what it is: last year's measured date plus the long-term trend (earlier bloom, earlier peak flow, later colour unless drought), with a window at least as wide as the year-to-year scatter in the record. If a seasonal outlook exists for the season (NOAA's three-month outlooks), show it as a tilt, not a date. The desert bloom is the one case with a real early signal: autumn rain.
3. **25 years out, projected.** NEX-GDDP-CMIP6 temperature and precipitation at the park's cell, 2050 against 1991 to 2020, across the model ensemble and two scenarios, shown as a band; then the literature's directions applied: bloom and peak flow earlier by the measured rates, colour later or earlier depending on drought, caves unchanged, crowds up in the shoulder seasons. Never a single date for 2051.

## Part 4. A build order that fits a weekend

1. Friday night: one park. Pull its nearest USGS gauge (real-time plus daily statistics) and its NOAA normals station. Show today against normal.
2. Saturday morning: USA-NPN AGDD and forecast maps for the park's cell; MCD12Q2 senescence dates for 2001 to last year through AppEEARS. Plot the trend lines.
3. Saturday afternoon: the visitor's preference slider (temperature, humidity) against the normals and this year; the cave card as the constant.
4. Saturday night: next-year window from record plus trend, with the width from the scatter; the sentence that says what it is.
5. Sunday: NEX-GDDP-CMIP6 band for 2050 at the cell, two scenarios; the visitation layer from NPS statistics against temperature.
6. Demo: one park, one date, three horizons on one screen, each labelled measured, forecast or projected, with its source.

## What this file does not claim

The NPS API documentation subpage (the developer index did render: photos, visitor centres, campgrounds, events, alerts and articles, an API key from Get Started), the NOAA data-access service, the MODIS product page at Goddard, the NEX-GDDP pages at NASA, LOCA, the NOAA Climate Explorer and NSIDC Snow Today did not render for us on the day; NEX-GDDP is described from its data paper. USDA SNOTEL was not opened and is not listed; it is the other snow record a team should look for. The OpenAlex query for wildflower superbloom prediction returned nothing, so the bloom-prediction evidence here is the phenology literature and DesertUSA's practice, not a validated superbloom model. Citation counts are OpenAlex's on 14 Nov 2026. Nothing here was run against a park; the first measurement is yours.

## MVP as built (14 Nov 2026)

What runs today, and where it departs from the research above. Open decisions are listed at the end.

**Parks.** The 63 national parks, parsed from Wikipedia's "List of national parks of the United States" (name, state, coordinates, 2025 visitors, nps.gov code), because the NPS API timed out on the day (503, then no answer in 110 s). Ids are slugs of the short name, since Sequoia and Kings Canyon share the NPS code `seki`.

**Data per park and calendar month** (`backend/scripts/prepare_parks.py` → `backend/data/parks/park_climate.json`, about 1 minute for all parks):

| horizon | source | what it is |
|---|---|---|
| this year, measured | NASA POWER monthly (daytime high, mean temperature, humidity, rain, cloud amount, snow depth) | the month's measured value; months not yet published (POWER monthly ran to September 2026) fall back to the 1991–2020 normal and say so |
| next year, forecast | the same POWER record, 1991 to last year | that month's linear trend extended one year, window ±1 residual standard deviation; labelled "forecast from the record, not a weather forecast" |
| 2050, projected | WorldClim 2.1 CMIP6 downscaled monthly normals, 2041–2060, 10 arc-minutes, six models (ACCESS-CM2, EC-Earth3-Veg, MIROC6, MPI-ESM1-2-HR, MRI-ESM2-0, UKESM1-0-LL), SSP2-4.5 and SSP5-8.5 | per model, future minus WorldClim's 1970–2000 baseline added to the POWER normal (rain as a ratio); median and model range; temperature and rain only |

NEX-GDDP-CMIP6 (Part 1) was not used: point extraction across models needs large global daily files. The Open-Meteo Climate API was tried as a stand-in and dropped: one 10-year, 5-variable, 7-model request used the whole free 600-per-minute allowance (measured), so 63 parks would take hours and exceed the daily limit.

**Scoring** (`backend/app/parks/scoring.py`). Each preference is a factor in [0, 1]; the park score is their mean × 100.

- Daytime high against the user's ideal range: 1 inside, falling to 0 at 8 °C outside.
- Humidity (optional maximum): 0 at 20 points above it. Rain (optional monthly maximum): 0 at twice it.
- Bugs (optional): 1 minus a weather proxy, warmth (0 below 10 °C mean, full at 22 °C) × (half humidity ramp 40–80 %, half rain ramp 0–100 mm).
- Stargazing: 1 minus cloud amount.
- Snowmelt season: the month's share of the year's snow-depth decline, relative to the peak melt month; 0 where the normal peak snow depth is under 5 cm.
- Next year and 2050 also report a score range from the low and high ends of their windows.

All falloffs and thresholds above are provisional choices, not from a source.

**API.** `GET /api/parks`, `GET /api/parks/plan?month&t_lo&t_hi[&rh_max&rain_max&avoid_bugs&stars&snowmelt&scenario]`.

**Front end** (updated 15 Nov 2026). No sign-in wall: a first visit is a guest and opens on Plan. Signing up or logging in is offered from the profile menu (`/signup`, `/login`, returning to `?next=`); logging out (`/logout`) returns to the guest, whose data is kept apart from any account's. Edit profile is `/profile`. Tabs: Plan, Mysteries, Saved, Passport, and a Research menu when research tools are on. Every tab has a real path (`/plan`, `/saved`, `/research/trend-atlas`…; old `#tab=` links still open). There is no Home page; the logo, `/` and old `#tab=home` links all open Plan.

Plan is two steps, each its own URL (`/plan` and `/plan?step=1`), so the back button moves between them:

1. Preferences: trip moods, then months, how warm, what you're into and what to avoid, with a live count of parks that fit and a "Show my parks" button.
2. Parks: every park on the left, ranked for next year's trend (A to Z with no ranks when no filter is set), each with a checkbox; a card per ticked park on the right. The top 3 matches start ticked; changing preferences resets the ticks to the new top 3. Each card shows this year (measured so far) and next year (trend) side by side: match score, daytime high, humidity, rain, cloud cover, and bugs when picked. There is no horizon toggle. "Details" opens the full park drawer. A link with a park (a mystery's or a saved park's "Plan") opens step 2 with that park ticked and first.

Saved uses the same card with a third column for 2050.

Place, selected parks and units are kept in the browser's localStorage as a convenience only.

Hovering or focusing a daytime-high, humidity, rain or cloud value on a card shows a year of daily values (`GET /api/parks/{id}/daily`): the 1991–2020 day-of-year average from NASA POWER daily data (smoothed over 15 days, a provisional choice) against the horizon's curve. 2026 shows the measured days; 2027 and 2050 show the average's daily shape shifted by their monthly change, interpolated between mid-month days (rain as a ratio). The daily files are `backend/data/parks/daily/{id}.json`, about 16 kB each.

**Not yet built from Parts 1–4.** USGS gauges and day-of-year medians for waterfalls; USA-NPN growing degree days and bloom data; MCD12Q2 foliage dates; caves as the constant; NPS visitation as a crowding layer; seasonal outlooks; moon phase and light pollution for stargazing.
