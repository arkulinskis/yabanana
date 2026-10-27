"""Admin tools for songs: find songs, feature (staff pick) or hide them, and work through reports. Admins only."""
import anvil.server
from anvil.tables import app_tables
import anvil.tables as tables

from . import common as C
from . import Songs as S
from .Community import REPORT_REASONS


def _admin_song(r, me):
    d = S.song_dict(r, me)
    d["open_reports"] = len(app_tables.reports.search(song=r, status="open"))
    return d


@anvil.server.callable(require_user=True)
def admin_songs(query=None, show="all"):
    me = C.require_admin()
    query = C.text(query, 80).lower()
    rows = list(app_tables.songs.search(tables.order_by("created", ascending=False)))
    if show == "hidden":
        rows = [r for r in rows if r["hidden"]]
    elif show == "featured":
        rows = [r for r in rows if r["featured"]]
    elif show == "drafts":
        rows = [r for r in rows if r["status"] != "published"]
    else:
        show = "all"
    if query:
        rows = [r for r in rows if query in (r["title"] or "").lower() or query in C.name_of(r["owner"]).lower()]
    return {"songs": [_admin_song(r, me) for r in rows[:150]], "total": len(rows), "show": show}


@anvil.server.callable(require_user=True)
def admin_set_song(song_id, featured=None, hidden=None):
    me = C.require_admin()
    r = C.row_by_id(app_tables.songs, song_id)
    if r is None:
        return C.fail("That song no longer exists.")
    if featured is not None:
        r["featured"] = bool(featured)
    if hidden is not None:
        r["hidden"] = bool(hidden)
    return C.ok(song=_admin_song(r, me))


@anvil.server.callable(require_user=True)
def list_reports(status="open"):
    me = C.require_admin()
    status = status if status in ("open", "resolved") else "open"
    rows = sorted(app_tables.reports.search(status=status), key=lambda x: x["created"], reverse=True)
    out = []
    for x in rows[:200]:
        s = x["song"]
        out.append({"id": x.get_id(), "reason": x["reason"], "reason_label": REPORT_REASONS.get(x["reason"], x["reason"]),
                    "note": x["note"] or "", "created": C.iso(x["created"]), "status": x["status"],
                    "by": S.author(x["user"])["name"], "song": _admin_song(s, me) if s is not None else None})
    return {"reports": out, "open": len(app_tables.reports.search(status="open"))}


@anvil.server.callable(require_user=True)
def resolve_report(report_id, action):
    """action: 'dismiss' (the song is fine: resolve every open report on it and unhide it) or 'hide' (hide the song)."""
    C.require_admin()
    x = C.row_by_id(app_tables.reports, report_id)
    if x is None:
        return C.fail("That report no longer exists.")
    if action not in ("dismiss", "hide"):
        return C.fail("Unknown action.")
    s = x["song"]
    targets = list(app_tables.reports.search(song=s, status="open")) if s is not None else [x]
    for t in targets:
        t["status"] = "resolved"
    x["status"] = "resolved"
    if s is not None:
        s["hidden"] = action == "hide"
    return C.ok(resolved=len(targets) or 1)


def open_count():
    return len(app_tables.reports.search(status="open"))
