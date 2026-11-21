"""The Weekly Bar Challenge: one prompt a week for all three scenes, with a rule the Studio can check as you write.

Weeks run Monday 00:00 to Sunday 24:00 UTC and are named by ISO week ("2026-W47"). Sixteen challenges rotate with no
admin work: week 1 is the week the feature first ran (app setting `challenge_epoch`, stored once), so the first live
week always opens on CHALLENGES[0] (the one the demo entries were written for). An admin can pin a challenge to a week
with the app setting `challenge_override` = {"2026-W48": "keys"}.

Taking the challenge makes a draft (one entry per member per week; asking again returns the same song). Sharing the
draft before the week ends enters it. Entries are ranked by bananas (upvotes) given before the week ends + 7 days
(the voting week), ties broken by the review rating. The top entry of a closed week wins.

The table `challenge_entries` (song, user, week, created, is_demo) is new: until the user accepts Anvil's Schema
Mismatch alert it doesn't exist live, and everything here quietly says "not open yet" (C.table returns None).
"""
import datetime as dt
import re

import anvil.server
from anvil.tables import app_tables
import anvil.tables.query as q

from . import common as C
from . import Songs as S

WEEK = dt.timedelta(days=7)
WEEK_RE = re.compile(r"^(\d{4})-W(\d{2})$")
PAST_WEEKS = 6

