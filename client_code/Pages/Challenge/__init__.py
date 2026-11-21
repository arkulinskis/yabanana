import anvil.js
import anvil.server
from anvil import *
from anvil.js import window

from ._anvil_designer import ChallengeTemplate
from ... import challenge, router, state, yb

SCENES = ("rap", "poetry", "pop")


def _day(iso, minus_ms=0):
    """'Sun 22 Nov' for an ISO time (in UTC, the challenge's clock)."""
    d = anvil.js.new(window.Date, window.Date.parse(iso) - minus_ms)
    return str(d.toLocaleDateString([], yb.to_js({"weekday": "short", "day": "numeric", "month": "short", "timeZone": "UTC"})))


class Challenge(ChallengeTemplate):
    """#challenge (this week) and #challenge/<2026-W46> (a past week): the Weekly Bar Challenge. The brief and its
    rule, a beat per scene with Take the challenge, the entries ranked by bananas, and the past weeks' top entries.
    Open to everyone; taking the challenge needs an account (challenge.take sends visitors to sign up first)."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        router.link(self.mine_link, "studio")
        d = anvil.server.call("get_challenge", args[0] if args else None)
        if not d.get("ok"):
            self.body.visible, self.missing.visible = False, True
            self.missing_text.text = d.get("error") or "That week isn't on the calendar."
            return
        self.body.visible, self.missing.visible = True, False
        self.data = d
        self._draw()

    def _draw(self):
        d = self.data
        b = d["brief"]
        live = bool(d.get("available"))
        current = bool(d.get("is_current"))
        st = b["status"]
        router.set_title(b["label"] + " challenge")
        self.week.text = b["label"]
        self.title.text = b["title"]
        state.heading(self.title, 1)
        self.rule.text = b["rule"]
        self.spark.text = b.get("spark") or ""
        self.back_link.visible = not current
        if st == "open":
            self.status.text = "Open · " + yb.time_left(b["ends"])
            self.status.role = ["badge", "badge-good"]
            self.f_when.text = "Share it by %s, midnight UTC" % _day(b["ends"], 1000)
        elif st == "voting":
            self.status.text = "Voting · " + yb.time_left(b["closes"])
            self.status.role = ["badge", "badge-warn"]
            self.f_when.text = "Entries closed. Bananas count until %s" % _day(b["closes"], 1000)
        else:
            self.status.text = "Closed"
            self.status.role = ["badge"]
            self.f_when.text = "Closed on %s" % _day(b["closes"], 1000)
        self.f_lines.text = "At least %s" % state.plural(b["lines"], "line")
        self.soon.visible = not live
        # your entry
        mine = d.get("my_entry")
        self.mine_part.visible = bool(mine)
        if mine:
            router.link(self.mine_link, "studio", mine["song_id"])
            if mine.get("shared"):
                self.mine_text.text = "Your entry “%s” is in. Good luck!" % mine["title"]
                self.mine_link.text = "Open your entry"
            else:
                self.mine_text.text = "Your entry “%s” is still a draft: share it before the deadline to enter." % mine["title"]
                self.mine_link.text = "Finish your entry"
        # the scenes (only while this week's challenge is open)
        self.scenes_part.visible = live and current and st == "open"
        for scene in SCENES:
            key = b["beats"][scene]
            getattr(self, "beat_" + scene).text = yb.beat(key)["name"]
            chip = getattr(self, "chip_" + scene)
            chip.beat = key
            button = getattr(self, "take_" + scene)
            button.text = "Open your entry" if mine else "Write it as %s" % scene
        # entries
        entries = d.get("entries") or []
        self.entries_part.visible = live
        self.entry_n.text = str(len(entries))
        self.entries_note.text = {"open": "Ranked by bananas so far. Voting stays open for a week after the deadline.",
                                  "voting": "Entries are in. Upvote your favourites: bananas still count.",
                                  "closed": "The final ranking."}[st]
        self.entries_panel.items = entries
        self.entries_panel.visible = bool(entries)
        self.no_entries.visible = not entries
        self.no_entries_text.text = ("Take the challenge, write at least two lines and share it: it shows up here." if st == "open"
                                     else "Nobody entered that week.")
        # past weeks
        past = d.get("past") or []
        self.past_part.visible = live and bool(past)
        self.past_panel.items = past

    def _take(self, scene, button):
        mine = self.data.get("my_entry")
        if mine:
            router.go("studio", mine["song_id"])
            return
        challenge.take(scene, button)

    @handle("take_rap", "click")
    def take_rap_click(self, **event_args):
        self._take("rap", self.take_rap)

    @handle("take_poetry", "click")
    def take_poetry_click(self, **event_args):
        self._take("poetry", self.take_poetry)

    @handle("take_pop", "click")
    def take_pop_click(self, **event_args):
        self._take("pop", self.take_pop)
