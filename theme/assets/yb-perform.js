/* yb-perform.js: Perform mode. YB.perform(song) opens a full-screen stage: the beat plays (one bar of count-in),
   the lyrics scroll one line per bar (or 1/2 / 2 bars), and the words light up in step, weighted by syllables.
   Space plays/stops, Esc closes. Moved unchanged from web/pages/_perform.html. */
(function () {
  'use strict';
  var YB = window.YB = window.YB || {};
  var esc = UI.esc;

  YB.perform = function (song) {
    var P = YB.player, b = YB.beat(song.beat), bpm = song.bpm || b.bpm;
    var bpl = song.bars_per_line || b.lines || 1;
    var lines = [];
    (song.sections || []).forEach(function (s) {
      (s.text || '').split('\n').forEach(function (l, i) { if (l.trim()) lines.push({ text: l.trim(), kind: lines.length && lines[lines.length - 1].sec === s ? '' : s.kind, sec: s }); });
    });
    if (!lines.length) { UI.toast('Write a few lines first, then perform them.'); return; }
    var weights = lines.map(function (l) {
      return (l.text.match(/\S+/g) || []).map(function (w) { return { w: w, n: Math.max(1, YB.words.syllables(w)) }; });
    });
    var wrap = document.createElement('div');
    wrap.className = 'ui yb-stage sc-' + esc(song.scene || 'rap');
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Perform mode');
    wrap.innerHTML = '<div class="yb-stage-top"><div class="grow"><h2>' + esc(song.title || 'Untitled') + '</h2><div class="sub">' +
      (song.author ? 'by ' + esc(song.author.name) + ' · ' : '') + esc(b.name) + ' · <span data-bpm>' + bpm + '</span> BPM · ' + esc(b.meter) + '</div></div>' +
      '<button class="x" data-close aria-label="Close">' + UI.icon('x') + '</button></div>' +
      '<div class="yb-stage-mid" data-mid></div>' +
      '<div class="yb-stage-bot">' + YB.stepsHtml(b) +
      '<div class="yb-stage-ctl"><button class="ui-btn primary lg" data-play>' + UI.icon('play') + 'Play</button>' +
      '<span class="lbl">Bars per line</span><div class="ui-seg" data-bpl>' + [[0.5, '½'], [1, '1'], [2, '2']].map(function (o) {
        return '<button type="button" data-v="' + o[0] + '" class="' + (o[0] === bpl ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<span class="lbl">Tempo</span><span class="tempo"><button type="button" data-tempo="-4" aria-label="Slower">−</button><span data-bpm>' + bpm + '</span><button type="button" data-tempo="4" aria-label="Faster">+</button></span>' +
      '</div></div>';
    document.body.appendChild(wrap);
    document.documentElement.classList.add('ui-modal-open');
    var mid = wrap.querySelector('[data-mid]'), playBtn = wrap.querySelector('[data-play]'), cur = -1, unsub = [], ended = false;

    function lineHtml(i, cls) { return '<div class="' + cls + '">' + (lines[i] ? esc(lines[i].text) : '&nbsp;') + '</div>'; }
    function show(i) {
      cur = i;
      var L = lines[i];
      mid.innerHTML = lineHtml(i - 1, 'prev') + '<div class="kind">' + esc(L.kind || L.sec.kind) + '</div>' +
        '<div class="cur">' + weights[i].map(function (x, k) { return '<span class="w" data-k="' + k + '">' + esc(x.w) + '</span>'; }).join(' ') + '</div>' +
        '<div class="bar"><i></i></div>' + lineHtml(i + 1, 'next') + lineHtml(i + 2, 'next2');
    }
    function idle(msg) {
      mid.innerHTML = '<div class="kind">' + esc(b.name) + ' · ' + esc(b.feel) + '</div><div class="cur" style="color:#f6f1e4">' + esc(msg) + '</div>' +
        '<div class="next">' + UI.plural(lines.length, 'line') + ' · aim for ' + b.target[0] + (b.target[1] !== b.target[0] ? '–' + b.target[1] : '') + ' syllables per line</div>';
    }
    idle(lines[0].text);
    function onStep(ev) {
      if (ev.type === 'state') { if (!ev.playing) setPlaying(false); return; }
      if (ev.type !== 'step' || P.owner !== 'perform') return;
      if (ev.counting) { mid.innerHTML = '<div class="kind">Count-in</div><div class="count">' + (Math.floor(ev.step / b.per) + 1) + '</div>'; return; }
      var spl = b.steps * bpl, pos = ev.bar * b.steps + ev.step, i = Math.floor(pos / spl), frac = (pos % spl + 1) / spl;
      if (i >= lines.length) {
        if (!ended) { ended = true; mid.innerHTML = '<div class="count">🍌</div><div class="cur" style="color:#f6f1e4">That\'s a wrap!</div><div class="next">Press Play to run it again.</div>'; }
        if (i >= lines.length + 1) P.stop();
        return;
      }
      if (i !== cur) show(i);
      var tot = weights[i].reduce(function (a, x) { return a + x.n; }, 0), acc = 0, lit = frac * tot + 0.01;
      mid.querySelectorAll('.cur .w').forEach(function (el, k) { el.classList.toggle('lit', acc < lit); acc += weights[i][k].n; });
      var bar = mid.querySelector('.bar i'); if (bar) bar.style.width = (frac * 100) + '%';
    }
    function setPlaying(on) {
      playBtn.innerHTML = UI.icon(on ? 'stop' : 'play') + (on ? 'Stop' : 'Play');
      if (!on && !ended && cur >= 0) idle('Paused at line ' + (cur + 1) + '. Play starts from the top.');
    }
    function play() {
      if (P.playing && P.owner === 'perform') { P.stop(); return; }
      cur = -1; ended = false;
      if (P.start(b.key, { bpm: bpm, countIn: 1, owner: 'perform' })) setPlaying(true);
    }
    unsub.push(P.on(onStep));
    unsub.push(YB.lightSteps(wrap));
    function close() {
      if (P.playing && P.owner === 'perform') P.stop();
      unsub.forEach(function (u) { u(); });
      wrap.remove(); document.removeEventListener('keydown', key, true);
      if (!document.querySelector('.ui-modal-wrap')) document.documentElement.classList.remove('ui-modal-open');
      window.removeEventListener('hashchange', close);
    }
    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === ' ' && !/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)) { e.preventDefault(); play(); }
    }
    document.addEventListener('keydown', key, true);
    window.addEventListener('hashchange', close);
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { close(); return; }
      if (e.target.closest('[data-play]')) { play(); return; }
      var v = e.target.closest('[data-bpl] [data-v]');
      if (v) { bpl = +v.getAttribute('data-v'); wrap.querySelectorAll('[data-bpl] button').forEach(function (x) { x.classList.toggle('on', x === v); }); if (P.playing && P.owner === 'perform') { P.stop(); play(); } return; }
      var t = e.target.closest('[data-tempo]');
      if (t) { bpm = Math.max(50, Math.min(180, bpm + +t.getAttribute('data-tempo'))); wrap.querySelectorAll('[data-bpm]').forEach(function (x) { x.textContent = bpm; }); if (P.playing && P.owner === 'perform') P.setBpm(bpm); }
    });
    YB.words.load().catch(function () {});
    setTimeout(function () { playBtn.focus(); }, 30);
    return { close: close, play: play };
  };
})();
