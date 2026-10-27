"""Demo content, so the stage is never empty. Loaded automatically the first time anyone opens the app
(ensure_loaded), removed or reloaded from Admin -> Demo data. Removing it is remembered: it doesn't come back.

Demo users have is_demo=True and @example.com emails; they can't sign in (no password, enabled=False).
Every demo row is flagged is_demo=True. Removing demo songs also removes whatever real members attached to them
(upvotes, reviews, promotions, reports), so nothing points at a deleted song.
All lyrics here are original and fictional.
"""
import datetime as dt

from anvil.tables import app_tables

from . import common as C

# (name, email, scene, bio)
WRITERS = [
    ("Juno Vale", "juno.demo@example.com", "poetry", "Night-shift nurse. Writes sonnets on the bus home."),
    ("Kofi Brightwater", "kofi.demo@example.com", "rap", "Boom bap purist from the fourth floor. Bars before breakfast."),
    ("Penny Lark", "penny.demo@example.com", "pop", "Bedroom pop, big choruses, bigger feelings."),
    ("Sol Marquez", "sol.demo@example.com", "rap", "Bilingual bars. Dembow on weekends."),
    ("Iris Tamura", "iris.demo@example.com", "poetry", "Lanterns, cats and dactyls. Mostly dactyls."),
    ("Rook Ellington", "rook.demo@example.com", "rap", "Trap at 140, thoughts at 200."),
    ("Mara Quill", "mara.demo@example.com", "pop", "Ex-choir kid. Ballads about laundromats."),
    ("DJ Plantain", "plantain.demo@example.com", "pop", "Four on the floor or nothing at all."),
]
LISTENERS = [("Bea Fontaine", "bea.demo@example.com"), ("Theo Martin", "theo.demo@example.com"),
             ("Ines Ozola", "ines.demo@example.com"), ("Ravi Okafor", "ravi.demo@example.com"),
             ("Lu Chen", "lu.demo@example.com"), ("Sam Doyle", "sam.demo@example.com")]

