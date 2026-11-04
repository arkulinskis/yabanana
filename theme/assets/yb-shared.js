/* yb-shared.js: drawing helpers shared by several pages: YB.lyricsHtml (full lyrics with the rhyme map, drawn by
   Components/Lyrics), YB.lines, YB.confetti. Moved from the old web/pages/_shared.html; the song cards, upvote
   buttons, avatars and the "Join the bunch" nudge are Python Forms now (Items/SongCard, Components/Upvote ...). */
(function () {
  'use strict';
  var YB = window.YB = window.YB || {};
  var esc = UI.esc;

  YB.confetti = function (x, y, n) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#ffc21a', '#ff3d7f', '#3e5bd8', '#e8a317'];
    for (var i = 0; i < (n || 16); i++) {
      var d = document.createElement('span');
      d.className = 'yb-confetti';
      d.setAttribute('aria-hidden', 'true');
      if (i % 4 === 0) d.textContent = '🍌';
      else { d.style.width = '8px'; d.style.height = '12px'; d.style.borderRadius = '2px'; d.style.background = colors[i % colors.length]; }
      d.style.left = x + 'px'; d.style.top = y + 'px';
      document.body.appendChild(d);
      var ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 90, rot = (Math.random() - .5) * 720;
      d.animate([{ transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
                 { transform: 'translate(' + (Math.cos(ang) * dist - 4) + 'px,' + (Math.sin(ang) * dist + 40) + 'px) rotate(' + rot + 'deg)', opacity: 0 }],
                { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = (function (el) { return function () { el.remove(); }; })(d);
    }
  };
  /* Confetti from an element (Python passes a component's DOM node). dx/dy: offset from its top-left (default: middle). */
  YB.confettiAt = function (el, n, dx, dy) {
    if (!el || !el.getBoundingClientRect) return;
    var r = el.getBoundingClientRect();
    YB.confetti(r.left + (dx == null ? r.width / 2 : dx), r.top + (dy == null ? r.height / 2 : dy), n);
  };

  /* Full lyrics. opts: {scheme: true (needs YB.words loaded), fav: 'a line to highlight'} */
  YB.lyricsHtml = function (sections, opts) {
    opts = opts || {};
    var lines = [];
    sections.forEach(function (s) { (s.text || '').split('\n').forEach(function (l) { lines.push(l); }); });
    var sch = opts.scheme && YB.words.ready ? YB.words.scheme(lines) : null;
    var li = 0;
    return '<div class="yb-lyrics' + (sch ? '' : ' no-scheme') + '">' + sections.map(function (s) {
      var rows = (s.text || '').split('\n').map(function (l) {
        var i = li++;
        if (!l.trim()) return '<div class="ln gap"></div>';
        var txt = sch ? YB.words.markHtml(sch.marks[i]) : esc(l);
        return '<div class="ln' + (opts.fav && l.trim() === opts.fav ? ' fav' : '') + '"><span class="t">' + txt + '</span><span class="lt">' + (sch ? esc(sch.letters[i]) : '') + '</span></div>';
      }).join('');
      return '<section><div class="kind">' + esc(s.kind || 'Verse') + '</div>' + rows + '</section>';
    }).join('') + '</div>';
  };
  /* ---- textarea helpers for the Studio (caret positions are the browser's own string offsets, so they stay here)
     YB.insertAtCaret(ta, text): put text at the cursor (after the word you're on, with a space), fire "input". */
  YB.insertAtCaret = function (ta, text) {
    var start = ta.selectionStart != null ? ta.selectionStart : ta.value.length, end = ta.selectionEnd != null ? ta.selectionEnd : start;
    var before = ta.value.slice(0, start), after = ta.value.slice(end);
    if (start === end && before && !/[\s\n]$/.test(before)) text = ' ' + text;
    ta.value = before + text + after;
    var pos = before.length + text.length;
    ta.focus(); ta.setSelectionRange(pos, pos);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return text.trim();
  };
  /* The word the helper should rhyme with: the selection, the word at the cursor, or on an empty line the last word
     of the line above. */
  YB.wordAtCaret = function (ta) {
    var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
    if (s !== e) return v.slice(s, e).trim().split(/\s+/).slice(-3).join(' ');
    var lineStart = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(lineStart, (v.indexOf('\n', s) + 1 || v.length + 1) - 1);
    if (!line.trim()) {
      var prev = v.slice(0, Math.max(0, lineStart - 1)).split('\n').filter(function (l) { return l.trim(); }).pop() || '';
      return (prev.match(/[A-Za-z']+/g) || []).slice(-1)[0] || '';
    }
    var left = v.slice(lineStart, s).match(/[A-Za-z']+$/), right = v.slice(s).match(/^[A-Za-z']+/);
    var w = (left ? left[0] : '') + (right ? right[0] : '');
    if (w) return w;
    return (v.slice(lineStart, s).match(/[A-Za-z']+/g) || []).slice(-1)[0] || '';
  };
  YB.autosize = function (ta, min) { ta.style.height = 'auto'; ta.style.height = Math.max(min || 130, ta.scrollHeight + 4) + 'px'; };

  YB.lines = function (sections) {
    var out = [];
    (sections || []).forEach(function (s) { (s.text || '').split('\n').forEach(function (l) { if (l.trim()) out.push(l.trim()); }); });
    return out;
  };
})();
