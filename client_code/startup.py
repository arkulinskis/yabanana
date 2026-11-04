"""The app starts here (anvil.yaml: startup module). One server call to learn who is signed in (Anvil's loading
spinner shows meanwhile), the Privacy & Terms kit, then the page for the address in the browser bar."""
import anvil.js
import anvil.server
from anvil.js import window

from . import legal, router, state

LEGAL_THEME = {"accent": "#c81d5c"}  # colours for the Privacy & Terms page (match --c-accent-text in app.css)

# The JavaScript engines (beat player, Perform mode, helper panel) show their short messages as Anvil notifications.
window.UI.toast = anvil.js.report_exceptions(state.toast)
legal.setup(LEGAL_THEME)
state.set_me(anvil.server.call("get_me"))
if state.me():
    legal.refresh_soon()
router.start()
