"""Server tests against the strict mock of Anvil (tools/testing/mock).

    python tools/testing/test_server.py          -> prints ALL OK, or the first failure

call(name, ...) runs a server function the way the browser does: by name, with require_user enforced,
and the reply must be JSON (a datetime or a row in a reply fails here, like it would break the page).
Add tests for every new server function: the happy path, bad input, and someone who isn't allowed.
"""
import datetime as dt
import importlib
import json
import os
import pathlib
import shutil
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
_tmp = pathlib.Path(tempfile.mkdtemp())
shutil.copytree(PROJECT / "server_code", _tmp / "app")
(_tmp / "app" / "__init__.py").write_text("")
os.environ["ANVIL_APP_YAML"] = str(PROJECT / "anvil.yaml")  # the mock's tables follow the app's own schema
sys.path[:0] = [str(HERE / "mock"), str(_tmp)]
import anvil.server  # noqa: E402
import anvil.users  # noqa: E402
from anvil.tables import app_tables as T  # noqa: E402

M = {p.stem: importlib.import_module("app." + p.stem) for p in sorted((PROJECT / "server_code").glob("*.py"))}
now = dt.datetime.now(dt.timezone.utc)


def call(name, *args):
    r = anvil.server.call(name, *args)
    json.dumps(r)  # strict: must be JSON-able
    return r


def as_user(row):
    anvil.users.CURRENT[0] = row
    anvil.server.session.use(row.get_id() if row is not None else None)


def denied(name, *args):
    try:
        call(name, *args)
    except anvil.server.PermissionDenied:
        return True
    return False


def ok(r, msg=""):
    assert isinstance(r, dict) and r.get("ok"), (msg, r)
    return r


def bad(r, msg=""):
    assert isinstance(r, dict) and r.get("ok") is False and r.get("error"), (msg, r)
    return r


def person(email, name=None, **kw):
    return T.users.add_row(email=email, enabled=True, signed_up=now, display_name=name, **kw)


# ---------------------------------------------------------------------------------- accounts
admin = person("arkulinskis@gmail.com", "The Admin")
ana = person("ana@example.com", "Ana")
bob = person("bob@example.com")

as_user(None)
assert call("get_me") is None
assert denied("update_profile", "X")
as_user(admin)
assert call("get_me")["is_admin"] is True, "ADMIN_EMAILS become admins on first sign-in"
as_user(ana)
me = call("get_me")
assert me["name"] == "Ana" and me["is_admin"] is False
assert ana["last_seen"] is not None
as_user(bob)
assert call("get_me")["name"] == "Bob", "a name comes from the email when none is set"
bad(call("update_profile", " x "))
assert ok(call("update_profile", "  Bob   Stone "))["me"]["name"] == "Bob Stone"

# ---------------------------------------------------------------------------------- feedback
as_user(None)
bad(call("submit_feedback", "bug", "hi"))
ok(call("submit_feedback", "bug", "The button is broken", "guest@example.com", {"page": "#home", "evil": "x" * 9999}))
fb = T.feedback.search()[0]
assert fb["name"] == "Guest" and fb["email"] == "guest@example.com" and "evil" not in fb["context"] and fb["status"] == "new"
for i in range(4):
    ok(call("submit_feedback", "idea", "Idea number %d" % i))
bad(call("submit_feedback", "idea", "One too many this hour"), "rate limit")
as_user(ana)
ok(call("submit_feedback", "nonsense-kind", "Signed-in feedback"))
assert T.feedback.get(message="Signed-in feedback")["kind"] == "other"
assert denied("list_feedback")
as_user(admin)
lst = call("list_feedback")
assert lst["counts"]["new"] == 6 and len(lst["items"]) == 6
fid = lst["items"][0]["id"]
ok(call("set_feedback_status", fid, "done", "Fixed it"))
assert call("list_feedback", "done")["items"][0]["note"] == "Fixed it"
bad(call("set_feedback_status", fid, "weird"))
bad(call("set_feedback_status", "nope", "done"))
ok(call("delete_feedback", fid))
assert len(call("list_feedback")["items"]) == 5

# ---------------------------------------------------------------------------------- admin
as_user(ana)
for fn, args in [("admin_overview", ()), ("list_users", ()), ("set_admin", (bob.get_id(), True)), ("demo_load", ()), ("demo_remove", ())]:
    assert denied(fn, *args), fn
