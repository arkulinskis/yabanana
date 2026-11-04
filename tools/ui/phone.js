/* Phone-width check (run at 390 px wide by tools/ui_test.py): every page loads without errors and without sideways
   scrolling, signed out and signed in. Resolves to {ok, log}. */
(async function () {
  const log = [], bad = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, what, ms) {
    const end = Date.now() + (ms || 20000);
    while (Date.now() < end) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(150); }
    throw new Error('timed out waiting for: ' + what);
  }
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  function type(input, value) {
    input.focus(); input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function check(hash, ready) {
    if (location.hash !== hash) window.UI_READY = false;  // the old page stays until the router runs
    location.hash = hash;
    await until(() => window.UI_READY && location.hash === hash && (!ready || ready()), hash, 40000);
    await sleep(600);
    const vw = Math.min(window.innerWidth, screen.width), w = document.documentElement.scrollWidth;
    const wide = $$('body *').filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > vw + 1 && !e.closest('.anvil-role-st-rail, .sd-help'); })
      .slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0, 2).join('.'));
    if (w > vw + 1) bad.push(hash + ' scrolls sideways (' + w + ' > ' + vw + ') ' + wide.join(' '));
    log.push((w > vw + 1 ? 'WIDE ' : 'ok   ') + hash + ' (' + w + ')');
  }
  try {
    for (const h of ['#landing', '#home', '#charts', '#charts/reviewed/pop', '#beats', '#lab', '#auth', '#auth/signup']) await check(h);
    await check('#home', () => $$('.yb-card h3 a').length);
    const song = $('.yb-card h3 a').getAttribute('href');
    await check(song, () => $('.yb-lyrics'));
    const writer = $('.sg-by a.anvil-role-by-link').getAttribute('href');
    await check(writer, () => $('.wr-head'));
    // sign up so the member pages can be checked too
    location.hash = '#auth/signup';
    await until(() => window.UI_READY && $$('.au-card input').length >= 3, 'sign-up form');
    const inputs = $$('.au-card input[type=text], .au-card input[type=email], .au-card input[type=password]');
    type(inputs[0], 'Phone Tester'); type(inputs[1], 'phone' + Date.now() + '@example.com'); type(inputs[2], 'Hb-' + Math.random().toString(36).slice(2) + '-Kq7');
    const tick = $('.au-card input[type=checkbox]'); if (tick && !tick.checked) tick.click();
    $$('.anvil-role-btn-block button').find((b) => /Create account/.test(b.textContent)).click();
    await until(() => location.hash === '#home' && window.UI_READY, 'signed in', 40000);
    ok_tabbar: {
      const tb = $('.ui-tabbar');
      if (!tb || tb.getBoundingClientRect().height < 20) bad.push('the phone tab bar is missing');
    }
    for (const h of ['#home', '#studio', '#studio/new', '#bunch', '#profile', song]) await check(h);
    // a song in the editor, with the helper sheet opened
    location.hash = '#studio/new';
    await until(() => window.UI_READY && $$('.sd-pick button').length === 3, 'new song');
    $('.sd-pick button[data-new="poetry"]').click();
    await until(() => /^#studio\/./.test(location.hash) && location.hash !== '#studio/new' && window.UI_READY && $$('.sd-sec').length, 'editor', 40000);
    await check(location.hash, () => $$('.sd-sec').length);
    const fab = $('.anvil-role-sd-fab button');
    if (!fab || fab.getBoundingClientRect().width === 0) bad.push('editor: no Helpers button on phones');
    else {
      fab.click();
      await sleep(600);
      const sheet = $('.sd-help').getBoundingClientRect();
      if (!(sheet.top < innerHeight * 0.6 && sheet.width <= innerWidth + 1)) bad.push('editor: the helper sheet does not slide up (' + Math.round(sheet.top) + ')');
      else log.push('ok   editor: the Helpers sheet slides up');
    }
    log.push(bad.length ? 'PROBLEMS: ' + bad.join(' | ') : 'PASSED');
    return { ok: !bad.length, log: log };
  } catch (e) {
    log.push(String(e && e.message || e));
    return { ok: false, log: log };
  }
})();
