from anvil import *
from anvil.js import window

from ._anvil_designer import BeatsTemplate
from ... import state, yb


class Beats(BeatsTemplate):
    """#beats, #beats/<key>: the 12 beats with the song and poetry theory behind each (play, step grid, meter,
    syllables per line, an example line), plus a craft cheat sheet per scene. No server calls.
    #beats/<key> outlines that beat and scrolls to it."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.focus = args[0] if args else ""
        me = state.me()
        self.write_link.visible, self.join_link.visible = bool(me), not me
        for scene, panel in (("rap", self.rap_panel), ("pop", self.pop_panel), ("poetry", self.poetry_panel)):
            panel.items = [dict(b, focus=b["key"] == self.focus) for b in yb.beats() if b["scene"] == scene]

    @handle("", "show")
    def form_show(self, **event_args):
        if self.focus:
            window.setTimeout(self._scroll, 80)

    def _scroll(self):
        el = window.document.getElementById("beat-" + self.focus)
        if el:
            el.scrollIntoView(yb.to_js({"block": "center", "behavior": "smooth"}))
