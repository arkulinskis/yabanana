import anvil.server
from anvil import *

from ._anvil_designer import WriterTemplate
from ... import router, state, yb


class Writer(WriterTemplate):
    """#writer/<user id>: a writer's public page: name, scene, bio, ripeness level (from bananas received), counts,
    their songs. Open to everyone."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        d = anvil.server.call("get_writer", args[0] if args else "")
        if not d.get("ok"):
            self.writer_part.visible, self.missing.visible = False, True
            return
        self.writer_part.visible, self.missing.visible = True, False
        w, t = d["writer"], d["totals"]
        scene = w.get("scene") or "rap"
        router.set_title(w["name"])
        self.head.classes["sc-" + scene] = True
        self.avatar.author = {"name": w["name"], "scene": scene}
        self.badge.visible = bool(w.get("scene"))
        self.badge.scene = scene
        r = yb.ripeness(t["upvotes"])
        self.ripe_icon.style["color"] = r["color"]
        self.ripe_name.text = r["name"]
        state.set_attr(self.ripe, "title", "%d bananas received%s" % (
            t["upvotes"], ", %d more to %s" % (r["next"]["at"] - t["upvotes"], r["next"]["name"]) if r["next"] else ""))
        self.joined.text = "joined " + state.month_year(w.get("joined")) if w.get("joined") else ""
        self.joined.visible = bool(w.get("joined"))
        self.name.text = w["name"]
        state.heading(self.name, 1)
        self.bio.text, self.bio.visible = w.get("bio") or "", bool(w.get("bio"))
        self.bio_hint.visible = not w.get("bio") and bool(w.get("me"))
        self.n_songs.text, self.n_upvotes.text = str(t["songs"]), str(t["upvotes"])
        self.n_reviews.text, self.n_bunch.text = str(t["reviews_given"]), str(t["bunch"])
        self.meter.visible = r["next"] is not None
        if r["next"]:
            pct = round((t["upvotes"] - r["at"]) / (r["next"]["at"] - r["at"]) * 100)
            self.meter_fill.style["width"] = "%d%%" % min(100, pct)
            self.meter_text.text = "%d more bananas to %s" % (r["next"]["at"] - t["upvotes"], r["next"]["name"])
        self.mine.visible = bool(w.get("me"))
        self.songs_panel.items = d["songs"]
        self.songs_panel.visible = bool(d["songs"])
        self.empty.visible = not d["songs"]
        self.empty_text.text = ("Share a song from your studio and it shows up here." if w.get("me") else
                                "%s hasn't shared anything yet." % w["name"].split(" ")[0])
