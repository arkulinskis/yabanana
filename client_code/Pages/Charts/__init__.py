from anvil import *

from ._anvil_designer import ChartsTemplate
from ... import router, state, yb

PERIODS = {"week": ("This week", "Most bananas in the last 7 days"),
           "all": ("All time", "The most-upvoted songs ever"),
           "reviewed": ("Best reviewed", "Highest average rating from reviews")}


class Charts(ChartsTemplate):
    """#charts/<week|all|reviewed>/<scene>: the top songs. Open to everyone."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.period = args[0] if args and args[0] in PERIODS else "week"
        self.scene = args[1] if len(args) > 1 and args[1] in yb.SCENES else ""
        name, sub = PERIODS[self.period]
        self.title.text = name
        state.heading(self.title, 1)
        self.sub.text = sub + (" in " + yb.scene_name(self.scene) if self.scene else "") + "."
        for key, el in (("week", self.p_week), ("all", self.p_all), ("reviewed", self.p_reviewed)):
            el.classes["on"] = key == self.period
        self.scene_pick.value = self.scene
        d = state.call("get_charts", self.scene or None, self.period)
        songs = [dict(s, rank=i + 1, period=self.period) for i, s in enumerate(d["songs"])]
        self.chart_panel.items = songs
        self.chart_panel.visible = bool(songs)
        self.empty.visible = not songs
        self.empty_text.text = ("No upvotes in the last 7 days%s. Go give some bananas!" % (" for this scene" if self.scene else "")
                                if self.period == "week" else "Nothing here yet.")

    def period_click(self, event):
        router.go("charts", str(event.currentTarget.getAttribute("data-period")), self.scene)

    @handle("scene_pick", "change")
    def scene_pick_change(self, value, **event_args):
        router.go("charts", self.period, value)
