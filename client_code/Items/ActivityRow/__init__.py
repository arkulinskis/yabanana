from anvil import *

from ._anvil_designer import ActivityRowTemplate
from ... import router, state


class ActivityRow(ActivityRowTemplate):
    """Studio → New since your last visit: one thing that happened to one of your songs (Songs.my_activity).
    item = {kind: review | bananas | remix, who, song {id, title}, rating, rework, n, remix {id, title}, when}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        e = self.item
        kind = e.get("kind")
        song = e.get("song") or {}
        who = (e.get("who") or {}).get("name") or "Someone"
        self.classes["k-" + str(kind)] = True
        bits = []
        if kind == "review":
            self.icon.classes["ic-chat"] = True
            self.what.text = "%s reviewed" % who
            bits.append("%.1f / 5" % (e.get("rating") or 0))
            if e.get("rework"):
                bits.append("pointed at a line to rework")
            target = song.get("id")
        elif kind == "bananas":
            self.icon.classes["ic-banana"] = True
            self.what.text = "%s on" % state.plural(e.get("n") or 0, "banana")
            target = song.get("id")
        else:
            self.icon.classes["ic-remix"] = True
            self.what.text = "%s remixed" % who
            rx = e.get("remix") or {}
            bits.append("as “%s”" % (rx.get("title") or "a remix"))
            target = rx.get("id") or song.get("id")
        self.song_link.text = song.get("title") or "your song"
        if target:
            router.link(self.song_link, "song", target)
        bits.append(state.ago(e.get("when")))
        self.extra.text = " · ".join(b for b in bits if b)
