/* For screenshots of member pages: sign up a fresh account, write a short song and share it, upvote a demo song.
   Resolves to window.SEED = {home, editor, song, other} (addresses for tools/ui_test.py --shots). */
(async function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, what, ms) {
    const end = Date.now() + (ms || 40000);
    while (Date.now() < end) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(150); }
    throw new Error('timed out waiting for: ' + what);
  }
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  function type(input, value) {
    input.focus(); input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function go(hash, ready) {
    if (location.hash !== hash) window.UI_READY = false;
    location.hash = hash;
    await until(() => window.UI_READY && location.hash === hash && ready(), hash);
  }
  try {
    await go('#auth/signup', () => $$('.au-card input').length >= 3);
    const inputs = $$('.au-card input[type=text], .au-card input[type=email], .au-card input[type=password]');
    type(inputs[0], 'Sam Rivera'); type(inputs[1], 'shots' + Date.now() + '@example.com'); type(inputs[2], 'Hb-' + Math.random().toString(36).slice(2) + '-Kq7');
    const tick = $('.au-card input[type=checkbox]'); if (tick && !tick.checked) tick.click();
    $$('.anvil-role-btn-block button').find((b) => /Create account/.test(b.textContent)).click();
    await until(() => location.hash === '#home' && window.UI_READY, 'home', 60000);
    await go('#studio/new', () => $$('.sd-pick button').length === 3);
    $('.sd-pick button[data-new="rap"]').click();
    await until(() => /^#studio\/./.test(location.hash) && location.hash !== '#studio/new' && window.UI_READY && $$('.sd-sec').length === 2, 'editor', 60000);
    const editor = location.hash, id = decodeURIComponent(editor.split('/')[1]);
    type($('.anvil-role-sd-title'), 'Radiator Backbeat');
    type($$('.sd-sec textarea')[0], 'Fourth floor walk-up, radiator banging out a backbeat\nMama on the phone like did you eat, I said I had a snack, sweet\n' +
      'Milk crate notebook balanced on my kneecap\nWriting like the rent is in the recap');
    type($$('.sd-sec textarea')[1], 'Peel it back, peel it back\nBanana moon on the railroad track');
    await until(() => /^Saved/.test(($('.sd-save') || {}).textContent.trim()), 'saved', 30000);
    $$('.sd-bar .anvil-role-btn button').find((b) => /Share to the stage/.test(b.textContent)).click();
    await until(() => $$('.sd-bar .anvil-role-btn button').some((b) => /Unpublish/.test(b.textContent)), 'shared');
    await go('#charts/all', () => $$('.ch-row').length);
    const other = $$('.ch-row h3 a')[0].getAttribute('href');
    await go(other, () => $('.sg-actions .anvil-role-yb-up button'));
    const up = $('.sg-actions .anvil-role-yb-up button');
    if (up.getAttribute('aria-pressed') !== 'true') { up.click(); await until(() => up.getAttribute('aria-pressed') === 'true', 'upvoted'); }
    window.SEED = { home: '#home', editor: editor, song: '#song/' + encodeURIComponent(id), other: other };
    return window.SEED;
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
})();
