from anvil import *

from ._anvil_designer import JoinNudgeTemplate
from ... import router


class JoinNudge(JoinNudgeTemplate):
    """For visitors who try a members' thing (upvoting): what it does, and Create an account / Sign in.
    The page they were on is remembered (router.remember_after), so signing in brings them back."""

    def __init__(self, what="Sign up to upvote songs", **properties):
        super().__init__(**properties)
        self.what.text = ("%s. Upvoted songs are saved to your Bunch, so you can find them again. It's free." % what)

    def _go(self, *where):
        self.raise_event("x-close-alert", value=None)
        router.go(*where)

    @handle("signup_button", "click")
    def signup_button_click(self, **event_args):
        self._go("auth", "signup")

    @handle("signin_button", "click")
    def signin_button_click(self, **event_args):
        self._go("auth")
