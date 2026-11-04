from anvil import *

from ._anvil_designer import RatingTemplate
from ... import state


class Rating(RatingTemplate):
    """Tap 1 to 5 bananas. value = the rating (0 = not rated yet)."""

    def __init__(self, **properties):
        self._value, self._label, self._ready = 0, "Rating", False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _buttons(self):
        return [self.b1, self.b2, self.b3, self.b4, self.b5]

    def _draw(self):
        if not self._ready:
            return
        for i, b in enumerate(self._buttons()):
            b.classes["on"] = self._value >= i + 1
            state.set_attr(b, "aria-pressed", "true" if self._value == i + 1 else "false")

    def pick_click(self, event):
        self._value = int(event.currentTarget.getAttribute("data-v"))
        self._draw()

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, value):
        self._value = int(value or 0)
        self._draw()

    @property
    def label(self):
        return self._label

    @label.setter
    def label(self, value):
        self._label = value or "Rating"
        state.set_attr(self.group, "aria-label", self._label)
