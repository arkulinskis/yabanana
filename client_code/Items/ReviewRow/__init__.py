from anvil import *

from ._anvil_designer import ReviewRowTemplate
from ... import router, state


class ReviewRow(ReviewRowTemplate):
    """Song page: one review. item = a review dict + "criteria" (the scene's three rating names).
    Delete asks, then raises x-changed on the panel so the page reloads."""

    def __init__(self, **properties):
        super().__init__(**properties)
        v = self.item
        a = v.get("author") or {}
        self.writer_link.text = a.get("name") or "Someone"
        if a.get("id"):
            router.link(self.writer_link, "writer", a["id"])
        self.when.text = state.ago(v.get("created"))
        self.scores.text = "   ".join("%s %s/5" % (c, v["r"][i]) for i, c in enumerate(v.get("criteria") or []))
        self.fav.text = "“%s”" % v["fav_line"] if v.get("fav_line") else ""

    @handle("delete_button", "click")
    def delete_button_click(self, **event_args):
        if confirm("Delete this review?", buttons=[("Cancel", False), ("Delete", True)], role="app-dialog"):
            if state.call("delete_review", self.item["id"]) is not None:
                self.parent.raise_event("x-changed")
