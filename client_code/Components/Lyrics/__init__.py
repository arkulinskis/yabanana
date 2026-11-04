from anvil import *
import anvil.js

from ._anvil_designer import LyricsTemplate
from ... import yb


class Lyrics(LyricsTemplate):
    """Lyrics with the rhyme map. Draws plain lyrics at once and colours the rhymes when the dictionary has loaded."""

    def __init__(self, **properties):
        self._sections, self._scheme, self._fav, self._ready = [], True, "", False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self, *args):
        if not self._ready:
            return
        anvil.js.get_dom_node(self).innerHTML = yb.lyrics_html(self._sections or [], self._scheme, self._fav)
        if self._scheme and not yb.words_ready():
            yb.when_words(self._loaded)

    def _loaded(self, error):
        if not error and yb.words_ready():
            anvil.js.get_dom_node(self).innerHTML = yb.lyrics_html(self._sections or [], self._scheme, self._fav)

    @property
    def sections(self):
        return self._sections

    @sections.setter
    def sections(self, value):
        self._sections = list(value or [])
        self._draw()

    @property
    def scheme(self):
        return self._scheme

    @scheme.setter
    def scheme(self, value):
        self._scheme = bool(value)
        self._draw()

    @property
    def fav(self):
        return self._fav

    @fav.setter
    def fav(self, value):
        self._fav = value or ""
        self._draw()
