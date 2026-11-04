from anvil import *

from ._anvil_designer import ShareLinkTemplate
from ... import state


class ShareLink(ShareLinkTemplate):
    """When the browser won't copy to the clipboard: the song's link, selected, ready to copy by hand."""

    def __init__(self, url="", **properties):
        super().__init__(**properties)
        self.url_box.text = url

    @handle("", "show")
    def form_show(self, **event_args):
        state.control(self.url_box).select()

    @handle("close_button", "click")
    def close_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
