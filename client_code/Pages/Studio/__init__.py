import anvil.server
from anvil import *

from ._anvil_designer import StudioTemplate
from ... import state


class Studio(StudioTemplate):
    """#studio: your notebook of drafts and shared songs, with totals, this week's challenge banner and "New since
    your last visit" (reviews, bananas and remixes on your songs: Songs.my_activity). The last visit is remembered in
    this browser (state.store "activitySeen" = the server's time), so nothing new is stored on the server and each
    item shows up once. Members only."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        d = state.call("my_songs")
        t = d["totals"]
        self.chal.data = d.get("challenge")
        self.t_published.text, self.t_drafts.text = str(t["published"]), str(t["drafts"])
        self.t_drafts_word.text = "draft" if t["drafts"] == 1 else "drafts"
        self.t_upvotes.text, self.t_reviews.text = str(t["upvotes"]), str(t["reviews"])
        self.songs_panel.items = d["songs"]
        self.songs_panel.visible = bool(d["songs"])
        self.empty.visible = not d["songs"]
        self._news(t["published"] > 0)

    def _news(self, has_shared):
        seen = state.store_get("activitySeen")
        try:
            a = anvil.server.call_s("my_activity", seen)
        except Exception as e:  # the notebook still works without it
            print("my_activity failed: %r" % e)
            self.news_part.visible = False
            return
        events = a.get("events") or []
        self.news_part.visible = bool(events) or (bool(seen) and has_shared)
        self.news_title.text = "New since your last visit" if seen else "On your songs lately"
        self.news_panel.items = events
        self.news_panel.visible = bool(events)
        self.news_none.visible = not events
        self.news_none.text = "All caught up: no new reviews, bananas or remixes since your last visit."
        if a.get("now"):
            state.store_set("activitySeen", a["now"])
