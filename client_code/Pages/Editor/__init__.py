import anvil.js
import anvil.server
from anvil import *
from anvil.js import window

from ._anvil_designer import EditorTemplate
from ... import router, state, yb
from ...Items.SectionEditor import SectionEditor

BPL = [(0.5, "bpl_half"), (1, "bpl_one"), (2, "bpl_two")]


class Editor(EditorTemplate):
    """#studio/<id>: the writer's desk. Title, scene, mood, beat (12, with preview), tempo, bars per line, the step
    lights, sections (Items/SectionEditor: kind + text + the flow strip), the helper panel (rhymes for the word at the
    cursor, similes, metaphors, themes, sparks; a bottom sheet on phones), autosave, Play, Perform, Share to the
    stage / Unpublish, Delete. Unsaved changes are saved when you leave the page."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.song_id = args[0] if args else ""
        self.song = {}
        self._dirty = self._saving = False
        self._save_t = self._preview_t = None
        self._last = None  # the section editor the helper inserts into
        self._unsub = None
        self._unload = anvil.js.report_exceptions(self._before_unload)
        self._on_beat = anvil.js.report_exceptions(self._player_event)
        self.mood_box.items = [("None", "")] + [(m, m) for m in yb.MOODS]
        state.set_control_attr(self.mood_box, "aria-label", "Mood")
        state.set_control_attr(self.title_box, "aria-label", "Title")
        state.control(self.title_box).setAttribute("maxlength", "80")
        self.dom_nodes["bpm"].addEventListener("input", anvil.js.report_exceptions(self._bpm_input))
        self.dom_nodes["preview_box"].addEventListener("toggle", anvil.js.report_exceptions(self._preview_toggle))
        self.sections_panel.add_event_handler("x-sec", self._section_event)
        r = anvil.server.call("get_draft", self.song_id)
        if not r.get("ok"):
            self.desk.visible, self.missing.visible = False, True
            self.missing_text.text = r.get("error") or "This song isn't yours."
            return
        self.desk.visible, self.missing.visible = True, False
        self.song = r["song"]
        if not self.song.get("sections"):
            self.song["sections"] = [{"kind": "Verse", "text": ""}]
        self.song["bpm"] = self.song.get("bpm") or yb.beat(self.song["beat"])["bpm"]
        router.set_title(self.song["title"])
        self.title_box.text = "" if self.song["title"] == "Untitled" else self.song["title"]
        rx = self.song.get("remix_of")
        self.remix_part.visible = bool(rx)
        if rx:
            self.remix_link.text = rx["title"]
            router.link(self.remix_link, "song", rx["id"])
            self.remix_by.text = "by " + rx["author"]["name"]
        self.mood_box.selected_value = self.song.get("mood") if self.song.get("mood") in yb.MOODS else ""
        self.helper.scene = self.song["scene"]
        if state.store_get("previewOpen"):
            self.dom_nodes["preview_box"].setAttribute("open", "")
        self._draw_status()
        self._draw_ctl()
        self._draw_sections()
        if not yb.words_ready():
            yb.when_words(self._words_loaded)

    def _editors(self):
        """The section editors on the page, in order."""
        return [c for c in self.sections_panel.get_components() if isinstance(c, SectionEditor)]

    # ---------------------------------------------------------------- drawing
    def _words_loaded(self, error):
        if not error:
            for ed in self._editors():
                ed.set_beat(self.song["beat"], self.song.get("bars_per_line") or 1)
            self._draw_preview()

    def _draw_status(self):
        pub = self.song.get("status") == "published"
        self.on_stage.visible, self.draft_badge.visible = pub, not pub
        state.set_attr(self.on_stage, "href", router.href("song", self.song_id))
        self.publish_button.text = "Unpublish" if pub else "Share to the stage"
        self.publish_button.role = ["btn", "ic-lock"] if pub else ["btn", "btn-primary", "ic-banana"]

    def _draw_ctl(self):
        s, b = self.song, yb.beat(self.song["beat"])
        for el, key in ((self.sc_rap, "rap"), (self.sc_poetry, "poetry"), (self.sc_pop, "pop")):
            el.classes["on"] = s["scene"] == key
        self.beat_button.text = b["name"] + " ▾"
        state.set_control_attr(self.beat_button, "aria-label", "Beat: %s. Pick another beat" % b["name"])
        self.dom_nodes["bpm"].value = str(s["bpm"])
        self.bpm_value.text = str(s["bpm"])
        bpl = s.get("bars_per_line") or 1
        for value, name in BPL:
            getattr(self, name).classes["on"] = bpl == value
        self.steps.beat = b["key"]
        self._draw_play()

    def _draw_play(self):
        p = window.YB.player
        on = bool(p.playing) and p.owner == "studio"
        self.play_button.role = ["btn", "btn-sm", "btn-icon", "ic-stop" if on else "ic-play"] + (["btn-primary"] if on else [])
        self.play_button.text = "Stop the beat" if on else "Play the beat"

    def _draw_sections(self):
        s = self.song
        n = len(s["sections"])
        self.sections_panel.items = [{"index": i, "count": n, "kind": sec["kind"], "text": sec["text"], "beat": s["beat"],
                                      "bpl": s.get("bars_per_line") or 1, "scene": s["scene"]}
                                     for i, sec in enumerate(s["sections"])]
        self._last = None
        self._draw_preview()

    def _draw_preview(self, *args):
        self._preview_t = None
        if getattr(self.dom_nodes["preview_box"], "open"):
            self.preview.sections = [dict(x) for x in self.song["sections"]]

    def _preview_toggle(self, event):
        state.store_set("previewOpen", bool(getattr(self.dom_nodes["preview_box"], "open")))
        self._draw_preview()

    # ---------------------------------------------------------------- saving
    def _payload(self):
        s = self.song
        return {"title": s["title"], "scene": s["scene"], "mood": s.get("mood") or "", "beat": s["beat"], "bpm": s["bpm"],
                "bars_per_line": s.get("bars_per_line") or 1, "sections": s["sections"]}

    def _status(self, text, icon, dirty):
        self.save_text.text = text
        for name in ("check", "edit", "refresh", "info"):
            self.save_icon.classes["ic-" + name] = name == icon
        self.save_box.classes["dirty"] = dirty

    def _mark_dirty(self):
        self._dirty = True
        self._status("Unsaved changes", "edit", True)
        if self._save_t is not None:
            window.clearTimeout(self._save_t)
        self._save_t = window.setTimeout(self._autosave, 1400)

    def _autosave(self):
        self._save_t = None
        self.save()

    def save(self):
        """Save now if anything changed. True when everything is saved."""
        if self._save_t is not None:
            window.clearTimeout(self._save_t)
            self._save_t = None
        if not self._dirty or self._saving:
            return not self._dirty
        self._saving, self._dirty = True, False
        self._status("Saving…", "refresh", False)
        try:
            r = anvil.server.call_s("save_song", self.song_id, self._payload())
        except anvil.server.AppOfflineError:
            r = {"ok": False, "error": "You seem to be offline. Your changes are kept here; we'll try again."}
        self._saving = False
        if not r.get("ok"):
            self._dirty = True
            self._status("Not saved", "info", True)
            state.toast(r.get("error") or "That didn't save.", "error")
            return False
        self._status("Saved", "check", False)
        if self._dirty:
            self._mark_dirty()
        return True

    def _before_unload(self, event):
        if self._dirty or self._saving:
            event.preventDefault()
            event.returnValue = ""

    @handle("", "show")
    def form_show(self, **event_args):
        window.addEventListener("beforeunload", self._unload)
        if self._unsub is None:
            self._unsub = window.YB.player.on(self._on_beat)

    @handle("", "hide")
    def form_hide(self, **event_args):
        window.removeEventListener("beforeunload", self._unload)
        if self._unsub is not None:
            self._unsub()
            self._unsub = None
        if self._dirty and self.song:
            try:
                anvil.server.call_s("save_song", self.song_id, self._payload())
                self._dirty = False
            except Exception as e:
                print("couldn't save on leaving: %r" % e)

    def _player_event(self, ev):
        if ev.type == "state":
            self._draw_play()

    # ---------------------------------------------------------------- the top controls
    @handle("title_box", "change")
    def title_box_change(self, **event_args):
        self.song["title"] = (self.title_box.text or "").strip() or "Untitled"
        self._mark_dirty()

    def scene_click(self, event):
        self.song["scene"] = str(event.currentTarget.getAttribute("data-v"))
        self.helper.scene = self.song["scene"]
        self._draw_ctl()
        self._draw_sections()
        self._mark_dirty()

    @handle("mood_box", "change")
    def mood_box_change(self, **event_args):
        self.song["mood"] = self.mood_box.selected_value or ""
        self._mark_dirty()

    def _beat_changed(self):
        self._draw_ctl()
        for ed in self._editors():
            ed.set_beat(self.song["beat"], self.song.get("bars_per_line") or 1)
        self._mark_dirty()

    @handle("beat_button", "click")
    def beat_button_click(self, **event_args):
        from ...Dialogs.BeatPicker import BeatPicker
        key = alert(BeatPicker(current=self.song["beat"]), buttons=[], large=True, role="app-dialog")
        if not key:
            return
        b = yb.beat(key)
        self.song["beat"], self.song["bpm"], self.song["bars_per_line"] = b["key"], b["bpm"], b.get("lines") or 1
        self._beat_changed()
        state.toast("%s it is. Aim for %s syllables per line." % (b["name"], yb.target_text(b)))

    @handle("play_button", "click")
    def play_button_click(self, **event_args):
        window.YB.player.toggle(self.song["beat"], yb.to_js({"bpm": self.song["bpm"], "owner": "studio"}))
        self._draw_play()

    def _bpm_input(self, event):
        self.song["bpm"] = int(self.dom_nodes["bpm"].value)
        self.bpm_value.text = str(self.song["bpm"])
        p = window.YB.player
        if p.playing and p.owner == "studio":
            p.setBpm(self.song["bpm"])
        self._mark_dirty()

    def bpl_click(self, event):
        v = float(event.currentTarget.getAttribute("data-v"))
        self.song["bars_per_line"] = int(v) if v >= 1 else v
        self._beat_changed()

    # ---------------------------------------------------------------- sections
    def _section_event(self, action, index, value=None, editor=None, **event_args):
        secs = self.song["sections"]
        if action == "focus":
            self._last = editor
        elif action == "caret":
            self.helper.set_word(value)
        elif action == "text":
            secs[index]["text"] = value or ""
            self._mark_dirty()
            if self._preview_t is not None:
                window.clearTimeout(self._preview_t)
            self._preview_t = window.setTimeout(self._draw_preview, 220)
        elif action == "kind":
            secs[index]["kind"] = value
            self._mark_dirty()
            self._draw_preview()
        elif action == "move":
            j = index + value
            if 0 <= j < len(secs):
                secs[index], secs[j] = secs[j], secs[index]
                self._draw_sections()
                self._mark_dirty()
        elif action == "dup":
            secs.insert(index + 1, {"kind": secs[index]["kind"], "text": secs[index]["text"]})
            self._draw_sections()
            self._mark_dirty()
            state.toast("Section repeated: handy for choruses.")
        elif action == "del":
            if secs[index]["text"].strip() and not confirm(
                    "Delete this %s?" % secs[index]["kind"].lower(), buttons=[("Cancel", False), ("Delete", True)],
                    role="app-dialog"):
                return
            secs.pop(index)
            if not secs:
                secs.append({"kind": "Verse", "text": ""})
            self._draw_sections()
            self._mark_dirty()

    def _add(self, kind):
        self.song["sections"].append({"kind": kind, "text": ""})
        self._draw_sections()
        self._mark_dirty()
        eds = self._editors()
        if eds:
            eds[-1].focus_text()
            self._last = eds[-1]

    @handle("add_verse", "click")
    def add_verse_click(self, **event_args):
        self._add("Verse")

    @handle("add_chorus", "click")
    def add_chorus_click(self, **event_args):
        self._add("Chorus")

    @handle("add_hook", "click")
    def add_hook_click(self, **event_args):
        self._add("Hook")

    @handle("add_bridge", "click")
    def add_bridge_click(self, **event_args):
        self._add("Bridge")

    @handle("add_stanza", "click")
    def add_stanza_click(self, **event_args):
        self._add("Stanza")

    # ---------------------------------------------------------------- the helper panel
    @handle("helper", "insert")
    def helper_insert(self, text, **event_args):
        eds = self._editors()
        target = self._last if self._last in eds else (eds[-1] if eds else None)
        if target is None:
            return
        added = target.insert(text)
        self._last = target
        state.toast('Added "%s"' % added)

    @handle("help_open", "click")
    def help_open_click(self, **event_args):
        self.help_wrap.classes["open"] = True

    @handle("help_close", "click")
    def help_close_click(self, **event_args):
        self.help_wrap.classes["open"] = False

    # ---------------------------------------------------------------- the bar's buttons
    @handle("perform_button", "click")
    def perform_button_click(self, **event_args):
        self.save()
        yb.perform(dict(self.song, author=state.me()))

    @handle("publish_button", "click")
    def publish_button_click(self, **event_args):
        flag = self.song.get("status") != "published"
        self.publish_button.enabled = False
        try:
            if not self.save():
                return
            r = state.call("set_published", self.song_id, flag)
        finally:
            self.publish_button.enabled = True
        if not r:
            return
        self.song["status"] = r["status"]
        self._draw_status()
        if flag:
            yb.confetti(self.publish_button, 30, None, 10)
            state.toast("It's on the stage! 🍌", "ok")
        else:
            state.toast("Back to drafts. Only you can see it now.")

    @handle("delete_button", "click")
    def delete_button_click(self, **event_args):
        if confirm("The song, its upvotes and its reviews are deleted for good.", title='Delete "%s"?' % self.song["title"],
                   buttons=[("Cancel", False), ("Delete", True)], role="app-dialog"):
            self._dirty = False
            if state.call("delete_song", self.song_id) is not None:
                state.toast("Deleted")
                router.go("studio")
