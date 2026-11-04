from anvil import *

from ._anvil_designer import AdminSongRowTemplate
from ... import router, state


class AdminSongRow(AdminSongRowTemplate):
    """Admin → Songs: staff pick / hidden switches (saved straight away) and Delete (raises x-changed)."""

    def __init__(self, **properties):
        super().__init__(**properties)
        s = self.item
        self.classes["sc-" + (s.get("scene") or "rap")] = True
        router.link(self.title_link, "song", s["id"])
        self.by.text = "by " + ((s.get("author") or {}).get("name") or "Someone")
        n = s.get("open_reports") or 0
        self.reports.visible = bool(n)
        self.reports.text = state.plural(n, "report")
        self.excerpt.text = " / ".join((s.get("excerpt") or [])[:2])

    def _save(self, box, featured, hidden):
        r = state.call("admin_set_song", self.item["id"], featured, hidden)
        if r is None:
            box.checked = not box.checked
        else:
            state.toast("Saved", "ok")

    @handle("featured_box", "change")
    def featured_box_change(self, **event_args):
        self._save(self.featured_box, self.featured_box.checked, None)

    @handle("hidden_box", "change")
    def hidden_box_change(self, **event_args):
        self._save(self.hidden_box, None, self.hidden_box.checked)

    @handle("delete_button", "click")
    def delete_button_click(self, **event_args):
        if confirm("It is deleted with its upvotes, reviews and reports. This can't be undone.", title="Delete this song?",
                   buttons=[("Cancel", False), ("Delete", True)], role="app-dialog"):
            if state.call("delete_song", self.item["id"]) is not None:
                state.toast("Deleted", "ok")
                self.parent.raise_event("x-changed")
