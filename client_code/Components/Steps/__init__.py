from anvil import *
import anvil.js
from anvil.js import window

from ._anvil_designer import StepsTemplate
from ... import yb


class Steps(StepsTemplate):
    """A beat's step grid that lights up while the beat plays (only that beat, so a page of beats lights one card)."""

    def __init__(self, **properties):
        self._beat, self._ready, self._unsub = "boombap", False, None
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        node = anvil.js.get_dom_node(self)
        node.innerHTML = window.YB.stepsHtml(window.YB.beat(self._beat))
        if self._unsub is not None:  # showing: follow the new beat
            self._listen()

    def _listen(self):
        self._stop()
        self._unsub = window.YB.lightSteps(anvil.js.get_dom_node(self), yb.beat(self._beat)["key"])

    def _stop(self):
        if self._unsub is not None:
            self._unsub()
            self._unsub = None

    @handle("", "show")
    def form_show(self, **event_args):
        self._listen()

    @handle("", "hide")
    def form_hide(self, **event_args):
        self._stop()

    @property
    def beat(self):
        return self._beat

    @beat.setter
    def beat(self, value):
        self._beat = value or "boombap"
        self._draw()
