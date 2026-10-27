"""Songs: the stage (random songs for the home page), reading a song, the writer's studio (create, save, publish,
remix, delete), charts, writer profiles and the Bunch (songs you upvoted).

Visibility: a published song that isn't hidden is public. Drafts and hidden songs are seen only by their owner
(and admins). Never return emails: authors are {id, name, scene}.
"""
import random
from collections import Counter
import datetime as dt

import anvil.server
from anvil.tables import app_tables
import anvil.tables as tables
import anvil.tables.query as q

from . import common as C
from . import DemoData

SCENES = ("rap", "poetry", "pop")
# Beat keys (web/pages/_beats.html defines the sound) -> default tempo. Any beat works in any scene.
BEATS = {"boombap": 90, "trap": 140, "drill": 142, "lofi": 78, "fourfloor": 120, "ballad": 72, "dembow": 96, "disco": 116,
         "iambic": 96, "trochaic": 104, "dactyl": 92, "anapest": 100}
DEFAULT_BEAT = {"rap": "boombap", "pop": "fourfloor", "poetry": "iambic"}
KINDS = ("Intro", "Verse", "Pre-chorus", "Chorus", "Hook", "Bridge", "Outro", "Stanza", "Couplet", "Refrain", "Spoken")
MOODS = ("Hype", "Defiant", "Tender", "Heartbroken", "Dreamy", "Nostalgic", "Playful", "Dark", "Hopeful")
# Review criteria per scene (r1, r2, r3).
CRITERIA = {"rap": ["Flow", "Wordplay", "Punch"], "poetry": ["Rhythm", "Imagery", "Resonance"],
            "pop": ["Hook", "Story", "Singability"]}
PROMOS_PER_WEEK = 3
WEEK = dt.timedelta(days=7)


# ----------------------------------------------------------------------------------------------- helpers
def author(u):
    if u is None:
        return {"id": None, "name": "A former writer", "scene": ""}
    return {"id": u.get_id(), "name": C.name_of(u), "scene": u["scene"] or ""}


def lines_of(sections):
    out = []
    for s in sections or []:
        out += [ln.strip() for ln in (s.get("text") or "").split("\n") if ln.strip()]
    return out


def is_public(r):
    return r is not None and r["status"] == "published" and not r["hidden"]


def can_see(r, me):
    return r is not None and (is_public(r) or (me is not None and (r["owner"] == me or C.is_admin(me))))


def public_songs(scene=None):
    kw = {"status": "published", "hidden": False}
    if scene in SCENES:
        kw["scene"] = scene
    return app_tables.songs.search(**kw)


def my_upvoted(me):
    if me is None:
        return set()
    return {u["song"].get_id() for u in app_tables.upvotes.search(user=me) if u["song"] is not None}


def boosts_by_song():
    """song id -> promotions in the last 7 days."""
    cut = C.now() - WEEK
    return Counter(p["song"].get_id() for p in app_tables.promotions.search(created=q.greater_than(cut)) if p["song"] is not None)


def song_dict(r, me, upvoted=None, full=False, boosts=None):
    sections = r["sections"] or []
    lines = lines_of(sections)
    mine = me is not None and r["owner"] == me
    remix = r["remix_of"]
    d = {"id": r.get_id(), "title": r["title"] or "Untitled", "scene": r["scene"] or "rap", "mood": r["mood"] or "",
         "beat": r["beat"] or DEFAULT_BEAT.get(r["scene"], "boombap"), "bpm": r["bpm"], "bars_per_line": r["bars_per_line"] or 1,
         "excerpt": lines[:4], "lines": len(lines), "status": r["status"], "created": C.iso(r["created"]),
         "updated": C.iso(r["updated"]), "published": C.iso(r["published"]), "author": author(r["owner"]),
         "upvotes": r["upvotes"] or 0, "upvoted": bool(upvoted and r.get_id() in upvoted), "mine": mine,
         "review_count": r["review_count"] or 0, "rating": r["rating"], "featured": bool(r["featured"]),
         "hidden": bool(r["hidden"]), "demo": bool(r["is_demo"]),
         "remix_of": ({"id": remix.get_id(), "title": remix["title"], "author": author(remix["owner"])}
                      if remix is not None and can_see(remix, me) else None)}
    if boosts is not None:
        d["boosts"] = boosts.get(r.get_id(), 0)
    if full:
        d["sections"] = [{"kind": s.get("kind") or "Verse", "text": s.get("text") or ""} for s in sections]
    return d


def song_or_fail(song_id, me):
    r = C.row_by_id(app_tables.songs, song_id)
    return r if can_see(r, me) else None


