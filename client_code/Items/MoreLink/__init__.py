from anvil import *

from ._anvil_designer import MoreLinkTemplate
from ... import router, state, yb


class MoreLink(MoreLinkTemplate):
    """Song page: "More by <writer>" link. item = a song dict."""

    def __init__(self, **properties):
        super().__init__(**properties)
        state.set_attr(self, "href", router.href("song", self.item["id"]))
        self.scene.text = "· " + yb.scene_name(self.item.get("scene"))
