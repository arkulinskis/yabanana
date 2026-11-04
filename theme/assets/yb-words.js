/* yb-words.js: the writing helpers, all from prepared dictionaries (no AI):
   _/theme/rhymes.txt (CMU Pronouncing Dictionary, 24k common words), _/theme/wordbank.json (hand-written).
   YB.words: load, syllables, stress, rhymes (perfect / near / multi), meter, rhyme scheme + highlights.
   YB.helper(el, opts): the tabbed helper panel (Components/Helper wraps it). Moved from web/pages/_words.html. */
(function () {
  'use strict';
  var YB = window.YB = window.YB || {};
  var W = YB.words = { ready: false };
  var DATA_V = '1';
  var VOW = ['AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER', 'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW'];
  var dict = null, order = [], loading = null, idx = null;

  W.load = function () {
    if (dict) return Promise.resolve(W);
    if (loading) return loading;
    loading = fetch('_/theme/rhymes.txt?v=' + DATA_V).then(function (r) { if (!r.ok) throw new Error('Could not load the rhyme dictionary.'); return r.text(); }).then(function (txt) {
      dict = new Map();
      txt.split('\n').forEach(function (line, i) {
        var tab = line.indexOf('\t');
        if (tab < 1) return;
        var w = line.slice(0, tab);
        dict.set(w, { r: i, c: line.slice(tab + 1) });
        order.push(w);
      });
      W.ready = true;
      return W;
    });
    loading.catch(function () { loading = null; });
    return loading;
  };

  /* phones(word) -> [{v: true, p: 'AY', s: 1} | {v: false, p: 'k'}] or null */
  function decode(code) {
    var out = [];
    for (var i = 0; i < code.length; i++) {
      var ch = code.charAt(i);
      if (ch >= 'A' && ch <= 'O') { out.push({ v: true, p: ch, s: +code.charAt(i + 1) }); i++; }
      else out.push({ v: false, p: ch });
    }
    return out;
  }
  function clean(w) { return String(w || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, '').replace(/^'+|'+$/g, ''); }
  W.clean = clean;
  function entry(word) {
    if (!dict) return null;
    var w = clean(word), e = dict.get(w);
    if (e) return e;
    // simple plurals / possessives / -in' endings
    if (/'s$/.test(w) && dict.get(w.slice(0, -2))) { var b = dict.get(w.slice(0, -2)); return { r: b.r, c: b.c + 'x' }; }
    if (/in'$/.test(w) && dict.get(w.slice(0, -1) + 'g')) { var g = dict.get(w.slice(0, -1) + 'g'); return { r: g.r, c: g.c.replace(/m$/, 'l') }; }
    if (/s$/.test(w) && dict.get(w.slice(0, -1))) { var s = dict.get(w.slice(0, -1)); return { r: s.r, c: s.c + 'x' }; }
    return null;
  }
  W.known = function (word) { return !!entry(word); };
  W.phones = function (word) { var e = entry(word); return e ? decode(e.c) : null; };

  /* Syllables: from the dictionary, else a spelling rule. */
  function guessSyl(w) {
    w = clean(w).replace(/'/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    var m = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }
  W.syllables = function (word) {
    var p = W.phones(word);
    return p ? p.filter(function (x) { return x.v; }).length : guessSyl(word);
  };
  /* Stress for a word, one char per syllable: '1' stressed / '0' unstressed (from the dictionary), '?' unknown.
     One-syllable words bend with the line, so they get a softer guess: 'u' (little words: the, of, my…) or 's'. */
  W.stress = function (word) {
    var p = W.phones(word);
    if (!p) { var n = guessSyl(word); return n === 1 ? (STOP.has(clean(word)) ? 'u' : 's') : new Array(n + 1).join('?'); }
    var s = p.filter(function (x) { return x.v; }).map(function (x) { return x.s === 0 ? '0' : '1'; }).join('');
    return s.length === 1 ? (STOP.has(clean(word)) ? 'u' : 's') : s;
  };

  function lastStressed(p) {
    var last = -1, lastAny = -1;
    p.forEach(function (x, i) { if (x.v) { lastAny = i; if (x.s === 1) last = i; } });
    if (last < 0) p.forEach(function (x, i) { if (x.v && x.s === 2) last = i; });
    return last >= 0 ? last : lastAny;
  }
  function rkey(p) { var i = lastStressed(p); return i < 0 ? '' : p.slice(i).map(function (x) { return x.p; }).join(''); }
  function vkey(p) { var i = lastStressed(p); return i < 0 ? '' : p.slice(i).filter(function (x) { return x.v; }).map(function (x) { return x.p; }).join(''); }
  function tailV(p, n) { var v = p.filter(function (x) { return x.v; }).map(function (x) { return x.p; }); return v.length >= n ? v.slice(-n).join('') : ''; }
  W.rhymeKey = function (word) { var p = W.phones(word); return p ? rkey(p) : ''; };

  function buildIndex() {
    if (idx) return idx;
    idx = { r: new Map(), v: new Map(), t2: new Map(), t3: new Map() };
    function add(m, k, w) { if (!k) return; var a = m.get(k); if (!a) m.set(k, a = []); a.push(w); }
    order.forEach(function (w) {
      var p = decode(dict.get(w).c);
      add(idx.r, rkey(p), w); add(idx.v, vkey(p), w); add(idx.t2, tailV(p, 2), w); add(idx.t3, tailV(p, 3), w);
    });
    return idx;
  }

  /* rhymes(text) -> {word, known, syllables, perfect: [[word, syl]...], near, multi} (most common first) */
  W.rhymes = function (text, limit) {
    limit = limit || 60;
    var words = String(text || '').trim().split(/\s+/).map(clean).filter(Boolean);
    var word = words[words.length - 1] || '';
    var res = { word: word, known: false, syllables: 0, perfect: [], near: [], multi: [], spelled: [] };
    if (!word || !dict) return res;
    buildIndex();
    var p = W.phones(word), seen = new Set([word]);
    res.syllables = W.syllables(word);
    function take(list, max) {
      var out = [];
      for (var i = 0; i < (list || []).length && out.length < max; i++) {
        var w = list[i];
        if (seen.has(w) || w.length < 2 && w !== 'i' && w !== 'a') continue;
        seen.add(w); out.push([w, W.syllables(w)]);
      }
      return out;
    }
    if (p) {
      res.known = true;
      res.perfect = take(idx.r.get(rkey(p)), limit);
      // near rhymes: same vowel sounds; the ones ending on a similar consonant first (heart: hard, dark, charge…), no filler words
      function coda(ph) { var out = []; for (var k = ph.length - 1; k >= 0 && !ph[k].v; k--) out.unshift(ph[k].p); return out; }
      var cd = coda(p), endC = cd.length ? cd[cd.length - 1] : '';
      // consonant letters as in tools/build_words.py: B=a CH=b D=c DH=d F=e G=f HH=g JH=h K=i L=j M=k N=l NG=m P=n R=o S=p SH=q T=r TH=s V=t W=u Y=v Z=w ZH=x
      var CLS = { a: 'stop', c: 'stop', f: 'stop', i: 'stop', n: 'stop', r: 'stop', k: 'nasal', l: 'nasal', m: 'nasal', j: 'liquid', o: 'liquid',
                  b: 'fric', d: 'fric', e: 'fric', h: 'fric', p: 'fric', q: 'fric', s: 'fric', t: 'fric', w: 'fric', x: 'fric' };
      var near = (idx.v.get(vkey(p)) || []).filter(function (w) { return !STOP.has(w) && w.length > 1; }).map(function (w, i) {
        var c2 = coda(decode(dict.get(w).c)), lc = c2.length ? c2[c2.length - 1] : '', sc = 0;
        if (lc === endC) sc += 2; else if (lc && endC && CLS[lc] && CLS[lc] === CLS[endC]) sc += 1;
        if (cd.length && c2.length && c2[0] === cd[0]) sc += 2;   // heart / hard: same R after the vowel
        if (!!lc !== !!endC) sc -= 2;
        return [w, sc, i];
      }).sort(function (x, y) { return y[1] - x[1] || x[2] - y[2]; }).map(function (x) { return x[0]; });
      res.near = take(near, Math.round(limit * 0.6));
      // multis: match the vowel sounds of the last 2-3 syllables of the whole phrase
      var all = [];
      words.slice(-3).forEach(function (w) { var ph = W.phones(w); if (ph) all = all.concat(ph); });
      var nv = all.filter(function (x) { return x.v; }).length;
      if (nv >= 3) res.multi = take(idx.t3.get(tailV(all, 3)), 30);
      if (nv >= 2 && res.multi.length < 12) res.multi = res.multi.concat(take(idx.t2.get(tailV(all, 2)), 30 - res.multi.length));
    } else {
      var end = word.slice(-3);
      res.spelled = take(order.filter(function (w) { return w.slice(-3) === end; }), limit);
    }
    return res;
  };

  /* A line's analysis: syllables, stress string, words. */
  W.line = function (text) {
    var toks = String(text || '').match(/[A-Za-z’'À-ÿ]+(?:[-’'][A-Za-z]+)*/g) || [];
    var syl = 0, stress = '';
    toks.forEach(function (t) {
      t.split('-').forEach(function (part) { var s = W.stress(part); stress += s; syl += s.length; });
    });
    return { words: toks, syllables: syl, stress: stress };
  };
  var FEET = [['iambic', '01', 'da-DUM'], ['trochaic', '10', 'DUM-da'], ['anapestic', '001', 'da-da-DUM'], ['dactylic', '100', 'DUM-da-da']];
  /* Best-fitting foot for a stress string. Dictionary stresses count fully, one-syllable guesses (u/s) count less,
     '?' not at all. */
  W.meter = function (stress) {
    var known = stress.replace(/[?us]/g, '').length + stress.replace(/[^us]/g, '').length * 0.6;
    if (stress.length < 4 || known < 3) return null;
    var best = null;
    FEET.forEach(function (f) {
      for (var off = 0; off < f[1].length; off++) {
        var hit = 0, tot = 0;
        for (var i = 0; i < stress.length; i++) {
          var c = stress.charAt(i); if (c === '?') continue;
          var wt = c === 'u' || c === 's' ? 0.6 : 1, v = c === 'u' ? '0' : c === 's' ? '1' : c;
          tot += wt; if (v === f[1].charAt((i + off) % f[1].length)) hit += wt;
        }
        var score = (tot ? hit / tot : 0) - off * 0.04;  // prefer lines that start on the foot's first syllable
        if (!best || score > best.score) best = { name: f[0], foot: f[2], score: score, feet: Math.round(stress.length / f[1].length) };
      }
    });
    return best && best.score >= 0.72 ? best : null;
  };
  W.stressMarks = function (stress) { return stress.split('').map(function (c) { return c === '1' || c === 's' ? '●' : c === '0' || c === 'u' ? '○' : '◌'; }).join(''); };

  var STOP = new Set(('a an the and or but of to in on at by for from with as is am are was were be been it its i me my you your he him his she her we us our ' +
    'they them their this that these those so if do does did not no yes oh ooh ah yeah uh hey la na who what when where how than then can will would could ' +
    "should has have had there there's it's i'm you're they're we're i'll into onto upon just").split(" "));
  /* scheme(lines) -> letters per line (A, B, ...; '' for blank) + word highlight classes.
     marks: [[{w, cls}]...] per line, one entry per word token, cls '' or 'rh0'..'rh7'. */
  W.scheme = function (lines) {
    var letters = [], keys = [], vks = [], next = 0;
    var toks = lines.map(function (l) { return String(l || '').match(/[A-Za-z’'À-ÿ]+(?:[-’'][A-Za-z]+)*|[^A-Za-z’'À-ÿ]+/g) || []; });
    lines.forEach(function (l, i) {
      var words = toks[i].filter(function (t) { return /[A-Za-z]/.test(t); });
      if (!words.length) { letters.push(''); keys.push(null); vks.push(null); return; }
      var last = words[words.length - 1].split('-').pop(), p = W.phones(last);
      var k = p ? rkey(p) : clean(last).slice(-3), v = p ? vkey(p) : null, L = '';
      for (var j = 0; j < i; j++) {
        if (keys[j] && keys[j] === k) { L = letters[j]; break; }
      }
      if (!L && v) for (var m = 0; m < i; m++) { if (vks[m] && vks[m] === v) { L = letters[m]; break; } }
      if (!L) L = String.fromCharCode(65 + (next++ % 26));
      letters.push(L); keys.push(k); vks.push(v);
    });
    // word highlights: words sharing a rhyme sound (distinct words, not filler). Perfect rhymes group by the sound
    // from the last stressed vowel; words of 2+ syllables also group by their vowels alone (slower / over / closer).
    var groups = new Map(), loose = new Map();
    toks.forEach(function (ts, li) {
      ts.forEach(function (t, ti) {
        if (!/[A-Za-z]/.test(t)) return;
        var w = clean(t.split('-').pop());
        if (w.length < 2 || STOP.has(w)) return;
        var p = W.phones(w); if (!p) return;
        var k = rkey(p); if (!k || k.length < 2) return;
        var g = groups.get(k); if (!g) groups.set(k, g = { words: new Set(), at: [] });
        g.words.add(w); g.at.push([li, ti]);
        var v = vkey(p);
        if (v.length >= 2) { var h = loose.get(v); if (!h) loose.set(v, h = { words: new Set(), at: [] }); h.words.add(w); h.at.push([li, ti]); }
      });
    });
    var cls = {}, color = 0;
    function paint(list) {
      list.filter(function (g) { return g.words.size >= 2; }).sort(function (a, b) { return b.at.length - a.at.length; }).forEach(function (g) {
        var free = g.at.filter(function (a) { return !cls[a[0] + ':' + a[1]]; });
        if (color >= 8 || free.length < 2) return;
        var c = 'rh' + (color++);
        free.forEach(function (a) { cls[a[0] + ':' + a[1]] = c; });
      });
    }
    paint(Array.from(groups.values()));
    paint(Array.from(loose.values()));
    var marks = toks.map(function (ts, li) { return ts.map(function (t, ti) { return { w: t, cls: cls[li + ':' + ti] || '' }; }); });
    return { letters: letters, marks: marks };
  };
  W.markHtml = function (marks) {
    return marks.map(function (m) { return m.cls ? '<span class="' + m.cls + '">' + UI.esc(m.w) + '</span>' : UI.esc(m.w); }).join('');
  };

  /* ---------------------------------------------------------------- the word bank */
  var bank = null, bankLoading = null;
  YB.bank = function () {
    if (bank) return Promise.resolve(bank);
    if (!bankLoading) {
      bankLoading = fetch('_/theme/wordbank.json?v=' + DATA_V).then(function (r) { if (!r.ok) throw new Error('Could not load the word bank.'); return r.json(); })
        .then(function (b) { bank = b; return b; });
      bankLoading.catch(function () { bankLoading = null; });
    }
    return bankLoading;
  };
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  YB.pick = pick;
  YB.shuffleArr = function (a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------------------------------------------------------------- the helper panel
     YB.helper(el, {onInsert(text), getWord() -> current word, scene, compact}) -> {setWord(w), show(tab)} */
  var TABS = [['rhymes', 'Rhymes'], ['similes', 'Similes'], ['metaphors', 'Metaphors'], ['themes', 'Themes'], ['sparks', 'Sparks']];
  YB.helper = function (el, opts) {
    opts = opts || {};
    var esc = UI.esc, tab = UI.store.get('helperTab', 'rhymes'), q = '', themeSel = null, mixSeed = 0, sparkScene = opts.scene || '';
    if (!TABS.some(function (t) { return t[0] === tab; })) tab = 'rhymes';
    el.classList.add('yb-help');
    // A group of toggle buttons (app-kit.js gives them aria-pressed), not a tablist: there are no real tab panels.
    el.innerHTML = '<div class="ui-tabs" role="group" aria-label="Writing helpers">' + TABS.map(function (t) { return '<button type="button" data-htab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<form class="yb-help-q" data-hq role="search"><input type="search" name="q" autocomplete="off" aria-label="Search the helpers" placeholder="A word…"><button class="ui-btn sm" type="submit" aria-label="Search">' + UI.icon('search') + '</button></form>' +
      '<div class="yb-help-body" data-hbody></div>';
    var body = el.querySelector('[data-hbody]'), input = el.querySelector('[name=q]');

    function placeholder() {
      input.placeholder = { rhymes: 'Rhyme with… (a word or phrase)', similes: 'An adjective: cold, sweet, lost…', metaphors: 'A concept: love, time, the city…', themes: 'Filter words…', sparks: '' }[tab];
      el.querySelector('[data-hq]').hidden = tab === 'sparks';
    }
    function words(list, topN) {
      return '<div class="yb-words">' + list.map(function (x, i) {
        return '<button type="button" class="yb-word' + (i < (topN || 0) ? ' top' : '') + '" data-ins="' + esc(x[0]) + '">' + esc(x[0]) + (x[1] ? '<small>' + x[1] + '</small>' : '') + '</button>';
      }).join('') + '</div>';
    }
    function phrases(list) {
      return '<div class="yb-phrases">' + list.map(function (t) { return '<button type="button" class="yb-phrase" data-ins="' + esc(t.ins || t) + '">' + (t.html || esc(t)) + '</button>'; }).join('') + '</div>';
    }
    function drawRhymes() {
      if (!q) { body.innerHTML = '<p class="hint">Type a word, or put your cursor on a word in your lyrics: rhymes appear here. Click one to drop it in.</p>' +
        '<p class="hint"><b>Perfect</b> rhymes match the last stressed sound (night / light). <b>Near</b> rhymes share the vowel (night / time). <b>Multis</b> match the last two or three vowel sounds (broken heart / open art): the rapper\'s favourite.</p>'; return; }
      body.innerHTML = '<div class="ui-skel" style="min-height:120px"></div>';
      return W.load().then(function () {
        var r = W.rhymes(q);
        var groups = [1, 2, 3].map(function (n) { return r.perfect.filter(function (x) { return n === 3 ? x[1] >= 3 : x[1] === n; }); });
        var html = '<p class="hint"><b>' + esc(r.word) + '</b> · ' + UI.plural(r.syllables, 'syllable') + (r.known ? ' · ' + W.stressMarks(W.stress(r.word)) : ' · not in the dictionary, so these are spelling matches') + '</p>';
        if (r.known) {
          html += r.perfect.length ? groups.map(function (g, i) { return g.length ? '<h4>Perfect · ' + ['1 syllable', '2 syllables', '3+ syllables'][i] + '</h4>' + words(g, 6) : ''; }).join('') : '<h4>Perfect</h4><p class="hint">No perfect rhymes in the dictionary. Try the near rhymes below.</p>';
          if (r.near.length) html += '<h4>Near rhymes (same vowel)</h4>' + words(r.near);
          if (r.multi.length) html += '<h4>Multis (same last vowel sounds)</h4>' + words(r.multi);
        } else if (r.spelled.length) html += '<h4>Spelled alike</h4>' + words(r.spelled);
        else html += '<p class="hint">Nothing found. Check the spelling, or try another word.</p>';
        body.innerHTML = html;
      }, function (e) { body.innerHTML = '<p class="ui-error">' + esc(e.message) + '</p>'; });
    }
    function drawSimiles(b) {
      var keys = Object.keys(b.similes);
      var k = q.toLowerCase().trim();
      var hit = keys.filter(function (x) { return k && (x === k || x.indexOf(k) === 0); });
      var html = '<div class="yb-chips">' + YB.shuffleArr(keys).slice(0, 14).map(function (x) { return '<button type="button" data-hpick="' + esc(x) + '" class="' + (x === hit[0] ? 'on' : '') + '">' + esc(x) + '</button>'; }).join('') + '</div>';
      if (hit.length) html += hit.slice(0, 3).map(function (x) { return '<h4>' + esc(x) + '</h4>' + phrases(b.similes[x]); }).join('');
      else {
        var found = [];
        keys.forEach(function (x) { b.similes[x].forEach(function (s) { if (k && s.toLowerCase().indexOf(k) >= 0) found.push(s); }); });
        html += k ? (found.length ? '<h4>Similes with "' + esc(k) + '"</h4>' + phrases(found.slice(0, 20)) : '<p class="hint">No similes for "' + esc(k) + '" yet. Try one of the words above.</p>')
          : '<h4>A few to start</h4>' + phrases(YB.shuffleArr([].concat.apply([], keys.map(function (x) { return b.similes[x]; }))).slice(0, 6));
      }
      body.innerHTML = html;
    }
    function drawMetaphors(b) {
      var keys = Object.keys(b.metaphors), k = q.toLowerCase().trim();
      var key = keys.filter(function (x) { return k && (x === k || x.replace(/^the /, '') === k.replace(/^the /, '') || x.indexOf(k) >= 0); })[0];
      var html = '<div class="yb-chips">' + keys.map(function (x) { return '<button type="button" data-hpick="' + esc(x) + '" class="' + (x === key ? 'on' : '') + '">' + esc(x) + '</button>'; }).join('') + '</div>';
      function line(concept, be, m) { var t = cap(concept) + ' ' + be + ' ' + m[0] + ' ' + m[1]; return { ins: t, html: esc(cap(concept)) + ' ' + be + ' <b>' + esc(m[0]) + '</b> ' + esc(m[1]) }; }
      var concept = key || k;
      if (key) html += '<h4>' + esc(key) + '</h4>' + phrases(b.metaphors[key].list.map(function (m) { return line(key, b.metaphors[key].be, m); }));
      if (concept) {
        var pool = [];
        keys.forEach(function (x) { if (x !== key) b.metaphors[x].list.forEach(function (m) { pool.push(m); }); });
        var be = key ? b.metaphors[key].be : (/s$/.test(concept) && !/ss$/.test(concept) ? 'are' : 'is');
        var rnd = YB.shuffleArr(pool).slice(0, 6);
        html += '<h4 class="ui-row between" style="display:flex">Metaphor machine <button type="button" class="ui-btn ghost sm" data-hmix>' + UI.icon('refresh') + 'Remix</button></h4>' +
          '<p class="hint">Your concept, with images borrowed from other ideas. Strange is good.</p>' + phrases(rnd.map(function (m) { return line(concept, be, m); }));
      } else html += '<p class="hint">Pick a concept above or type your own (your own concept goes through the metaphor machine).</p>';
      body.innerHTML = html;
    }
    function drawThemes(b) {
      var names = Object.keys(b.themes);
      themeSel = themeSel || names[0];
      var th = b.themes[themeSel], k = q.toLowerCase().trim();
      function f(list) { return list.filter(function (w) { return !k || w.toLowerCase().indexOf(k) >= 0; }).map(function (w) { return [w]; }); }
      body.innerHTML = '<div class="yb-chips">' + names.map(function (n) { return '<button type="button" data-htheme="' + esc(n) + '" class="' + (n === themeSel ? 'on' : '') + '">' + esc(n) + '</button>'; }).join('') + '</div>' +
        '<h4>Nouns</h4>' + words(f(th.nouns)) + '<h4>Verbs</h4>' + words(f(th.verbs)) + '<h4>Adjectives</h4>' + words(f(th.adjectives)) +
        '<h4>Images</h4>' + phrases(th.images.filter(function (w) { return !k || w.toLowerCase().indexOf(k) >= 0; }));
    }
    function drawSparks(b) {
      var list = b.sparks.filter(function (s) { return !sparkScene || !s.scene || s.scene === sparkScene; });
      body.innerHTML = '<div class="yb-chips">' + [['', 'All'], ['rap', 'Rap'], ['poetry', 'Poetry'], ['pop', 'Pop']].map(function (s) {
        return '<button type="button" data-hspark="' + s[0] + '" class="' + (s[0] === sparkScene ? 'on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div>' +
        '<p class="hint">Stuck? Take a spark. Click one to copy it into your notes as a comment.</p>' +
        phrases(YB.shuffleArr(list).slice(0, 6).map(function (s) { return { ins: '(' + s.text + ')', html: esc(s.text) }; })) +
        '<div style="margin-top:10px"><button type="button" class="ui-btn sm" data-hmix>' + UI.icon('refresh') + 'More sparks</button></div>';
    }
    function draw() {
      el.querySelectorAll('[data-htab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-htab') === tab); });
      placeholder();
      if (tab === 'rhymes') return drawRhymes();
      body.innerHTML = '<div class="ui-skel" style="min-height:120px"></div>';
      return YB.bank().then(function (b) {
        ({ similes: drawSimiles, metaphors: drawMetaphors, themes: drawThemes, sparks: drawSparks })[tab](b);
      }, function (e) { body.innerHTML = '<p class="ui-error">' + esc(e.message) + '</p>'; });
    }
    el.addEventListener('click', function (e) {
      var t = e.target.closest('[data-htab]');
      if (t) { tab = t.getAttribute('data-htab'); UI.store.set('helperTab', tab); if (tab === 'themes' || tab === 'sparks') { q = ''; input.value = ''; } draw(); return; }
      var ins = e.target.closest('[data-ins]');
      if (ins) { if (opts.onInsert) opts.onInsert(ins.getAttribute('data-ins')); return; }
      var pk = e.target.closest('[data-hpick]');
      if (pk) { q = pk.getAttribute('data-hpick'); input.value = q; draw(); return; }
      var th = e.target.closest('[data-htheme]');
      if (th) { themeSel = th.getAttribute('data-htheme'); draw(); return; }
      var sp = e.target.closest('[data-hspark]');
      if (sp) { sparkScene = sp.getAttribute('data-hspark'); draw(); return; }
      if (e.target.closest('[data-hmix]')) { mixSeed++; draw(); }
    });
    el.querySelector('[data-hq]').addEventListener('submit', function (e) { e.preventDefault(); q = input.value.trim(); draw(); });
    var deb = null;
    input.addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(function () { q = input.value.trim(); draw(); }, 250); });
    draw();
    return {
      setWord: function (w) {
        w = String(w || '').trim();
        if (!w || w === q || tab === 'sparks' || tab === 'themes') return;
        if (tab === 'similes' || tab === 'metaphors') return;  // those follow the search box only
        q = w; input.value = w; draw();
      },
      show: function (t, word) { tab = t; if (word != null) { q = word; input.value = word; } draw(); },
      setScene: function (s) { sparkScene = s; if (tab === 'sparks') draw(); }
    };
  };

  /* ---------------------------------------------------------------- hooks for the Python side (client_code/yb.py)
     A JS promise handed to Python is awaited on the spot, so Python asks for a callback instead. */
  YB.whenWords = function (cb) { W.load().then(function () { cb(null); }, function (e) { cb(String(e && e.message || e)); }); };
  YB.mountHelper = function (el, scene, onInsert) { return YB.helper(el, { scene: scene || '', onInsert: function (t) { onInsert(t); } }); };

  /* ---------------------------------------------------------------- line read-outs (redrawn on every keystroke)
     Moved here from the old studio and lab pages: they analyse each line with the dictionary, so they stay next to it.
     YB.target(beatKey, barsPerLine) -> [min, max] syllables per line for that beat at that line length. */
  var POETIC = { iambic: 'iambic', trochaic: 'trochaic', dactyl: 'dactylic', anapest: 'anapestic' };
  YB.target = function (beatKey, barsPerLine) {
    var b = YB.beat(beatKey), k = (barsPerLine || 1) / (b.lines || 1);
    return [Math.max(1, Math.round(b.target[0] * k)), Math.max(1, Math.round(b.target[1] * k))];
  };
  /* The Studio's flow strip under a section: syllables per line vs the beat's target, rhyme letters, meter on poetry beats. */
  YB.flowHtml = function (text, beatKey, barsPerLine) {
    var esc = UI.esc, lines = String(text || '').split('\n'), t = YB.target(beatKey, barsPerLine), poetic = POETIC[beatKey];
    var sch = W.ready ? W.scheme(lines) : null;
    var chips = lines.map(function (l, i) {
      if (!l.trim()) return '';
      var a = W.line(l), ok = a.syllables >= t[0] && a.syllables <= t[1];
      var m = poetic && W.ready ? W.meter(a.stress) : null;
      var tip = a.syllables + ' syllables' + (m ? ', ' + m.name : '') + ' · ' + W.stressMarks(a.stress);
      return '<span class="sd-chip ' + (ok ? 'ok' : 'off') + '" title="' + esc(tip) + '">' + a.syllables + (sch && sch.letters[i] ? '<sup>' + esc(sch.letters[i]) + '</sup>' : '') + '</span>' +
        (poetic && m ? '<span class="sd-chip m" title="' + esc(tip) + '">' + (m.name === poetic ? '✓ ' : '') + esc(m.name.slice(0, 4)) + '</span>' : '');
    }).join('');
    return chips ? '<span class="lbl">Syllables/line · aim ' + t[0] + (t[1] !== t[0] ? '–' + t[1] : '') + '</span>' + chips : '<span class="lbl">Syllable counts and rhyme letters show up here as you write.</span>';
  };
  /* The Rhyme lab's line checker: per line the syllables, stress marks, meter and rhyme letter, rhyming words coloured. */
  YB.checkHtml = function (text) {
    var esc = UI.esc, lines = String(text || '').split('\n');
    if (!W.ready) return '<div class="ui-skel" style="min-height:80px"></div>';
    var sch = W.scheme(lines);
    return lines.map(function (l, i) {
      if (!l.trim()) return '';
      var a = W.line(l), m = W.meter(a.stress);
      return '<div class="yb-meter-line"><span class="n">' + a.syllables + '</span><div><div class="t">' + W.markHtml(sch.marks[i]) + ' <b class="faint small">' + esc(sch.letters[i]) + '</b></div>' +
        '<div class="s"><span class="yb-stress">' + W.stressMarks(a.stress) + '</span>' + (m ? ' · ' + esc(m.name) + ' (' + esc(m.foot) + ' ×' + m.feet + ')' : '') + '</div></div></div>';
    }).join('') || '<p class="muted small">Write something above.</p>';
  };
})();
