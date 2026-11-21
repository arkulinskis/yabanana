# Yabanana

A song-writing community for three crowds at once: **rappers, poets and pop writers**. Members write lyrics over twelve
simple beats built from song and poetry theory (boom bap to iambic pentameter), with rhymes, similes, metaphors and
theme palettes one click away, then share them to the Stage where others upvote, review, promote and remix them.
All writing help comes from prepared dictionaries (no AI). Built on [Anvil](https://anvil.works) as native Anvil Forms
(Python Forms with HTML templates, a layout, custom components; JavaScript only for the beat synth, the rhyme dictionary
and Perform mode).

- **App repo:** github.com/arkulinskis/yabanana (branch `master`). Anvil pulls `master`.
- **Live:** https://yabanana.com (native Anvil Forms since the `forms` branch was merged in Nov 2026).

## What it does

**For everyone (no account needed):**
- **Landing page** (`#landing`): the promise for each scene, a sticker-collage hero, live random songs, how it works, FAQ.
- **The Stage** (`#home`, `#home/<scene>`): random songs (Shuffle), each card naming its writer, scene, mood, beat (▶ plays it),
  excerpt, review count and upvotes; a **Spotlight** rail (staff picks + songs members promoted this week), **Fresh drops**, totals.
  Upvoting while signed out shows a "Join the bunch" nudge.
- **Weekly Bar Challenge** (`#challenge`, `#challenge/<2026-W46>`): one prompt a week for all three scenes ("Flip it: GLASS",
  "Ten and done", "One rhyme, all the way down"... 16 rotate on their own), a rule the Studio checks as you write, a beat per
  scene, entries ranked by bananas (voting stays open a week after the deadline), the past weeks' winners. A banner on the
  Stage and in the Studio, and a fourth card on the New song page. Entries get a "Week 47 challenge" tag; writer pages show
  "took 5 · won 1".
- **Song page** (`#song/<id>`): full lyrics with the **Rhyme map** (A/B scheme letters + colour-coded rhyming words, including
  assonance like slower/over/closer), **Perform mode**, the beat card with its theory, ratings breakdown, the writer's question
  pinned above the reviews, reviews, more by the writer.
- **Share = lyric cards + song links:** pick 1 to 5 lines, a style (Sticker / Night / the scene's colour) and a size (square
  1080x1080 or story 1080x1920); download the PNG or share it from a phone. The song's link, `yabanana.com/s/<id>`, previews
  in WhatsApp, Discord or iMessage as "*Title* by Writer" with the first lines (only songs their writer shared; drafts get a
  404). `/songs.xml` lists every shared song for search engines.
- **Waiting for a first review** (Stage): songs nobody has reviewed yet (never your own), writers who review others first,
  each with a "Be the first review" chip.
- **Perform mode:** full-screen stage; the beat plays with a one-bar count-in and the lyrics light up word by word (weighted by
  syllables), one line per bar (½ / 1 / 2 bars per line, tempo ±). Space plays, Esc closes.
- **Charts** (`#charts/<week|all|reviewed>/<scene>`): most upvoted this week, all time, best reviewed.
- **Writer pages** (`#writer/<id>`): pen name, scene, bio, ripeness level (Green → Ripening → Ripe → Sweet → Golden Bunch by
  bananas received), counts, their songs.
- **Beats & theory** (`#beats`, `#beats/<key>`): the 12 beats with step grids, meter, BPM, syllables per line, the theory and an
  example line; a craft cheat sheet per scene.
- **Rhyme lab** (`#lab`, `#lab/<word>`): the helper panel full size, a line checker (syllables, stress ●○, meter, rhyme scheme)
  and a scratchpad kept in the browser.

**For members:**
- **Studio** (`#studio`): your notebook of drafts and shared songs with totals. `#studio/new`: pick Rap / Poetry / Pop to start.
- **New since your last visit** (Studio): reviews, bananas and remixes other people gave your songs since you last opened
  the Studio (remembered in your browser).
- **Editor** (`#studio/<id>`): title, scene, mood, beat picker (12 beats, preview each), tempo, bars per line, step lights,
  sections (Verse, Chorus, Hook, Bridge, Stanza…; move, repeat, delete), a **flow strip** under each section (syllables per line
  vs the beat's target, rhyme letters, detected meter on poetry beats), "Ask your reviewers" (one question, 140 characters,
  pinned on the song page), the challenge rule with live checks on challenge drafts, autosave, Play, Perform, Share to the stage /
  Unpublish, Delete. A **helper panel** (bottom sheet on phones) follows the cursor: rhymes for the word you're on (or for the
  end of the line above when you start a new line), similes by adjective, metaphors by concept + a "metaphor machine", theme
  word palettes, writing sparks. Click any suggestion to insert it.
- **Upvotes** (bananas): one per song, not on your own; every upvoted song is saved to your **Bunch** (`#bunch`, search + scene filter).
- **Reviews:** three 1–5 banana ratings named per scene (Rap: Flow / Wordplay / Punch; Poetry: Rhythm / Imagery / Resonance;
  Pop: Hook / Story / Singability), written feedback, a favourite line and a line to rework. One per person per song, editable.
- **Promote:** 3 promotions per rolling week put someone else's song in the Spotlight for 7 days.
- **Remix:** copy a shared song into your studio as a draft, credited to the original.
- **Report:** five reasons + note. Three reports from different people hide a song until an admin decides.
- **Profile** (`#profile`): pen name, scene, bio, appearance, password reset, Privacy & Terms.

