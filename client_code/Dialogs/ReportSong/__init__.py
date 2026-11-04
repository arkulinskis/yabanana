import anvil.server
from anvil import *

from ._anvil_designer import ReportSongTemplate


class ReportSong(ReportSongTemplate):
    """Report a song: five reasons + an optional note. Closes with the server's thank-you message, or None."""

    def __init__(self, song_id="", **properties):
        super().__init__(**properties)
        self._song_id = song_id
        self.note_box.placeholder = "What's wrong with it?"

    def _reason(self):
        for rb in (self.r_spam, self.r_hate, self.r_copied, self.r_explicit, self.r_other):
            if rb.selected:
                return rb.value
        return "spam"

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)

    @handle("send_button", "click")
    def send_button_click(self, **event_args):
        self.send_button.enabled = False
        try:
            r = anvil.server.call("report_song", self._song_id, self._reason(), self.note_box.text or "")
        finally:
            self.send_button.enabled = True
        if not r.get("ok"):
            self.message.text, self.message.visible = r.get("error") or "That didn't work.", True
            return
        self.raise_event("x-close-alert", value=r.get("message") or "Thanks. An admin will look at it.")
