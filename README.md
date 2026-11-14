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

Tests:

```sh
cd backend && uv run pytest
```

## Licence

MIT
