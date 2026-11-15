"""The Campfire: a small board where researchers share notes about the trends.

There are no accounts. Each browser keeps a random id, used to count one vote per
browser and to let a writer delete their own note. Notes are stored in SQLite.
"""

import re
import sqlite3
import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.config import settings

router = APIRouter(prefix="/api/community")

Kind = Literal["insight", "question", "hypothesis", "method"]
_ID = r"^[A-Za-z0-9_-]{8,64}$"

SCHEMA = """
CREATE TABLE IF NOT EXISTS posts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  author    TEXT NOT NULL,
  owner     TEXT NOT NULL,
  kind      TEXT NOT NULL,
  text      TEXT NOT NULL,
  park_id   TEXT,
  variable  TEXT,
  period    TEXT,
  created   REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS votes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  voter   TEXT NOT NULL,
  PRIMARY KEY (post_id, voter)
);
CREATE TABLE IF NOT EXISTS reports (
  post_id  INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter TEXT NOT NULL,
  reason   TEXT NOT NULL,
  created  REAL NOT NULL,
  PRIMARY KEY (post_id, reporter)
);
CREATE INDEX IF NOT EXISTS posts_parent ON posts(parent_id);
"""


@contextmanager
def _db() -> Iterator[sqlite3.Connection]:
    con = sqlite3.connect(settings.community_db)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(SCHEMA)
    try:
        yield con
        con.commit()
    finally:
        con.close()


_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_URL = re.compile(r"https?://", re.IGNORECASE)


def _clean(s: str) -> str:
    return _CTRL.sub("", s).strip()


class PostIn(BaseModel):
    author: str = Field(min_length=1, max_length=40)
    owner: str = Field(pattern=_ID)
    kind: Kind = "insight"
    text: str = Field(min_length=3, max_length=1000)
    park_id: str | None = Field(None, pattern=r"^[a-z0-9-]{2,16}$")
    variable: str | None = Field(None, pattern=r"^[a-z0-9_]{1,20}$")
    period: str | None = Field(None, pattern=r"^[A-Za-z0-9]{1,8}$")
    parent_id: int | None = None

    @field_validator("author", "text")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = _clean(v)
        if not v:
            raise ValueError("empty")
        return v

    @field_validator("text")
    @classmethod
    def _few_links(cls, v: str) -> str:
        if len(_URL.findall(v)) > 2:
            raise ValueError("at most 2 links")
        return v


class Post(BaseModel):
    id: int
    parent_id: int | None
    author: str
    kind: Kind
    text: str
    park_id: str | None
    variable: str | None
    period: str | None
    created: float
    votes: int
    voted: bool
    mine: bool
    replies: list["Post"] = []


class VoteIn(BaseModel):
    voter: str = Field(pattern=_ID)


class ReportIn(BaseModel):
    reporter: str = Field(pattern=_ID)
    reason: Literal["spam", "rude", "wrong", "other"] = "other"


# Per-address caps over 10 minutes, so one browser cannot flood the board.
MAX_POSTS_PER_10_MIN = 10
MAX_VOTES_PER_10_MIN = 60
MAX_REPORTS_PER_10_MIN = 20
# A note with this many reports from different browsers is hidden until someone reviews it.
HIDE_AT_REPORTS = 3
_recent: dict[str, list[float]] = {}


def _allow(ip: str, kind: str = "post", limit: int = MAX_POSTS_PER_10_MIN) -> bool:
    key = f"{kind}:{ip}"
    now = time.monotonic()
    hits = [t for t in _recent.get(key, []) if now - t < 600]
    if len(hits) >= limit:
        _recent[key] = hits
        return False
    hits.append(now)
    _recent[key] = hits
    return True


def _ip(request: Request) -> str:
    return request.client.host if request.client else "?"


_SELECT = """
SELECT p.*, (SELECT COUNT(*) FROM votes v WHERE v.post_id = p.id) AS votes,
       EXISTS(SELECT 1 FROM votes v WHERE v.post_id = p.id AND v.voter = :me) AS voted
FROM posts p
"""


def _row(r: sqlite3.Row, me: str) -> Post:
    return Post(
        id=r["id"], parent_id=r["parent_id"], author=r["author"], kind=r["kind"], text=r["text"],
        park_id=r["park_id"], variable=r["variable"], period=r["period"], created=r["created"],
        votes=r["votes"], voted=bool(r["voted"]), mine=bool(me) and r["owner"] == me,
    )