# (writer, scene, beat, bpm, mood, title, days ago, [(kind, text)...], upvotes, featured)
SONGS = [
    (1, "rap", "boombap", 90, "Defiant", "Fourth Floor Walk-Up", 26, [
        ("Verse", "Fourth floor walk-up, radiator banging out a backbeat,\nMama on the phone like \"baby, did you eat?\" That's sweet.\n"
                  "I'm on a milk crate, notebook balanced on my kneecap,\nwriting like the rent is due in every single recap."),
        ("Hook", "Up the stairs, up the stairs, every step a bar,\nup the stairs, up the stairs, look how far we are."),
        ("Verse", "Elevator broke since oh-nine, so I built these lungs,\nevery flight a stanza, every landing where it's sung,\n"
                  "neighbors knock the ceiling when the cadence get too loud,\nbut the echo in the stairwell is the closest thing to crowd.")], 11, False),
    (0, "poetry", "iambic", 96, "Tender", "Night Shift Sonnet", 24, [
        ("Stanza", "I hold the hands of strangers until dawn,\nand learn their names the way you learn the rain:\n"
                   "by listening, then knowing it is gone,\nthen waiting by the window all the same."),
        ("Stanza", "The monitors keep time like patient clocks,\nthe hallway hums its hymn of pale white light,\n"
                   "and I, a keeper of these unlocked locks,\ngo home to sleep the morning into night.")], 13, False),
    (2, "pop", "fourfloor", 120, "Hopeful", "Glitter in the Gutter", 21, [
        ("Verse", "Lost my keys and lost my mind and lost the last bus home,\nfound a quarter on the sidewalk, called it lucky, called it mine."),
        ("Pre-chorus", "And the streetlights hum a little sharper tonight,\nlike they know something I don't."),
        ("Chorus", "There's glitter in the gutter, there's a bassline in the rain,\nI'm dancing with my shadow and she's calling out my name,\n"
                   "oh-oh, oh-oh, we're shining anyway,\nglitter in the gutter, we're shining anyway.")], 12, False),
    (3, "pop", "dembow", 96, "Playful", "Verano en el Bloque", 19, [
        ("Verse", "Summer on the block and the hydrant's wide open,\nabuela on the stoop with a fan and a rosary, hoping."),
        ("Chorus", "Muévelo, muévelo, the whole street's in motion,\nsneakers on the asphalt, we can almost smell the ocean,\n"
                   "muévelo, muévelo, nobody's going home,\nverano en el bloque, the whole block's our own.")], 9, False),
    (4, "poetry", "dactyl", 92, "Dreamy", "Lanterns Over the Harbor", 17, [
        ("Stanza", "Lanterns go drifting out over the harbor,\ncarrying wishes too heavy for paper,\n"
                   "somebody's grandmother, somebody's daughter,\nhumming a song that is older than water."),
        ("Stanza", "Gather the ribbons and gather the matches,\nnothing that burns is the same once it catches;\n"
                   "still we keep lighting them, still we keep sending\nsmall paper boats to a sea without ending.")], 10, False),
    (5, "rap", "trap", 140, "Hype", "140 Thoughts", 15, [
        ("Hook", "Hundred-forty on the meter and my thoughts on two hundred,\nphone face-down on the table, let the whole world wonder."),
        ("Verse", "Counting hi-hats like they're sheep but I never get to sleep,\nevery triplet is a staircase and I'm taking three by three,\n"
                  "they said slow it down, I told them I was born in double-time,\ngot a metronome for a heartbeat and a skyline for a spine.")], 8, False),
    (6, "pop", "ballad", 72, "Nostalgic", "Laundromat at Midnight", 14, [
        ("Verse", "Quarter in the dryer, watch your t-shirt spin,\nit still smells like the summer that we never let begin."),
        ("Chorus", "Fold me like a letter you were never gonna send,\ntuck me in a drawer between the hello and the end,\n"
                   "it's just the laundromat at midnight,\nand I'm still warm from the dryer, still warm from you.")], 12, False),
    (7, "pop", "disco", 116, "Playful", "Banana Moon", 12, [
        ("Verse", "Roller skates and lemonade and a mirror on the ceiling,\nI don't know the words but I know exactly what I'm feeling."),
        ("Chorus", "Under the banana moon we move a little slower,\npeel back the night and let the bassline take us over,\n"
                   "under the banana moon nobody's getting older,\nso hold me like a secret, baby, hold me even closer.")], 13, True),
    (1, "rap", "lofi", 78, "Nostalgic", "Rain on the Corner Store", 10, [
        ("Verse", "Rain on the corner store, the neon says it's open but it's flickering,\nMister Lee is counting change, the radio is whispering,\n"
                  "I remember penny candy and the comics on the wire racks,\nnow my nephew needs a password just to let me in the chat."),
        ("Hook", "Rain on the corner store, rain on the corner store,\neverything I used to be is still behind that door.")], 7, False),
    (0, "poetry", "trochaic", 104, "Dark", "Tell the Owls", 9, [
        ("Stanza", "Tell the owls the house is sleeping,\ntell the fox the gate is wide,\ntell the river what it's keeping\nunderneath the evening tide."),
        ("Stanza", "Candle, kettle, spoon and saucer,\nall the quiet things we own;\nevery winter, someone's daughter\nwalks the orchard path alone.")], 9, False),
    (3, "rap", "drill", 142, "Defiant", "No Elevator", 7, [
        ("Hook", "No elevator, still I'm going up,\nno elevator, still I'm showing up."),
        ("Verse", "Took the stairs 'cause the elevator never came,\nnow I'm counting every step like it's got a name,\n"
                  "they said the building wasn't built for us to make it,\nso I wrote it in the stairwell and the whole block traced it.")], 6, False),
    (4, "poetry", "anapest", 100, "Playful", "The Cat Who Collected the Moon", 6, [
        ("Stanza", "There's a cat on the roof who collects every moon,\nshe keeps crescents in jars and the fulls in a spoon,\n"
                   "and when neighbors complain that the night is too dark,\nshe just rents out a sliver for walks in the park.")], 11, False),
    (2, "pop", "ballad", 72, "Tender", "Text Me When You're Home", 5, [
        ("Verse", "You always said \"text me when you're home,\"\nthree little dots like footsteps on the phone."),
        ("Chorus", "So I'm texting you I'm home, but home's a different word,\nit's the loudest kind of quiet that I've ever heard,\n"
                   "text me when you're home, text me when you're home,\nI'll leave the porch light on in case you're on your own.")], 10, False),
    (5, "rap", "boombap", 90, "Playful", "Peel Session", 3, [
        ("Verse", "Peel session, I unzip the verse like a banana,\npotassium flow, keep the cramps out the stanza,\n"
                  "I'm a bunch on the counter getting sweeter by the hour,\nbrown spots on the résumé, that's flavor, that's power."),
        ("Hook", "Yellow on the outside, golden on the in,\npeel it back slow, let the session begin.")], 8, False),
    (6, "poetry", "iambic", 96, "Hopeful", "Small Inventory", 2, [
        ("Stanza", "A chipped blue mug, a key I cannot place,\na ticket stub from somewhere I was brave,\n"
                   "the photograph that never caught your face,\na recipe for bread you never gave.")], 5, False),
    (7, "pop", "dembow", 96, "Hype", "Hands Up in the Produce Aisle", 1, [
        ("Verse", "Cart with a wobbly wheel but it's keeping the rhythm,\ncoupons in the air like confetti, we give 'em."),
        ("Chorus", "Hands up in the produce aisle, everybody's grooving,\nmangoes on the speaker and the melons keep it moving,\n"
                   "cashier on the bass and security's a dancer,\nif you ask me what the question is, the beat would be the answer.")], 4, False),
]

