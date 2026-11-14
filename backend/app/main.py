import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.datasets.router import router as datasets_router
from app.parks.router import router as parks_router


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
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(datasets_router)
app.include_router(parks_router)


@app.get("/hello")
def hello() -> dict[str, str]:
    return {"message": "hello"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
