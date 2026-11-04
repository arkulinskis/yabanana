from anvil import *

from ._anvil_designer import BunchTemplate
from ... import state, yb


class Bunch(BunchTemplate):
    """#bunch: the songs you upvoted, saved as links, newest first. Search, scene filter; un-upvoting removes a song."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.scene, self.query, self._stop = "", "", None
        state.set_control_attr(self.search_box, "aria-label", "Search your Bunch")
        self.all = state.call("get_bunch")["songs"]
        self.tools.visible = bool(self.all)
        state.heading(self.empty_title, 2)
        self._draw()

    def _draw(self):
        self.count.text = state.plural(len(self.all), "song")
        q = self.query
        items = [s for s in self.all if (not self.scene or s["scene"] == self.scene) and
                 (not q or q in (" ".join([s["title"], s["author"]["name"]] + list(s.get("excerpt") or []))).lower())]
        self.songs_panel.items = items
        self.songs_panel.visible = bool(items)
        self.empty.visible = not items
        self.empty_title.text = "Nothing matches" if self.all else "Your Bunch is empty"
        self.empty_text.text = ("Try another search or scene." if self.all else
                                "Upvote songs you love on the Stage: they're saved here so you can find them again.")
        self.empty_link.visible = not self.all

    def _heard(self, song_id, upvoted, upvotes):
        if upvoted:
            return
        before = len(self.all)
        self.all = [s for s in self.all if s["id"] != song_id]
        if len(self.all) != before:
            state.toast("Removed from your Bunch")
            self.tools.visible = bool(self.all)
            self._draw()

    @handle("", "show")
    def form_show(self, **event_args):
        if self._stop is None:
            self._stop = yb.on_upvote(self._heard)

    @handle("", "hide")
    def form_hide(self, **event_args):
        if self._stop is not None:
            self._stop()
            self._stop = None

    @handle("search_box", "change")
    def search_box_change(self, **event_args):
        self.query = (self.search_box.text or "").strip().lower()
        self._draw()

    @handle("scene_pick", "change")
    def scene_pick_change(self, value, **event_args):
        self.scene = value
        self._draw()
