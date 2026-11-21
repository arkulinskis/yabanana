from anvil import *

from ._anvil_designer import ChallengeWeekTemplate
from ... import router, state


class ChallengeWeek(ChallengeWeekTemplate):
    """Challenge page → Past weeks: one week with its top entry (the winner once voting has closed).
    item = {week, label, title, entries, status, top (a song dict + score, or None)}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        w = self.item
        self.week_link.text = "%s · %s" % (w["label"], w["title"])
        router.link(self.week_link, "challenge", w["week"])
        status = {"open": "open", "voting": "voting now", "closed": "closed"}.get(w.get("status"), "")
        self.meta.text = " · ".join(x for x in (state.plural(w.get("entries") or 0, "entry", "entries"), status) if x)
        top = w.get("top")
        self.top_part.visible = bool(top)
        self.none.visible = not top
        if top:
            self.top_what.text = "Winner" if w.get("status") == "closed" else "Leading"
            self.top_link.text = top["title"]
            router.link(self.top_link, "song", top["id"])
            a = top.get("author") or {}
            self.by_link.text = a.get("name") or "Someone"
            if a.get("id"):
                router.link(self.by_link, "writer", a["id"])
            self.score.text = state.plural(top.get("score") or 0, "banana")
