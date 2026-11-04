/* yb-beats.js: the 12 beats and the sound engine (Web Audio: every drum and chord is synthesized live, no audio files).
   YB.BEATS (definitions + the theory behind each), YB.beat(key), YB.player (start/stop/toggle, step events),
   YB.beatChip (the play button the BeatChip component draws), YB.stepsHtml / YB.lightSteps (step lights).
   Moved unchanged from the old web/pages/_beats.html. Server keys must match BEATS in server_code/Songs.py. */
(function () {
  'use strict';
  var YB = window.YB = window.YB || {};

  /* ---------------------------------------------------------------- the beats
     steps: steps per bar; per: steps per beat (4 = 16ths, 2 = 8ths, 3 = triplets); swing 0..0.35.
     Drum strings: one char per step ('x' hit, 'X' accent, 'o' open hat, 'r' roll, '.' rest); a string 2 bars long alternates.
     chords: one per bar (cycled); keys: 'keys' stabs on chordPat, 'pad' held, 'pluck', 'arp' (one note per hit).
     bass: hits on bassPat at the bar's root ('X' = octave up); bassType '808' or 'synth'.
     target: syllables per LINE at the default bars per line (lines). */
  var BEATS = [
    { key: 'boombap', name: 'Boom Bap', scene: 'rap', bpm: 90, steps: 16, per: 4, swing: .16, lines: 1, target: [10, 16],
      kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xo', chords: ['Am7', 'Dm7', 'Fmaj7', 'E7'], keys: 'keys', chordPat: 'x.........x.....',
      bass: 'x......x..x.....', bassType: 'synth',
      feel: 'Dusty, head-nodding, built for storytelling.',
      meter: 'BOOM . . bap . . BOOM-BOOM bap',
      theory: 'Hip-hop\'s backbone: kick on 1, snare on 2 and 4, with a lazy swing on the hi-hats. One line per bar, and the last syllable of the line lands on (or just before) the snare on 4. Ten to sixteen syllables per bar is the classic pocket.',
      tryLine: 'Fourth floor walk-up, radiator banging out a backbeat' },
    { key: 'trap', name: 'Trap 140', scene: 'rap', bpm: 140, steps: 16, per: 4, swing: 0, lines: 1, target: [12, 20],
      kick: 'x......x..x.....x.....x...x..x..', snare: '........x...............x.......', hat: 'x.x.x.x.x.xrx.x.x.x.x.x.rrx.x.x.', chords: ['Cm', 'Ab', 'Eb', 'Bb'], keys: 'pad',
      bass: 'x......x..x.....', bassType: '808',
      feel: 'Rolling hi-hats, booming 808, half-time snare.',
      meter: 'ta-ka-ta-ka (triplet flows over half time)',
      theory: 'Fast tempo, slow feel: the snare hits once per bar (beat 3), so the bar feels half as fast as the hi-hats. That space invites triplet flows: three syllables per beat ("Mi-gos flow"). Hi-hat rolls mark the end of a phrase.',
      tryLine: 'Counting hi-hats like they\'re sheep but I never get to sleep' },
    { key: 'drill', name: 'Drill', scene: 'rap', bpm: 142, steps: 16, per: 4, swing: 0, lines: 1, target: [10, 16],
      kick: 'x.....x...x.....x.......x.x.....', snare: '........x..x............x.......', hat: 'x..x..x.x..x.x..x..x..x.x..x.xr.', chords: ['Gm', 'Eb', 'Cm', 'D'], keys: 'pad',
      bass: 'x.....x...x.....', bassType: '808',
      feel: 'Dark, sliding 808s, off-beat snares.',
      meter: 'DUM . . da-DUM . da . (syncopated)',
      theory: 'Drill moves the snare off the grid (beat 3 and the "e" of 3) and lets the hats skip in triplets. Lines get choppy and punchy: short phrases, hard stops, room for ad-libs. Minor chords with a raised 7th (the D) give the eerie pull.',
      tryLine: 'Took the stairs \'cause the elevator never came' },
    { key: 'lofi', name: 'Lo-fi Rain', scene: 'rap', bpm: 78, steps: 16, per: 4, swing: .3, lines: 1, target: [8, 14], crackle: true,
      kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.xxx.x.x.xxx.x.', chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], keys: 'keys', chordPat: 'x.......x.......',
      bass: 'x.......x.x.....', bassType: 'synth',
      feel: 'Warm, swung, a little sleepy. Vinyl crackle included.',
      meter: 'laid-back, behind the beat',
      theory: 'Major-seventh chords walking down (IV-iii-ii-I in C) give that sunny-sad lo-fi colour. Heavy swing means the off-beats arrive late: deliver your words a hair behind the beat and leave space between lines.',
      tryLine: 'Rain on the corner store, the neon says it\'s open' },
    { key: 'fourfloor', name: 'Four on the Floor', scene: 'pop', bpm: 120, steps: 16, per: 4, swing: 0, lines: 1, target: [6, 12],
      kick: 'x...x...x...x...', snare: '....x.......x...', clap: '....x.......x...', hat: '..o...o...o...o.', chords: ['C', 'G', 'Am', 'F'], keys: 'pluck', chordPat: 'x..x..x.x..x..x.',
      bass: '..x...x...x...x.', bassType: 'synth',
      feel: 'Kick on every beat, made for dancing.',
      meter: 'ONE two THREE four',
      theory: 'The "four-chord song": I-V-vi-IV (C, G, Am, F) under a kick on every beat. Pop melodies love short lines (6 to 12 syllables), repeated hooks, and open vowels (ooh, ay, oh) on the long notes. Put the title in the chorus, at least twice.',
      tryLine: 'There\'s glitter in the gutter, there\'s a bassline in the rain' },
    { key: 'ballad', name: 'Piano Ballad', scene: 'pop', bpm: 72, steps: 16, per: 4, swing: 0, lines: 1, target: [5, 10],
      kick: 'x.......x.......', snare: '', rim: '....x.......x...', hat: '', chords: ['Am', 'F', 'C', 'G'], keys: 'arp', chordPat: 'x.x.x.x.x.x.x.x.',
      bass: 'x.......x.......', bassType: 'synth',
      feel: 'Slow, open, room to hold a note.',
      meter: 'one . . . two . . . (long notes)',
      theory: 'vi-IV-I-V (Am, F, C, G) is the sad-hopeful turn behind countless ballads. At a slow tempo, fewer syllables land harder: five to ten per bar, with the emotional word on the downbeat. Leave the last bar of a section empty so the song can breathe.',
      tryLine: 'Three little dots like footsteps on the phone' },
    { key: 'dembow', name: 'Dembow', scene: 'pop', bpm: 96, steps: 16, per: 4, swing: 0, lines: 1, target: [8, 14],
      kick: 'x...x...x...x...', snare: '...x..x....x..x.', hat: 'x.x.x.x.x.x.x.x.', chords: ['Am', 'F', 'C', 'G'], keys: 'pluck', chordPat: 'x.......x.......',
      bass: 'x...x...x...x...', bassType: '808',
      feel: 'The reggaeton heartbeat: boom-ch-boom-chick.',
      meter: 'BOOM-ch-BOOM-chick',
      theory: 'Dembow is a tresillo (3+3+2) on the snare over a steady kick. It pulls words into a bouncing 3-3-2 shape, so phrases that group syllables in threes ride it perfectly. Repetition is a feature: chant-like hooks win.',
      tryLine: 'Muévelo, muévelo, the whole street\'s in motion' },
    { key: 'disco', name: 'Disco Strut', scene: 'pop', bpm: 116, steps: 16, per: 4, swing: 0, lines: 1, target: [8, 12],
      kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'xxoxxxoxxxoxxxox', chords: ['Dm7', 'G7', 'Cmaj7', 'Am7'], keys: 'keys', chordPat: '..x...x...x...x.',
      bass: 'x.X.x.X.x.X.x.X.', bassType: 'synth',
      feel: 'Octave bass, open hats, mirror ball.',
      meter: 'ONE-and TWO-and (octave bounce)',
      theory: 'ii-V-I-vi in C (Dm7, G7, Cmaj7, Am7) borrowed from jazz, with an octave-jumping bass and open hats on the off-beats. Syncopated chord stabs leave gaps: fill them with call-and-response lines.',
      tryLine: 'Under the banana moon we move a little slower' },
    { key: 'iambic', name: 'Iambic Heartbeat', scene: 'poetry', bpm: 96, steps: 10, per: 2, swing: 0, lines: 1, target: [10, 10], beatsPerBar: 5, poetic: true,
      kick: '.x.x.x.x.x', tick: 'x.x.x.x.x.', chords: ['D', 'Bm', 'G', 'A'], keys: 'pad',
      feel: 'da-DUM five times: the sound of a sonnet.',
      meter: 'da-DUM da-DUM da-DUM da-DUM da-DUM',
      theory: 'Iambic pentameter: five iambs (unstressed-STRESSED) per line, ten syllables. Each bar here is one line: soft ticks for the unstressed syllables, a heartbeat for the stressed ones. Shakespeare\'s sonnets, Wordsworth, half of English poetry walk at this pace.',
      tryLine: 'I hold the hands of strangers until dawn' },
    { key: 'trochaic', name: 'Trochaic March', scene: 'poetry', bpm: 104, steps: 8, per: 2, swing: 0, lines: 1, target: [7, 8], poetic: true,
      kick: 'x.x.x.x.', tick: '.x.x.x.x', chords: ['Em', 'Em', 'C', 'D'], keys: 'pad',
      feel: 'DUM-da four times: spells, nursery rhymes, marches.',
      meter: 'DUM-da DUM-da DUM-da DUM-(da)',
      theory: 'Trochaic tetrameter: four trochees (STRESSED-unstressed), often with the last soft syllable dropped, so 7 or 8 syllables. It sounds like a chant or a spell ("Double, double, toil and trouble"). Starting every line on a strong beat makes it insistent.',
      tryLine: 'Tell the owls the house is sleeping' },
    { key: 'dactyl', name: 'Dactyl Waltz', scene: 'poetry', bpm: 92, steps: 6, per: 3, swing: 0, lines: 2, target: [11, 12], poetic: true,
      kick: 'x..x..', tick: '.xx.xx', chords: ['G', 'Em', 'C', 'D'], keys: 'keys', chordPat: 'x.....',
      feel: 'DUM-da-da, rolling like a waltz or a wave.',
      meter: 'DUM-da-da DUM-da-da DUM-da-da DUM-da',
      theory: 'Dactyls (STRESSED-unstressed-unstressed) roll in threes, like a waltz. Here a 6/8 bar holds two of them, and a line of four dactyls (dactylic tetrameter) spans two bars, often ending short: "Lanterns go drifting out over the harbor."',
      tryLine: 'Lanterns go drifting out over the harbor' },
    { key: 'anapest', name: 'Anapest Gallop', scene: 'poetry', bpm: 100, steps: 12, per: 3, swing: 0, lines: 1, target: [11, 12], poetic: true,
      kick: '..x..x..x..x', tick: 'xx.xx.xx.xx.', chords: ['C', 'Am', 'F', 'G'], keys: 'pluck', chordPat: 'x.....x.....',
      feel: 'da-da-DUM, galloping: limericks and bedtime stories.',
      meter: 'da-da-DUM da-da-DUM da-da-DUM da-da-DUM',
      theory: 'Anapests (unstressed-unstressed-STRESSED) gallop forward: "\'Twas the night before Christmas" rides them. Four anapests make twelve syllables per line, one bar here, each foot a triplet ending on the kick. Great for comic and narrative verse.',
      tryLine: 'There\'s a cat on the roof who collects every moon' }
  ];
  var BY = {};
  BEATS.forEach(function (b) { BY[b.key] = b; b.beatsPerBar = b.beatsPerBar || b.steps / b.per; });
  YB.BEATS = BEATS;
  YB.beat = function (key) { return BY[key] || BY.boombap; };

  /* ---------------------------------------------------------------- notes + chords */
  var NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  var QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7] };
  function chord(name) {
    var m = /^([A-G][b#]?)(.*)$/.exec(name) || [0, 'C', ''];
    var root = NOTE[m[1]], ints = QUAL[m[2]] || QUAL[''];
    var base = 48 + root + (root < 4 ? 12 : 0);
    return { root: root, notes: ints.map(function (i) { return base + i; }) };
  }
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  /* ---------------------------------------------------------------- the synth */
  var A = null;
  function audio() {
    if (!A) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      var ctx = new Ctx(), comp = ctx.createDynamicsCompressor(), master = ctx.createGain();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master.gain.value = UI.store.get('volume', 0.8);
      master.connect(comp); comp.connect(ctx.destination);
      var buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A = { ctx: ctx, master: master, noise: buf };
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
    return A;
  }
  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  function osc(type, f, t, dur, peak, attack, dest) {
    var o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    env(g, t, peak, attack || 0.005, dur);
    o.connect(g); g.connect(dest || A.master);
    o.start(t); o.stop(t + (attack || 0.005) + dur + 0.05);
    return o;
  }
  function noise(t, dur, peak, filter, freq, q) {
    var s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
    s.buffer = A.noise; f.type = filter; f.frequency.value = freq; if (q) f.Q.value = q;
    env(g, t, peak, 0.002, dur);
    s.connect(f); f.connect(g); g.connect(A.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  var V = {
    kick: function (t, v) { var o = osc('sine', 150, t, 0.42, 0.95 * v, 0.003); o.frequency.exponentialRampToValueAtTime(42, t + 0.13); },
    heart: function (t, v) { var o = osc('sine', 95, t, 0.3, 0.8 * v, 0.004); o.frequency.exponentialRampToValueAtTime(48, t + 0.12); noise(t, 0.03, 0.05 * v, 'lowpass', 900); },
    snare: function (t, v) { noise(t, 0.18, 0.5 * v, 'highpass', 1100); osc('triangle', 190, t, 0.09, 0.3 * v); },
    clap: function (t, v) { [0, 0.011, 0.022].forEach(function (d) { noise(t + d, d === 0.022 ? 0.16 : 0.02, 0.45 * v, 'bandpass', 1300, 0.9); }); },
    rim: function (t, v) { noise(t, 0.04, 0.35 * v, 'bandpass', 2600, 3); osc('square', 1700, t, 0.02, 0.05 * v); },
    tick: function (t, v) { noise(t, 0.035, 0.18 * v, 'bandpass', 3400, 4); osc('sine', 2200, t, 0.025, 0.05 * v); },
    hat: function (t, v, open) { noise(t, open ? 0.3 : 0.045, (open ? 0.16 : 0.22) * v, 'highpass', 7200); },
    crackle: function (t) { if (Math.random() < 0.35) noise(t + Math.random() * 0.1, 0.008, 0.06 + Math.random() * 0.08, 'highpass', 2500); },
    bass808: function (t, midi, dur) { var o = osc('sine', hz(midi + 2), t, dur, 0.75, 0.005); o.frequency.exponentialRampToValueAtTime(hz(midi), t + 0.06); },
    bassSynth: function (t, midi, dur) {
      var o = A.ctx.createOscillator(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(midi); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
      env(g, t, 0.28, 0.01, dur); o.connect(f); f.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.1);
    },
    keys: function (t, notes, dur) { notes.forEach(function (n) { osc('triangle', hz(n), t, dur, 0.09, 0.008); osc('sine', hz(n + 12), t, dur * 0.6, 0.03, 0.008); }); },
    pluck: function (t, notes, dur) {
      notes.forEach(function (n) {
        var o = A.ctx.createOscillator(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
        o.type = 'square'; o.frequency.value = hz(n + 12); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.25);
        env(g, t, 0.05, 0.004, Math.min(dur, 0.4)); o.connect(f); f.connect(g); g.connect(A.master); o.start(t); o.stop(t + 0.5);
      });
    },
    pad: function (t, notes, dur) {
      notes.forEach(function (n) {
        [-6, 6].forEach(function (cents) {
          var o = A.ctx.createOscillator(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = cents; f.type = 'lowpass'; f.frequency.value = 850;
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.022, t + Math.min(0.35, dur / 3));
          g.gain.setValueAtTime(0.022, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
          o.connect(f); f.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.3);
        });
      });
    }
  };

  /* ---------------------------------------------------------------- the player (lookahead scheduler) */
  function at(pat, bar, step, steps) {
    if (!pat) return '.';
    var bars = Math.max(1, Math.round(pat.length / steps));
    return pat.charAt((bar % bars) * steps + step) || '.';
  }
  var P = YB.player = { playing: false, key: null, bpm: 0, listeners: [], owner: null };
  var timer = null, nextTime = 0, step = 0, bar = 0, countIn = 0, arpI = 0;

  function emit(ev) { P.listeners.slice().forEach(function (fn) { try { fn(ev); } catch (e) { console.error(e); } }); }
  P.on = function (fn) { P.listeners.push(fn); return function () { P.listeners = P.listeners.filter(function (f) { return f !== fn; }); }; };
  P.stepDur = function (b, bpm) { return 60 / (bpm || b.bpm) / b.per; };

  function schedule(b, t) {
    var sd = P.stepDur(b, P.bpm), counting = bar < 0, accent;
    if (counting) {
      if (step % b.per === 0) (step === 0 ? V.rim : V.tick)(t, step === 0 ? 1 : 0.8);
      return;
    }
    function hit(pat, fn, vol) { var c = at(pat, bar, step, b.steps); if (c === 'x' || c === 'X') fn(t, c === 'X' ? vol * 1.2 : vol); return c; }
    hit(b.kick, b.poetic ? V.heart : V.kick, 1);
    hit(b.snare, V.snare, 0.9);
    hit(b.clap, V.clap, 0.8);
    hit(b.rim, V.rim, 0.7);
    hit(b.tick, V.tick, 1);
    var h = at(b.hat, bar, step, b.steps);
    accent = step % b.per === 0 ? 1 : 0.7;
    if (h === 'x' || h === 'X') V.hat(t, accent);
    else if (h === 'o') V.hat(t, 0.9, true);
    else if (h === 'r') { for (var r = 0; r < 3; r++) V.hat(t + r * sd / 3, 0.6); }
    if (b.crackle) V.crackle(t);
    var ch = chord(b.chords[((bar % b.chords.length) + b.chords.length) % b.chords.length]);
    var barDur = sd * b.steps;
    if (b.keys === 'pad' && step === 0) V.pad(t, ch.notes, barDur);
    else if (b.chordPat && at(b.chordPat, bar, step, b.steps) === 'x') {
      if (b.keys === 'arp') { V.keys(t, [ch.notes[arpI % ch.notes.length] + (arpI % 6 >= 3 ? 12 : 0)], sd * 3); arpI++; }
      else if (b.keys === 'pluck') V.pluck(t, ch.notes, sd * 2);
      else V.keys(t, ch.notes, sd * 4);
    }
    var bc = at(b.bass, bar, step, b.steps);
    if (bc === 'x' || bc === 'X') {
      var root = 36 + ch.root + (bc === 'X' ? 12 : 0);
      if (b.bassType === '808') V.bass808(t, root, sd * 5);
      else V.bassSynth(t, root, sd * 1.6);
    }
  }

  function tick() {
    var b = BY[P.key];
    if (!b || !A) return;
    var sd = P.stepDur(b, P.bpm);
    while (nextTime < A.ctx.currentTime + 0.12) {
      var swingDelay = (b.per % 2 === 0 && step % 2 === 1) ? b.swing * sd : 0;
      var t = nextTime + swingDelay;
      schedule(b, t);
      (function (ev, when) {
        setTimeout(function () { if (P.playing && P.key === ev.key) emit(ev); }, Math.max(0, (when - A.ctx.currentTime) * 1000));
      })({ type: 'step', key: P.key, step: step, bar: bar, steps: b.steps, per: b.per, counting: bar < 0 }, t);
      nextTime += sd;
      step++;
      if (step >= b.steps) { step = 0; bar++; }
    }
  }

  /* start(key, {bpm, countIn: bars, owner}) -> true if it started */
  P.start = function (key, opts) {
    opts = opts || {};
    P.stop(true);
    if (!audio()) { UI.toast('Your browser can\'t play sound here.', 'error'); return false; }
    var b = YB.beat(key);
    P.key = b.key; P.bpm = Math.max(50, Math.min(180, opts.bpm || b.bpm)); P.owner = opts.owner || null;
    countIn = opts.countIn || 0; step = 0; bar = -countIn; arpI = 0;
    nextTime = A.ctx.currentTime + 0.08;
    P.playing = true;
    timer = setInterval(tick, 25); tick();
    emit({ type: 'state', playing: true, key: P.key, owner: P.owner });
    return true;
  };
  P.stop = function (quiet) {
    if (timer) clearInterval(timer);
    timer = null;
    var was = P.playing;
    P.playing = false;
    if (was && !quiet) emit({ type: 'state', playing: false, key: P.key, owner: P.owner });
    if (was && quiet) emit({ type: 'state', playing: false, key: P.key, owner: P.owner, switching: true });
  };
  P.toggle = function (key, opts) {
    if (P.playing && P.key === key && (!opts || !opts.owner || opts.owner === P.owner)) { P.stop(); return false; }
    return P.start(key, opts);
  };
  P.setBpm = function (bpm) { P.bpm = Math.max(50, Math.min(180, bpm)); };
  P.setVolume = function (v) { UI.store.set('volume', v); if (A) A.master.gain.value = v; };
  P.volume = function () { return UI.store.get('volume', 0.8); };
  P.time = function () { return A ? A.ctx.currentTime : 0; };
  // Stop when leaving a page (route change) unless something asked to keep playing.
  window.addEventListener('hashchange', function () { if (P.playing) P.stop(); });

  /* ---------------------------------------------------------------- shared bits of UI */
  YB.beatChip = function (key, bpm, owner) {
    var b = YB.beat(key), on = P.playing && P.key === b.key && P.owner === (owner || null);
    return '<button type="button" class="yb-beatchip' + (on ? ' on' : '') + '" data-play-beat="' + b.key + '" data-bpm="' + (bpm || b.bpm) + '"' +
      (owner ? ' data-owner="' + UI.esc(owner) + '"' : '') + ' style="--bpm:' + (bpm || b.bpm) + '" aria-label="Play the ' + UI.esc(b.name) + ' beat">' +
      '<span class="pb">' + UI.icon(on ? 'stop' : 'play') + '</span><span class="bn">' + UI.esc(b.name) + '</span><span class="bpm">' + (bpm || b.bpm) + '</span></button>';
  };
  YB.stepsHtml = function (b) {
    var out = '';
    for (var i = 0; i < b.steps; i++) {
      var strong = b.poetic ? at(b.kick, 0, i, b.steps) === 'x' : i % b.per === 0;
      out += '<i data-s="' + i + '" class="' + (strong ? 'acc' : '') + (i === 0 ? ' beat1' : '') + '"></i>';
    }
    return '<div class="yb-steps" style="--n:' + b.steps + '">' + out + '</div>';
  };
  // Light up the step grids inside `root` while the player runs. Returns an unsubscribe function.
  // onlyKey (optional): only while that beat plays (Components/Steps passes its own beat, so the Beats page lights one card).
  YB.lightSteps = function (root, onlyKey) {
    return P.on(function (ev) {
      var off = ev.type === 'state' && !ev.playing || (onlyKey && ev.key !== onlyKey);
      if (off) { root.querySelectorAll('.yb-steps i.now').forEach(function (i) { i.classList.remove('now'); }); return; }
      if (ev.type !== 'step') return;
      root.querySelectorAll('.yb-steps').forEach(function (g) {
        var on = g.querySelector('i.now'); if (on) on.classList.remove('now');
        var cell = g.querySelector('i[data-s="' + ev.step + '"]'); if (cell && !ev.counting) cell.classList.add('now');
      });
    });
  };
  // Any [data-play-beat] button anywhere toggles that beat.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-play-beat]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    P.toggle(b.getAttribute('data-play-beat'), { bpm: +b.getAttribute('data-bpm') || null, owner: b.getAttribute('data-owner') || null });
  }, true);
  P.on(function (ev) {
    if (ev.type !== 'state') return;
    document.querySelectorAll('[data-play-beat]').forEach(function (btn) {
      var on = ev.playing && btn.getAttribute('data-play-beat') === ev.key && (btn.getAttribute('data-owner') || null) === (ev.owner || null);
      btn.classList.toggle('on', on);
      var pb = btn.querySelector('.pb'); if (pb) pb.innerHTML = UI.icon(on ? 'stop' : 'play');
    });
  });
})();
