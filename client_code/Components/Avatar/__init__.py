from anvil import *

from ._anvil_designer import AvatarTemplate
from ... import router, state, yb


class Avatar(AvatarTemplate):
    """A writer's initials on their scene colour, linking to their writer page."""

    def __init__(self, **properties):
        self._author, self._big, self._ready = {}, False, False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        a = self._author or {}
        scene = a.get("scene") if a.get("scene") in yb.SCENES else "rap"
        letters = state.initials(a.get("name") or "?")
        linked = bool(a.get("id"))
        self.link.visible, self.plain.visible = linked, not linked
        for el in (self.link, self.plain):
            for s in yb.SCENE_KEYS:
                el.classes["sc-" + s] = s == scene
            el.classes["lg"] = self._big
        self.link_letters.text = self.plain_letters.text = letters
        if linked:
            state.set_attr(self.link, "href", router.href("writer", a["id"]))
            state.set_attr(self.link, "aria-label", a.get("name") or "Writer")

    @property
    def author(self):
        return self._author

    @author.setter
    def author(self, value):
        self._author = value or {}
        self._draw()

    @property
    def big(self):
        return self._big

    @big.setter
    def big(self, value):
        self._big = bool(value)
        self._draw()