# Each challenge: key, title, flip (the word, for flip challenges), lines (at least), rule (what people read), spark (a
# nudge to get going), check (what the Studio checks live: see YB.challengeHtml in theme/assets/yb-words.js) and a beat
# per scene. Written for all three scenes: every rule works for a verse, a poem or a chorus.
CHALLENGES = [
    {"key": "glass", "title": "Flip it: GLASS", "flip": "glass", "lines": 8,
     "rule": "Use GLASS at least three times, a different meaning each time: a window, a drink, a ceiling, a slipper...",
     "spark": "What do you see through it, drink from it, or break?",
     "check": {"word": "glass", "times": 3}, "beats": {"rap": "lofi", "poetry": "iambic", "pop": "ballad"}},
    {"key": "ten", "title": "Ten and done", "flip": "", "lines": 8,
     "rule": "Every line has exactly ten syllables. The flow strip counts them for you.",
     "spark": "Ten syllables is a heartbeat line: say it out loud and tap it.",
     "check": {"syll": [10, 10]}, "beats": {"rap": "boombap", "poetry": "iambic", "pop": "fourfloor"}},
    {"key": "mono", "title": "One rhyme, all the way down", "flip": "", "lines": 6,
     "rule": "Every line ends on the same rhyme sound. No breaks, no cheats.",
     "spark": "Pick an ending with lots of rhymes (-ight, -ay, -ow) or show off with a hard one.",
     "check": {"mono": True}, "beats": {"rap": "trap", "poetry": "trochaic", "pop": "disco"}},
    {"key": "keys", "title": "Flip it: KEYS", "flip": "keys", "lines": 8,
     "rule": "Use KEYS at least three times, a different meaning each time: a door, a piano, an island, the answer...",
     "spark": "Who holds the keys, and what do they open?",
     "check": {"word": "key", "times": 3}, "beats": {"rap": "boombap", "poetry": "anapest", "pop": "ballad"}},
    {"key": "six", "title": "Six words a line", "flip": "", "lines": 8,
     "rule": "Every line has exactly six words. Short words count, contractions count as one.",
     "spark": "Six words can hold a whole story. Make every one work.",
     "check": {"words": [6, 6]}, "beats": {"rap": "drill", "poetry": "trochaic", "pop": "dembow"}},
    {"key": "anaphora", "title": "Same first word", "flip": "", "lines": 6,
     "rule": "Start every line with the same word. Let the repetition build.",
     "spark": "\"Maybe...\", \"Tell...\", \"Never...\": pick a word that wants to be said again.",
     "check": {"start": True}, "beats": {"rap": "boombap", "poetry": "anapest", "pop": "fourfloor"}},
    {"key": "light", "title": "Flip it: LIGHT", "flip": "light", "lines": 8,
     "rule": "Use LIGHT at least three times, a different meaning each time: a lamp, not heavy, a green light, a lighter...",
     "spark": "What's light on your mind, and who left the light on?",
     "check": {"word": "light", "times": 3}, "beats": {"rap": "lofi", "poetry": "dactyl", "pop": "disco"}},
    {"key": "short", "title": "Short and sharp", "flip": "", "lines": 12,
     "rule": "Twelve lines, and none longer than eight syllables. Cut everything you can.",
     "spark": "Drill-style stops, haiku-tight images, chantable hooks.",
     "check": {"syll": [1, 8]}, "beats": {"rap": "drill", "poetry": "trochaic", "pop": "ballad"}},
    {"key": "circle", "title": "Full circle", "flip": "", "lines": 8,
     "rule": "The first and the last line end on the same word, but it means something new by the end.",
     "spark": "Pick a word that can change: home, gone, fine, free, still.",
     "check": {"bookend": True}, "beats": {"rap": "lofi", "poetry": "dactyl", "pop": "ballad"}},
    {"key": "run", "title": "Flip it: RUN", "flip": "run", "lines": 8,
     "rule": "Use RUN at least three times, a different meaning each time: running away, a home run, a run in your tights...",
     "spark": "Who's running, what's running out, and what runs in the family?",
     "check": {"word": "run", "times": 3}, "beats": {"rap": "trap", "poetry": "anapest", "pop": "fourfloor"}},
    {"key": "no-i", "title": "No I in this", "flip": "", "lines": 8,
     "rule": "Write it without I, me, my or mine. Tell the story through someone or something else.",
     "spark": "Write from the point of view of the kettle, the bus, the city, or \"you\".",
     "check": {"ban": ["i", "me", "my", "mine", "i'm", "i've", "i'll", "i'd", "myself"]},
     "beats": {"rap": "boombap", "poetry": "iambic", "pop": "dembow"}},
    {"key": "colour", "title": "Colour every line", "flip": "", "lines": 6,
     "rule": "Put a colour in every line: red, gold, grey, neon, whatever you can see.",
     "spark": "Colour is a cheat code for images. Go past the rainbow: rust, teal, ivory.",
     "check": {"colour": True}, "beats": {"rap": "lofi", "poetry": "dactyl", "pop": "disco"}},
    {"key": "break", "title": "Flip it: BREAK", "flip": "break", "lines": 8,
     "rule": "Use BREAK at least three times, a different meaning each time: a heartbreak, a lunch break, the break of day...",
     "spark": "What broke, who needs a break, and when does the day break?",
     "check": {"word": "break", "times": 3}, "beats": {"rap": "drill", "poetry": "trochaic", "pop": "dembow"}},
    {"key": "questions", "title": "Questions only", "flip": "", "lines": 6,
     "rule": "Every line is a question and ends with a question mark. No answers allowed.",
     "spark": "Ask the questions you never said out loud.",
     "check": {"end": "?"}, "beats": {"rap": "boombap", "poetry": "anapest", "pop": "ballad"}},
    {"key": "spring", "title": "Flip it: SPRING", "flip": "spring", "lines": 8,
     "rule": "Use SPRING at least three times, a different meaning each time: the season, a coil, water, a sudden jump...",
     "spark": "What springs back, what springs up, and what happens in spring?",
     "check": {"word": "spring", "times": 3}, "beats": {"rap": "lofi", "poetry": "iambic", "pop": "fourfloor"}},
    {"key": "gallop", "title": "The gallop", "flip": "", "lines": 8,
     "rule": "Every line has eleven or twelve syllables. Ride the anapests: da-da-DUM da-da-DUM.",
     "spark": "Long lines roll: pack them with little words and land hard on the last one.",
     "check": {"syll": [11, 12]}, "beats": {"rap": "trap", "poetry": "anapest", "pop": "disco"}},
]
BY_KEY = {c["key"]: c for c in CHALLENGES}
# The sections a challenge draft starts with, per scene (as the Studio's New song page).
START = {"rap": [{"kind": "Verse", "text": ""}, {"kind": "Hook", "text": ""}], "poetry": [{"kind": "Stanza", "text": ""}],
         "pop": [{"kind": "Verse", "text": ""}, {"kind": "Chorus", "text": ""}]}


# ----------------------------------------------------------------------------------------------- weeks
def _aware(d):
    if d is not None and d.tzinfo is None:
        return d.replace(tzinfo=dt.timezone.utc)
    return d


def week_key(when=None):
    """'2026-W47': the ISO week (UTC) holding `when` (default now)."""
    y, w = (when or C.now()).isocalendar()[:2]
    return "%d-W%02d" % (y, w)


def valid_key(key):
    m = WEEK_RE.match(key) if isinstance(key, str) else None
    if not m:
        return False
    try:
        dt.date.fromisocalendar(int(m.group(1)), int(m.group(2)), 1)
        return True
    except ValueError:
        return False


