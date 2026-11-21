import re

from anvil import *
from anvil.js import window

from ._anvil_designer import ShareSongTemplate
from ... import state, yb

MAX_LINES = 5


class ShareSong(ShareSongTemplate):
    """Share a song: pick 1-5 lines for a lyric card (it starts on the line reviewers picked most as their favourite,
    or the first four), a style (Sticker cream / Night / the scene's colour) and a size (square 1080x1080 or story
    1080x1920), with a live preview drawn by theme/assets/yb-card.js. Download image, Share image (phones that can
    share files) and the song's /s/ link, whose preview in chats shows the title and first lines."""

    def __init__(self, song, fav_counts=None, **properties):
        super().__init__(**properties)
        self.song = song
        self.lines = yb.song_lines(song.get("sections"))
        self.url = yb.song_link(song["id"])
        self.card_style = state.store_get("cardStyle", "cream")
        self.card_size = state.store_get("cardSize", "square")
        self.card_style = self.card_style if self.card_style in ("cream", "night", "scene") else "cream"
        self.card_size = self.card_size if self.card_size in ("square", "story") else "square"
        best, most = None, 0  # the line reviewers picked most as their favourite (a loop: Skulpt's lambdas trip here)
        for line, n in dict(fav_counts or {}).items():
            if n > most:
                best, most = line, n
        if best in self.lines:
            i = self.lines.index(best)
            self.picked = [i] + ([i + 1] if i + 1 < len(self.lines) else [])
        else:
            self.picked = list(range(min(4, len(self.lines))))
        self.lines_panel.add_event_handler("x-pick", self._pick)
        self.url_box.text = self.url
        state.control(self.url_box).setAttribute("readonly", "")
        state.set_control_attr(self.url_box, "aria-label", "Song link")
        self.share_button.visible = bool(window.YB.card.canShare())
        self._draw_lines()
        self._draw_opts()
        self._render()

    # ---------------------------------------------------------------- drawing
    def _draw_lines(self):
        full = len(self.picked) >= MAX_LINES
        self.lines_panel.items = [{"i": i, "text": ln, "on": i in self.picked, "full": full} for i, ln in enumerate(self.lines)]
        self.count.text = "%d of %d picked" % (len(self.picked), MAX_LINES)
        self.download_button.enabled = self.share_button.enabled = bool(self.picked)

    def _draw_opts(self):
        for el, v in ((self.st_cream, "cream"), (self.st_night, "night"), (self.st_scene, "scene")):
            el.classes["on"] = self.card_style == v
        for el, v in ((self.sz_square, "square"), (self.sz_story, "story")):
            el.classes["on"] = self.card_size == v
        self.dom_nodes["canvas"].classList.toggle("story", self.card_size == "story")

    def _chosen(self):
        return [self.lines[i] for i in sorted(self.picked) if i < len(self.lines)]

    def _render(self):
        a = self.song.get("author") or {}
        shown = self.url.split("://", 1)[-1]
        opts = {"lines": self._chosen(), "title": self.song.get("title") or "Untitled", "author": a.get("name") or "",
                "url": shown, "style": self.card_style, "scene": self.song.get("scene") or "rap", "size": self.card_size}
        canvas = self.dom_nodes["canvas"]
        canvas.setAttribute("aria-label", "Lyric card: " + " / ".join(self._chosen()) + " (from %s)" % opts["title"])
        window.YB.card.render(canvas, yb.to_js(opts), None)

    def _filename(self):
        base = re.sub(r"[^a-z0-9]+", "-", (self.song.get("title") or "lyrics").lower()).strip("-") or "lyrics"
        return "yabanana-%s-%s.png" % (base[:40], self.card_size)

    # ---------------------------------------------------------------- choices
    def _pick(self, index, on, **event_args):
        if on and index not in self.picked:
            if len(self.picked) >= MAX_LINES:
                state.toast("Up to %d lines fit on a card." % MAX_LINES)
                self._draw_lines()
                return
            self.picked.append(index)
        elif not on and index in self.picked:
            self.picked.remove(index)
        self._draw_lines()
        self._render()

    def style_click(self, event):
        self.card_style = str(event.currentTarget.getAttribute("data-v"))
        state.store_set("cardStyle", self.card_style)
        self._draw_opts()
        self._render()

    def size_click(self, event):
        self.card_size = str(event.currentTarget.getAttribute("data-v"))
        state.store_set("cardSize", self.card_size)
        self._draw_opts()
        self._render()

    # ---------------------------------------------------------------- actions
    @handle("download_button", "click")
    def download_button_click(self, **event_args):
        if not self.picked:
            state.toast("Pick at least one line.", "error")
            return
        window.YB.card.save(self.dom_nodes["canvas"], self._filename())
        state.toast("Lyric card saved", "ok")

    @handle("share_button", "click")
    def share_button_click(self, **event_args):
        if not self.picked:
            state.toast("Pick at least one line.", "error")
            return
        try:
            how = str(window.YB.card.share(self.dom_nodes["canvas"], self._filename(), self.song.get("title") or "", self.url))
        except Exception:
            how = "cancelled"
        if how == "downloaded":
            state.toast("Your browser can't share images here, so we saved it instead.", "ok")

    @handle("copy_button", "click")
    def copy_button_click(self, **event_args):
        if yb.copy_text(self.url):
            state.toast("Link copied", "ok")
        else:
            box = state.control(self.url_box)
            box.focus()
            box.select()
            state.toast("Copy the selected link (Ctrl+C, or press and hold on a phone).")

    @handle("close_button", "click")
    def close_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
