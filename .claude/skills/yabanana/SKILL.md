---
name: yabanana
description: Context, workflow and recipes for Yabanana (folder yabanana-forms), the user's Anvil app built as native Anvil Forms. A song-writing community for rappers, poets and pop writers: lyrics over 12 theory-based beats, dictionary-based rhyme/simile/metaphor helpers, a public Stage with upvotes, reviews, promotions and remixes. Load this before any feature request, bug fix, restyle, content change or deploy for this app.
---

# Yabanana: working on the app

**What it is:** Writers (three communities: Rap, Poetry, Pop) write lyrics in the Studio over one of 12 beats synthesized
in the browser, helped by a pronouncing dictionary (rhymes, syllables, meter) and a hand-written word bank (similes,
metaphors, theme palettes, sparks). No AI: the user wants prepared dictionaries (an LLM may come later). Shared songs go
on the Stage (random songs, open to visitors), where members upvote (saved to their Bunch), review, promote (Spotlight)
and remix them. Charts, writer pages, Beats & theory and a Rhyme lab round it out; admins moderate songs and reports.

**Where it lives:**
- Folder `C:\Users\arkvi\Documents\CLAUDE\yabanana-forms\` = the git clone of **github.com/arkulinskis/yabanana**.
  "git" layout: the folder *is* the Anvil app. Live at https://yabanana.com (Anvil pulls `master`).
- **Converted to native Anvil Forms on branch `forms` (2026-11-04), not merged yet.** Until the user approves and it is
  merged, `master` and the live app still run the old JavaScript version, built from the old source folder
  `C:\Users\arkvi\Documents\CLAUDE\yabanana\` (tools/deploy.py). Don't deploy from both: once `forms` is merged, retire
  the old folder (CONVERT.md step 5) and update apps.json (folder, `layout: git`, `ui: forms`, this guide's path).
- Made from `APP_MAKER\template-forms`. Anvil's own agent skills describe the same model
  (`APP_MAKER\vendor\anvil-agent-references\skills\client-forms` ...; ANVIL_NOTES.md, "Native Anvil Forms").
- **README.md** lists every feature. Keep it up to date.

**What the user wants:** design direction "Sticker Stage": banana cream background #fff7e0, ink #1d1830, banana yellow
brand #ffc21a, pop pink accent #ff3d7f, scene colours Rap gold #e8a317 / Poetry ink-blue #3e5bd8 / Pop pink #ff3d7f
(dark: #15121f background). Fonts: Bricolage Grotesque (headings), DM Sans (body), Fraunces (lyrics, italic excerpts;
never for user-typed Latvian text: it misdraws macrons). Shapes: 2px ink outlines, hard offset shadows (4px 4px 0), pill
buttons that lift on hover, washi-tape strips on song cards. Appeal to all three communities equally. Homepage = random
songs naming the writer, upvotes for members, upvoted songs saved to the member (the Bunch). Prepared dictionaries, not
an LLM. Claude assumes details and builds; Claude deploys. Mobile-first: every page must fit 390 px. Light and dark.

## Workflow for any change

1. `git pull --ff-only` (Anvil commits "Edited ..." when the user changes something in the IDE; read those commits).
2. Edit: a page's template and Python side by side (`client_code/Pages/X/form_template.html` + `__init__.py`).
3. `python tools/check.py` (no -I) -> **ALL CHECKS PASSED**: Anvil's validator (type-checks every template and Python
   file), JS syntax of the engines, asset hashes (`tools/assets.py`), server tests (tools/testing/test_server.py).
4. `python -I tools/ui_test.py` (Docker Desktop running) -> **ALL UI TESTS PASSED**: the app in the Anvil App Server
   (container `yabanana-dev`, http://localhost:3127) driven by headless Chrome: tools/ui/flow.js (the whole journey:
   visitor pages, join nudge, sign-up, a song from scratch with helper insert + beat picker + share + Perform, review,
   upvote, promote, Bunch, charts, profile, writer page, delete, sign out), phone.js (true 390 px, every page, the
   helper sheet), admin.js, a11y.js (axe WCAG 2.2 AA on every page, light + dark). Server edits need `--restart`.
   `--only flow.js` runs one; `--shots DIR` = every screen, desktop + phone, light + dark, visitor + member: Read them.
5. Commit only your files as arkulinskis with the Co-Authored-By line; push (`forms` until it is merged, then `master`).
   New tables/columns: tell the user to accept the **Schema Mismatch** alert ("The schema of the source code is correct").

## Architecture

```
anvil.yaml               startup: module `startup`; db_schema (unchanged from the JS version); head_html: SEO block,
                         fonts, Prepsto, legal-kit.js, icons.css, app.css, app-kit.js, yb-beats/words/shared/perform.js