def promos_left(me):
    if me is None:
        return 0
    used = len(app_tables.promotions.search(user=me, created=q.greater_than(C.now() - WEEK)))
    return max(0, PROMOS_PER_WEEK - used)


def recount(song):
    """Refresh the counts stored on a song (upvotes, reviews, average rating)."""
    song["upvotes"] = len(app_tables.upvotes.search(song=song))
    revs = app_tables.reviews.search(song=song)
    song["review_count"] = len(revs)
    song["rating"] = round(sum((v["r1"] + v["r2"] + v["r3"]) / 3.0 for v in revs) / len(revs), 2) if len(revs) else None


def delete_children(song):
    for t in (app_tables.upvotes, app_tables.reviews, app_tables.promotions, app_tables.reports):
        for row in t.search(song=song):
            row.delete()
    for child in app_tables.songs.search(remix_of=song):
        child["remix_of"] = None


# ----------------------------------------------------------------------------------------------- the stage (home)
@anvil.server.callable
def get_stage(scene=None):
    """Home page: random songs, the spotlight (staff picks + songs members promoted this week), fresh drops."""
    DemoData.ensure_loaded()
    me = C.me()
    up = my_upvoted(me)
    rows = list(public_songs(scene))
    boosts = boosts_by_song()
    pool = list(public_songs())
    latest = {}
    for p in app_tables.promotions.search(created=q.greater_than(C.now() - WEEK)):
        if p["song"] is not None:
            k = p["song"].get_id()
            latest[k] = max(latest.get(k) or p["created"], p["created"])
    spot = [r for r in pool if r["featured"] or boosts.get(r.get_id())]
    # staff picks first, then the most promoted, then the most recently promoted
    spot.sort(key=lambda r: (bool(r["featured"]), boosts.get(r.get_id(), 0), C.iso(latest.get(r.get_id())) or ""), reverse=True)
    fresh = sorted(pool, key=lambda r: r["published"] or r["created"], reverse=True)[:6]
    writers = {r["owner"].get_id() for r in pool if r["owner"] is not None}
    return {"songs": [song_dict(r, me, up) for r in random.sample(rows, min(12, len(rows)))],
            "spotlight": [song_dict(r, me, up, boosts=boosts) for r in spot[:8]],
            "fresh": [song_dict(r, me, up) for r in fresh],
            "counts": {"songs": len(pool), "writers": len(writers),
                       "upvotes": sum((r["upvotes"] or 0) for r in pool)},
            "promos_left": promos_left(me)}


@anvil.server.callable
def shuffle(scene=None, count=12):
    """Another random handful (the Shuffle button, the landing page)."""
    DemoData.ensure_loaded()
    me = C.me()
    up = my_upvoted(me)
    rows = list(public_songs(scene))
    count = max(1, min(int(count or 12), 24)) if isinstance(count, (int, float)) else 12
    return {"songs": [song_dict(r, me, up) for r in random.sample(rows, min(count, len(rows)))]}


# ----------------------------------------------------------------------------------------------- one song
def review_dict(v, me):
    return {"id": v.get_id(), "author": author(v["author"]), "r": [v["r1"], v["r2"], v["r3"]], "text": v["text"] or "",
            "fav_line": v["fav_line"] or "", "created": C.iso(v["created"]),
            "mine": me is not None and v["author"] == me, "can_delete": me is not None and (v["author"] == me or C.is_admin(me))}


@anvil.server.callable
def get_song(song_id):
    me = C.me()
    r = song_or_fail(song_id, me)
    if r is None:
        return C.fail("This song isn't here. It may be a draft, or it was removed.")
    up = my_upvoted(me)
    revs = sorted(app_tables.reviews.search(song=r), key=lambda v: v["created"], reverse=True)
    mine = me is not None and r["owner"] == me
    my_review = next((v for v in revs if me is not None and v["author"] == me), None)
    boosts = boosts_by_song()
    promoted = me is not None and len(app_tables.promotions.search(song=r, user=me, created=q.greater_than(C.now() - WEEK))) > 0
    more = [x for x in public_songs() if x["owner"] == r["owner"] and x != r][:4]
    return C.ok(song=song_dict(r, me, up, full=True, boosts=boosts), criteria=CRITERIA.get(r["scene"], CRITERIA["rap"]),
                reviews=[review_dict(v, me) for v in revs],
                my_review=review_dict(my_review, me) if my_review else None,
                can_review=me is not None and not mine and is_public(r),
                can_promote=me is not None and not mine and is_public(r) and not promoted,
                promoted=promoted, promos_left=promos_left(me),
                remixes=len([x for x in app_tables.songs.search(remix_of=r) if is_public(x)]),
                more=[song_dict(x, me, up) for x in more],
                reported=me is not None and len(app_tables.reports.search(song=r, user=me)) > 0)


