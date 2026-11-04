from anvil import *

from ._anvil_designer import ProfileTemplate
from ... import auth, router, state


class Profile(ProfileTemplate):
    """#profile: your writer card (pen name, scene, bio), light/dark, a password reset link, Privacy & Terms,
    feedback, sign out."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        me = state.me()
        self.name_box.text = me.get("name") or ""
        self.scene_pick.value = me.get("scene") or ""
        self.bio_box.text = me.get("bio") or ""
        state.set_control_attr(self.name_box, "autocomplete", "nickname")
        state.control(self.name_box).setAttribute("maxlength", "60")
        state.control(self.bio_box).setAttribute("maxlength", "280")
        state.set_attr(self.page_link, "href", router.href("writer", me.get("id")))
        self._show_me()
        self._show_theme()

    def _show_me(self):
        me = state.me()
        self.initials.text = state.initials(me.get("name"))
        self.name_title.text = me.get("name") or ""
        state.heading(self.name_title, 1)
        joined = state.month_year(me.get("joined"))
        self.email_line.text = (me.get("email") or "") + (" · member since " + joined if joined else "")
        self.admin_link.visible = bool(me.get("is_admin"))

    def _show_theme(self):
        t = state.theme()
        for name, el in (("auto", self.theme_auto), ("light", self.theme_light), ("dark", self.theme_dark)):
            el.classes["on"] = name == t

    def theme_click(self, event):
        state.set_theme(event.currentTarget.getAttribute("data-theme-pick"))
        self._show_theme()
        if self.layout is not None:
            self.layout.refresh("profile")  # the account menu's Auto / Light / Dark too

    @handle("name_box", "pressed_enter")
    def name_box_pressed_enter(self, **event_args):
        self.save_button_click()

    @handle("save_button", "click")
    def save_button_click(self, **event_args):
        name = (self.name_box.text or "").strip()
        if len(name) < 2:
            state.toast("Please use at least 2 characters for your name.", "error")
            return
        self.save_button.enabled = False
        try:
            r = state.call("update_profile", name, self.scene_pick.value or "", self.bio_box.text or "")
        finally:
            self.save_button.enabled = True
        if r:
            state.set_me(r["me"])
            self._show_me()
            if self.layout is not None:
                self.layout.refresh("profile")  # new initials in the header
            state.toast("Saved", "ok")

    @handle("reset_button", "click")
    def reset_button_click(self, **event_args):
        r = auth.reset(state.me()["email"])
        state.toast(r["message"], "ok")

    def feedback_click(self, event):
        state.feedback()

    def sign_out_click(self, event):
        auth.sign_out()
        state.toast("Signed out. Keep writing!")
        router.go("landing")
