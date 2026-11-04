from anvil import *

from ._anvil_designer import LandingTemplate
from ... import state

# The app's video on the Addanapp YouTube channel (APP_MAKER/youtube/manifest.json), shown in the Watch section.
YT_VIDEO = "TwZemZxbquE"


class Landing(LandingTemplate):
    """#landing: what visitors see first (also "About" for members). The promise for three scenes (rap, poetry, pop),
    a sticker-collage hero, the video, live random songs from the Stage, how it works, features, FAQ.
    Static copy lives in the template; only the signed-in variations and the live songs are set here."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        me = state.me()
        self.guest_cta.visible = not me
        self.member_cta.visible = bool(me)
        if me:
            state.set_attr(self.band_link, "href", "#studio/new")
            self.dom_nodes["band_text"].textContent = "Write a song"
        self.dom_nodes["yt_cover"].addEventListener("click", self._play)
        d = state.call_quiet("shuffle", None, 6) or {"songs": []}
        self.live_panel.items = d["songs"]
        self.live_empty.visible = not d["songs"]

    def _play(self, event):
        """Swap the video's cover for YouTube's player (privacy-enhanced); nothing loads from YouTube before this click."""
        self.dom_nodes["yt_frame"].innerHTML = (
            '<iframe src="https://www.youtube-nocookie.com/embed/' + YT_VIDEO + '?autoplay=1&rel=0&playsinline=1" '
            'title="Yabanana video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen '
            'referrerpolicy="strict-origin-when-cross-origin"></iframe>')
