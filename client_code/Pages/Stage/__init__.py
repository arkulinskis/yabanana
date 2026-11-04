import random

import anvil.server
from anvil import *

from ._anvil_designer import StageTemplate
from ... import router, state, yb

GREET = ["What are we writing today?", "The beat is warming up.", "Fresh page, fresh bars.", "Somebody needs your chorus.",
         "Peel back a new verse."]


class Stage(StageTemplate):
    """#home, #home/<scene>: the Stage, open to everyone. Random songs (Shuffle), the Spotlight (staff picks + songs
    members promoted this week), fresh drops, counts. Upvotes need an account (visitors get the Join nudge)."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.scene = args[0] if args and args[0] in yb.SCENES else ""
        me = state.me()
        if me:
            self.hello.text = "Hey %s." % (me.get("name") or "there").split(" ")[0]
            self.greet.text = random.choice(GREET)
            self.lead.text = ("Random songs from rappers, poets and pop writers. Upvote what you love: it lands in your Bunch.")
        else:
            self.hello.text, self.greet.text = "Fresh off the", "shuffle"
            self.lead.text = "Random songs from rappers, poets and pop writers. Sign up to upvote, review and write your own."
        self.start_link.visible = self.empty_write.visible = bool(me)
        self.join_link.visible = self.empty_join.visible = self.guest_band.visible = not me
        self.scene_pick.value = self.scene
        self.empty_title.text = "No %ssongs yet" % (yb.scene_name(self.scene) + " " if self.scene else "")
        state.heading(self.empty_title, 3)
        d = state.call("get_stage", self.scene or None)
        self._songs(d["songs"])
        self.spot_part.visible = bool(d["spotlight"])
        self.spot_panel.items = d["spotlight"]
        self.spot_text.text = "Staff picks and songs members promoted this week." + (
            " You have %s left this week." % state.plural(d["promos_left"], "promotion") if me else "")
        self.fresh_part.visible = bool(d["fresh"])
        self.fresh_panel.items = d["fresh"]
        self.n_songs.text = str(d["counts"]["songs"])
        self.n_writers.text = str(d["counts"]["writers"])
        self.n_upvotes.text = str(d["counts"]["upvotes"])

    def _songs(self, songs):
        self.songs_panel.items = songs
        self.songs_panel.visible = bool(songs)
        self.empty.visible = not songs

    @handle("scene_pick", "change")
    def scene_pick_change(self, value, **event_args):
        router.go("home", value)

    @handle("shuffle_button", "click")
    def shuffle_button_click(self, **event_args):
        self.shuffle_button.enabled = False
        try:
            d = anvil.server.call_s("shuffle", self.scene or None, 12)
        finally:
            self.shuffle_button.enabled = True
        self._songs(d["songs"])
