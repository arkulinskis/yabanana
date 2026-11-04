from anvil import *

from ._anvil_designer import BeatOptionTemplate
from ... import state, yb


class BeatOption(BeatOptionTemplate):
    """Beat picker dialog: one beat to preview (▶) and use. item = a beat + "using" (the song's current beat).
    Use raises x-use on the panel with the beat's key."""

    def __init__(self, **properties):
        super().__init__(**properties)
        b = self.item
        self.classes["sc-" + b["scene"]] = True
        self.classes["using"] = bool(b.get("using"))
        self.chip.beat, self.chip.bpm, self.chip.owner = b["key"], b["bpm"], "pick"
        self.meta.text = "%s · %s syllables/line" % (b["meter"], yb.target_text(b))
        self.use_button.text = "Using" if b.get("using") else "Use"
        self.use_button.role = ["btn", "btn-sm", "btn-primary"] if b.get("using") else ["btn", "btn-sm"]
        state.set_control_attr(self.use_button, "aria-label", ("Using " if b.get("using") else "Use ") + b["name"])

    @handle("use_button", "click")
    def use_button_click(self, **event_args):
        self.parent.raise_event("x-use", key=self.item["key"])