# (song, reviewer: ("w", i) writer or ("l", i) listener, r1, r2, r3, text, favourite line index or None, days ago)
REVIEWS = [
    (0, ("w", 5), 5, 4, 5, "The milk crate image does so much work. Second verse's stairwell echo is a perfect closer.", 2, 20),
    (0, ("l", 0), 4, 4, 4, "Hook is simple in the best way. I was humming 'up the stairs' all day.", 4, 18),
    (1, ("w", 4), 5, 5, 5, "Strict pentameter that never feels strict. 'Learn their names the way you learn the rain' is gorgeous.", 1, 22),
    (1, ("w", 6), 4, 5, 5, "Ending on 'sleep the morning into night' flipped my stomach. Lovely.", 7, 21),
    (1, ("l", 2), 5, 4, 5, "Read it twice on my break. Thank you for this.", None, 19),
    (2, ("w", 7), 5, 4, 5, "Chorus is pure four-on-the-floor joy. 'Dancing with my shadow' should be on a T-shirt.", 5, 18),
    (2, ("l", 3), 4, 4, 5, "Pre-chorus lift works great. Maybe one more image in the verse?", None, 15),
    (3, ("w", 1), 4, 5, 4, "Hydrant and abuela with a rosary: you can feel the heat. Open/hoping is a sweet slant rhyme.", 1, 16),
    (4, ("w", 0), 5, 5, 4, "The dactyls roll like water. 'Older than water' is the line.", 3, 14),
    (4, ("l", 4), 4, 5, 5, "Second stanza's 'nothing that burns is the same once it catches' stuck with me.", 5, 12),
    (5, ("w", 3), 5, 4, 5, "Triplet-as-staircase is a sick metaphor for trap hats. Hook goes hard.", 3, 12),
    (6, ("w", 2), 5, 5, 5, "'Between the hello and the end' made me put my phone down. Ballad perfection.", 3, 11),
    (6, ("l", 1), 4, 5, 4, "So specific and so universal at the same time.", 5, 9),
    (7, ("w", 2), 5, 4, 5, "Okay this is the summer anthem. 'Peel back the night' is so on brand I'm screaming.", 3, 10),
    (7, ("w", 5), 4, 3, 5, "Bassline line in the chorus slaps. Verse could use one more internal rhyme.", None, 9),
    (7, ("l", 5), 5, 4, 5, "Played it on the disco beat five times in a row.", 5, 6),
    (8, ("w", 3), 5, 5, 4, "The password line is so real. Multis on flickering/whispering are clean.", 3, 8),
    (9, ("w", 4), 5, 5, 5, "Trochees knocking like a spell. The orchard path ending is chilling in the right way.", 7, 7),
    (11, ("w", 0), 5, 5, 5, "Anapests galloping over the rooftops! 'Rents out a sliver' made me laugh out loud.", 3, 4),
    (11, ("l", 0), 4, 5, 5, "Read this to my niece and now she wants a cat AND a moon.", None, 3),
    (12, ("w", 6), 4, 5, 5, "Three dots like footsteps: such a precise little image.", 1, 4),
    (13, ("w", 1), 5, 5, 4, "Brown spots on the résumé, that's flavor. Respect.", 3, 2),
    (14, ("w", 0), 5, 5, 4, "A whole life in four objects. The last line hurts.", 3, 1),
]
# (song, promoter: ("w"|"l", i), days ago): this week's Spotlight.
PROMOTIONS = [(11, ("w", 0), 1), (11, ("l", 2), 2), (14, ("w", 4), 1), (13, ("l", 3), 2), (6, ("w", 7), 3)]