as_user(admin)
ov = call("admin_overview")
assert ov["users"] == 3 and ov["admins"] == 1 and ov["feedback_new"] == 5
assert len(call("list_users")["users"]) == 3 and len(call("list_users", "bob")["users"]) == 1
ok(call("set_admin", bob.get_id(), True))
assert bob["is_admin"] is True
bad(call("set_admin", admin.get_id(), False), "can't remove your own admin")
ok(call("set_enabled", bob.get_id(), False))
assert bob["enabled"] is False
bad(call("set_enabled", admin.get_id(), False))
ok(call("set_enabled", bob.get_id(), True))
ok(call("set_admin", bob.get_id(), False))
assert bob["is_admin"] is False

# ---------------------------------------------------------------------------------- the stage (demo data loads on first visit)
DD = M["DemoData"]
carl = person("carl@example.com", "Carl")
as_user(None)
st = call("get_stage")
assert DD.state() == "loaded", "demo loads on first visit"
assert len(st["songs"]) == min(12, len(DD.SONGS)) and st["counts"]["songs"] == len(DD.SONGS)
assert st["spotlight"] and st["spotlight"][0]["featured"], "staff picks lead the spotlight"
assert all(not s["upvoted"] and not s["mine"] for s in st["songs"])
assert "@" not in json.dumps(st), "no emails on the stage"
assert all(s["scene"] == "poetry" for s in call("get_stage", "poetry")["songs"])
assert len(call("shuffle", "rap", 3)["songs"]) == 3
for r in T.songs.search(is_demo=True):
    assert r["upvotes"] == len(T.upvotes.search(song=r)) and r["review_count"] == len(T.reviews.search(song=r)), "demo counts match"
sid = T.songs.get(title="Banana Moon").get_id()
g = ok(call("get_song", sid))
assert g["song"]["sections"] and g["reviews"] and not g["can_review"] and g["criteria"] == ["Hook", "Story", "Singability"]
assert g["reviews"][0]["fav_line"] in g["song"]["excerpt"] + [ln for s in g["song"]["sections"] for ln in s["text"].split("\n")] or not g["reviews"][0]["fav_line"]
bad(call("get_song", "nope"))
for fn, args in [("my_songs", ()), ("create_song", ("rap",)), ("save_song", (sid, {})), ("toggle_upvote", (sid,)),
                 ("save_review", (sid, 5, 5, 5, "Great stuff here")), ("delete_review", ("x",)), ("promote_song", (sid,)),
                 ("report_song", (sid, "spam")), ("remix_song", (sid,)), ("get_bunch", ()), ("get_draft", (sid,)),
                 ("set_published", (sid, True)), ("delete_song", (sid,))]:
    assert denied(fn, *args), fn

# ---------------------------------------------------------------------------------- the studio
as_user(ana)
new = ok(call("create_song", "poetry", "  My   First  ", [{"kind": "Stanza", "text": "a line\nanother line"}, {"kind": "Weird", "text": "x"}, "junk"]))["song"]
assert new["status"] == "draft" and new["beat"] == "iambic" and new["title"] == "My First"
assert [s["kind"] for s in new["sections"]] == ["Stanza", "Verse"]
nid = new["id"]
as_user(bob)
bad(call("get_song", nid), "drafts are private")
bad(call("save_song", nid, {"title": "Hacked"}))
bad(call("get_draft", nid))
bad(call("set_published", nid, True))
bad(call("delete_song", nid))
as_user(ana)
ok(call("save_song", nid, {"title": "Night Bus", "beat": "trochaic", "bpm": 999, "mood": "Dreamy", "bars_per_line": 2, "scene": "nope",
                           "sections": [{"kind": "Stanza", "text": "Tell the driver I'm asleep\nkeep the change and keep the street"}]}))
r = T.songs.get_by_id(nid)
assert r["title"] == "Night Bus" and r["beat"] == "trochaic" and r["bpm"] == 180 and r["scene"] == "poetry"
assert r["bars_per_line"] == 2 and r["mood"] == "Dreamy"
ok(call("save_song", nid, {"beat": "nonsense", "mood": "nonsense"}))
assert r["beat"] == "trochaic" and r["mood"] == ""
bad(call("save_song", nid, "not a dict"))
ok(call("set_published", nid, True))
assert ok(call("get_song", nid))["song"]["status"] == "published"
bad(call("save_song", nid, {"sections": [{"kind": "Verse", "text": "one line"}]}), "published songs keep 2+ lines")
blank = ok(call("create_song", "rap"))["song"]
bad(call("set_published", blank["id"], True), "empty songs can't be shared")
ok(call("save_song", blank["id"], {"sections": [{"kind": "Verse", "text": "one\ntwo"}]}))
bad(call("set_published", blank["id"], True), "a song needs a title to be shared")
mine = call("my_songs")
assert len(mine["songs"]) == 2 and mine["totals"]["published"] == 1 and mine["totals"]["drafts"] == 1
assert ok(call("get_draft", nid))["song"]["title"] == "Night Bus"

