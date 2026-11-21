"""Song links that show the song: https://yabanana.com/s/<slug> and /songs.xml.

The app itself runs in the browser (#song/<id>), so a shared hash link previews as plain "Yabanana" in WhatsApp,
Discord or iMessage. /s/<slug> is a small server-made page with the song's own preview tags (og:title "<title> by
<writer>", og:description = the first two lines), the lyrics as text for crawlers, and a script that hands the
browser on to the song page. Only songs their writer shared (published, not hidden) get a page: drafts, hidden and
missing songs get the same friendly 404, so a link never says whether a private song exists.

Slug = the Anvil row id without brackets, comma -> "-" ("[169234,5678901]" -> "169234-5678901").
Kept apart from seo_routes.py (the SEO kit rewrites that file).
"""
import html
import json
import re

import anvil
import anvil.server
from anvil.tables import app_tables

from . import common as C
from . import Songs as S

SLUG_RE = re.compile(r"^(\d+)-(\d+)$")
MAX_SITEMAP = 5000


def slug_of(row_id):
    """'[169234,5678901]' -> '169234-5678901' ('' for anything else)."""
    m = re.match(r"^\[(\d+),(\d+)\]$", str(row_id or "").replace(" ", ""))
    return "%s-%s" % (m.group(1), m.group(2)) if m else ""


def id_of(slug):
    m = SLUG_RE.match(str(slug or ""))
    return "[%s,%s]" % (m.group(1), m.group(2)) if m else None


def site():
    """The address links should name: the app's own domain (from the SEO kit's facts), else where Anvil serves it."""
    try:
        from . import seo_routes
        if seo_routes.SEO.get("site"):
            return seo_routes.SEO["site"].rstrip("/")
    except Exception:
        pass
    return anvil.server.get_app_origin().rstrip("/")


def public_song(slug):
    row_id = id_of(slug)
    r = C.row_by_id(app_tables.songs, row_id) if row_id else None
    return r if S.is_public(r) else None


def _js(value):
    """A JSON value safe inside a <script> element."""
    return json.dumps(value).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


STYLE = """body{margin:0;background:#fff7e0;color:#1d1830;font:17px/1.6 "DM Sans",system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:40px 20px 64px}
.paper{background:#fff;border:2px solid #1d1830;border-radius:18px;box-shadow:4px 4px 0 #1d1830;padding:24px 22px}
h1{font:800 clamp(1.8rem,6vw,2.6rem)/1.1 "Bricolage Grotesque",system-ui,sans-serif;margin:0 0 6px;text-wrap:balance}
.by{margin:0 0 20px;color:#5e5872}.kind{font-weight:700;font-size:.85rem;color:#8a5b00;margin:18px 0 4px}
.lines{white-space:pre-line;margin:0}a{color:#1d1830;text-decoration-color:#ffc21a;text-decoration-thickness:2px}
.go{display:inline-block;margin-top:24px;background:#ffc21a;border:2px solid #1d1830;border-radius:999px;padding:10px 20px;
font-weight:700;text-decoration:none}
@media (prefers-color-scheme:dark){body{background:#15121f;color:#f6f1e4}.paper{background:#221d31;border-color:#514770;
box-shadow:4px 4px 0 #050409}.by{color:#b7b0c8}.kind{color:#ffd257}a{color:#f6f1e4}.go{color:#1d1830}}"""


def song_html(r, slug):
    """The page for one shared song."""
    e = html.escape
    o = site()
    title = r["title"] or "Untitled"
    name = C.name_of(r["owner"]) if r["owner"] is not None else "A former writer"
    lines = S.lines_of(r["sections"])
    desc = " / ".join(lines[:2]) or "A song on Yabanana"
    if len(desc) > 200:
        desc = desc[:197].rstrip() + "..."
    url = "%s/s/%s" % (o, slug)
    target = "/#song/" + r.get_id().replace("[", "%5B").replace("]", "%5D").replace(",", "%2C")
    image = o + "/_/theme/og-image.png"
    head_title = "%s by %s" % (title, name)
    ld = {"@context": "https://schema.org", "@type": "MusicComposition", "name": title, "url": url,
          "lyricist": {"@type": "Person", "name": name}, "inLanguage": "en",
          "lyrics": {"@type": "CreativeWork", "text": "\n".join(lines)},
          "isPartOf": {"@type": "WebSite", "name": "Yabanana", "url": o + "/"}}
    if r["published"] is not None:
        ld["datePublished"] = C.iso(r["published"])[:10]
    body = "".join('<p class="kind">%s</p><p class="lines">%s</p>' % (e(sec.get("kind") or "Verse"), e((sec.get("text") or "").strip()))
                   for sec in (r["sections"] or []) if (sec.get("text") or "").strip())
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(ht)s · Yabanana</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(url)s">
<link rel="icon" type="image/svg+xml" href="/_/theme/icon.svg">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Yabanana">
<meta property="og:title" content="%(ht)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(url)s">
<meta property="og:image" content="%(img)s">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Yabanana: lyrics over beats">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="%(ht)s">
<meta name="twitter:description" content="%(desc)s">
<meta name="twitter:image" content="%(img)s">
<script type="application/ld+json">%(ld)s</script>
<style>%(style)s</style>
<script>location.replace(%(target_js)s);</script>
</head><body><main>
<div class="paper"><h1>%(title)s</h1><p class="by">by %(name)s · on Yabanana</p>%(body)s</div>
<a class="go" href="%(target)s">Open the song on Yabanana</a>
</main></body></html>
""" % {"ht": e(head_title), "desc": e(desc), "url": e(url), "img": e(image), "ld": _js(ld), "style": STYLE,
       "target_js": _js(target), "target": e(target), "title": e(title), "name": e(name), "body": body}


def missing_html():
    return """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>This song isn't here · Yabanana</title><meta name="robots" content="noindex">
<style>%s</style></head><body><main><div class="paper"><h1>This song isn't here</h1>
<p class="by">It may still be a draft, or its writer took it down.</p></div>
<a class="go" href="/#home">Go to the Stage</a></main></body></html>
""" % STYLE


def songs_xml():
    """Every shared song's /s/ page, for search engines."""
    o = site()
    rows = sorted(S.public_songs(), key=lambda r: C.iso(r["updated"] or r["published"]) or "", reverse=True)[:MAX_SITEMAP]
    out = []
    for r in rows:
        slug = slug_of(r.get_id())
        if slug:
            when = C.iso(r["updated"] or r["published"] or r["created"]) or ""
            out.append("<url><loc>%s/s/%s</loc>%s</url>" % (html.escape(o), slug,
                                                           "<lastmod>%s</lastmod>" % when[:10] if when else ""))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(out) + "\n</urlset>\n")


def _page(status, text, ctype="text/html; charset=utf-8", cache="public, max-age=300"):
    return anvil.server.HttpResponse(status, anvil.BlobMedia(ctype, text.encode("utf-8")), headers={"Cache-Control": cache})


ROUTE = getattr(anvil.server, "route", None)
if ROUTE:
    @ROUTE("/s/:slug")
    def song_link(slug="", **params):
        r = public_song(slug)
        if r is None:
            return _page(404, missing_html(), cache="no-store")
        return _page(200, song_html(r, slug))

    @ROUTE("/songs.xml")
    def songs_sitemap(**params):
        return _page(200, songs_xml(), "application/xml; charset=utf-8", "public, max-age=3600")