def start_of(key):
    """Monday 00:00 UTC of an ISO week key."""
    m = WEEK_RE.match(key)
    d = dt.date.fromisocalendar(int(m.group(1)), int(m.group(2)), 1)
    return dt.datetime(d.year, d.month, d.day, tzinfo=dt.timezone.utc)


def shift(key, weeks):
    return week_key(start_of(key) + dt.timedelta(days=7 * weeks, hours=12))


def number(key):
    return int(key[-2:])


def label(key):
    return "Week %d" % number(key)


def table():
    return C.table("challenge_entries")


def epoch():
    """Week 1 of the rotation: stored the first time the feature runs with its table in place."""
    v = C.get_setting("challenge_epoch")
    if valid_key(v):
        return v
    cur = week_key()
    if table() is not None:
        C.set_setting("challenge_epoch", cur)
    return cur


def challenge_for(key):
    over = C.get_setting("challenge_override")
    if isinstance(over, dict) and over.get(key) in BY_KEY:
        return BY_KEY[over[key]]
    weeks = (start_of(key) - start_of(epoch())).days // 7
    return CHALLENGES[weeks % len(CHALLENGES)]


def status_of(key, now=None):
    now = now or C.now()
    end = start_of(key) + WEEK
    if now < end:
        return "open"
    return "voting" if now < end + WEEK else "closed"


def brief(key):
    c = challenge_for(key)
    start = start_of(key)
    return {"week": key, "number": number(key), "label": label(key), "key": c["key"], "title": c["title"],
            "flip": c["flip"], "lines": c["lines"], "rule": c["rule"], "spark": c["spark"], "check": dict(c["check"]),
            "beats": dict(c["beats"]), "starts": C.iso(start), "ends": C.iso(start + WEEK),
            "closes": C.iso(start + 2 * WEEK), "status": status_of(key)}


# ----------------------------------------------------------------------------------------------- entries
def _entries(key):
    t = table()
    if t is None:
        return []
    return [e for e in t.search(week=key) if e["song"] is not None]


def counted(key):
    """Entries that count for a week: shared (public) and first shared before the week ended."""
    end = start_of(key) + WEEK
    return [e["song"] for e in _entries(key)
            if S.is_public(e["song"]) and e["song"]["published"] is not None and _aware(e["song"]["published"]) < end]


def ranked(key):
    """[(song row, bananas)] best first: bananas given before the voting week closed, then rating, then who was first."""
    close = start_of(key) + 2 * WEEK
    out = []
    for s in counted(key):
        out.append((s, len(app_tables.upvotes.search(song=s, created=q.less_than(close)))))
    out.sort(key=lambda p: (-p[1], -(p[0]["rating"] or 0), _aware(p[0]["published"])))
    return out


def winner(key):
    """The winning song row of a closed week, else None."""
    if status_of(key) != "closed":
        return None
    r = ranked(key)
    return r[0][0] if r else None


def my_entry(me, key):
    t = table()
    if me is None or t is None:
        return None
    for e in t.search(week=key, user=me):
        s = e["song"]
        if s is not None:
            end = start_of(key) + WEEK
            return {"song_id": s.get_id(), "title": s["title"] or "Untitled",
                    "shared": S.is_public(s) and s["published"] is not None and _aware(s["published"]) < end}
    return None


def weeks_by_song():
    """song id -> the week it was entered in (for the "Week 47 challenge" badges)."""
    t = table()
    if t is None:
        return {}
    return {e["song"].get_id(): e["week"] for e in t.search() if e["song"] is not None}


def tag(songs, weeks=None):
    """Add "challenge": {week, label} to song dicts that are challenge entries."""
    weeks = weeks_by_song() if weeks is None else weeks
    for d in songs:
        wk = weeks.get(d.get("id"))
        if wk:
            d["challenge"] = {"week": wk, "label": "%s challenge" % label(wk)}
    return songs


def song_info(song_row):
    """For the song page: {week, label, won, rank} when the song is a challenge entry, else None."""
    t = table()
    if t is None or song_row is None:
        return None
    for e in t.search(song=song_row):
        key = e["week"]
        r = ranked(key)
        rank = next((i + 1 for i, p in enumerate(r) if p[0] == song_row), None)
        st = status_of(key)
        return {"week": key, "label": "%s challenge" % label(key), "title": challenge_for(key)["title"],
                "rank": rank, "won": st == "closed" and rank == 1, "status": st}
    return None


def draft_info(song_row):
    """For the Studio editor: the brief of the challenge this draft was started for, else None."""
    t = table()
    if t is None or song_row is None:
        return None
    for e in t.search(song=song_row):
        return brief(e["week"])
    return None


