import anvil.server
from anvil import *

from ._anvil_designer import SongTemplate
from ... import router, state, yb


class Song(SongTemplate):
    """#song/<id>: one song, open to everyone (drafts and hidden songs: their writer and admins only).
    Lyrics with the rhyme map, Perform mode, the beat card, upvote, promote, remix, share, report, and reviews
    (three ratings named for the scene + text + favourite line). Every action reloads the page's data."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.song_id = args[0] if args else ""
        self.data = {}
        self._stop = None
        self.scheme_box.checked = bool(state.store_get("rhymeMap", True))
        self.reviews_panel.add_event_handler("x-changed", self._reload)
        self._load()

    # ---------------------------------------------------------------- data
    def _load(self):
        d = anvil.server.call("get_song", self.song_id)
        if not d.get("ok"):
            self.grid.visible, self.missing.visible = False, True
            self.missing_text.text = d.get("error") or "It may be a draft, or it was removed."
            return
        self.grid.visible, self.missing.visible = True, False
        self.data = d
        self._draw()

    def _reload(self, **event_args):
        self._load()

    def _draw(self):
        d, me = self.data, state.me()
        s = d["song"]
        b = yb.beat(s["beat"])
        router.set_title(s["title"])
        published = s["status"] == "published"
        for k in yb.SCENE_KEYS:
            self.grid.classes["sc-" + k] = k == s["scene"]
        self.draft_note.visible = not published
        self.hidden_note.visible = bool(s.get("hidden"))
        self.badge.scene = s["scene"]
        self.mood.text, self.mood.visible = s.get("mood") or "", bool(s.get("mood"))
        self.staff_pick.visible = bool(s.get("featured"))
        self.boosted.visible = bool(s.get("boosts"))
        self.boosted_text.text = "Promoted ×%s" % s.get("boosts")
        self.title.text = s["title"]
        state.heading(self.title, 1)
        a = s.get("author") or {}
        self.avatar.author = a
        self.writer_link.text = a.get("name") or "Someone"
        if a.get("id"):
            router.link(self.writer_link, "writer", a["id"])
        self.when.text = ("Shared " + state.ago(s["published"])) if s.get("published") else ("Draft, edited " + state.ago(s["updated"]))
        rx = s.get("remix_of")
        self.remix_part.visible = bool(rx)
        if rx:
            self.remix_link.text = rx["title"]
            router.link(self.remix_link, "song", rx["id"])
            self.remix_by.text = "by " + rx["author"]["name"]
        # actions
        self.upvote.visible = published
        self.upvote.song = s
        self.edit_link.visible = bool(s.get("mine"))
        router.link(self.edit_link, "studio", s["id"])
        self.promote_button.visible = bool(d.get("can_promote"))
        self.promoted.visible = not d.get("can_promote") and bool(d.get("promoted"))
        self.remix_button.visible = bool(me) and published
        self.share_button.visible = published
        self.report_button.visible = bool(me) and not s.get("mine") and published
        self.report_button.text = "Reported" if d.get("reported") else "Report"
        self.admin_delete_button.visible = bool(me and me.get("is_admin")) and not s.get("mine")
        # lyrics
        self.chip.beat, self.chip.bpm = s["beat"], s.get("bpm")
        self.lyrics.scheme = self.scheme_box.checked
        self.lyrics.sections = s.get("sections") or []
        # reviews
        reviews = d["reviews"]
        self.review_n.text = str(len(reviews))
        crit = d["criteria"]
        self.form_part.visible = bool(d.get("can_review"))
        self.join_note.visible = not me and published
        self.own_note.visible = bool(s.get("mine"))
        if d.get("can_review"):
            self._draw_form()
        others = [dict(v, criteria=crit) for v in reviews if not v.get("mine")]
        self.reviews_panel.items = others
        self.no_reviews.visible = not reviews
        # side
        self.beat_name.text = b["name"]
        self.steps.beat = b["key"]
        self.meter.text, self.theory.text = b["meter"], b["theory"]
        state.set_attr(self.beat_link, "href", router.href("beats", b["key"]))
        self.up_n.text = str(s.get("upvotes") or 0)
        self.rating.text = "%.1f" % s["rating"] if s.get("rating") else "–"
        self.remix_n.text = str(d["remixes"])
        self.remix_word.text = "remix" if d["remixes"] == 1 else "remixes"
        self.crit_panel.visible = bool(reviews)
        self.crit_panel.items = [{"name": c, "avg": sum(v["r"][i] for v in reviews) / len(reviews)}
                                 for i, c in enumerate(crit)] if reviews else []
        self.more_part.visible = bool(d["more"])
        self.more_title.text = "More by " + (a.get("name") or "them").split(" ")[0]
        self.more_panel.items = d["more"]

    def _draw_form(self):
        d = self.data
        mine = d.get("my_review")
        crit = d["criteria"]
        self.form_title.text = "Your review (edit it any time)" if mine else "Write a review"
        state.heading(self.form_title, 3)
        for i, (lab, box) in enumerate(((self.c1, self.rate1), (self.c2, self.rate2), (self.c3, self.rate3))):
            lab.text = crit[i]
            box.label = crit[i]
            box.value = mine["r"][i] if mine else 0
        self.review_box.text = mine["text"] if mine else ""
        lines = yb.song_lines(d["song"].get("sections"))
        self.fav_box.items = [("None picked", "")] + [(ln, ln) for ln in lines]
        self.fav_box.selected_value = mine["fav_line"] if mine and mine.get("fav_line") in lines else ""
        state.set_control_attr(self.fav_box, "aria-label", "Favourite line (optional)")
        self.delete_mine_button.visible = bool(mine)
        self.post_button.text = "Update review" if mine else "Post review"
        self.review_msg.visible = False

    # ---------------------------------------------------------------- the upvote count on the side card
    def _heard(self, song_id, upvoted, upvotes):
        if song_id == self.song_id:
            self.up_n.text = str(upvotes)

    @handle("", "show")
    def form_show(self, **event_args):
        if self._stop is None:
            self._stop = yb.on_upvote(self._heard)

    @handle("", "hide")
    def form_hide(self, **event_args):
        if self._stop is not None:
            self._stop()
            self._stop = None

    # ---------------------------------------------------------------- actions
    @handle("scheme_box", "change")
    def scheme_box_change(self, **event_args):
        state.store_set("rhymeMap", self.scheme_box.checked)
        self.lyrics.scheme = self.scheme_box.checked

    @handle("perform_button", "click")
    def perform_button_click(self, **event_args):
        yb.perform(self.data["song"])

    @handle("share_button", "click")
    def share_button_click(self, **event_args):
        url = yb.page_url(router.href("song", self.song_id))
        if yb.copy_text(url):
            state.toast("Link copied", "ok")
        else:
            from ...Dialogs.ShareLink import ShareLink
            alert(ShareLink(url=url), buttons=[], role="app-dialog")

    @handle("promote_button", "click")
    def promote_button_click(self, **event_args):
        left = state.plural(self.data.get("promos_left") or 0, "promotion")
        if not confirm("It goes into the Spotlight on the Stage for 7 days. You have %s left this week." % left,
                       title="Promote this song?", buttons=[("Cancel", False), ("Promote it", True)], role="app-dialog"):
            return
        if state.call("promote_song", self.song_id):
            yb.confetti(self.promote_button, 22, 30, 20)
            state.toast("Promoted! It's in the Spotlight.", "ok")
            self._load()

    @handle("remix_button", "click")
    def remix_button_click(self, **event_args):
        self.remix_button.enabled = False
        try:
            r = state.call("remix_song", self.song_id)
        finally:
            self.remix_button.enabled = True
        if r:
            state.toast("Remix started in your Studio", "ok")
            router.go("studio", r["song"]["id"])

    @handle("report_button", "click")
    def report_button_click(self, **event_args):
        if self.data.get("reported"):
            state.toast("You already reported this song. An admin will look at it.")
            return
        from ...Dialogs.ReportSong import ReportSong
        msg = alert(ReportSong(song_id=self.song_id), buttons=[], role="app-dialog")
        if msg:
            state.toast(msg, "ok")
            self.data["reported"] = True
            self.report_button.text = "Reported"

    @handle("admin_delete_button", "click")
    def admin_delete_button_click(self, **event_args):
        if confirm("Admin action: the song and its upvotes and reviews are deleted for good.", title="Delete this song?",
                   buttons=[("Cancel", False), ("Delete", True)], role="app-dialog"):
            if state.call("delete_song", self.song_id) is not None:
                state.toast("Deleted", "ok")
                router.go("home")

    # ---- the review form
    @handle("post_button", "click")
    def post_button_click(self, **event_args):
        scores = [self.rate1.value, self.rate2.value, self.rate3.value]
        if not all(scores):
            state.toast("Tap 1 to 5 bananas for each rating.", "error")
            return
        self.post_button.enabled = False
        try:
            r = anvil.server.call("save_review", self.song_id, scores[0], scores[1], scores[2], self.review_box.text or "",
                                  self.fav_box.selected_value or None)
        finally:
            self.post_button.enabled = True
        if not r.get("ok"):
            self.review_msg.text, self.review_msg.visible = r.get("error") or "That didn't work.", True
            return
        state.toast("Review posted. Thank you!", "ok")
        self._load()

    @handle("delete_mine_button", "click")
    def delete_mine_button_click(self, **event_args):
        mine = self.data.get("my_review")
        if mine and confirm("Delete this review?", buttons=[("Cancel", False), ("Delete", True)], role="app-dialog"):
            if state.call("delete_review", mine["id"]) is not None:
                self._load()
