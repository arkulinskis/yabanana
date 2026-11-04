from anvil import *
import anvil.server
from anvil.js import window

from ._anvil_designer import UpvoteTemplate
from ... import router, state, yb


class Upvote(UpvoteTemplate):
    """The banana: one upvote per member per song (not their own). Upvoted songs land in the member's Bunch."""

    def __init__(self, **properties):
        self._song, self._big, self._ready, self._stop = {}, False, False, None
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        s = self._song or {}
        on, n = bool(s.get("upvoted")), int(s.get("upvotes") or 0)
        self.btn.text = str(n)
        self.btn.role = ["yb-up", "ic-banana"] + (["on"] if on else []) + (["big"] if self._big else [])
        self.btn.tooltip = "In your Bunch. Click to remove." if on else "Upvote: saves it to your Bunch"
        state.set_control_attr(self.btn, "aria-pressed", "true" if on else "false")
        state.set_control_attr(self.btn, "aria-label", "Upvote (%d)" % n)

    # ---- every banana for this song shows the same thing
    def _heard(self, song_id, upvoted, upvotes):
        if self._song and song_id == self._song.get("id"):
            self._song["upvoted"], self._song["upvotes"] = upvoted, upvotes
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

    @handle("btn", "click")
    def btn_click(self, **event_args):
        s = self._song or {}
        if not s.get("id"):
            return
        if not state.me():
            router.remember_after(window.location.hash)
            from ...Dialogs.JoinNudge import JoinNudge
            alert(JoinNudge(what="Sign up to upvote this song"), buttons=[], role="app-dialog")
            return
        if s.get("mine"):
            state.toast("That's your own song. Share the link instead!")
            return
        was, n = bool(s.get("upvoted")), int(s.get("upvotes") or 0)
        self._heard(s["id"], not was, n + (-1 if was else 1))  # show it straight away
        if not was:
            yb.confetti(self.btn, 12, 18)
        try:
            r = anvil.server.call_s("toggle_upvote", s["id"])
        except anvil.server.AppOfflineError:
            r = {"ok": False, "error": "You seem to be offline. Check your connection and try again."}
        if not r.get("ok"):
            self._heard(s["id"], was, n)
            state.toast(r.get("error") or "That didn't work.", "error")
            return
        yb.upvote_changed(s["id"], r["upvoted"], r["upvotes"])
        if r["upvoted"] and not state.store_get("bunchTip"):
            state.store_set("bunchTip", 1)
            state.toast("Saved to your Bunch. Find it under Bunch any time.", "ok")

    @property
    def song(self):
        return self._song

    @song.setter
    def song(self, value):
        self._song = dict(value) if value else {}
        self._draw()

    @property
    def big(self):
        return self._big

    @big.setter
    def big(self, value):
        self._big = bool(value)
        self._draw()
