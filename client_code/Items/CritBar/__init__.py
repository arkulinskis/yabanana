from anvil import *

from ._anvil_designer import CritBarTemplate


class CritBar(CritBarTemplate):
    """Song page side card: the average of one review rating. item = {name, avg}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        avg = self.item.get("avg") or 0
        self.fill.style["width"] = "%d%%" % round(avg / 5 * 100)
        self.value.text = "%.1f" % avg
