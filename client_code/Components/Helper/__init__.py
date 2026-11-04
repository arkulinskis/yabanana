from anvil import *
import anvil.js
from anvil.js import window

from ._anvil_designer import HelperTemplate


class Helper(HelperTemplate):
    """The writing helpers panel. It's a JavaScript engine (it searches a 24,000-word dictionary on every keystroke
    and redraws a hundred suggestion chips), so this component only mounts it and passes clicks on as "insert"."""

    def __init__(self, **properties):
        self._scene, self._api = "", None
        super().__init__(**properties)
        self._api = window.YB.mountHelper(anvil.js.get_dom_node(self), self._scene, self._insert)

    def _insert(self, text):
        self.raise_event("insert", text=str(text))

    def set_word(self, word):
        """Rhymes for the word at the writer's cursor (the Rhymes tab only)."""
        if self._api is not None:
            self._api.setWord(word or "")

    def show(self, tab, word=None):
        if self._api is not None:
            self._api.show(tab, word)

    @property
    def scene(self):
        return self._scene

    @scene.setter
    def scene(self, value):
        self._scene = value or ""
        if self._api is not None:
            self._api.setScene(self._scene)