def writer_stats(user):
    """{took, won}: challenges a writer entered (shared entries) and won."""
    t = table()
    if t is None or user is None:
        return {"took": 0, "won": 0}
    weeks = sorted({e["week"] for e in t.search(user=user) if e["song"] is not None})
    took = won = 0
    for key in weeks:
        mine = [s for s in counted(key) if s["owner"] == user]
        if not mine:
            continue
        took += 1
        w = winner(key)
        if w is not None and w["owner"] == user:
            won += 1
    return {"took": took, "won": won}


def summary(me):
    """This week's banner (Stage, Studio, New song): the brief, entries so far and your entry. None = not open yet."""
    if table() is None:
        return None
    ensure_demo()
    key = week_key()
    b = brief(key)
    return {"week": key, "label": b["label"], "title": b["title"], "rule": b["rule"], "lines": b["lines"],
            "ends": b["ends"], "beats": b["beats"], "entries": len(counted(key)), "my_entry": my_entry(me, key)}


def ensure_demo():
    """The demo challenge entries arrive with the demo data; an app whose demo loaded before this feature existed
    gets them the first time the challenge runs (unless an admin removed the demo)."""
    from . import DemoData
    if C.get_setting("challenge_demo") is None and DemoData.state() == "loaded" and table() is not None:
        DemoData.load_challenge()


# ----------------------------------------------------------------------------------------------- callables
@anvil.server.callable
def challenge_banner():
    """The banner on the Stage, Studio and New song pages (None when the challenge isn't open yet)."""
    return summary(C.me())


@anvil.server.callable
def get_challenge(week=None):
    """#challenge (this week) or #challenge/<2026-W46>: the brief, entries ranked by bananas, your entry, and the
    top entry of the weeks before. Open to everyone."""
    me = C.me()
    cur = week_key()
    if table() is None:
        return C.ok(available=False, current=cur, brief=brief(cur), entries=[], past=[], my_entry=None, is_current=True)
    ensure_demo()
    key = week if valid_key(week) else cur
    first = epoch()
    if key > cur:
        return C.fail("That week hasn't started yet.")
    if key < first:
        return C.fail("The weekly challenge started in %s." % label(first))
    up = S.my_upvoted(me)
    weeks = weeks_by_song()
    st = status_of(key)
    entries = []
    for i, (s, score) in enumerate(ranked(key)):
        d = S.song_dict(s, me, up)
        d.update(rank=i + 1, score=score, period="challenge", winner=(i == 0 and st == "closed"))
        entries.append(d)
    tag(entries, weeks)
    past = []
    k = shift(key, -1)
    while len(past) < PAST_WEEKS and k >= first:
        r = ranked(k)
        top = None
        if r:
            top = S.song_dict(r[0][0], me, up)
            top.update(score=r[0][1])
        past.append({"week": k, "label": label(k), "title": challenge_for(k)["title"], "entries": len(r),
                     "status": status_of(k), "top": top})
        k = shift(k, -1)
    return C.ok(available=True, current=cur, is_current=key == cur, brief=brief(key), entries=entries,
                my_entry=my_entry(me, key), past=past)


@anvil.server.callable(require_user=True)
def start_challenge_song(scene=None):
    """Take this week's challenge: a draft with the challenge's title and that scene's beat. One entry per member per
    week: asking again returns the same song."""
    me = C.require_user()
    t = table()
    if t is None:
        return C.fail("The weekly challenge isn't open yet. Check back soon!")
    ensure_demo()
    key = week_key()
    have = my_entry(me, key)
    if have:
        return C.ok(song_id=have["song_id"], existing=True)
    if C.rate_limited("create_song", 30, 3600):
        return C.fail("That's a lot of new songs in one hour. Finish one first?")
    scene = scene if scene in S.SCENES else (me["scene"] if me["scene"] in S.SCENES else "rap")
    c = challenge_for(key)
    beat = c["beats"][scene]
    stamp = C.now()
    r = app_tables.songs.add_row(owner=me, title=c["title"], scene=scene, mood="", beat=beat, bpm=S.BEATS[beat],
                                 bars_per_line=S.BARS_PER_LINE.get(beat, 1), sections=S.clean_sections(START[scene]), status="draft", created=stamp,
                                 updated=stamp, published=None, upvotes=0, review_count=0, rating=None, featured=False,
                                 hidden=False, is_demo=False)
    t.add_row(song=r, user=me, week=key, created=stamp, is_demo=False)
    return C.ok(song_id=r.get_id(), existing=False)
