"""What members do with other people's songs: upvote (saved to their Bunch), review, promote, report.

Rules: you can't upvote, review or promote your own song; each member has PROMOS_PER_WEEK promotions per 7 days;
REPORTS_TO_HIDE reports from different people hide a song until an admin looks at it.
"""
import anvil.server
from anvil.tables import app_tables
import anvil.tables.query as q

from . import common as C
from . import Songs as S

REPORT_REASONS = {"spam": "Spam or advertising", "hate": "Hateful or harassing", "copied": "Copied from someone else",
                  "explicit": "Sexual or graphic content", "other": "Something else"}
REPORTS_TO_HIDE = 3


def public_song(song_id):
    r = C.row_by_id(app_tables.songs, song_id)
    return r if S.is_public(r) else None


@anvil.server.callable(require_user=True)
def toggle_upvote(song_id):
    me = C.require_user()
    r = public_song(song_id)
    if r is None:
        return C.fail("This song isn't available any more.")
    if r["owner"] == me:
        return C.fail("You can't upvote your own song. (We're sure it's great.)")
    have = app_tables.upvotes.get(user=me, song=r)
    if have is not None:
        have.delete()
        upvoted = False
    else:
        if C.rate_limited("upvote", 200, 3600):
            return C.fail("Easy there! Too many upvotes in one hour.")
        app_tables.upvotes.add_row(user=me, song=r, created=C.now(), is_demo=False)
        upvoted = True
    S.recount(r)
    return C.ok(upvoted=upvoted, upvotes=r["upvotes"])


def _score(v):
    try:
        v = int(v)
    except (TypeError, ValueError):
        return None
    return v if 1 <= v <= 5 else None


@anvil.server.callable(require_user=True)
def save_review(song_id, r1, r2, r3, text, fav_line=None):
    """Write (or rewrite) your review of someone else's song."""
    me = C.require_user()
    r = public_song(song_id)
    if r is None:
        return C.fail("This song isn't available any more.")
    if r["owner"] == me:
        return C.fail("You can't review your own song.")
    scores = [_score(x) for x in (r1, r2, r3)]
    if None in scores:
        return C.fail("Pick 1 to 5 bananas for each of the three ratings.")
    text = C.text(text, 1500, multiline=True)
    if len(text) < 10:
        return C.fail("Say a little more (at least 10 characters): what worked, what you'd change.")
    fav = C.text(fav_line, 300)
    if fav and fav not in S.lines_of(r["sections"]):
        fav = ""
    have = app_tables.reviews.get(song=r, author=me)
    if have is not None:
        have.update(r1=scores[0], r2=scores[1], r3=scores[2], text=text, fav_line=fav)
    else:
        if C.rate_limited("review", 30, 3600):
            return C.fail("That's a lot of reviews in one hour. Take a break and come back.")
        have = app_tables.reviews.add_row(song=r, author=me, r1=scores[0], r2=scores[1], r3=scores[2], text=text,
                                          fav_line=fav, created=C.now(), is_demo=False)
    S.recount(r)
    return C.ok(review=S.review_dict(have, me), rating=r["rating"], review_count=r["review_count"])


@anvil.server.callable(require_user=True)
def delete_review(review_id):
    me = C.require_user()
    v = C.row_by_id(app_tables.reviews, review_id)
    if v is None:
        return C.ok()
    if v["author"] != me and not C.is_admin(me):
        return C.fail("You can only delete your own reviews.")
    song = v["song"]
    v.delete()
    if song is not None:
        S.recount(song)
    return C.ok()


@anvil.server.callable(require_user=True)
def promote_song(song_id):
    """Spend one of your weekly promotions: the song goes into the home page's Spotlight for 7 days."""
    me = C.require_user()
    r = public_song(song_id)
    if r is None:
        return C.fail("This song isn't available any more.")
    if r["owner"] == me:
        return C.fail("You can't promote your own song. Share its link instead!")
    cut = C.now() - S.WEEK
    if len(app_tables.promotions.search(song=r, user=me, created=q.greater_than(cut))):
        return C.fail("You already promoted this song this week.")
    if S.promos_left(me) <= 0:
        return C.fail("You've used your %d promotions this week. They come back 7 days after you spend them." % S.PROMOS_PER_WEEK)
    app_tables.promotions.add_row(song=r, user=me, created=C.now(), is_demo=False)
    return C.ok(promos_left=S.promos_left(me), boosts=S.boosts_by_song().get(r.get_id(), 0))


@anvil.server.callable(require_user=True)
def report_song(song_id, reason, note=None):
    me = C.require_user()
    r = C.row_by_id(app_tables.songs, song_id)
    if r is None or not S.is_public(r):
        return C.fail("This song isn't available any more.")
    if r["owner"] == me:
        return C.fail("That's your own song.")
    if reason not in REPORT_REASONS:
        return C.fail("Pick a reason.")
    if app_tables.reports.get(song=r, user=me, status="open") is not None:
        return C.ok(message="You already reported this song. An admin will look at it.")
    if C.rate_limited("report", 10, 3600):
        return C.fail("Too many reports in one hour.")
    app_tables.reports.add_row(song=r, user=me, reason=reason, note=C.text(note, 500, multiline=True), status="open",
                               created=C.now())
    reporters = {x["user"].get_id() for x in app_tables.reports.search(song=r, status="open") if x["user"] is not None}
    if len(reporters) >= REPORTS_TO_HIDE:
        r["hidden"] = True
    return C.ok(message="Thanks. An admin will look at it.")