# ---------------------------------------------------------------------------------- upvotes + the Bunch
bad(call("toggle_upvote", nid), "can't upvote your own song")
before = T.songs.get_by_id(sid)["upvotes"]
assert call("toggle_upvote", sid)["upvoted"] is True and T.songs.get_by_id(sid)["upvotes"] == before + 1
assert call("get_song", sid)["song"]["upvoted"] is True
assert [s["id"] for s in call("get_bunch")["songs"]] == [sid], "upvoted songs are saved to the bunch"
assert call("toggle_upvote", sid)["upvoted"] is False and T.songs.get_by_id(sid)["upvotes"] == before
assert call("get_bunch")["songs"] == []
call("toggle_upvote", sid)
bad(call("toggle_upvote", blank["id"]), "drafts can't be upvoted")
bad(call("toggle_upvote", "nope"))

# ---------------------------------------------------------------------------------- reviews
as_user(bob)
bad(call("save_review", nid, 0, 3, 3, "Lovely rhythm in this"), "ratings are 1 to 5")
bad(call("save_review", nid, 4, 4, 4, "short"), "a review needs words")
rv = ok(call("save_review", nid, 4, 5, 3, "Lovely trochees, the street rhyme lands.", "keep the change and keep the street"))
assert rv["review_count"] == 1 and rv["review"]["fav_line"] == "keep the change and keep the street"
ok(call("save_review", nid, 5, 5, 5, "Updated: even better on a second read.", "not a real line"))
assert len(T.reviews.search(song=T.songs.get_by_id(nid))) == 1, "one review per person, updated in place"
assert T.songs.get_by_id(nid)["rating"] == 5 and T.reviews.get(author=bob)["fav_line"] == "", "a made-up favourite line is dropped"
g = ok(call("get_song", nid))
assert g["my_review"] and g["can_review"] and g["reviews"][0]["mine"] and g["criteria"] == ["Rhythm", "Imagery", "Resonance"]
as_user(ana)
bad(call("save_review", nid, 5, 5, 5, "My own song is great"), "no reviewing your own song")
bad(call("delete_review", g["reviews"][0]["id"]), "can't delete someone else's review")
as_user(bob)
ok(call("delete_review", g["reviews"][0]["id"]))
assert T.songs.get_by_id(nid)["review_count"] == 0 and T.songs.get_by_id(nid)["rating"] is None

# ---------------------------------------------------------------------------------- promotions (the Spotlight)
ok(call("promote_song", nid))
bad(call("promote_song", nid), "once per song per week")
others = [x for x in T.songs.search(status="published") if x["owner"] != bob][:4]
ok(call("promote_song", others[0].get_id()))
ok(call("promote_song", others[1].get_id()))
bad(call("promote_song", others[2].get_id()), "3 promotions a week")
assert call("get_stage")["promos_left"] == 0
assert any(s["id"] == nid for s in call("get_stage")["spotlight"]), "promoted songs reach the spotlight"
as_user(ana)
bad(call("promote_song", nid), "can't promote your own song")

# ---------------------------------------------------------------------------------- remix
as_user(bob)
rx = ok(call("remix_song", nid))["song"]
assert rx["remix_of"]["id"] == nid and rx["status"] == "draft" and rx["title"].endswith("(remix)")
bad(call("remix_song", blank["id"]), "drafts can't be remixed")

# ---------------------------------------------------------------------------------- charts + writer pages
as_user(None)
wk = call("get_charts", None, "week")["songs"]
assert wk and all(wk[i]["score"] >= wk[i + 1]["score"] for i in range(len(wk) - 1))
al = call("get_charts", "pop", "all")["songs"]
assert al and all(s["scene"] == "pop" for s in al) and al[0]["upvotes"] >= al[-1]["upvotes"]
assert call("get_charts", None, "reviewed")["songs"][0]["score"] >= 4
assert call("get_charts", None, "weird")["period"] == "all"
w = ok(call("get_writer", ana.get_id()))
assert w["writer"]["name"] == "Ana" and [s["id"] for s in w["songs"]] == [nid] and "email" not in w["writer"]
assert ok(call("get_writer", T.users.get(email="kofi.demo@example.com").get_id()))["totals"]["songs"] == 2, "demo writers have pages"
bad(call("get_writer", "nope"))

