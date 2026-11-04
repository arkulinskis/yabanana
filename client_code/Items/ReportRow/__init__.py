from anvil import *

from ._anvil_designer import ReportRowTemplate
from ... import router, state


class ReportRow(ReportRowTemplate):
    """Admin → Reports: one report. Open ones can be dismissed ("It's fine", unhides the song) or the song hidden.
    Both raise x-changed on the panel so the page reloads."""

    def __init__(self, **properties):
        super().__init__(**properties)
        r = self.item
        s = r.get("song")
        self.when.text = state.short_date(r.get("created"))
        self.hidden.visible = bool(s and s.get("hidden"))
        self.song_part.visible = self.excerpt.visible = bool(s)
        self.gone.visible = not s
        if s:
            self.title_link.text = s.get("title") or "Untitled"
            router.link(self.title_link, "song", s["id"])
            self.by.text = " by " + ((s.get("author") or {}).get("name") or "Someone")
            self.excerpt.text = " / ".join(s.get("excerpt") or [])
        self.note.visible = bool(r.get("note"))
        self.note.text = "“%s”" % r["note"] if r.get("note") else ""
        self.actions.visible = r.get("status") == "open"

    def _resolve(self, how, button):
        button.enabled = False
        try:
            if state.call("resolve_report", self.item["id"], how) is not None:
                state.toast("Done", "ok")
                self.parent.raise_event("x-changed")
        finally:
            button.enabled = True

    @handle("fine_button", "click")
    def fine_button_click(self, **event_args):
        self._resolve("dismiss", self.fine_button)

    @handle("hide_button", "click")
    def hide_button_click(self, **event_args):
        self._resolve("hide", self.hide_button)
