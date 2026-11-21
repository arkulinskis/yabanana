/* yb-card.js: lyric cards. 1 to 5 lines of a song drawn as a sticker-style PNG (square 1080x1080 or story 1080x1920)
   with washi tape, the lyrics, the title, "by Pen Name", the banana and the song's /s/ link. Dialogs/ShareSong uses it.
     YB.card.render(canvas, opts, done)   opts = {lines: [...], title, author, url, style: 'cream'|'night'|'scene',
                                          scene: 'rap'|'poetry'|'pop', size: 'square'|'story'}; done() once drawn
     YB.card.save(canvas, filename)       download the PNG
     YB.card.canShare()                   true when the browser can share an image file (most phones)
     YB.card.share(canvas, filename, title, url) -> Promise of 'shared' | 'cancelled' | 'downloaded'
   Lyrics are drawn in Fraunces italic only when every character is Latin-1 (Fraunces misdraws Latvian macrons:
   APP_MAKER/ANVIL_NOTES.md), otherwise in DM Sans. Colours are literal: a canvas can't read CSS variables. */
(function () {
  'use strict';
  var YB = window.YB = window.YB || {};
  var SIZES = { square: [1080, 1080], story: [1080, 1920] };
  var INK = '#1d1830', CREAM = '#fff7e0', BANANA = '#ffc21a';
  var STYLES = {
    cream: { bg: CREAM, paper: '#ffffff', ink: INK, muted: '#5e5872', edge: INK, shadow: INK, tape: 'rgba(255, 61, 127, .62)', dot: BANANA, foot: INK, quote: '#ff3d7f' },
    night: { bg: '#15121f', paper: '#221d31', ink: '#f6f1e4', muted: '#b7b0c8', edge: '#f6f1e4', shadow: '#050409', tape: 'rgba(255, 194, 26, .7)', dot: '#ff5a92', foot: '#f6f1e4', quote: BANANA }
  };
  var SCENE = {  // scene-colour cards: the page in the scene's colour, the paper in banana cream
    rap: { bg: '#e8a317', foot: INK, dot: '#fff7e0', tape: 'rgba(255, 61, 127, .6)', quote: '#b8174f' },
    poetry: { bg: '#3e5bd8', foot: '#ffffff', dot: BANANA, tape: 'rgba(255, 194, 26, .75)', quote: '#3e5bd8' },
    pop: { bg: '#ff3d7f', foot: INK, dot: BANANA, tape: 'rgba(255, 194, 26, .75)', quote: '#b01650' }
  };
  // Latin-1 plus typographic punctuation (curly quotes, dashes, ellipsis): Fraunces draws all of these correctly.
  var LATIN1 = /^[\u0000-ÿ‐-‧]*$/;

  function palette(o) {
    if (o.style === 'night') return STYLES.night;
    if (o.style === 'scene') {
      var s = SCENE[o.scene] || SCENE.rap, p = {};
      Object.keys(STYLES.cream).forEach(function (k) { p[k] = STYLES.cream[k]; });
      p.paper = CREAM; p.bg = s.bg; p.foot = s.foot; p.dot = s.dot; p.tape = s.tape; p.quote = s.quote;
      return p;
    }
    return STYLES.cream;
  }

  var fontsReady = null, icon = null, iconReady = null;
  function loadFonts() {
    if (!fontsReady) {
      var f = document.fonts;
      fontsReady = !f || !f.load ? Promise.resolve() : Promise.all([
        f.load('italic 500 60px "Fraunces"'), f.load('800 60px "Bricolage Grotesque"'),
        f.load('500 40px "DM Sans"'), f.load('700 40px "DM Sans"')
      ]).catch(function () {});
    }
    return fontsReady;
  }
  function loadIcon() {
    if (!iconReady) {
      iconReady = new Promise(function (resolve) {
        var im = new Image();
        im.onload = function () { icon = im; resolve(im); };
        im.onerror = function () { resolve(null); };
        im.src = '_/theme/icon.svg';
      });
    }
    return iconReady;
  }

  function wrap(ctx, text, maxW) {
    var words = String(text || '').split(/\s+/).filter(Boolean), out = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else { out.push(line); line = w; }
    });
    if (line) out.push(line);
    return out.length ? out : [''];
  }
  function fit(ctx, text, font, size, maxW, min) {
    var s = size;
    ctx.font = font.replace('{s}', s);
    while (s > min && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = font.replace('{s}', s); }
    var t = text;
    if (ctx.measureText(t).width > maxW) {
      while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
      t = t.replace(/\s+$/, '') + '…';
    }
    return t;
  }
  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function draw(canvas, o) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, story = H > W, p = palette(o);
    var lines = (o.lines || []).filter(function (l) { return String(l || '').trim(); }).slice(0, 5);
    if (!lines.length) lines = [o.title || 'Untitled'];
    var all = lines.join(' ') + (o.title || '') + (o.author || '');
    var lyricFont = LATIN1.test(all) ? 'italic 500 {s}px "Fraunces", Georgia, serif' : '500 {s}px "DM Sans", system-ui, sans-serif';
    var m = 90, pad = 72, paperW = W - 2 * m, textW = paperW - 2 * pad;

    // the page: colour + a few confetti dots
    ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = p.dot;
    [[0.08, 0.06, 18], [0.9, 0.1, 12], [0.94, 0.5, 9], [0.05, 0.72, 14], [0.86, 0.9, 16], [0.15, 0.94, 8]].forEach(function (d) {
      ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(d[0] * W, d[1] * H, d[2], 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // lyrics: the biggest size that fits
    var footH = 110, maxText = (story ? H * 0.56 : H * 0.42), size = story ? 84 : 74, rows = [], lh = 0;
    for (; size >= 34; size -= 3) {
      ctx.font = lyricFont.replace('{s}', size);
      rows = [];
      lines.forEach(function (l, i) { if (i) rows.push(null); wrap(ctx, l, textW).forEach(function (r) { rows.push(r); }); });
      lh = Math.round(size * 1.28);
      var hgt = rows.reduce(function (a, r) { return a + (r === null ? lh * 0.22 : lh); }, 0);
      if (hgt <= maxText) break;
    }
    var textH = rows.reduce(function (a, r) { return a + (r === null ? lh * 0.22 : lh); }, 0);
    var top = 130, titleBlock = 150, paperH = top + textH + 56 + titleBlock;
    var py = Math.max(m, Math.round((H - footH - paperH) / 2)), px = m;

    // the paper: hard sticker shadow, outline, washi tape
    ctx.fillStyle = p.shadow; rounded(ctx, px + 16, py + 16, paperW, paperH, 38); ctx.fill();
    ctx.fillStyle = p.paper; rounded(ctx, px, py, paperW, paperH, 38); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = p.edge; ctx.stroke();
    ctx.save(); ctx.translate(W / 2, py + 4); ctx.rotate(-0.06); ctx.fillStyle = p.tape; ctx.fillRect(-150, -34, 300, 68);
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
    for (var k = -140; k < 150; k += 26) ctx.fillRect(k, -34, 8, 68);
    ctx.restore(); ctx.globalAlpha = 1;
    // a big opening quote mark
    ctx.fillStyle = p.quote; ctx.font = '700 170px "Fraunces", Georgia, serif'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('“', px + pad - 12, py + 150);

    // the lines
    ctx.fillStyle = p.ink; ctx.font = lyricFont.replace('{s}', size); ctx.textBaseline = 'top';
    var y = py + top;
    rows.forEach(function (r) {
      if (r === null) { y += lh * 0.22; return; }
      ctx.fillText(r, px + pad, y + (lh - size) / 2); y += lh;
    });

    // title + writer
    y += 40;
    ctx.fillStyle = BANANA; rounded(ctx, px + pad, y, 90, 12, 6); ctx.fill();
    y += 34;
    ctx.fillStyle = p.ink;
    var title = fit(ctx, o.title || 'Untitled', '800 {s}px "Bricolage Grotesque", system-ui, sans-serif', 54, textW, 34);
    ctx.fillText(title, px + pad, y);
    y += 66;
    ctx.fillStyle = p.muted;
    var by = fit(ctx, 'by ' + (o.author || 'a Yabanana writer'), '600 {s}px "DM Sans", system-ui, sans-serif', 36, textW, 26);
    ctx.fillText(by, px + pad, y);

    // footer: the banana + the link
    var fy = Math.min(H - footH + 8, py + paperH + 52);
    if (icon) ctx.drawImage(icon, m, fy, 72, 72);
    ctx.fillStyle = p.foot; ctx.textBaseline = 'middle';
    var link = fit(ctx, o.url || 'yabanana.com', '700 {s}px "DM Sans", system-ui, sans-serif', 38, W - 2 * m - 96, 24);
    ctx.fillText(link, m + 92, fy + 37);
    ctx.textBaseline = 'alphabetic';
    canvas._ybBlob = null;
    if (canvas.toBlob) canvas.toBlob(function (b) { canvas._ybBlob = b; }, 'image/png');
  }

  function blobOf(canvas) {
    if (canvas._ybBlob) return Promise.resolve(canvas._ybBlob);
    return new Promise(function (resolve) { canvas.toBlob(function (b) { resolve(b); }, 'image/png'); });
  }
  function download(blob, filename) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename || 'yabanana-lyrics.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  YB.card = {
    render: function (canvas, opts, done) {
      var o = opts || {}, size = SIZES[o.size] || SIZES.square;
      canvas.width = size[0]; canvas.height = size[1];
      draw(canvas, o);  // straight away (fallback fonts), then again once the fonts and the banana are in
      Promise.all([loadFonts(), loadIcon()]).then(function () { draw(canvas, o); if (done) done(); },
        function () { if (done) done(); });
    },
    save: function (canvas, filename) { return blobOf(canvas).then(function (b) { if (b) download(b, filename); return !!b; }); },
    canShare: function () {
      try {
        return !!(navigator.canShare && navigator.share &&
          navigator.canShare({ files: [new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })] }));
      } catch (e) { return false; }
    },
    share: function (canvas, filename, title, url) {
      return blobOf(canvas).then(function (b) {
        if (!b) return 'cancelled';
        var file = new File([b], filename || 'yabanana-lyrics.png', { type: 'image/png' });
        if (!YB.card.canShare()) { download(b, filename); return 'downloaded'; }
        return navigator.share({ files: [file], title: title || 'Yabanana', text: (title ? title + ' ' : '') + (url || '') })
          .then(function () { return 'shared'; }, function (e) {
            if (e && e.name === 'AbortError') return 'cancelled';
            download(b, filename); return 'downloaded';
          });
      });
    }
  };
})();
