from anvil import *

from ._anvil_designer import AdminTemplate
from ... import state

TABS = ["overview", "songs", "reports", "feedback", "users", "demo"]


class Admin(AdminTemplate):
    """#admin/<tab>: overview numbers, songs (staff pick, hide, delete), reports (dismiss or hide the song), the old
    feedback inbox, users (admin / active switches) and the demo data. Each tab is its own address."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.tab = args[0] if args and args[0] in TABS else "overview"
        self._filter, self._song_show, self._rep_status = "new", "all", "open"
        parts = {"overview": self.overview_part, "songs": self.songs_part, "reports": self.reports_part,
                 "feedback": self.feedback_part, "users": self.users_part, "demo": self.demo_part}
        tabs = {"overview": self.tab_overview, "songs": self.tab_songs, "reports": self.tab_reports,
                "feedback": self.tab_feedback, "users": self.tab_users, "demo": self.tab_demo}
        for name in TABS:
            parts[name].visible = name == self.tab
            tabs[name].classes["on"] = name == self.tab
            state.set_attr(tabs[name], "aria-current", "page" if name == self.tab else None)
        self.feedback_panel.add_event_handler("x-changed", self._feedback_changed)
        self.songs_panel.add_event_handler("x-changed", self._songs_changed)
        self.reports_panel.add_event_handler("x-changed", self._reports_changed)
        state.set_control_attr(self.search_box, "aria-label", "Search people")
        state.set_control_attr(self.song_search_box, "aria-label", "Search songs")
        getattr(self, "_" + self.tab)()

    # ---- overview
    def _overview(self):
        d = state.call("admin_overview")
        self.s_users.text, self.s_admins.text = str(d["users"]), str(d["admins"])
        self.s_admins_label.text = "admin" if d["admins"] == 1 else "admins"
        self.s_feedback.text, self.s_songs.text, self.s_drafts.text = str(d["feedback_new"]), str(d["songs"]), str(d["drafts"])
        self.s_reports.text, self.s_reviews.text, self.s_upvotes.text = str(d["reports_open"]), str(d["reviews"]), str(d["upvotes"])
        self.demo_line.text = "Demo data is %s (%d demo people). Manage it in the Demo data tab." % (
            d["demo"]["state"], d["demo"]["counts"].get("users", 0))

    # ---- songs
    def _songs(self):
        d = state.call("admin_songs", (self.song_search_box.text or "").strip() or None, self._song_show)
        self.songs_panel.items = d["songs"]
        self.no_songs.visible = not d["songs"]
        self.songs_count.text = state.plural(d["total"], "song")
        for key, el in (("all", self.ss_all), ("featured", self.ss_featured), ("hidden", self.ss_hidden), ("drafts", self.ss_drafts)):
            el.classes["on"] = key == self._song_show

    def song_show_click(self, event):
        self._song_show = str(event.currentTarget.getAttribute("data-show"))
        self._songs()

    @handle("song_search_box", "pressed_enter")
    def song_search_box_pressed_enter(self, **event_args):
        self._songs()

    @handle("song_search_button", "click")
    def song_search_button_click(self, **event_args):
        self._songs()

    def _songs_changed(self, **event_args):
        self._songs()

    # ---- reports
    def _reports(self):
        d = state.call("list_reports", self._rep_status)
        self.reports_panel.items = d["reports"]
        self.no_reports.visible = not d["reports"]
        self.no_reports_title.text = "No %s reports" % self._rep_status
        state.heading(self.no_reports_title, 3)
        self.dom_nodes["rs_open_text"].textContent = "Open (%d)" % d["open"]
        self.rs_open.classes["on"] = self._rep_status == "open"
        self.rs_resolved.classes["on"] = self._rep_status == "resolved"

    def report_status_click(self, event):
        self._rep_status = str(event.currentTarget.getAttribute("data-status"))
        self._reports()

    def _reports_changed(self, **event_args):
        self._reports()

    # ---- feedback
    def _feedback(self):
        d = state.call("list_feedback", None)
        items = [i for i in d["items"] if self._filter == "all" or i["status"] == self._filter]
        self.feedback_panel.items = items
        self.no_feedback.visible = not items
        labels = {"new": "New", "read": "Read", "done": "Done", "all": "All"}
        for key, el in (("new", self.f_new), ("read", self.f_read), ("done", self.f_done), ("all", self.f_all)):
            n = len(d["items"]) if key == "all" else d["counts"].get(key, 0)
            el.text = "%s (%d)" % (labels[key], n)
            el.role = ["seg", "on"] if key == self._filter else ["seg"]
            state.set_control_attr(el, "aria-pressed", "true" if key == self._filter else "false")

    def _set_filter(self, value):
        self._filter = value
        self._feedback()

    @handle("f_new", "click")
    def f_new_click(self, **event_args):
        self._set_filter("new")

    @handle("f_read", "click")
    def f_read_click(self, **event_args):
        self._set_filter("read")

    @handle("f_done", "click")
    def f_done_click(self, **event_args):
        self._set_filter("done")

    @handle("f_all", "click")
    def f_all_click(self, **event_args):
        self._set_filter("all")

    def _feedback_changed(self, **event_args):
        self._feedback()

    # ---- users
    def _users(self, query=None):
        d = state.call("list_users", query or None)
        self.users_panel.items = d["users"]
        self.users_count.text = state.plural(d["total"], "person", "people")

    @handle("search_box", "pressed_enter")
    def search_box_pressed_enter(self, **event_args):
        self._users(self.search_box.text)

    @handle("search_button", "click")
    def search_button_click(self, **event_args):
        self._users(self.search_box.text)

    # ---- demo data
    def _demo(self):
        d = state.call("admin_overview")["demo"]
        counts = ", ".join("%s %s" % (v, k) for k, v in d["counts"].items())
        self.demo_status.text = "Status: %s · %s" % (d["state"], counts)
        self.demo_load_button.text = "Reload demo data" if d["state"] == "loaded" else "Load demo data"

    @handle("demo_load_button", "click")
    def demo_load_button_click(self, **event_args):
        if confirm("Demo people and content are added (any old demo rows are replaced).", title="Load the demo data?",
                   buttons=[("Cancel", False), ("Load", True)], role="app-dialog"):
            if state.call("demo_load"):
                state.toast("Done", "ok")
                self._demo()

    @handle("demo_remove_button", "click")
    def demo_remove_button_click(self, **event_args):
        if confirm("Every demo row is deleted. Real data stays.", title="Remove the demo data?",
                   buttons=[("Cancel", False), ("Remove", True)], role="app-dialog"):
            if state.call("demo_remove"):
                state.toast("Done", "ok")
                self._demo()