# Tables that hold demo rows (each has an is_demo column). Children before parents.
DEMO_TABLES = ["promotions", "reviews", "upvotes", "songs"]


def state():
    return C.get_setting("demo", "never")  # "never" | "loaded" | "removed"


def ensure_loaded():
    """Call from the app's main data callables: loads the demo once, unless an admin removed it."""
    if state() == "never":
        load()


def _person(name, email, scene=None, bio=None):
    u = app_tables.users.get(email=email) or app_tables.users.add_row(email=email, enabled=False)
    u.update(display_name=name, is_demo=True, signed_up=C.now() - dt.timedelta(days=40), scene=scene or "", bio=bio or "")
    return u


def load():
    from . import Songs
    remove(remember=False)
    now = C.now()
    writers = [_person(n, e, s, b) for n, e, s, b in WRITERS]
    listeners = [_person(n, e) for n, e in LISTENERS]
    who = lambda ref: writers[ref[1]] if ref[0] == "w" else listeners[ref[1]]  # noqa: E731
    songs = []
    for i, (w, scene, beat, bpm, mood, title, days, sections, ups, featured) in enumerate(SONGS):
        when = now - dt.timedelta(days=days, hours=3 * i)
        r = app_tables.songs.add_row(owner=writers[w], title=title, scene=scene, mood=mood, beat=beat, bpm=bpm, bars_per_line=1,
                                     sections=[{"kind": k, "text": t} for k, t in sections], status="published",
                                     created=when - dt.timedelta(hours=5), updated=when, published=when, upvotes=0,
                                     review_count=0, rating=None, featured=featured, hidden=False, is_demo=True)
        songs.append(r)
        fans = [p for p in writers + listeners if p != writers[w]]
        step = max(1, days * 24 // max(ups, 1))
        for k in range(min(ups, len(fans))):
            fan = fans[(i * 5 + k * 3) % len(fans)]
            if app_tables.upvotes.get(user=fan, song=r) is None:
                app_tables.upvotes.add_row(user=fan, song=r, is_demo=True, created=when + dt.timedelta(hours=6 + k * step))
    for si, ref, a, b, c, text, fav, days in REVIEWS:
        song = songs[si]
        lines = Songs.lines_of(song["sections"])
        app_tables.reviews.add_row(song=song, author=who(ref), r1=a, r2=b, r3=c, text=text,
                                   fav_line=lines[fav] if fav is not None and fav < len(lines) else "",
                                   created=now - dt.timedelta(days=days, hours=2), is_demo=True)
    for si, ref, days in PROMOTIONS:
        app_tables.promotions.add_row(song=songs[si], user=who(ref), created=now - dt.timedelta(days=days), is_demo=True)
    for r in songs:
        Songs.recount(r)
    C.set_setting("demo", "loaded")
    return counts()


def remove(remember=True):
    from . import Songs
    for s in app_tables.songs.search(is_demo=True):
        Songs.delete_children(s)
    for name in DEMO_TABLES:
        for r in getattr(app_tables, name).search(is_demo=True):
            r.delete()
    touched = []
    for u in list(app_tables.users.search(is_demo=True)):
        for t, col in (("upvotes", "user"), ("reviews", "author"), ("promotions", "user"), ("reports", "user")):
            for r in getattr(app_tables, t).search(**{col: u}):
                touched.append(r["song"])
                r.delete()
        for s in app_tables.songs.search(owner=u):
            Songs.delete_children(s)
            s.delete()
        u.delete()
    # Demo people's upvotes and reviews on real songs are gone: refresh those songs' counts.
    for s in {s.get_id(): s for s in touched if s is not None}.values():
        if app_tables.songs.has_row(s):
            Songs.recount(s)
    if remember:
        C.set_setting("demo", "removed")
    return counts()


def counts():
    out = {"users": len(app_tables.users.search(is_demo=True))}
    for name in DEMO_TABLES:
        out[name] = len(getattr(app_tables, name).search(is_demo=True))
    return out
