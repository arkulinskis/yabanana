from anvil import *

from ._anvil_designer import StudioTemplate
from ... import state


class Studio(StudioTemplate):
    """#studio: your notebook of drafts and shared songs, with totals. Members only."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        d = state.call("my_songs")
        t = d["totals"]
        self.t_published.text, self.t_drafts.text = str(t["published"]), str(t["drafts"])
        self.t_drafts_word.text = "draft" if t["drafts"] == 1 else "drafts"
        self.t_upvotes.text, self.t_reviews.text = str(t["upvotes"]), str(t["reviews"])
        self.songs_panel.items = d["songs"]
        self.songs_panel.visible = bool(d["songs"])
        self.empty.visible = not d["songs"]
