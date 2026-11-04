from anvil import *

from ._anvil_designer import SceneBadgeTemplate
from ... import yb


class SceneBadge(SceneBadgeTemplate):
    """RAP / POETRY / POP in the scene's colour."""

    def __init__(self, **properties):
        self._scene, self._ready = "rap", False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        scene = self._scene if self._scene in yb.SCENES else "rap"
        for s in yb.SCENE_KEYS:
            self.pill.classes["sc-" + s] = s == scene
        self.label.text = yb.scene_name(scene)

    @property
    def scene(self):
        return self._scene

    @scene.setter
    def scene(self, value):
        self._scene = value or "rap"
        self._draw()
