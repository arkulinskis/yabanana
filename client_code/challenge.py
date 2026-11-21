"""The Weekly Bar Challenge on the client: taking it from any page (server_code/Challenges.py does the work).

    challenge.take(scene)      sign-up first for visitors (then back to #challenge); members get their entry draft
                               opened in the Studio (the same draft on every later click, one entry per week)
    challenge.meta(d)          "8 lines · 4 days left · 12 entries" for a banner
"""
from . import router, state, yb


def take(scene=None, button=None):
    if not state.me():
        router.remember_after("#challenge")
        state.toast("Join Yabanana (free) to take the weekly challenge.")
        router.go("auth", "signup")
        return
    if button is not None:
        button.enabled = False
    try:
        r = state.call("start_challenge_song", scene)
    finally:
        if button is not None:
            button.enabled = True
    if r:
        if not r.get("existing"):
            state.toast("Challenge accepted! The rule is pinned above your lyrics.", "ok")
        router.go("studio", r["song_id"])


def meta(d):
    if not d:
        return ""
    bits = [state.plural(d.get("lines") or 0, "line"), yb.time_left(d.get("ends")),
            state.plural(d.get("entries") or 0, "entry", "entries")]
    return " · ".join(b for b in bits if b)
