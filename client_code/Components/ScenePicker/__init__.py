from anvil import *

from ._anvil_designer import ScenePickerTemplate


class ScenePicker(ScenePickerTemplate):
    """All / Rap / Poetry / Pop. Raises "change" with the picked value ("" for all)."""

    def __init__(self, **properties):
        self._value, self._ready = "", False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        for key, el in (("", self.s_all), ("rap", self.s_rap), ("poetry", self.s_poetry), ("pop", self.s_pop)):
            el.classes["on"] = key == self._value  # app-kit.js turns "on" into aria-pressed

    def pick_click(self, event):
        self._value = str(event.currentTarget.getAttribute("data-scene") or "")
        self._draw()
        self.raise_event("change", value=self._value)

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, value):
        self._value = value or ""
        self._draw()

    @property
    def all_label(self):
        return self.dom_nodes["all_text"].textContent

    @all_label.setter
    def all_label(self, value):
        self.dom_nodes["all_text"].textContent = value or "All scenes"