@router.get("/posts", response_model=list[Post])
def list_posts(
    park: str | None = None,
    kind: Kind | None = None,
    sort: Literal["new", "top"] = "new",
    me: str = "",
    limit: int = 50,
) -> list[Post]:
    limit = max(1, min(limit, 100))
    where = ["p.parent_id IS NULL", f"(SELECT COUNT(*) FROM reports r WHERE r.post_id = p.id) < {HIDE_AT_REPORTS}"]
    args: dict[str, object] = {"me": me, "limit": limit}
    if park:
        where.append("p.park_id = :park")
        args["park"] = park
    if kind:
        where.append("p.kind = :kind")
        args["kind"] = kind
    order = "votes DESC, p.created DESC" if sort == "top" else "p.created DESC"
    with _db() as con:
        tops = [_row(r, me) for r in con.execute(f"{_SELECT} WHERE {' AND '.join(where)} ORDER BY {order} LIMIT :limit", args)]
        if tops:
            ids = {p.id: p for p in tops}
            named = {f"i{n}": pid for n, pid in enumerate(ids)}
            marks = ",".join(f":{k}" for k in named)
            hidden = f"(SELECT COUNT(*) FROM reports r WHERE r.post_id = p.id) < {HIDE_AT_REPORTS}"
            for r in con.execute(f"{_SELECT} WHERE p.parent_id IN ({marks}) AND {hidden} ORDER BY p.created", {"me": me, **named}):
                reply = _row(r, me)
                ids[reply.parent_id].replies.append(reply)  # type: ignore[index]
    return tops


@router.post("/posts", response_model=Post, status_code=201)
def create_post(p: PostIn, request: Request) -> Post:
    if not _allow(_ip(request)):
        raise HTTPException(429, "Too many notes. Please wait a few minutes.")
    with _db() as con:
        if p.parent_id is not None:
            parent = con.execute("SELECT parent_id FROM posts WHERE id = ?", (p.parent_id,)).fetchone()
            if parent is None:
                raise HTTPException(404, "That note is gone.")
            if parent["parent_id"] is not None:
                raise HTTPException(400, "Reply to the first note, not to a reply.")
        cur = con.execute(
            "INSERT INTO posts (parent_id, author, owner, kind, text, park_id, variable, period, created)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (p.parent_id, p.author, p.owner, p.kind, p.text, p.park_id, p.variable, p.period, time.time()),
        )
        row = con.execute(f"{_SELECT} WHERE p.id = :id", {"id": cur.lastrowid, "me": p.owner}).fetchone()
    return _row(row, p.owner)


@router.post("/posts/{post_id}/vote")
def toggle_vote(post_id: int, v: VoteIn, request: Request) -> dict[str, int | bool]:
    if not _allow(_ip(request), "vote", MAX_VOTES_PER_10_MIN):
        raise HTTPException(429, "Too many votes. Please wait a few minutes.")
    with _db() as con:
        if con.execute("SELECT 1 FROM posts WHERE id = ?", (post_id,)).fetchone() is None:
            raise HTTPException(404, "That note is gone.")
        gone = con.execute("DELETE FROM votes WHERE post_id = ? AND voter = ?", (post_id, v.voter)).rowcount
        if not gone:
            con.execute("INSERT INTO votes (post_id, voter) VALUES (?, ?)", (post_id, v.voter))
        n = con.execute("SELECT COUNT(*) FROM votes WHERE post_id = ?", (post_id,)).fetchone()[0]
    return {"votes": n, "voted": not gone}


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(post_id: int, owner: str) -> None:
    with _db() as con:
        row = con.execute("SELECT owner FROM posts WHERE id = ?", (post_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "That note is gone.")
        if row["owner"] != owner:
            raise HTTPException(403, "You can only delete your own notes.")
        con.execute("DELETE FROM posts WHERE id = ?", (post_id,))


@router.post("/posts/{post_id}/report")
def report_post(post_id: int, rep: ReportIn, request: Request) -> dict[str, bool]:
    """Flag a note. Repeat reports from one browser count once; enough reports hide the note."""
    if not _allow(_ip(request), "report", MAX_REPORTS_PER_10_MIN):
        raise HTTPException(429, "Too many reports. Please wait a few minutes.")
    with _db() as con:
        if con.execute("SELECT 1 FROM posts WHERE id = ?", (post_id,)).fetchone() is None:
            raise HTTPException(404, "That note is gone.")
        con.execute(
            "INSERT OR IGNORE INTO reports (post_id, reporter, reason, created) VALUES (?, ?, ?, ?)",
            (post_id, rep.reporter, rep.reason, time.time()),
        )
        n = con.execute("SELECT COUNT(*) FROM reports WHERE post_id = ?", (post_id,)).fetchone()[0]
    return {"reported": True, "hidden": n >= HIDE_AT_REPORTS}
