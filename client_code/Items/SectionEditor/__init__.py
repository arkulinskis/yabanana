from anvil import *
import anvil.js
from anvil.js import window

from ._anvil_designer import SectionEditorTemplate
from ... import state, yb


class SectionEditor(SectionEditorTemplate):
    """Studio editor: one section (Verse, Chorus, Stanza ...). item = {index, count, kind, text, beat, bpl, scene}.

    Tells the Editor page what happened by raising x-sec on the panel: action = "text" (value = the new text),
    "kind", "move" (value = -1 / 1), "dup", "del", "focus" (the helper inserts here) or "caret" (value = the word
    at the cursor, for the rhymes). Under the text, the flow strip: syllables per line vs the beat's target,
    rhyme letters and the meter (drawn by the dictionary engine, YB.flowHtml)."""

    def __init__(self, **properties):
        super().__init__(**properties)
        i = self.item
        self._beat, self._bpl = i.get("beat") or "boombap", i.get("bpl") or 1
        self._flow_t = None
        self._caret_t = None
        self.classes["sc-" + (i.get("scene") or "rap")] = True
        self.kind_box.items = yb.KINDS
        self.kind_box.selected_value = i["kind"] if i.get("kind") in yb.KINDS else "Verse"
        state.set_control_attr(self.kind_box, "aria-label", "Section type")  # after .items: Anvil rebuilds the select
        self.text_box.text = i.get("text") or ""
        self.text_box.placeholder = ("Write your first line… (the helper rhymes with the word at your cursor)"
                                     if i["index"] == 0 else "Keep going…")
        ta = state.control(self.text_box)
        ta.setAttribute("spellcheck", "true")
        ta.setAttribute("rows", "4")
        ta.setAttribute("aria-label", "%s %d lyrics" % (self.kind_box.selected_value, i["index"] + 1))
        for name in ("keyup", "click", "focus"):
            ta.addEventListener(name, anvil.js.report_exceptions(self._caret))
        self.up_button.enabled = i["index"] > 0
        self.down_button.enabled = i["index"] < i["count"] - 1
        self._draw_flow()

    def _tell(self, action, value=None):
        panel = self.parent
        if panel is None:  # a timer that fired after the sections were redrawn: this editor is gone
            return
        panel.raise_event("x-sec", action=action, index=self.item["index"], value=value, editor=self)

    @handle("", "show")
    def form_show(self, **event_args):
        window.YB.autosize(state.control(self.text_box), 130)

    # ---- the text
    @handle("text_box", "change")
    def text_box_change(self, **event_args):
        text = self.text_box.text or ""
        self.item["text"] = text
        window.YB.autosize(state.control(self.text_box), 130)
        self._tell("text", text)
        if self._flow_t is not None:
            window.clearTimeout(self._flow_t)
        self._flow_t = window.setTimeout(self._draw_flow, 220)
        self._caret(None)

    def _caret(self, event):
        """Focus, click, typing: remember this box (the helper inserts here) and show rhymes for the word at the cursor."""
        self._tell("focus")
        if event is not None and str(event.type) == "focus" and self.text_box.text:
            return
        if self._caret_t is not None:
            window.clearTimeout(self._caret_t)
        self._caret_t = window.setTimeout(self._send_word, 280)

    def _send_word(self):
        self._tell("caret", str(window.YB.wordAtCaret(state.control(self.text_box)) or ""))

    def insert(self, text):
        """Put a helper suggestion at the cursor (fires the change handler like typing does)."""
        return str(window.YB.insertAtCaret(state.control(self.text_box), text))

    def focus_text(self):
        state.focus(self.text_box)

    # ---- the flow strip
    def _draw_flow(self, *args):
        self._flow_t = None
        self.dom_nodes["flow"].innerHTML = window.YB.flowHtml(self.text_box.text or "", self._beat, self._bpl)

    def set_beat(self, beat, bpl):
        self._beat, self._bpl = beat, bpl
        self._draw_flow()

    # ---- the section's buttons
    @handle("kind_box", "change")
    def kind_box_change(self, **event_args):
        self._tell("kind", self.kind_box.selected_value)

    @handle("up_button", "click")
    def up_button_click(self, **event_args):
        self._tell("move", -1)

    @handle("down_button", "click")
    def down_button_click(self, **event_args):
        self._tell("move", 1)

    @handle("dup_button", "click")
    def dup_button_click(self, **event_args):
        self._tell("dup")

    @handle("del_button", "click")
    def del_button_click(self, **event_args):
        self._tell("del")
