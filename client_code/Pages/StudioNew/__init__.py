from anvil import *

from ._anvil_designer import StudioNewTemplate
from ... import router, state

# The sections a new song starts with, per scene.
SAMPLE = {"rap": [{"kind": "Verse", "text": ""}, {"kind": "Hook", "text": ""}],
          "poetry": [{"kind": "Stanza", "text": ""}],
          "pop": [{"kind": "Verse", "text": ""}, {"kind": "Chorus", "text": ""}]}


class StudioNew(StudioNewTemplate):
    """#studio/new: pick Rap / Poetry / Pop; the song is made and opens in the editor. Your own scene is outlined."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        mine = (state.me() or {}).get("scene") or ""
        for scene, el in (("rap", self.pick_rap), ("poetry", self.pick_poetry), ("pop", self.pick_pop)):
            el.classes["mine"] = scene == mine

    def pick_click(self, event):
        button = event.currentTarget  # (the browser clears event.currentTarget once the server call starts waiting)
        scene = str(button.getAttribute("data-new"))
        button.disabled = True
        try:
            r = state.call("create_song", scene, None, SAMPLE[scene])
        finally:
            button.disabled = False
        if r:
            router.open_replacing("studio", r["song"]["id"])
