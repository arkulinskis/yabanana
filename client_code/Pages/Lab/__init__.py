from anvil import *
from anvil.js import window

from ._anvil_designer import LabTemplate
from ... import router, state, yb

DEMO = ("I hold the hands of strangers until dawn\nand learn their names the way you learn the rain\n"
        "Counting hi-hats like they're sheep but I never get to sleep\nThere's a cat on the roof who collects every moon")


class Lab(LabTemplate):
    """#lab, #lab/<word>: the Rhyme lab, open to everyone. The full helper panel beside a line checker (syllables,
    stress marks, meter, rhyme letters per line) and a scratchpad kept in this browser. No server calls, except
    "Start a song with this" for members."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        me = state.me()
        self._t = None
        self.helper.scene = (me or {}).get("scene") or ""
        if args:
            self.helper.show("rhymes", args[0])
        self.song_button.visible = bool(me)
        self.scratch_box.text = state.store_get("scratch", "") or ""
        self.check_box.text = state.store_get("checker", DEMO)
        state.set_control_attr(self.check_box, "aria-label", "Lines to check")
        state.set_control_attr(self.scratch_box, "aria-label", "Scratchpad")
        state.control(self.check_box).setAttribute("spellcheck", "true")
        self._analyse()
        if not yb.words_ready():
            yb.when_words(self._loaded)

    def _loaded(self, error):
        if error:
            self.dom_nodes["out"].innerHTML = '<p class="ui-error">%s</p>' % window.UI.esc(error)
        else:
            self._analyse()

    def _analyse(self, *args):
        self._t = None
        state.store_set("checker", self.check_box.text or "")
        self.dom_nodes["out"].innerHTML = window.YB.checkHtml(self.check_box.text or "")

    @handle("check_box", "change")
    def check_box_change(self, **event_args):
        if self._t is not None:
            window.clearTimeout(self._t)
        self._t = window.setTimeout(self._analyse, 200)

    @handle("scratch_box", "change")
    def scratch_box_change(self, **event_args):
        state.store_set("scratch", self.scratch_box.text or "")

    @handle("helper", "insert")
    def helper_insert(self, text, **event_args):
        s = self.scratch_box.text or ""
        if s and not s[-1].isspace():
            s += "\n" if len(text) > 20 else " "
        self.scratch_box.text = s + text
        state.store_set("scratch", self.scratch_box.text)
        state.toast("Added to your scratchpad")

    @handle("copy_button", "click")
    def copy_button_click(self, **event_args):
        if yb.copy_text(self.scratch_box.text or ""):
            state.toast("Copied", "ok")
        else:
            state.control(self.scratch_box).select()

    @handle("clear_button", "click")
    def clear_button_click(self, **event_args):
        self.scratch_box.text = ""
        state.store_set("scratch", "")

    @handle("song_button", "click")
    def song_button_click(self, **event_args):
        text = (self.scratch_box.text or "").strip() or (self.check_box.text or "").strip()
        me = state.me() or {}
        self.song_button.enabled = False
        try:
            r = state.call("create_song", me.get("scene") or "rap", None, [{"kind": "Verse", "text": text}])
        finally:
            self.song_button.enabled = True
        if r:
            router.go("studio", r["song"]["id"])
