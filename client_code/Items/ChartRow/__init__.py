from anvil import *

from ._anvil_designer import ChartRowTemplate
from ... import router


class ChartRow(ChartRowTemplate):
    """Charts (and the challenge page's entries): one ranked song. item = a song dict + "rank", "score" and "period"
    (week / all / reviewed / challenge; challenge entries may carry "winner")."""

    def __init__(self, **properties):
        super().__init__(**properties)
        s = self.item
        self.classes["sc-" + (s.get("scene") or "rap")] = True
        self.classes["top%d" % s["rank"]] = s["rank"] <= 3
        self.rank.text = str(s["rank"])
        router.link(self.title_link, "song", s["id"])
        self.excerpt.text = (s.get("excerpt") or [""])[0] if s.get("excerpt") else ""
        a = s.get("author") or {}
        self.writer_link.text = a.get("name") or "Someone"
        if a.get("id"):
            router.link(self.writer_link, "writer", a["id"])
        self.reviews.visible = bool(s.get("review_count"))
        period, score = s.get("period"), s.get("score")
        if period == "reviewed":
            text = "%.1f / 5" % score if score else ""
        elif period == "challenge":  # the Weekly Bar Challenge's entries
            text = ("Winner · " if s.get("winner") else "") + ("%d banana%s" % (score or 0, "" if score == 1 else "s"))
            self.classes["won"] = bool(s.get("winner"))
        elif period == "week":
            text = "+%s this week" % score
        else:
            text = ""
        self.score.text, self.score.visible = text, bool(text)
