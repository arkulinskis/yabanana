/* The main user journeys, run inside the real app (Anvil App Server) by tools/ui_test.py through tools/live/drive.mjs.
   Resolves to {ok, log}. Keep log lines ASCII (the Windows console). Ported from the old tools/preview/tests/flowtest.html:
   visitor pages (landing, Stage, a song, beats, the Rhyme lab), the join nudge, sign-up, a song from scratch in the Studio
   (sections, helper insert, beat picker, flow strip, share, Perform), reviewing and upvoting someone else's song, the Bunch,
   charts, the writer page, the profile, deleting the song and signing out. */
(async function () {
  const log = [], t0 = Date.now();
  const say = (m) => log.push(((Date.now() - t0) / 1000).toFixed(1) + 's ' + m);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, what, ms) {
    const end = Date.now() + (ms || 20000);
    while (Date.now() < end) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(150); }
    throw new Error('timed out waiting for: ' + what);
  }
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const vis = (e) => !!e && e.getBoundingClientRect().width > 0;
  const txt = (e) => (e ? e.textContent.trim().replace(/\s+/g, ' ') : '');
  const byText = (sel, text, r) => $$(sel, r).find((e) => vis(e) && (text instanceof RegExp ? text.test(txt(e)) : txt(e) === text));
  async function click(sel, text, r) {
    const el = await until(() => (text ? byText(sel, text, r) : $$(sel, r).find(vis)), sel + (text ? ' "' + text + '"' : ''));
    el.scrollIntoView({ block: 'center' });
    el.click();
    return el;
  }
  function type(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function page(hash, ready, what) {
    if (location.hash !== hash) window.UI_READY = false;  // the old page stays until the router runs
    location.hash = hash;
    await until(() => window.UI_READY && location.hash === hash && ready(), what || hash, 40000);
    await sleep(300);
  }
  const ok = (cond, msg) => { if (!cond) throw new Error('FAILED: ' + msg); say('ok   ' + msg); };
  const modal = () => $$('.anvil-modal-content').find(vis);
  async function confirmWith(label) {
    await until(() => modal() && byText('button', label, modal()), 'a dialog with "' + label + '"');
    byText('button', label, modal()).click();
    await until(() => !modal(), 'the dialog closes');
  }

  try {
    // ---------------------------------------------------------------- visitors
    await page('#landing', () => $('.lp-hero') && $$('.yb-landing .yb-card').length, 'landing with live songs');
    ok($('.lp-hero a[href="#auth/signup"]'), 'landing: hero with a sign-up link');
    ok($$('.yb-landing .yb-card').length >= 3, 'landing: random songs from the Stage (' + $$('.yb-landing .yb-card').length + ')');
    ok(byText('.ui-header .ui-btn', 'Join') && byText('.ui-nav a', 'Rhyme lab'), 'header: visitors see Join and the public menu');

    await page('#home', () => $$('.anvil-role-st-shuffle .yb-card').length);
    ok(/Fresh off the/.test(txt($('.st-title'))), 'stage: the visitor greeting');
    ok($$('.anvil-role-st-rail .yb-card').length, 'stage: the Spotlight rail');
    ok($$('.anvil-role-st-fresh .st-row').length, 'stage: fresh drops');
    window.UI_READY = false;
    await click('.yb-scenes-pick button', 'Poetry');
    await until(() => location.hash === '#home/poetry' && window.UI_READY && $$('.anvil-role-st-shuffle .yb-card').length &&
      $$('.anvil-role-st-shuffle .yb-card').every((c) => c.classList.contains('sc-poetry')), 'poetry filter');
    ok($('.yb-scenes-pick button.sc-poetry.on'), 'stage: the scene filter shows only poetry');
    await click('.anvil-role-ic-shuffle button', 'Shuffle');
    await sleep(2500);
    ok($$('.anvil-role-st-shuffle .yb-card').length >= 1, 'stage: Shuffle redraws the songs');

    // the banana asks visitors to join
    await page('#home', () => $$('.anvil-role-st-shuffle .anvil-role-yb-up button').length);
    $$('.anvil-role-st-shuffle .anvil-role-yb-up button').find(vis).click();
    await until(() => modal() && $('.yb-join', modal()), 'join nudge');
    ok(/Join the bunch/.test(txt(modal())), 'upvote as a visitor: the "Join the bunch" nudge');
    await confirmWith('Sign in');
    await until(() => location.hash === '#auth' && window.UI_READY, 'sign-in page from the nudge');

    // a song page
    await page('#home', () => $$('.anvil-role-st-shuffle .yb-card').length);
    const card = $$('.anvil-role-st-shuffle .yb-card').find(vis);
    const songHref = $('h3 a', card).getAttribute('href');
    $('.yb-excerpt', card).click();  // clicking the card itself opens the song
    await until(() => location.hash === songHref && window.UI_READY && $('.yb-lyrics'), 'song page from a card click');
    ok(true, 'card click opens the song (' + songHref + ')');
    await until(() => $('.yb-lyrics:not(.no-scheme)') && $$('.yb-lyrics .lt').some((e) => e.textContent.trim()), 'rhyme map letters', 30000);
    ok(true, 'song: the rhyme map draws scheme letters once the dictionary loads');
    ok($('.sg-side .yb-steps') && txt($('.sg-side .anvil-role-sg-meter')).length, 'song: the beat card with steps and meter');
    ok(!$$('a[target=_blank]').some((a) => /^#/.test(a.getAttribute('href') || '')), 'links to app pages stay in this tab (no target=_blank)');
    $('.sg-paper input[type=checkbox]').click();
    await until(() => $('.yb-lyrics.no-scheme'), 'rhyme map off');
    $('.sg-paper input[type=checkbox]').click();
    ok(true, 'song: the Rhyme map switch');
    const chip = $('.sg-paper [data-play-beat]');
    chip.click();
    await until(() => chip.classList.contains('on'), 'beat chip playing');
    chip.click();
    await until(() => !chip.classList.contains('on'), 'beat chip stopped');
    ok(true, 'song: the beat chip plays and stops');
    await click('.anvil-role-ic-mic button', 'Perform');
    await until(() => $('.yb-stage'), 'perform mode');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await until(() => !$('.yb-stage'), 'perform closes');
    ok(true, 'perform mode opens and Esc closes it');

    // beats + lab
    await page('#beats/trap', () => $$('.bt-card').length === 12);
    ok($('#beat-trap.focus'), 'beats: 12 beats, #beats/trap outlined');
    const play = $('#beat-trap .play');
    play.click();
    await until(() => play.classList.contains('on'), 'trap playing');
    await page('#lab', () => $('.yb-help .yb-help-q'));
    ok(!window.YB.player.playing, 'leaving the page stops the beat');
    await until(() => $$('.lb-out .yb-meter-line').length >= 3, 'line checker output', 30000);
    ok(/iambic/.test(txt($('.lb-out'))), 'lab: the line checker finds the meter (' + $$('.lb-out .yb-meter-line').length + ' lines)');
    await click('.yb-help .ui-tabs button', 'Rhymes');
    type($('.yb-help-q input'), 'night');
    await until(() => $$('.lb-helper .yb-word').length > 10, 'rhymes for night');
    const word = $$('.lb-helper .yb-word').find((b) => /^light/.test(txt(b)));
    ok(word, 'lab: perfect rhymes for "night" include light');
    word.click();
    await until(() => /light/.test($('.lb-scratch textarea').value), 'word in the scratchpad');
    ok(true, 'lab: clicking a rhyme drops it in the scratchpad');
    await click('.yb-help .ui-tabs button', 'Similes');
    await until(() => $$('.lb-helper .yb-phrase').length, 'similes');
    ok(true, 'lab: the Similes tab');
    await click('.yb-help .ui-tabs button', 'Rhymes');
    await click('.lb-actions .anvil-role-btn button', 'Clear');

    // ---------------------------------------------------------------- sign up (from a members-only page)
    await page('#studio', () => true);
    await until(() => window.UI_READY && $$('.au-card input').length >= 2, 'redirected to sign in');
    ok(true, 'the Studio asks visitors to sign in');
    await click('.au-card .ui-seg button', 'Create account');
    await until(() => $$('.au-card input').filter(vis).length >= 3, 'sign-up form');
    const inputs = $$('.au-card input[type=text], .au-card input[type=email], .au-card input[type=password]').filter(vis);
    type(inputs[0], 'Flow Tester'); type(inputs[1], 'flow' + Date.now() + '@example.com'); type(inputs[2], 'Hb-' + Math.random().toString(36).slice(2) + '-Kq7');
    const tick = $('.au-card input[type=checkbox]');
    if (tick && !tick.checked) tick.click();
    await click('.anvil-role-btn-block button', 'Create account');
    await until(() => location.hash === '#studio' && window.UI_READY && $('.sd-totals'), 'back on the Studio', 40000);
    ok(true, 'sign-up: signed in and sent on to the Studio');
    ok($('.anvil-role-avatar button') && /FT/.test(txt($('.anvil-role-avatar button'))), 'header: account button with initials');
    ok(byText('.ui-nav a', 'Bunch') && vis($('.yb-newbtn')), 'header: the member menu and the Write button');
    ok(/notebook is empty/.test(txt($('.ui-empty'))), 'studio: the empty notebook');

    // ---------------------------------------------------------------- a song from scratch
    await page('#studio/new', () => $$('.sd-pick button').length === 3);
    $('.sd-pick button[data-new="rap"]').click();
    await until(() => /^#studio\/./.test(location.hash) && location.hash !== '#studio/new' && window.UI_READY && $$('.sd-sec').length === 2, 'the editor', 40000);
    const songHash = location.hash, songId = decodeURIComponent(songHash.split('/')[1]);
    ok($$('.sd-sec select').map((s) => s.selectedOptions[0].textContent).join() === 'Verse,Hook', 'editor: a rap song starts with Verse + Hook');
    ok(/Boom Bap/.test(txt($('.anvil-role-ic-wave button'))), 'editor: the beat is Boom Bap');
    type($('.anvil-role-sd-title'), 'Flow Test Anthem');
    const ta = $$('.sd-sec textarea')[0];
    type(ta, 'Fourth floor walk-up radiator banging out a beat\nMama on the phone asking if I got enough to eat');
    await until(() => $$('.sd-sec')[0].querySelectorAll('.sd-chip').length >= 2, 'flow chips', 30000);
    ok(/aim 10/.test(txt($('.sd-flow'))), 'editor: the flow strip counts syllables against the beat');
    await until(() => $$('.sd-help .yb-word').length > 3, 'helper rhymes for the word at the cursor', 30000);
    ok(/eat/.test($('.sd-help .yb-help-q input').value), 'editor: the helper follows the cursor (rhymes for "' + $('.sd-help .yb-help-q input').value + '")');
    const rhyme = $$('.sd-help .yb-word').find(vis);
    const rw = rhyme.getAttribute('data-ins');
    rhyme.click();
    await until(() => ta.value.indexOf(' ' + rw) > 60, 'inserted rhyme');
    ok(true, 'editor: clicking a rhyme inserts it at the cursor ("' + rw + '")');
    await until(() => /^Saved/.test(txt($('.sd-save'))), 'autosave', 20000);
    ok(true, 'editor: autosave');
    // sections: add, repeat, move, delete
    await click('.sd-add .anvil-role-btn button', 'Chorus');
    await until(() => $$('.sd-sec').length === 3, 'chorus added');
    type($$('.sd-sec textarea')[2], 'Banana moon over the block tonight\nWe keep writing till the morning light');
    $$('.sd-sec')[2].querySelector('.anvil-role-ic-copy button').click();
    await until(() => $$('.sd-sec').length === 4 && $$('.sd-sec textarea')[3].value.indexOf('Banana moon') === 0, 'section repeated');
    ok(true, 'editor: Repeat this section copies the chorus');
    $$('.sd-sec')[1].querySelector('.anvil-role-ic-trash button').click();  // the empty Hook: no question asked
    await until(() => $$('.sd-sec').length === 3, 'empty section deleted');
    ok($$('.sd-sec select').map((s) => s.selectedOptions[0].textContent).join() === 'Verse,Chorus,Chorus', 'editor: delete an empty section');
    $$('.sd-sec')[2].querySelector('.anvil-role-ic-up button').click();
    await until(() => $$('.sd-sec').length === 3 && $$('.sd-sec')[0].querySelector('.anvil-role-ic-up button').disabled, 'moved');
    $$('.sd-sec')[2].querySelector('.anvil-role-ic-trash button').click();  // has words: asks first
    await confirmWith('Delete');
    await until(() => $$('.sd-sec').length === 2, 'filled section deleted');
    ok(true, 'editor: move up, and deleting a section with words asks first');
    // beat picker + controls
    await click('.anvil-role-ic-wave button');
    await until(() => modal() && $$('.bp-opt', modal()).length === 12, 'beat picker');
    ok(true, 'beat picker: all 12 beats');
    const trap = $$('.bp-opt', modal()).find((o) => /Trap 140/.test(o.textContent));
    trap.querySelector('[data-play-beat]').click();
    await until(() => window.YB.player.playing && window.YB.player.owner === 'pick', 'preview');
    trap.querySelector('.anvil-role-btn button').click();
    await until(() => !modal() && /Trap 140/.test(txt($('.anvil-role-ic-wave button'))), 'trap chosen');
    ok(!window.YB.player.playing, 'beat picker: Use picks the beat and stops the preview');
    ok($('.sd-ctl input[type=range]').value === '140', 'editor: the tempo follows the beat (140)');
    await click('.sd-ctl .ui-seg button', '2');
    await until(() => /aim 2[0-9]/.test(txt($('.sd-flow'))), 'two bars per line');
    ok(true, 'editor: 2 bars per line doubles the syllable target');
    await click('.sd-ctl .ui-seg button', 'Pop');
    await until(() => $$('.sd-sec.sc-pop').length === 2, 'pop scene');
    ok(true, 'editor: the scene switch recolours the sections');
    $('.sd-preview summary').click();
    await until(() => $('.sd-preview .yb-lyrics .lt'), 'rhyme map preview');
    ok(true, 'editor: the rhyme map preview');
    $('.sd-ctl .anvil-role-btn-icon button').click();
    await until(() => window.YB.player.playing && window.YB.player.owner === 'studio', 'studio play');
    $('.sd-ctl .anvil-role-btn-icon button').click();
    await until(() => !window.YB.player.playing, 'studio stop');
    ok(true, 'editor: Play / Stop the beat');
    // share it
    await click('.sd-bar .anvil-role-btn button', 'Share to the stage');
    await until(() => vis($('.sd-bar .ui-badge.good')) && byText('.sd-bar .anvil-role-btn button', 'Unpublish'), 'shared', 20000);
    ok(true, 'editor: Share to the stage');
    await click('.anvil-role-ic-mic button', 'Perform');
    await until(() => $('.yb-stage') && /Flow Test Anthem/.test(txt($('.yb-stage'))), 'perform');
    $('.yb-stage [data-close]').click();
    await until(() => !$('.yb-stage'), 'perform closed');
    ok(true, 'editor: Perform shows the song');

    // the song page as its writer
    await page('#song/' + encodeURIComponent(songId), () => $('.anvil-role-sg-title'));
    ok(txt($('.anvil-role-sg-title')) === 'Flow Test Anthem', 'song page: the title');
    ok(vis($('.sg-actions a.anvil-role-ic-pen')) && /Reviews from other writers/.test(txt($('.sg-reviews'))), 'song page: Edit for the writer, no review form');
    ok(!vis($('.sg-actions .anvil-role-ic-flame button')), 'song page: no Promote on your own song');

    // ---------------------------------------------------------------- someone else's song: upvote, review, promote
    await page('#charts/all', () => $$('.ch-row').length);
    ok($$('.ch-row').length >= 5 && txt($('.ch-row .anvil-role-ch-rank')) === '1', 'charts: ranked songs');
    window.UI_READY = false;
    await click('.ch-tools .ui-seg button', 'Best reviewed');
    await until(() => location.hash === '#charts/reviewed' && window.UI_READY && $$('.ch-row').length, 'best reviewed');
    ok(/\/ 5/.test(txt($('.ch-row .anvil-role-ch-score'))), 'charts: Best reviewed shows ratings');
    const other = $$('.ch-row').find((r) => !/Flow Tester/.test(r.textContent));
    const otherHref = $('h3 a', other).getAttribute('href');
    await page(otherHref, () => $('.sg-form') && vis($('.sg-form')));
    const up = $('.sg-actions .anvil-role-yb-up button');
    const n0 = +txt(up);
    up.click();
    await until(() => up.getAttribute('aria-pressed') === 'true' && +txt(up) === n0 + 1, 'upvoted');
    await until(() => +txt($('.anvil-role-sg-num')) === n0 + 1, 'side count');
    ok(true, 'song: upvote (bananas ' + n0 + ' -> ' + (n0 + 1) + ', side card too)');
    for (const box of $$('.sg-form .sg-stars')) box.querySelectorAll('button')[3].click();
    type($('.sg-form textarea'), 'The internal rhymes in the second line land hard. Great image.');
    const fav = $('.sg-form select');
    fav.selectedIndex = 1; fav.dispatchEvent(new Event('change', { bubbles: true }));
    await click('.sg-form .anvil-role-btn-primary button', 'Post review');
    await until(() => /Your review/.test(txt($('.anvil-role-sg-form-title'))) && byText('.sg-form button', 'Update review'), 'review saved', 20000);
    ok($$('.sg-form .sg-stars button.on').length === 12, 'song: the review is saved and comes back in the form (4 bananas x 3)');
    if (vis($('.sg-actions .anvil-role-ic-flame button'))) {
      await click('.sg-actions .anvil-role-ic-flame button', 'Promote');
      await confirmWith('Promote it');
      await until(() => vis($('.sg-actions .ui-badge.accent')), 'promoted', 20000);
      ok(true, 'song: Promote puts it in the Spotlight');
    }
    await click('.sg-actions .anvil-role-ic-flag button');
    await until(() => modal() && $('.yb-report', modal()), 'report dialog');
    await confirmWith('Cancel');
    ok(true, 'song: the report dialog opens and cancels');

    // the Bunch
    await page('#bunch', () => $('.bn-hero'));
    ok($$('.anvil-role-yb-cards .yb-card').some((c) => $('h3 a', c).getAttribute('href') === otherHref), 'bunch: the upvoted song is saved');
    type($('.anvil-role-bn-search'), 'zzz-nothing');
    await until(() => /Nothing matches/.test(txt($('.ui-empty'))), 'search narrows');
    type($('.anvil-role-bn-search'), '');
    await until(() => $$('.anvil-role-yb-cards .yb-card').length, 'all back');
    const saved = $$('.anvil-role-yb-cards .yb-card').find((c) => $('h3 a', c).getAttribute('href') === otherHref);
    saved.querySelector('.anvil-role-yb-up button').click();
    await until(() => !$$('.anvil-role-yb-cards .yb-card').some((c) => vis(c) && $('h3 a', c).getAttribute('href') === otherHref), 'removed from the bunch');
    ok(true, 'bunch: search, and un-upvoting removes the song');

    // profile + writer page
    await page('#profile', () => $('.pf-grid'));
    await click('.pf-grid .yb-scenes-pick button', 'Poetry');
    type($('.pf-grid textarea'), 'Night-shift poet. Boom bap at breakfast.');
    type($('.pf-grid input[type=text]'), 'Flow Tester Two');
    await click('.pf-grid .anvil-role-btn-primary button', 'Save');
    await until(() => /Flow Tester Two/.test(txt($('.pf-head'))), 'name saved');
    ok(/FT/.test(txt($('.anvil-role-avatar button'))), 'profile: saved (header initials follow)');
    await click('.pf-grid a.ui-btn', /See your page/);
    await until(() => /^#writer\//.test(location.hash) && window.UI_READY && $('.wr-head'), 'writer page');
    ok(/Night-shift poet/.test(txt($('.wr-head'))) && /Poetry/.test(txt($('.wr-badges'))) && $$('.anvil-role-yb-cards .yb-card').length === 1,
      'writer page: bio, scene and the shared song');

    // ---------------------------------------------------------------- clean up: delete the song, sign out
    await page(songHash, () => $$('.sd-sec').length);
    await click('.sd-bar .anvil-role-ic-trash button');
    await confirmWith('Delete');
    await until(() => location.hash === '#studio' && window.UI_READY && $('.sd-totals'), 'back in the studio');
    ok(/notebook is empty/.test(txt($('.ui-empty'))), 'editor: Delete removes the song');
    await click('.anvil-role-avatar button');
    await click('.ui-menu .ui-seg button', 'Dark');
    ok(document.documentElement.classList.contains('ui-dark'), 'menu: Dark switches the theme');
    await click('.ui-menu .ui-seg button', 'Auto');
    await click('.ui-menu button', 'Sign out');
    await until(() => location.hash === '#landing' && window.UI_READY && byText('.ui-header .ui-btn', 'Join'), 'signed out');
    ok(true, 'sign out: back to the landing page as a visitor');

    say('PASSED');
    return { ok: true, log: log };
  } catch (e) {
    say(String(e && e.message || e));
    return { ok: false, log: log };
  }
})();