# ---------------------------------------------------------------------------------- reports + moderation
as_user(ana)
bad(call("report_song", nid, "spam"), "can't report your own song")
for who in (bob, admin, carl):
    as_user(who)
    bad(call("report_song", sid, "bogus"))
    ok(call("report_song", sid, "spam", "Looks like an ad"))
    if who == bob:
        assert "already" in ok(call("report_song", sid, "spam"))["message"], "a second report from the same person is a no-op"
assert T.songs.get_by_id(sid)["hidden"] is True, "three reports from different people hide a song"
as_user(ana)
bad(call("get_song", sid), "hidden songs are off the stage")
for fn, args in [("admin_songs", ()), ("admin_set_song", (sid, True, None)), ("list_reports", ()), ("resolve_report", ("x", "hide"))]:
    assert denied(fn, *args), fn
as_user(admin)
assert ok(call("get_song", sid)), "admins still see hidden songs"
reps = call("list_reports")
assert reps["open"] == 3 and reps["reports"][0]["song"]["id"] == sid
bad(call("resolve_report", reps["reports"][0]["id"], "nuke"))
bad(call("resolve_report", "nope", "hide"))
ok(call("resolve_report", reps["reports"][0]["id"], "dismiss"))
assert call("list_reports")["open"] == 0 and T.songs.get_by_id(sid)["hidden"] is False, "dismissing unhides and resolves them all"
ok(call("admin_set_song", nid, True, None))
assert T.songs.get_by_id(nid)["featured"] is True
ok(call("admin_set_song", nid, None, True))
assert T.songs.get_by_id(nid)["hidden"] is True and any(s["id"] == nid for s in call("admin_songs", None, "hidden")["songs"])
assert call("admin_songs", "night")["total"] >= 1 and call("admin_songs", None, "drafts")["total"] >= 2
ov = call("admin_overview")
assert ov["reports_open"] == 0 and ov["songs"] >= 1 and ov["reviews"] >= 1
ok(call("admin_set_song", nid, False, False))
bad(call("admin_set_song", "nope", True))

# ---------------------------------------------------------------------------------- profile: scene + bio
as_user(ana)
me = ok(call("update_profile", "Ana", "poetry", "Bus poet."))["me"]
assert me["scene"] == "poetry" and me["bio"] == "Bus poet."
assert ok(call("update_profile", "Ana", "metal"))["me"]["scene"] == ""

# ---------------------------------------------------------------------------------- deleting a song takes its children with it
as_user(ana)
ok(call("delete_song", nid))
assert T.songs.get_by_id(rx["id"])["remix_of"] is None, "remixes lose the link, not the song"
for t in (T.upvotes, T.reviews, T.promotions, T.reports):
    assert all(x["song"] is None or x["song"].get_id() != nid for x in t.search())
as_user(bob)
ok(call("delete_song", rx["id"]))
as_user(admin)
ok(call("delete_song", blank["id"]), "admins can delete anything")

# ---------------------------------------------------------------------------------- demo data: remove, stays removed, reload
as_user(admin)
ok(call("demo_remove"))
assert DD.state() == "removed" and not T.users.search(is_demo=True) and not T.songs.search(is_demo=True)
assert not T.upvotes.search() and not T.reviews.search(), "members' upvotes on demo songs go with them"
assert call("get_stage")["counts"]["songs"] == 0
as_user(None)
call("get_stage")
assert DD.state() == "removed", "removed demo data doesn't come back by itself"
as_user(admin)
ok(call("demo_load"))
ok(call("demo_load"))
assert call("get_stage")["counts"]["songs"] == len(DD.SONGS), "reloading replaces the demo instead of doubling it"

# ---------------------------------------------------------------------------------- Privacy & Terms
if "legal_server" in M:
    as_user(ana)
    st = call("legal_state")
    assert st["signedIn"] and st["accepted_version"] is None
    ok(call("legal_accept", st["version"], "signup"))
    assert ana["legal_source"] == "signup" and call("legal_state")["accepted_version"] == st["version"]

# ---------------------------------------------------------------------------------- every callable is covered by a permission check
# A callable that changes data without require_user / a C.require_* check is a security hole. List the public ones here.
PUBLIC = {"get_me", "submit_feedback", "get_stage", "shuffle", "get_song", "get_charts", "get_writer", "legal_state", "legal_accept"}
for name, (f, need) in sorted(anvil.server.CALLABLES.items()):
    if name in PUBLIC:
        continue
    assert need, "%s is callable by anyone: add require_user=True (or list it in PUBLIC in test_server.py)" % name

print("ALL OK (%d server functions)" % len(anvil.server.CALLABLES))
