from anvil import *

from ._anvil_designer import FreshRowTemplate
from ... import router, state, yb


class FreshRow(FreshRowTemplate):
    """Stage → Fresh drops: one of the newest songs. item = a song dict."""

    def __init__(self, **properties):
        super().__init__(**properties)
        s = self.item
        self.classes["sc-" + (s.get("scene") or "rap")] = True
        router.link(self.title_link, "song", s["id"])
        self.meta.text = " · ".join([(s.get("author") or {}).get("name") or "Someone", yb.scene_name(s.get("scene")),
                                     state.ago(s.get("published"))])