# ----------------------------------------------------------------------------------------------- the studio
def clean_sections(sections):
    out, total = [], 0
    for s in (sections if isinstance(sections, list) else [])[:24]:
        if not isinstance(s, dict):
            continue
        kind = s.get("kind") if s.get("kind") in KINDS else "Verse"
        text = C.text(s.get("text"), 3000, multiline=True)
        total += len(text)
        if total > 12000:
            break
        out.append({"kind": kind, "text": text})
    return out


@anvil.server.callable(require_user=True)
def my_songs():
    me = C.require_user()
    rows = sorted(app_tables.songs.search(owner=me), key=lambda r: r["updated"] or r["created"], reverse=True)
    up = my_upvoted(me)
    songs = [song_dict(r, me, up) for r in rows]
    return {"songs": songs, "totals": {"published": len([s for s in songs if s["status"] == "published"]),
                                       "drafts": len([s for s in songs if s["status"] != "published"]),
                                       "upvotes": sum(s["upvotes"] for s in songs),
                                       "reviews": sum(s["review_count"] for s in songs)}}


@anvil.server.callable(require_user=True)
def create_song(scene="rap", title=None, sections=None):
    me = C.require_user()
    if C.rate_limited("create_song", 30, 3600):
        return C.fail("That's a lot of new songs in one hour. Finish one first?")
    scene = scene if scene in SCENES else (me["scene"] if me["scene"] in SCENES else "rap")
    start = clean_sections(sections) or [{"kind": "Stanza" if scene == "poetry" else "Verse", "text": ""}]
    r = app_tables.songs.add_row(owner=me, title=C.text(title, 80) or "Untitled", scene=scene, mood="",
                                 beat=DEFAULT_BEAT[scene], bpm=BEATS[DEFAULT_BEAT[scene]], bars_per_line=1,
                                 sections=start, status="draft", created=C.now(), updated=C.now(), published=None,
                                 upvotes=0, review_count=0, rating=None, featured=False, hidden=False, is_demo=False)
    return C.ok(song=song_dict(r, me, set(), full=True))


@anvil.server.callable(require_user=True)
def get_draft(song_id):
    """The studio's copy of a song: owner only."""
    me = C.require_user()
    r = C.row_by_id(app_tables.songs, song_id)
    if r is None or r["owner"] != me:
        return C.fail("You can only edit your own songs.")
    return C.ok(song=song_dict(r, me, my_upvoted(me), full=True))


@anvil.server.callable(require_user=True)
def save_song(song_id, data):
    me = C.require_user()
    r = C.row_by_id(app_tables.songs, song_id)
    if r is None or r["owner"] != me:
        return C.fail("You can only edit your own songs.")
    if not isinstance(data, dict):
        return C.fail("Nothing to save.")
    ch = {"updated": C.now()}
    if "title" in data:
        ch["title"] = C.text(data["title"], 80) or "Untitled"
    if data.get("scene") in SCENES:
        ch["scene"] = data["scene"]
    if "mood" in data:
        ch["mood"] = data["mood"] if data["mood"] in MOODS else ""
    if data.get("beat") in BEATS:
        ch["beat"] = data["beat"]
    if "bpm" in data:
        try:
            ch["bpm"] = max(50, min(180, int(data["bpm"])))
        except (TypeError, ValueError):
            pass
    if "bars_per_line" in data:
        ch["bars_per_line"] = 2 if data["bars_per_line"] == 2 else (0.5 if data["bars_per_line"] == 0.5 else 1)
    if "sections" in data:
        ch["sections"] = clean_sections(data["sections"]) or [{"kind": "Verse", "text": ""}]
    if r["status"] == "published" and "sections" in ch and len(lines_of(ch["sections"])) < 2:
        return C.fail("A published song needs at least two lines. Unpublish it first to clear it.")
    r.update(**ch)
    return C.ok(saved=C.iso(ch["updated"]))


@anvil.server.callable(require_user=True)
def set_published(song_id, flag):
    me = C.require_user()
    r = C.row_by_id(app_tables.songs, song_id)
    if r is None or r["owner"] != me:
        return C.fail("You can only publish your own songs.")
    if flag:
        if len(lines_of(r["sections"])) < 2:
            return C.fail("Write at least two lines before you share it.")
        if (r["title"] or "Untitled") == "Untitled":
            return C.fail("Give your song a title before you share it.")
        r.update(status="published", published=r["published"] or C.now())
    else:
        r["status"] = "draft"
    return C.ok(status=r["status"])


