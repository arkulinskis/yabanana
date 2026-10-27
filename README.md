# Yabanana

A song-writing community for three crowds at once: **rappers, poets and pop writers**. Members write lyrics over twelve
simple beats built from song and poetry theory (boom bap to iambic pentameter), with rhymes, similes, metaphors and
theme palettes one click away, then share them to the Stage where others upvote, review, promote and remix them.
All writing help comes from prepared dictionaries (no AI). Built on [Anvil](https://anvil.works).

- **App repo:** github.com/arkulinskis/yabanana (branch `master`). Anvil pulls `master`.
- **Live:** not published yet (planned: yabanana.anvil.app or a custom domain).

## What it does

**For everyone (no account needed):**
- **Landing page** (`#landing`): the promise for each scene, a sticker-collage hero, live random songs, how it works, FAQ.
- **The Stage** (`#home`, `#home/<scene>`): random songs (Shuffle), each card naming its writer, scene, mood, beat (▶ plays it),
  excerpt, review count and upvotes; a **Spotlight** rail (staff picks + songs members promoted this week), **Fresh drops**, totals.
  Upvoting while signed out shows a "Join the bunch" nudge.
- **Song page** (`#song/<id>`): full lyrics with the **Rhyme map** (A/B scheme letters + colour-coded rhyming words, including
  assonance like slower/over/closer), **Perform mode**, the beat card with its theory, ratings breakdown, reviews, more by the writer.
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
- **Editor** (`#studio/<id>`): title, scene, mood, beat picker (12 beats, preview each), tempo, bars per line, step lights,
  sections (Verse, Chorus, Hook, Bridge, Stanza…; move, repeat, delete), a **flow strip** under each section (syllables per line
  vs the beat's target, rhyme letters, detected meter on poetry beats), autosave, Play, Perform, Share to the stage /
  Unpublish, Delete. A **helper panel** (bottom sheet on phones) follows the cursor: rhymes for the word you're on (or for the
  end of the line above when you start a new line), similes by adjective, metaphors by concept + a "metaphor machine", theme
  word palettes, writing sparks. Click any suggestion to insert it.
- **Upvotes** (bananas): one per song, not on your own; every upvoted song is saved to your **Bunch** (`#bunch`, search + scene filter).
- **Reviews:** three 1–5 banana ratings named per scene (Rap: Flow / Wordplay / Punch; Poetry: Rhythm / Imagery / Resonance;
  Pop: Hook / Story / Singability), written feedback and a favourite line. One per person per song, editable.
- **Promote:** 3 promotions per rolling week put someone else's song in the Spotlight for 7 days.
- **Remix:** copy a shared song into your studio as a draft, credited to the original.
- **Report:** five reasons + note. Three reports from different people hide a song until an admin decides.
- **Profile** (`#profile`): pen name, scene, bio, appearance, password reset, Privacy & Terms.

**For admins** (`#admin`; arkulinskis@gmail.com becomes an admin on first sign-in):
- **Overview:** members, songs, drafts, reviews, upvotes, open reports, new feedback.
- **Songs:** search, filter (staff picks / hidden / drafts), make a staff pick, hide, delete.
- **Reports:** open / resolved; "It's fine" (resolves all and unhides) or "Hide the song".
- **Feedback inbox, Users, Demo data** (8 writers, 6 listeners, 16 original songs with upvotes, reviews and promotions).

## Setting it up in Anvil (once)

1. In the Anvil editor: **Create app → Clone from GitHub**, and paste `https://github.com/arkulinskis/yabanana`.
2. **Users** service: email + password, sign-up allowed (already set in `anvil.yaml`; check it).
3. Open the app in the editor. If it shows a **Schema Mismatch** alert, choose **"The schema of the source code is correct"** so Anvil creates the tables.
4. **Run** it and sign up with **arkulinskis@gmail.com** straight away (that account becomes the admin).
5. **Publish** (Publish → public URL, or your own domain).

## Working on it

See `.claude/skills/yabanana/SKILL.md`. In short:

```
python -I tools/check.py --ui                    # syntax, server tests, headless UI tests → ALL CHECKS PASSED
python -I tools/preview/devserver.py 8765        # the app on in-memory data: http://localhost:8765/  (?as=ana#home, ?as=admin#admin)
python tools/deploy.py                           # dry run (needs PyYAML, so no -I)
python tools/deploy.py --push "Message"          # deploy: commit + push to GitHub, Anvil pulls it
python -I tools/build_words.py CMUDICT FREQLIST  # rebuild assets/rhymes.txt (see the script for the download links)
```

## Project layout

```
web/            core.js/core.css (engine + "sticker stage" tokens), app.js (header, footer, extra icons), pages/*.html
web/pages/_*    shared parts: _beats (12 beats + Web Audio synth + player), _words (dictionary, rhymes, meter, helper panel),
                _shared (song cards, upvotes, lyrics, confetti), _perform (Perform mode)
client_code/    Main.py (the only Anvil form: bridge to the server, sign-in), legal.py
server_code/    Songs.py (stage, songs, studio, charts, writers, bunch), Community.py (upvote, review, promote, report),
                Moderation.py (admin songs + reports), Accounts.py, Feedback.py, Admin.py, DemoData.py, common.py, legal_server.py
assets/         icon.svg + PNG icons, rhymes.txt (24k-word pronouncing dictionary), wordbank.json (similes, metaphors, themes, sparks)
tools/          sync_to_anvil.py (settings + tables), build_words.py, deploy.py, check.py, preview/ (dev server, UI tests, shots), testing/
```

Credits: rhymes and syllables from the CMU Pronouncing Dictionary (Copyright © 1993-2015 Carnegie Mellon University, BSD-style
licence); common-word ranking from hermitdave/FrequencyWords. The word bank and all demo lyrics are original.
