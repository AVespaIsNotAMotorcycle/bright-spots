"""Shared outbound HTTP helper: TTL cache plus retry with backoff (spec 5.1)."""

from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx

CACHE_TTL_S = 6 * 3600
RETRY_BACKOFF_S = (1.0, 3.0)

_cache: dict[str, tuple[float, Any]] = {}


def clear_cache() -> None:
    _cache.clear()


async def get_json(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    *,
    ttl_s: float = CACHE_TTL_S,
    backoff_s: tuple[float, ...] | None = None,
) -> Any:
    params = params or {}
    if backoff_s is None:
        backoff_s = RETRY_BACKOFF_S
    key = url + "?" + "&".join(f"{k}={params[k]}" for k in sorted(params))
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < ttl_s:
        return hit[1]

    last: Exception | None = None
    for attempt in range(len(backoff_s) + 1):
        if attempt:
            await asyncio.sleep(backoff_s[attempt - 1])
        try:
            resp = await client.get(url, params=params, headers=headers)
            # Retry only server-side / transient failures.
            if resp.status_code >= 500 or resp.status_code == 429:
                resp.raise_for_status()
            resp.raise_for_status()
            body = resp.json()
            _cache[key] = (time.monotonic(), body)
            return body
        except httpx.HTTPStatusError as e:
            last = e
            if e.response.status_code < 500 and e.response.status_code != 429:
                raise
        except httpx.TransportError as e:
            last = e
    assert last is not None
    raise last
