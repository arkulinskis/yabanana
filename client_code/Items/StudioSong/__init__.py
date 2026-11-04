from anvil import *

from ._anvil_designer import StudioSongTemplate
from ... import router, state


class StudioSong(StudioSongTemplate):
    """Studio notebook: one of your songs (draft or on stage). item = a song dict from my_songs."""

    def __init__(self, **properties):
        super().__init__(**properties)
        s = self.item
        self.classes["sc-" + (s.get("scene") or "rap")] = True
        self.avatar.author = {"name": s.get("title"), "scene": s.get("scene")}
        router.link(self.title_link, "studio", s["id"])
        router.link(self.write_link, "studio", s["id"])
        router.link(self.view_link, "song", s["id"])
        published = s.get("status") == "published"
        self.status.text = "On stage" if published else "Draft"
        self.status.role = ["badge", "badge-good"] if published else ["badge"]
        self.lines.text = state.plural(s.get("lines") or 0, "line")
        self.edited.text = "edited " + state.ago(s.get("updated"))
        self.counts.visible = published
