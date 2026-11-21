from anvil import *

from ._anvil_designer import CardLineTemplate


class CardLine(CardLineTemplate):
    """Share dialog: one line of the song to put on the lyric card. item = {i, text, on, full} (full = 5 lines are
    already picked, so unpicked lines wait). Raises x-pick (index, on) on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        it = self.item
        self.box.text = it["text"]
        self.box.checked = bool(it.get("on"))
        self.box.enabled = bool(it.get("on")) or not it.get("full")
        self.classes["on"] = bool(it.get("on"))

    @handle("box", "change")
    def box_change(self, **event_args):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-pick", index=self.item["i"], on=bool(self.box.checked))
