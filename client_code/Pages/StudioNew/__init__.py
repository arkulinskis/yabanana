import anvil.server
from anvil import *

from ._anvil_designer import StudioNewTemplate
from ... import challenge, router, state

# The sections a new song starts with, per scene.
SAMPLE = {"rap": [{"kind": "Verse", "text": ""}, {"kind": "Hook", "text": ""}],
          "poetry": [{"kind": "Stanza", "text": ""}],
          "pop": [{"kind": "Verse", "text": ""}, {"kind": "Chorus", "text": ""}]}


class StudioNew(StudioNewTemplate):
    """#studio/new: pick Rap / Poetry / Pop; the song is made and opens in the editor. Your own scene is outlined.
    A fourth card offers this week's challenge in any of the three scenes (or opens your entry)."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        mine = (state.me() or {}).get("scene") or ""
        for scene, el in (("rap", self.pick_rap), ("poetry", self.pick_poetry), ("pop", self.pick_pop)):
            el.classes["mine"] = scene == mine
        self.chal = None
        try:
            self.chal = anvil.server.call_s("challenge_banner")
        except Exception as e:  # the three scene cards work without it
            print("challenge_banner failed: %r" % e)
        self._draw_challenge()

    def _draw_challenge(self):
        c = self.chal
        self.chal_card.visible = bool(c)
        if not c:
            return
        self.chal_week.text = "Or take this week's challenge:"
        self.chal_title.text = c["title"]
        self.chal_meta.text = challenge.meta(c)
        self.chal_rule.text = c["rule"]
        entry = c.get("my_entry")
        for b in (self.chal_rap, self.chal_poetry, self.chal_pop):
            b.visible = not entry
        self.chal_open.visible = bool(entry)

    @handle("chal_rap", "click")
    def chal_rap_click(self, **event_args):
        challenge.take("rap", self.chal_rap)

    @handle("chal_poetry", "click")
    def chal_poetry_click(self, **event_args):
        challenge.take("poetry", self.chal_poetry)

    @handle("chal_pop", "click")
    def chal_pop_click(self, **event_args):
        challenge.take("pop", self.chal_pop)

    @handle("chal_open", "click")
    def chal_open_click(self, **event_args):
        entry = (self.chal or {}).get("my_entry") or {}
        if entry.get("song_id"):
            router.go("studio", entry["song_id"])

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
