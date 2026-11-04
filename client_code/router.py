"""Page addresses: #name/arg1/arg2 -> a page Form (open_form), with sign-in rules. The same addresses as the old
JavaScript version, so links people shared keep working.

Links in templates are plain <a href="#home">; code calls router.go("song", id).

    PAGES[name] = (who may open it, browser-tab title)   who: None = anyone, "guest" = signed out only, "user", "admin"
    NAV = the main menu for members (header + phone tab bar): (page, label, icon). At most 4.
    PUBLIC_NAV = the header menu for visitors who aren't signed in.
New page: add it to PAGES, to _form() and (if it belongs in a menu) to NAV / PUBLIC_NAV.
"""
import anvil
import anvil.js
from anvil.js import window

from . import state

PAGES = {
    "landing": (None, "Write lyrics over beats"),
    "home": (None, "The Stage"),
    "song": (None, "Song"),
    "studio": ("user", "Studio"),
    "charts": (None, "Charts"),
    "bunch": ("user", "Your Bunch"),
    "writer": (None, "Writer"),
    "beats": (None, "Beats & theory"),
    "lab": (None, "Rhyme lab"),
    "auth": ("guest", "Sign in"),
    "profile": ("user", "Your profile"),
    "admin": ("admin", "Admin"),
}
NAV = [("home", "Stage", "shuffle"), ("studio", "Studio", "pen"), ("charts", "Charts", "trophy"), ("bunch", "Bunch", "banana")]
PUBLIC_NAV = [("home", "Stage", "shuffle"), ("charts", "Charts", "trophy"), ("beats", "Beats", "wave"), ("lab", "Rhyme lab", "book")]
APP_NAME = "Yabanana"
_r: dict = {"after": "", "listening": False, "page": ""}


def _form(name, args):
    """The page's Form class (imported when first needed, so start-up stays quick)."""
    if name == "landing":
        from .Pages.Landing import Landing
        return Landing
    if name == "home":
        from .Pages.Stage import Stage
        return Stage
    if name == "song":
        from .Pages.Song import Song
        return Song
    if name == "studio":
        if not args:
            from .Pages.Studio import Studio
            return Studio
        if args[0] == "new":
            from .Pages.StudioNew import StudioNew
            return StudioNew
        from .Pages.Editor import Editor
        return Editor
    if name == "charts":
        from .Pages.Charts import Charts
        return Charts
    if name == "bunch":
        from .Pages.Bunch import Bunch
        return Bunch
    if name == "writer":
        from .Pages.Writer import Writer
        return Writer
    if name == "beats":
        from .Pages.Beats import Beats
        return Beats
    if name == "lab":
        from .Pages.Lab import Lab
        return Lab
    if name == "auth":
        from .Pages.Auth import Auth
        return Auth
    if name == "profile":
        from .Pages.Profile import Profile
        return Profile
    from .Pages.Admin import Admin
    return Admin


def parse(hash_text):
    h = (hash_text or "").lstrip("#").lstrip("!").lstrip("/").split("?")[0]
    parts = [window.decodeURIComponent(p) for p in h.split("/") if p]
    return (parts[0] if parts else ""), parts[1:]


def href(name, *args):
    """'#name/arg1/arg2' with every part URL-encoded (row ids contain brackets and commas)."""
    return "#" + "/".join([name] + [window.encodeURIComponent(str(a)) for a in args if a not in (None, "")])


def link(component, name, *args):
    """Point an Anvil Link at a page of this app. (A Link with a url opens a new tab by default: keep it in this one.)"""
    component.url = href(name, *args)
    import anvil.js as _js
    node = _js.get_dom_node(component)
    node.removeAttribute("target")
    node.removeAttribute("rel")


def home_page():
    return "home" if state.me() else "landing"


def current():
    return _r["page"]


def set_title(text):
    """The browser tab title for a page that learns its name after loading (a song, a writer)."""
    window.document.title = (text + " · " if text else "") + APP_NAME


def show():
    """Open the page for the current address."""
    name, args = parse(window.location.hash)
    if name not in PAGES:
        name, args = home_page(), []
    who = PAGES[name][0]
    if who == "guest" and state.me():
        name, args = "home", []
    elif who in ("user", "admin") and not state.me():
        _r["after"] = window.location.hash
        name, args = "auth", []
    elif who == "admin" and not state.is_admin():
        state.toast("That page is for admins only.", "error")
        name, args = "home", []
    _r["page"] = name
    set_title(PAGES[name][1])
    window.UI_READY = False
    page = _form(name, args)(args=args)
    anvil.open_form(page)
    shell = getattr(page, "layout", None)
    if shell is not None and hasattr(shell, "refresh"):
        shell.refresh(name)  # Anvil reuses the layout between pages: tell it who is signed in and which page is open
    window.scrollTo(0, 0)
    window.UI_READY = True  # tests and screenshots wait for this


def go(name, *args):
    """Go to a page. Same address again = reload the page."""
    target = href(name, *args)
    if window.location.hash == target:
        show()
    else:
        window.location.hash = target


def replace(name, *args):
    """Change the address without opening anything (a page that switches its own view)."""
    window.history.replaceState(None, "", href(name, *args))


def open_replacing(name, *args):
    """Go to a page without leaving the current address in the history (a new song opens straight in the editor)."""
    window.location.replace(href(name, *args))


def after_sign_in():
    """Where to go once someone signs in: the page they were heading for, or home."""
    target = _r["after"]
    _r["after"] = ""
    if target and target != window.location.hash:
        window.location.hash = target
    else:
        go("home")


def remember_after(target):
    _r["after"] = target


def _on_hash(event):
    show()


def start():
    if not _r["listening"]:
        window.addEventListener("hashchange", anvil.js.report_exceptions(_on_hash))
        _r["listening"] = True
    show()
