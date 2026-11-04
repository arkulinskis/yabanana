from anvil import *

from ._anvil_designer import BeatCardTemplate
from ... import state, yb


class BeatCard(BeatCardTemplate):
    """Beats & theory: one beat with its step grid, meter, numbers, theory and an example line.
    item = a beat from yb.beats() + "focus" (the beat the address points at, #beats/<key>).
    The big ▶ button is the beat engine's: [data-play-beat] buttons toggle the player anywhere."""

    def __init__(self, **properties):
        super().__init__(**properties)
        b = self.item
        self.classes["sc-" + b["scene"]] = True
        self.classes["focus"] = bool(b.get("focus"))
        state.set_attr(self, "id", "beat-" + b["key"])
        for name, value in (("data-play-beat", b["key"]), ("data-owner", "lib"), ("aria-label", "Play " + b["name"])):
            state.set_attr(self.play_button, name, value)
        self.bpm.text = "%d BPM" % b["bpm"]
        self.per_bar.text = "%s beats/bar" % b["beatsPerBar"]
        self.syllables.text = "%s syllables/line" % yb.target_text(b)
        self.bars.visible = (b.get("lines") or 1) > 1
        self.bars.text = "%s bars/line" % b.get("lines")