**For admins** (`#admin`; an address in the App Secret `admin_emails` becomes an admin once it is proven: signed in with
Google, or a confirmed email. Or tick `is_admin` on a user in the Data Tables):
- **Overview:** members, songs, drafts, reviews, upvotes, open reports, new feedback.
- **Songs:** search, filter (staff picks / hidden / drafts), make a staff pick, hide, delete.
- **Reports:** open / resolved; "It's fine" (resolves all and unhides) or "Hide the song".
- **Feedback inbox, Users, Demo data** (8 writers, 6 listeners, 16 original songs with upvotes, reviews and promotions, plus
  four entries for the first week of the Weekly Bar Challenge, with writers' questions and reviews that point at a line).

## Setting it up in Anvil (once)

1. In the Anvil editor: **Create app → Clone from GitHub**, and paste `https://github.com/arkulinskis/yabanana`.
2. **Users** service: email + password and "Continue with Google", sign-up allowed (already set in `anvil.yaml`; check it).
3. Open the app in the editor. If it shows a **Schema Mismatch** alert, choose **"The schema of the source code is correct"** so Anvil creates the tables.
4. Add the App Secret `admin_emails` (your address), then **Run** the app and **Continue with Google** with that address: a
   proven address on the list becomes the admin (email confirmation is off, so a password sign-up alone is never promoted).
5. **Publish** (Publish → public URL, or your own domain).

<!-- libraries:start -->
## Libraries and outside services

What this project uses besides its own code. Generated by `APP_MAKER/tools/libraries.py`; to change it, edit `APP_MAKER/libraries/catalog.py` and re-run the script.

| Name | How it gets in | Used here for |
|---|---|---|
| [YouTube embeds](https://developers.google.com/youtube/player_parameters) | Outside web service | Plays a YouTube video inside the page (the privacy-friendlier youtube-nocookie address). |
| [Google Fonts](https://fonts.google.com) | Loaded from a CDN | Bricolage Grotesque, DM Sans, Fraunces |
| [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) | Data set | How 130,000 English words are pronounced, sound by sound. |

**Built into the browser:** Canvas 2D, Web Audio API, Web Share, localStorage, Clipboard, File downloads (Blob), Web Animations.

**Anvil platform:** Anvil, Anvil Data Tables, Anvil Email, Anvil JS bridge (anvil.js), Anvil Secrets, Anvil Users, Anvil Google service, Anvil HTTP, Anvil timezones (anvil.tz).

**Build and test tools (not shipped):** axe-core, Node.js, Headless Chrome (DevTools Protocol), PyYAML.

<!-- libraries:end -->

## Working on it

See `.claude/skills/yabanana/SKILL.md`. In short:

```
python tools/check.py          # Anvil's validator, engine syntax, asset hashes, server tests -> ALL CHECKS PASSED
python -I tools/ui_test.py     # the app in the Anvil App Server (Docker) + headless Chrome -> ALL UI TESTS PASSED
python -I tools/ui_test.py --shots DIR   # screenshots of every screen (desktop + phone, light + dark)
python tools/assets.py         # after changing a theme asset: refresh the ?v= hashes in anvil.yaml
```
Deploying = committing and pushing (Anvil pulls `master`).

## Project layout

```
client_code/    startup.py, router.py (pages + addresses), state.py, auth.py, yb.py (scenes, beats, engine wrappers),
                challenge.py, Layouts/Shell, Pages/ (Landing, Stage, Song, Studio, StudioNew, Editor, Challenge, Charts,
                Bunch, Writer, Beats, Lab, Profile, Admin, Auth), Components/ (BeatChip, Steps, Upvote, Avatar, SceneBadge,
                ScenePicker, Rating, Lyrics, Helper, ChallengeBanner), Items/ (SongCard, SectionEditor, ChartRow,
                ChallengeWeek, ActivityRow, CardLine ...), Dialogs/ (JoinNudge, ReportSong, BeatPicker, ShareSong,
                ShareLink), legal.py
server_code/    Songs.py (stage, songs, studio, charts, writers, bunch, my_activity), Challenges.py (the Weekly Bar
                Challenge), SongLinks.py (/s/<id> song links + /songs.xml), Community.py (upvote, review, promote, report),
                Moderation.py (admin songs + reports), Accounts.py, Feedback.py, Admin.py, DemoData.py, common.py,
                legal_server.py, seo_routes.py, SchemaCheck.py
theme/assets/   app.css, icons.css, app-kit.js, the engines yb-beats.js (12 beats + Web Audio synth + player),
                yb-words.js (dictionary, rhymes, meter, helper panel), yb-shared.js (lyrics + rhyme map, confetti),
                yb-perform.js (Perform mode), yb-card.js (lyric cards); rhymes.txt (24k-word pronouncing dictionary),
                wordbank.json, icons
tools/          check.py, ui_test.py + ui/ (flow, phone, admin, a11y, seed), assets.py, build_icons.py, make_icons.py,
                live/drive.mjs, testing/ (server tests on a strict Anvil mock)
```

Credits: rhymes and syllables from the CMU Pronouncing Dictionary (Copyright © 1993-2015 Carnegie Mellon University, BSD-style
licence); common-word ranking from hermitdave/FrequencyWords. The word bank and all demo lyrics are original.