client_code/
  startup.py             UI.toast -> state.toast (the engines' messages), legal kit, get_me, router.start()
  router.py              PAGES, NAV (members: Stage/Studio/Charts/Bunch), PUBLIC_NAV (visitors: Stage/Charts/Beats/Rhyme lab),
                         _form(name, args) (#studio -> Studio, #studio/new -> StudioNew, #studio/<id> -> Editor),
                         go / href / link(Link, page, ...) / set_title / open_replacing
  state.py               me(), call(), call_quiet(), toast(), store_get/set (same browser keys as before), a11y helpers
  auth.py                sign in / up / reset / Continue with Google / sign out
  yb.py                  SCENES, MOODS, KINDS, beats() (read from the JS engine), ripeness, confetti, perform,
                         lyrics_html, when_words, on_upvote / upvote_changed (every banana for a song updates together)
  Layouts/Shell          header (menu, Write button, account menu), footer, phone tab bar; refresh(page) also puts
                         `page-<name>` on the frame (.page-landing, .page-studio)
  Pages/                 Landing, Stage (#home), Song, Studio, StudioNew, Editor, Charts, Bunch, Writer, Beats, Lab,
                         Profile, Admin (overview, songs, reports, feedback, users, demo), Auth
  Components/            BeatChip, Steps, Upvote, Avatar, SceneBadge, ScenePicker, Rating, Lyrics, Helper
  Items/                 SongCard, FreshRow, ChartRow, StudioSong, SectionEditor, ReviewRow, CritBar, MoreLink,
                         BeatCard, BeatOption, AdminSongRow, ReportRow, FeedbackRow, UserRow, NavLink
  Dialogs/               JoinNudge, ReportSong, BeatPicker, ShareLink
server_code/             Songs, Community, Moderation, Accounts, Admin, DemoData, Feedback, common, SchemaCheck,
                         legal_server (kit), seo_routes (kit)
theme/assets/            app.css (tokens + pages + role layer), icons.css (tools/build_icons.py from app-kit.js),
                         app-kit.js, the engines yb-*.js, rhymes.txt + wordbank.json (dictionaries), icons, og-image
```

**The JavaScript engines** (kept as JS because they draw, play sound or search 24,000 words on every keystroke):
- `yb-beats.js`: `YB.BEATS` (12 beats: patterns, chords, theory), the Web Audio synth, `YB.player` (start/stop/toggle,
  step events, stops on every route change), `YB.beatChip` (the ▶ pill; any `[data-play-beat]` button toggles the
  player, caught in the capture phase so a chip in a clickable card never opens the card), `YB.stepsHtml` /
  `YB.lightSteps(root, onlyKey)`.
- `yb-words.js`: `YB.words` (rhymes.txt loader, syllables, stress, perfect/near/multi rhymes, meter, rhyme scheme),
  `YB.bank` (wordbank.json), `YB.helper` (the helper panel; `YB.mountHelper` for Components/Helper), `YB.flowHtml`
  (the Studio flow strip), `YB.checkHtml` (Rhyme lab line checker), `YB.whenWords(cb)`, `YB.target`.
- `yb-shared.js`: `YB.lyricsHtml` (rhyme map), `YB.confetti` / `confettiAt`, `YB.insertAtCaret`, `YB.wordAtCaret`,
  `YB.autosize` (caret offsets are the browser's own UTF-16 positions, so they stay in JS).
- `yb-perform.js`: `YB.perform(song)`: full-screen karaoke over the beat (Space plays, Esc / route change closes).
Python reaches them through `yb.py` (data goes over as JSON: `yb.to_js`). A JS promise returned to Python is awaited
on the spot, so the engines take callbacks instead (`YB.whenWords(cb)`).

**Tables** (`db_schema` in anvil.yaml; all `client: none`): `users` (+ display_name, is_admin, is_demo, last_seen,
legal_*, scene, bio), `app_settings`, `feedback`, `songs` (owner, title, scene, mood, beat, bpm, bars_per_line,
sections = [{kind, text}], status draft|published, created/updated/published, upvotes, review_count, rating (cached:
Songs.recount), featured, hidden, remix_of, is_demo), `upvotes` (the Bunch), `reviews` (r1-r3, text, fav_line),
`promotions`, `reports`.

## How things are done here

The template-forms rules apply (one Form per page with the Shell layout, RepeatingPanel + `Items/` for lists, `Dialogs/`
+ `alert(..., role="app-dialog")`, Labels for changing text, Buttons with roles, `state.call` for server calls). Yabanana
specifics, learned in the conversion:
- **Links to app pages: `router.link(self.x_link, "song", id)`**, never `link.url = ...` alone: an Anvil Link with a url
  gets `target="_blank"` and opens a new tab. flow.js checks no `#...` link has a target.
- **Song cards open on a click anywhere**: SongCard listens on its root node in Python (`anvil:on-dom:` on a template's
  ROOT element isn't wired up on the App Server). Read text selection with `getSelection().toString()`, not `str()`.
- **Read `event.currentTarget` before any server call** (the browser clears it while Python waits).
- **Item timers** (SectionEditor's caret/flow `setTimeout`s) can fire after a redraw removed the item: `self.parent` is
  then None (`_tell` checks).
- **Labels' text follows the Label's role**: app.css makes `.anvil-label > .anvil-label-text` inherit font, colour and
  alignment, so old rules aimed at plain `<span>`s (`.sg-nums span`) can't shrink a number. Anvil also writes
  `text-align: left` on every Label/Link; app.css lets them follow the container.
- Grids around lists go on the panel's role: `.anvil-role-yb-cards > div`, `st-rail`, `st-fresh`, `ch-list`, `bt-grid`.
- Toggle groups (`.ui-seg`, `.yb-scenes-pick`, the helper's tabs and chips) get aria-pressed from the "on" class
  (TOGGLES in app-kit.js). Avatar initials take their colour from the avatar's own scene class, not the card's.

## Recipes

- **New page:** `Pages/X` (template with `<anvil-form layout="Yabanana.Layouts.Shell">` + `__init__.py` taking `args`),
  register it in router.py (`PAGES`, `_form`, NAV/PUBLIC_NAV if needed), add its address to tools/ui/phone.js and
  a11y.js, its journey to flow.js.
- **New server function:** in a server module + tests in tools/testing/test_server.py (happy path, bad input, someone not
  allowed; public ones in `PUBLIC`). Return `C.ok(...)` / `C.fail("...")`, never emails.
- **New table or column:** `db_schema` in anvil.yaml, then the Schema Mismatch step. Personal data -> the legal kit.
- **New beat:** an entry in `BEATS` in theme/assets/yb-beats.js AND its key + default BPM in `BEATS` in
  server_code/Songs.py (save_song rejects unknown keys). Poetry beats: `poetic: true`, and the key in `POETIC` in
  yb-words.js for meter checking. `python tools/assets.py`.
- **More similes / metaphors / themes / sparks:** theme/assets/wordbank.json, then bump `DATA_V` in yb-words.js.
- **Rebuild the rhyme dictionary:** old folder's tools/build_words.py (download links inside) writes rhymes.txt; copy it
  to theme/assets, bump `DATA_V`.
- **Review criteria:** `CRITERIA` in Songs.py. **Counts on songs** are cached: `Songs.recount(song)` after changes.
- **Demo content:** DemoData.py (`is_demo=True`, `DEMO_TABLES`, children first). get_stage / shuffle / get_charts call
  `DemoData.ensure_loaded()`, so the first visitor sees demo songs.
- **Restyle:** tokens at the top of app.css (light and dark blocks), fonts in head_html, the spinner in theme.css,
  `LEGAL_THEME` in startup.py. **Icon:** theme/assets/icon.svg, `python -I tools/make_icons.py`, `python tools/assets.py`.
- **App icon set (UI.ICONS in app-kit.js):** add one, `python tools/build_icons.py` (assets.py runs it).

## Gotchas

- `python -I` hides PyYAML: check.py and assets.py run without `-I`; ui_test.py with `-I`.
- Never write Anvil's theme-colour token pattern (percent, `color:`, name, percent) in theme.css.
- Headless Chrome needs `--autoplay-policy=no-user-gesture-required` for the beat player (drive.mjs has it).
- The local App Server 1.18 lags hosted Anvil (anvil-dropzone wrappers, notification markup): test on the user's Anvil
  link of the branch too for big changes.
- Email confirmation is off, so whoever first signs up with an ADMIN_EMAILS address becomes admin.

## Privacy & Terms (legal kit)

From `C:/Users/arkvi/Documents/CLAUDE/APP_MAKER/legal-kit`: change `apps/yabanana.json`, then there
`python -I build.py yabanana && python -I install.py yabanana` (while apps.json still points at the old folder,
install into this one by overriding `install.APPS["yabanana"] = ("yabanana-forms", "git")`), then
`python tools/assets.py` and deploy. Sign-up keeps the tick box (`legal.consent_field()` in Pages/Auth).
Feedback = Prepsto only ("Submit feedback", code gncbgnf).