@anvil.server.callable(require_user=True)
def delete_song(song_id):
    me = C.require_user()
    r = C.row_by_id(app_tables.songs, song_id)
    if r is None:
        return C.ok()
    if r["owner"] != me and not C.is_admin(me):
        return C.fail("You can only delete your own songs.")
    delete_children(r)
    r.delete()
    return C.ok()


@anvil.server.callable(require_user=True)
def remix_song(song_id):
    """Copy a public song into your studio as a draft, credited to the original."""
    me = C.require_user()
    src = C.row_by_id(app_tables.songs, song_id)
    if src is None or not (is_public(src) or src["owner"] == me):
        return C.fail("That song can't be remixed.")
    if C.rate_limited("create_song", 30, 3600):
        return C.fail("That's a lot of new songs in one hour. Finish one first?")
    r = app_tables.songs.add_row(owner=me, title=C.text((src["title"] or "Untitled") + " (remix)", 80), scene=src["scene"],
                                 mood=src["mood"] or "", beat=src["beat"], bpm=src["bpm"], bars_per_line=src["bars_per_line"] or 1,
                                 sections=[dict(s) for s in (src["sections"] or [])], status="draft", created=C.now(),
                                 updated=C.now(), published=None, upvotes=0, review_count=0, rating=None, featured=False,
                                 hidden=False, remix_of=src, is_demo=False)
    return C.ok(song=song_dict(r, me, set(), full=True))


# ----------------------------------------------------------------------------------------------- charts, writers, bunch
@anvil.server.callable
def get_charts(scene=None, period="week"):
    DemoData.ensure_loaded()
    me = C.me()
    up = my_upvoted(me)
    rows = list(public_songs(scene))
    if period == "week":
        cut = C.now() - WEEK
        recent = Counter(u["song"].get_id() for u in app_tables.upvotes.search(created=q.greater_than(cut)) if u["song"] is not None)
        rows = [r for r in rows if recent.get(r.get_id())]
        rows.sort(key=lambda r: (recent[r.get_id()], r["upvotes"] or 0), reverse=True)
        score = lambda r: recent[r.get_id()]  # noqa: E731
    elif period == "reviewed":
        rows = [r for r in rows if (r["review_count"] or 0) > 0]
        rows.sort(key=lambda r: (r["rating"] or 0, r["review_count"] or 0), reverse=True)
        score = lambda r: r["rating"]  # noqa: E731
    else:
        period = "all"
        rows.sort(key=lambda r: (r["upvotes"] or 0, r["review_count"] or 0), reverse=True)
        score = lambda r: r["upvotes"] or 0  # noqa: E731
    out = []
    for r in rows[:25]:
        d = song_dict(r, me, up)
        d["score"] = score(r)
        out.append(d)
    return {"songs": out, "period": period}


@anvil.server.callable
def get_writer(user_id):
    me = C.me()
    u = C.row_by_id(app_tables.users, user_id)
    if u is None or u["enabled"] is False and not u["is_demo"]:
        return C.fail("We couldn't find that writer.")
    up = my_upvoted(me)
    rows = sorted([r for r in app_tables.songs.search(owner=u) if is_public(r)],
                  key=lambda r: r["published"] or r["created"], reverse=True)
    songs = [song_dict(r, me, up) for r in rows]
    reviews_given = len(app_tables.reviews.search(author=u))
    return C.ok(writer={"id": u.get_id(), "name": C.name_of(u), "scene": u["scene"] or "", "bio": u["bio"] or "",
                        "joined": C.iso(u["signed_up"]), "me": me is not None and u == me},
                songs=songs, totals={"songs": len(songs), "upvotes": sum(s["upvotes"] for s in songs),
                                     "reviews_given": reviews_given,
                                     "bunch": len(app_tables.upvotes.search(user=u))})


@anvil.server.callable(require_user=True)
def get_bunch():
    """The songs you upvoted, newest first: your saved links."""
    me = C.require_user()
    up = my_upvoted(me)
    rows = sorted(app_tables.upvotes.search(user=me), key=lambda u: u["created"], reverse=True)
    out = []
    for u in rows:
        s = u["song"]
        if s is None or not can_see(s, me):
            continue
        d = song_dict(s, me, up)
        d["liked"] = C.iso(u["created"])
        out.append(d)
    return {"songs": out}
