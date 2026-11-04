from anvil import *
import anvil.js
from anvil.js import window

from ._anvil_designer import SongCardTemplate
from ... import router, state, yb


class SongCard(SongCardTemplate):
    """A song card (Stage, Bunch, writer pages, landing). item = a song dict from the server, plus optionally
    "rank" (charts-style number) and "liked" (when it went into your Bunch). Clicking the card opens the song."""

    def __init__(self, **properties):
        super().__init__(**properties)
        # (a template's root element can't take anvil:on-dom: bindings on every runtime, so listen here)
        anvil.js.get_dom_node(self).addEventListener("click", anvil.js.report_exceptions(self.card_click))
        s = self.item
        scene = s.get("scene") or "rap"
        self.classes["sc-" + scene] = True
        self.rank.visible = bool(s.get("rank"))
        self.rank.text = "#%s" % s.get("rank", "")
        flag = None
        if s.get("featured"):
            flag = ("star", "Staff pick", "")
        elif s.get("boosts"):
            flag = ("flame", "Promoted ×%d" % s["boosts"], "")
        elif s.get("status") and s.get("status") != "published":
            flag = ("lock", "Draft", "muted")
        elif s.get("hidden"):
            flag = ("", "Hidden", "")
        self.flag.visible = flag is not None
        if flag:
            if flag[0]:
                self.flag_icon.classes["ic-" + flag[0]] = True
            self.flag_icon.visible = bool(flag[0])
            self.flag_text.text = flag[1]
            self.flag.classes["muted"] = flag[2] == "muted"
        router.link(self.title_link, "song", s["id"])
        lines = (s.get("excerpt") or [])[:4]
        for i, lab in enumerate([self.l1, self.l2, self.l3, self.l4]):
            lab.text = lines[i] if i < len(lines) else ""
            lab.visible = i < len(lines)
        if not lines:
            self.l1.text, self.l1.visible = "(no lines yet)", True
            self.l1.role = ["ex-line", "faint"]
        a = s.get("author") or {}
        self.writer_link.visible = bool(a.get("id"))
        self.writer_name.visible = not a.get("id")
        self.writer_link.text = self.writer_name.text = a.get("name") or "Someone"
        if a.get("id"):
            router.link(self.writer_link, "writer", a["id"])
        self.when.text = state.ago(s.get("published") or s.get("updated") or s.get("created"))
        self.remix.visible = bool(s.get("remix_of"))
        self.liked.visible = bool(s.get("liked"))
        self.liked.text = "· saved " + state.ago(s.get("liked")) if s.get("liked") else ""
        self.chip.beat, self.chip.bpm, self.chip.owner = s.get("beat") or "boombap", s.get("bpm"), "card-" + s["id"]
        self.reviews.visible = bool(s.get("review_count"))
        self.upvote.visible = s.get("status") == "published" and not s.get("no_up")
        if self.upvote.visible:
            self.upvote.song = s

    def card_click(self, event):
        """Anywhere on the card that isn't a link or a button opens the song (not when selecting text)."""
        if event.target.closest("a, button, input, select, textarea, label"):
            return
        sel = window.getSelection()
        if sel is not None and getattr(sel, "toString")():  # (str() of a JS object gives its description, not the selected text)
            return
        router.go("song", self.item["id"])
