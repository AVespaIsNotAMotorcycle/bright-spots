import pytest
from fastapi.testclient import TestClient

from app.community import router as community
from app.config import settings
from app.main import app

client = TestClient(app)
ME = "browser-aaaa1111"
YOU = "browser-bbbb2222"


@pytest.fixture(autouse=True)
def _db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "community_db", str(tmp_path / "c.db"))
    community._recent.clear()


def post(**kw):
    body = {"author": "Purva", "owner": ME, "kind": "insight", "text": "Zion summer nights warm fast.", **kw}
    return client.post("/api/community/posts", json=body)


def test_post_list_reply_vote_delete():
    r = post(park_id="zion", variable="tmin_c", period="JJA")
    assert r.status_code == 201
    pid = r.json()["id"]
    assert r.json()["mine"] is True

    assert post(text="Same in Bryce?", kind="question", parent_id=pid, owner=YOU).status_code == 201
    # replies go one level deep only
    reply_id = client.get("/api/community/posts").json()[0]["replies"][0]["id"]
    assert post(text="nested", parent_id=reply_id).status_code == 400

    v = client.post(f"/api/community/posts/{pid}/vote", json={"voter": YOU}).json()
    assert v == {"votes": 1, "voted": True}
    listed = client.get("/api/community/posts", params={"me": YOU}).json()
    assert listed[0]["votes"] == 1 and listed[0]["voted"] is True and listed[0]["mine"] is False
    assert listed[0]["replies"][0]["mine"] is True
    v = client.post(f"/api/community/posts/{pid}/vote", json={"voter": YOU}).json()
    assert v == {"votes": 0, "voted": False}

    assert client.get("/api/community/posts", params={"park": "acad"}).json() == []
    assert client.delete(f"/api/community/posts/{pid}", params={"owner": YOU}).status_code == 403
    assert client.delete(f"/api/community/posts/{pid}", params={"owner": ME}).status_code == 204
    assert client.get("/api/community/posts").json() == []


def test_validation_and_rate_limit():
    assert post(text="  ").status_code == 422
    assert post(text="a http://x http://y http://z").status_code == 422
    assert post(park_id="<script>").status_code == 422
    assert post(owner="short").status_code == 422
    for _ in range(community.MAX_POSTS_PER_10_MIN):
        assert post().status_code == 201
    assert post().status_code == 429


def test_top_sort():
    a = post(text="first note").json()["id"]
    b = post(text="second note").json()["id"]
    client.post(f"/api/community/posts/{a}/vote", json={"voter": YOU})
    ids = [p["id"] for p in client.get("/api/community/posts", params={"sort": "top"}).json()]
    assert ids == [a, b]
    ids = [p["id"] for p in client.get("/api/community/posts").json()]
    assert ids == [b, a]


def test_reports_hide_a_note_and_count_once_per_browser():
    pid = post().json()["id"]
    rep = lambda who: client.post(f"/api/community/posts/{pid}/report", json={"reporter": who, "reason": "spam"})  # noqa: E731
    assert rep("reporter-0000001").json() == {"reported": True, "hidden": False}
    assert rep("reporter-0000001").json()["hidden"] is False  # same browser again: still 1
    assert rep("reporter-0000002").json()["hidden"] is False
    assert len(client.get("/api/community/posts").json()) == 1
    assert rep("reporter-0000003").json()["hidden"] is True
    assert client.get("/api/community/posts").json() == []
    assert client.post("/api/community/posts/999/report", json={"reporter": "reporter-0000001"}).status_code == 404


def test_vote_rate_limit():
    pid = post().json()["id"]
    for i in range(community.MAX_VOTES_PER_10_MIN):
        assert client.post(f"/api/community/posts/{pid}/vote", json={"voter": f"voter-{i:08d}"}).status_code == 200
    assert client.post(f"/api/community/posts/{pid}/vote", json={"voter": "voter-late0001"}).status_code == 429
