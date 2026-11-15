"""Step 9: one small photo per park for the passport stamps.

Takes each park's lead image from its English Wikipedia article, keeps it only
if Wikimedia Commons lists a free licence, and saves a thumbnail at most 600 x 240 px.

Writes:
  frontend/public/parks/<code>.jpg
  frontend/src/detective/parkPhotos.json   {code: {file, credit, license, source}}

Run from backend/:  .venv/bin/python scripts/step9_park_photos.py
"""

from __future__ import annotations

import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / "frontend/public/data/atlas.json"
OUT_DIR = ROOT / "frontend/public/parks"
OUT_JSON = ROOT / "frontend/src/detective/parkPhotos.json"
UA = {"User-Agent": "ParkTrendDetective/1.0 (NASA Space Apps 2026; github.com/AVespaIsNotAMotorcycle/bright-spots)"}
FREE = re.compile(r"public domain|^pd|cc0|cc[ -]by|^fal$|free art", re.I)
WIDTH, HEIGHT = 600, 240  # fits inside this box, so wide panoramas stay sharp

# Articles whose title differs from the atlas name.
TITLE = {"seki": "Sequoia National Park", "chir": "Chiricahua National Park"}


def fetch(url: str) -> bytes:
    """GET with polite backoff: Wikimedia answers 429 when asked too fast."""
    for wait in (0, 5, 15, 30, 60):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    raise RuntimeError("still rate limited")


def get_json(url: str) -> dict:
    return json.loads(fetch(url))


def strip_tags(s: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", s or "")).split())


def lead_file(title: str) -> str | None:
    """The Commons file name of the article's lead image."""
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(
        {"action": "query", "titles": title, "prop": "pageimages", "piprop": "name", "redirects": 1, "format": "json"}
    )
    pages = get_json(url)["query"]["pages"]
    return next((p.get("pageimage") for p in pages.values() if p.get("pageimage")), None)


def file_info(name: str) -> dict | None:
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
        {
            "action": "query",
            "titles": f"File:{name}",
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": WIDTH,
            "iiurlheight": HEIGHT,
            "format": "json",
        }
    )
    pages = get_json(url)["query"]["pages"]
    info = next(iter(pages.values())).get("imageinfo")
    return info[0] if info else None


def main() -> None:
    atlas = json.loads(ATLAS.read_text())
    parks: dict[str, str] = {}
    for p in atlas["parks"]:
        if p["code"] and p["code"] not in parks:
            parks[p["code"]] = TITLE.get(p["code"], p["name"])
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Re-runs keep what is already saved and only fetch the missing parks.
    out: dict[str, dict] = json.loads(OUT_JSON.read_text()) if OUT_JSON.exists() else {}
    for code, title in sorted(parks.items()):
        if code in out and (OUT_DIR / f"{code}.jpg").exists():
            continue
        time.sleep(2)
        try:
            name = lead_file(title)
            info = file_info(name) if name else None
        except Exception as e:  # noqa: BLE001 - one bad park must not stop the rest
            print(f"{code}: lookup failed ({e})")
            continue
        if not info:
            print(f"{code}: no lead image")
            continue
        meta = info.get("extmetadata", {})
        lic = strip_tags(meta.get("LicenseShortName", {}).get("value", ""))
        if not FREE.search(lic):
            print(f"{code}: skipped, licence {lic!r}")
            continue
        try:
            (OUT_DIR / f"{code}.jpg").write_bytes(fetch(info["thumburl"]))
        except Exception as e:  # noqa: BLE001
            print(f"{code}: download failed ({e})")
            continue
        out[code] = {
            "file": f"/parks/{code}.jpg",
            "credit": strip_tags(meta.get("Artist", {}).get("value", "")) or "Unknown",
            "license": lic,
            "source": info["descriptionurl"],
        }
        print(f"{code}: {lic} · {out[code]['credit'][:40]}")
        OUT_JSON.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    OUT_JSON.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(out)} of {len(parks)} parks have a photo")


if __name__ == "__main__":
    main()
