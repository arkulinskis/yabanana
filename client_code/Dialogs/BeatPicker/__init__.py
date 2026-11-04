from anvil import *
from anvil.js import window

from ._anvil_designer import BeatPickerTemplate
from ... import yb


class BeatPicker(BeatPickerTemplate):
    """The Studio's beat picker: the 12 beats by scene, each with ▶ to preview and Use. Closes with the chosen
    beat's key, or None. Stops the preview when it closes."""

    def __init__(self, current="boombap", **properties):
        super().__init__(**properties)
        for scene, panel in (("rap", self.rap_panel), ("pop", self.pop_panel), ("poetry", self.poetry_panel)):
            panel.items = [dict(b, using=b["key"] == current) for b in yb.beats() if b["scene"] == scene]
            panel.add_event_handler("x-use", self._use)

    def _close(self, value):
        if window.YB.player.owner == "pick":
            window.YB.player.stop()
        self.raise_event("x-close-alert", value=value)

    def _use(self, key, **event_args):
        self._close(key)

    @handle("close_button", "click")
    def close_button_click(self, **event_args):
        self._close(None)

    @handle("", "hide")
    def form_hide(self, **event_args):
        if window.YB.player.owner == "pick":
            window.YB.player.stop()
