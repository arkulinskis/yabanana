from anvil import *

from ._anvil_designer import ChallengeBannerTemplate
from ... import challenge, router, state


class ChallengeBanner(ChallengeBannerTemplate):
    """This week's challenge as a sticker banner (Stage, Studio). Take the challenge starts a draft in your profile's
    scene (no scene yet: the challenge page lets you pick one); once you have an entry the button opens it."""

    def __init__(self, **properties):
        self._data, self._ready = None, False
        super().__init__(**properties)
        self._ready = True
        router.link(self.see_link, "challenge")
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        d = self._data
        self.box.visible = bool(d)
        if not d:
            return
        self.week.text = "This week:"
        self.title.text = d.get("title") or ""
        self.meta.text = challenge.meta(d)
        self.rule.text = d.get("rule") or ""
        mine = d.get("my_entry")
        if mine:
            self.take_button.text = "Open your entry" if mine.get("shared") else "Finish your entry"
            self.take_button.role = ["btn", "btn-primary", "ic-pen"]
        else:
            self.take_button.text = "Take the challenge"
            self.take_button.role = ["btn", "btn-primary", "ic-pen"]

    @handle("take_button", "click")
    def take_button_click(self, **event_args):
        d = self._data or {}
        mine = d.get("my_entry")
        if mine:
            router.go("studio", mine["song_id"])
            return
        me = state.me()
        if me and not me.get("scene"):
            router.go("challenge")  # pick Rap, Poetry or Pop there
            return
        challenge.take((me or {}).get("scene"), self.take_button)

    @property
    def data(self):
        return self._data

    @data.setter
    def data(self, value):
        self._data = dict(value) if value else None
        self._draw()
