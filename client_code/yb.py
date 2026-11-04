"""Yabanana's shared client pieces: scenes, moods and section kinds, the beats (read once from the JavaScript engine),
ripeness levels, upvote news between components, and thin wrappers around the engines in theme/assets/yb-*.js:

    yb-beats.js    YB.BEATS, YB.player (Web Audio synth), YB.beatChip, YB.stepsHtml / YB.lightSteps
    yb-words.js    YB.words (rhyme dictionary, syllables, meter, rhyme scheme), YB.helper (the helper panel),
                   YB.flowHtml (Studio flow strip), YB.checkHtml (Rhyme lab line checker)
    yb-shared.js   YB.lyricsHtml (lyrics + rhyme map), YB.lines, YB.confetti
    yb-perform.js  YB.perform (full-screen karaoke over the beat)

Data goes to JavaScript as JSON (to_js) so nested lists and dicts arrive as plain JS objects.
"""
import json

import anvil.js
from anvil.js import window

SCENE_KEYS = ["rap", "poetry", "pop"]
SCENES = {"rap": {"name": "Rap", "word": "Bars", "desc": "Flow, punchlines, multis"},
          "poetry": {"name": "Poetry", "word": "Lines", "desc": "Meter, images, the turn"},
          "pop": {"name": "Pop", "word": "Hooks", "desc": "Hooks, choruses, singability"}}
MOODS = ["Hype", "Defiant", "Tender", "Heartbroken", "Dreamy", "Nostalgic", "Playful", "Dark", "Hopeful"]
KINDS = ["Intro", "Verse", "Pre-chorus", "Chorus", "Hook", "Bridge", "Outro", "Stanza", "Couplet", "Refrain", "Spoken"]
START_BEAT = {"rap": "boombap", "poetry": "iambic", "pop": "fourfloor"}
# Ripeness: a writer's level from the bananas (upvotes) their songs received.
RIPE = [(0, "Green", "#7cc35a"), (5, "Ripening", "#c9d64a"), (20, "Ripe", "#ffc21a"), (50, "Sweet", "#e8a317"),
        (100, "Golden Bunch", "#d48a00")]

_cache: dict = {}
_upvote_listeners: list = []


def to_js(value):
    """A Python dict/list as a plain JavaScript object (through JSON)."""
    return window.JSON.parse(json.dumps(value))


def scene_name(scene):
    return SCENES.get(scene or "rap", SCENES["rap"])["name"]


def beats():
    """The 12 beats as dicts (key, name, scene, bpm, steps, per, target [min, max], lines, feel, meter, theory, tryLine,
    beatsPerBar, poetic ...), straight from the sound engine so the two never disagree."""
    if "beats" not in _cache:
        _cache["beats"] = json.loads(window.JSON.stringify(window.YB.BEATS))
    return _cache["beats"]


def beat(key):
    for b in beats():
        if b["key"] == key:
            return b
    return beats()[0]


def target_text(b):
    """'10–16' (or '10' when the range is one number)."""
    lo, hi = b["target"][0], b["target"][1]
    return str(lo) if lo == hi else "%d–%d" % (lo, hi)


def ripeness(n):
    level, nxt = RIPE[0], None
    for i, r in enumerate(RIPE):
        if n >= r[0]:
            level, nxt = r, (RIPE[i + 1] if i + 1 < len(RIPE) else None)
    return {"at": level[0], "name": level[1], "color": level[2],
            "next": {"at": nxt[0], "name": nxt[1]} if nxt else None}


def confetti(component, n=16, dx=None, dy=None):
    """Banana confetti bursting from a component (skipped when the visitor prefers reduced motion)."""
    try:
        window.YB.confettiAt(anvil.js.get_dom_node(component), n, dx, dy)
    except Exception:
        pass


def perform(song):
    """Open Perform mode for a song dict (title, author, scene, beat, bpm, bars_per_line, sections)."""
    window.YB.perform(to_js(song))


def stop_beat():
    if window.YB.player.playing:
        window.YB.player.stop()


def words_ready():
    return bool(window.YB.words.ready)


def when_words(callback):
    """Load the rhyme dictionary (once), then call callback(error_or_None)."""
    window.YB.whenWords(callback)


def lyrics_html(sections, scheme=True, fav=""):
    return window.YB.lyricsHtml(to_js(sections), to_js({"scheme": bool(scheme), "fav": fav or ""}))


def song_lines(sections):
    out = []
    for s in sections or []:
        out += [ln.strip() for ln in (s.get("text") or "").split("\n") if ln.strip()]
    return out


# ---------------------------------------------------------------- upvotes: every button for a song shows the same count
def on_upvote(fn):
    """fn(song_id, upvoted, upvotes) after any upvote changes. Returns a function that stops listening."""
    _upvote_listeners.append(fn)

    def stop():
        if fn in _upvote_listeners:
            _upvote_listeners.remove(fn)
    return stop


def upvote_changed(song_id, upvoted, upvotes):
    for fn in list(_upvote_listeners):
        try:
            fn(song_id, upvoted, upvotes)
        except Exception as e:  # a listener from a page that has gone: drop it
            print("upvote listener failed: %r" % e)
            if fn in _upvote_listeners:
                _upvote_listeners.remove(fn)


def copy_text(text):
    """Copy to the clipboard. True if it worked (some browsers refuse without a secure page)."""
    try:
        window.navigator.clipboard.writeText(text)
        return True
    except Exception:
        return False


def page_url(hash_part):
    loc = window.location
    return str(loc.href).split("#")[0].split("?")[0] + hash_part
