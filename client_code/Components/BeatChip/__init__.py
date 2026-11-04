from anvil import *
import anvil.js
from anvil.js import window

from ._anvil_designer import BeatChipTemplate


class BeatChip(BeatChipTemplate):
    """The play-a-beat pill. The beat engine draws it and handles the click (so a chip inside a clickable song card
    never opens the card), and lights every chip of the beat that's playing."""

    def __init__(self, **properties):
        self._beat, self._bpm, self._owner, self._ready = "boombap", None, "", False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if self._ready:
            anvil.js.get_dom_node(self).innerHTML = window.YB.beatChip(self._beat or "boombap", self._bpm or None,
                                                                       self._owner or None)

    @property
    def beat(self):
        return self._beat

    @beat.setter
    def beat(self, value):
        self._beat = value or "boombap"
        self._draw()

    @property
    def bpm(self):
        return self._bpm

    @bpm.setter
    def bpm(self, value):
        self._bpm = value or None
        self._draw()

    @property
    def owner(self):
        return self._owner

    @owner.setter
    def owner(self, value):
        self._owner = value or ""
        self._draw()
