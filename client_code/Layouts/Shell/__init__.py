import datetime

from anvil import *
import anvil.js
from anvil.js import window

from ._anvil_designer import ShellTemplate
from ... import auth, router, state

THEMES = ["auto", "light", "dark"]


class Shell(ShellTemplate):
    """The frame around every page: header (Stage / Studio / Charts / Bunch + Write + the account menu for members,
    Stage / Charts / Beats / Rhyme lab + Sign in / Join for visitors), the footer and the phone tab bar.
    Pages use it with <anvil-form layout="Yabanana.Layouts.Shell">.

    Anvil keeps ONE Shell while pages come and go (open_form only swaps the "content" slot when the layout matches),
    so everything that depends on who is signed in or which page is open is drawn in refresh(), which router.show()
    calls after every page change. Never only in __init__."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.copyright_label.text = "© %d Yabanana · Peel back the beat 🍌" % datetime.date.today().year
        self._outside = anvil.js.report_exceptions(self._close_menu_outside)
        self._keys = anvil.js.report_exceptions(self._key)
        self._page = ""
        self.refresh("")

    def refresh(self, page):
        me = state.me()
        if self._page:
            self.classes["page-" + self._page] = False
        self._page = page
        self.classes.update({"signed-in": bool(me), "signed-out": not me})
        if page:
            self.classes["page-" + page] = True  # pages style the frame around them (.page-landing, .page-studio)
        self.member_actions.visible = bool(me)
        self.guest_actions.visible = not me and page != "auth"
        self.tabbar.visible = bool(me)
        self.menu.visible = False
        home = "#home" if me else "#landing"
        state.set_attr(self.brand, "href", home)
        state.set_attr(self.foot_brand, "href", home)
        nav = router.NAV if me else router.PUBLIC_NAV
        links = [{"page": p, "label": label, "icon": icon, "on": p == page} for p, label, icon in nav]
        self.nav_panel.items = links
        self.tab_panel.items = links if me else []
        self.tab_profile.classes["on"] = page == "profile"
        if me:
            self.avatar_button.text = state.initials(me.get("name"))
            state.set_control_attr(self.avatar_button, "aria-label", "Your account")
            self.menu_name.text = me.get("name") or ""
            self.menu_email.text = me.get("email") or ""
            self.admin_link.visible = bool(me.get("is_admin"))
            state.set_attr(self.writer_link, "href", router.href("writer", me.get("id")))
        self._show_theme()

    # ---- account menu
    @handle("avatar_button", "click")
    def avatar_button_click(self, **event_args):
        self.menu.visible = not self.menu.visible
        state.set_control_attr(self.avatar_button, "aria-expanded", "true" if self.menu.visible else "false")

    def _close_menu_outside(self, event):
        if self.menu.visible and not event.target.closest(".anvil-role-avatar, .ui-menu .ui-seg"):
            self.menu.visible = False

    def _key(self, event):
        if event.key == "Escape":
            self.menu.visible = False

    @handle("", "show")
    def form_show(self, **event_args):
        window.document.addEventListener("click", self._outside, True)
        window.document.addEventListener("keydown", self._keys)

    @handle("", "hide")
    def form_hide(self, **event_args):
        window.document.removeEventListener("click", self._outside, True)
        window.document.removeEventListener("keydown", self._keys)

    def theme_click(self, event):
        state.set_theme(event.currentTarget.getAttribute("data-theme-set"))
        self._show_theme()

    def _show_theme(self):
        t = state.theme()
        for name, el in zip(THEMES, [self.theme_auto, self.theme_light, self.theme_dark]):
            el.classes["on"] = name == t

    def feedback_click(self, event):
        self.menu.visible = False
        state.feedback()

    def sign_out_click(self, event):
        auth.sign_out()
        state.toast("Signed out. Keep writing!")
        router.go("landing")
