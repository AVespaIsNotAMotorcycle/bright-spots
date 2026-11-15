import asyncio
import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse

from app.community.router import router as community_router
from app.config import settings
from app.datasets.router import router as datasets_router
from app.explain.router import router as explain_router
from app.parks.router import router as parks_router
from app.trends.router import router as trends_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # One shared client and connection pool (spec: backend stack).
    async with httpx.AsyncClient(timeout=settings.http_timeout_s) as client:
        app.state.http = client
        app.state.ornl_sem = asyncio.Semaphore(settings.ornl_concurrency)
        yield


app = FastAPI(title="Park visit planner", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    # POST/DELETE for the Campfire and "Explain it to me" when the app is hosted without the dev proxy.
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(community_router)
app.include_router(datasets_router)
app.include_router(explain_router)
app.include_router(parks_router)
app.include_router(trends_router)


@app.get("/hello")
def hello() -> dict[str, str]:
    return {"message": "hello"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Hosted mode: serve the built frontend from the same server, so one free web service runs the app.
# Set STATIC_DIR to the Vite build folder (the Dockerfile does). Unknown paths fall back to index.html.
_static = os.environ.get("STATIC_DIR")
if _static and Path(_static, "index.html").is_file():
    _root = Path(_static).resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        file = (_root / path).resolve()
        if path and file.is_file() and file.is_relative_to(_root):
            return FileResponse(file)
        return FileResponse(_root / "index.html")
