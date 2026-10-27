/* core.js: the shared front-end engine (window.UI). Same in every app made from APP_MAKER/template;
   app-specific things live in web/app.js (brand, nav, footer) and web/pages/*.html (the pages).

   Pages:   UI.page(name, {title, nav, icon, auth, order, chrome}, mount)
              auth: null (anyone) | 'guest' (signed-out only) | 'user' | 'admin'
              nav: label for the header / phone tab bar (omit to keep it out of the menus)
              mount(view, ctx) draws into `view`; ctx = {args, me, go, api}. Return a Promise (the page
              is "ready" when it resolves) or {ready, destroy}. URLs are #name/arg1/arg2.
   Server:  UI.api(fn, ...args) -> Promise of the server function's return value. A reply of
              {ok: false, error} rejects with that message (shown as a toast unless you .catch it).
            UI.apiQuiet(fn, ...args) is the same without Anvil's loading spinner.
   Auth:    UI.auth('login'|'signup'|'reset'|'logout', {...}) -> Promise of {ok, me, message}
   Helpers: UI.esc, UI.icon, UI.toast, UI.modal, UI.confirm, UI.busy, UI.formData, UI.fmtDate, UI.ago,
            UI.store, UI.setTheme, UI.feedback, UI.go, UI.refresh
   Tests:   window.UI_READY is true when the current page has finished loading. */
(function () {
  'use strict';
  if (window.UI && window.UI.__v) return;
  var UI = window.UI = { __v: 1, pages: {}, me: null, config: { name: 'App', key: 'app', home: 'home', landing: 'landing' } };
  window.UI_READY = false;

  UI.configure = function (cfg) { Object.keys(cfg).forEach(function (k) { UI.config[k] = cfg[k]; }); };

  /* ------------------------------------------------------------------ small helpers */
  UI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  UI.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  UI.initials = function (name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };
  UI.fmtDate = function (iso, opts) {
    if (!iso) return '';
    var d = iso.length <= 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
    return d.toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
  };
  UI.fmtDateTime = function (iso) {
    return iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  };
  UI.ago = function (iso) {
    if (!iso) return '';
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    var steps = [[60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']], n = s / 60;
    for (var i = 0; i < steps.length; i++) {
      if (n < steps[i][0]) { n = Math.floor(n); return UI.plural(n, steps[i][1]) + ' ago'; }
      n = n / steps[i][0];
    }
    return '';
  };
  UI.store = {
    get: function (k, dflt) { try { var v = localStorage.getItem(UI.config.key + '.' + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
    set: function (k, v) { try { localStorage.setItem(UI.config.key + '.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  UI.formData = function (form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  };
  /* Disable a button while a Promise runs; returns the Promise. */
  UI.busy = function (btn, promise) {
    if (!btn) return promise;
    btn.disabled = true; btn.classList.add('is-busy');
    var done = function () { btn.disabled = false; btn.classList.remove('is-busy'); };
    promise.then(done, done);
    return promise;
  };

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.7c2.2.6 3.5 2.4 3.5 5.3"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8V5M9 5.5 7.5 4M15 5.5 16.5 4M7 13H3M21 13h-4M7.5 18l-3 2M16.5 18l3 2M7.5 9.5l-3-2M16.5 9.5l3-2"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13"/><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'
  };
  UI.ICONS = ICONS;
  UI.icon = function (name, cls) {
    return '<svg class="ui-ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.sparkle) + '</svg>';
  };

  /* ------------------------------------------------------------------ toasts, modals */
  UI.toast = function (msg, kind) {
    var box = document.querySelector('.ui-toasts');
    if (!box) { box = document.createElement('div'); box.className = 'ui ui-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'ui-toast' + (kind ? ' ' + kind : '');
    t.innerHTML = (kind === 'error' ? UI.icon('info') : kind === 'ok' ? UI.icon('check') : '') + '<span>' + UI.esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, kind === 'error' ? 6500 : 3200);
  };
  UI.modal = function (html, opts) {
    opts = opts || {};
    var prev = document.activeElement;
    var wrap = document.createElement('div');
    wrap.className = 'ui ui-modal-wrap';
    wrap.innerHTML = '<div class="ui-modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<button class="ui-btn ghost icon ui-modal-x" data-close aria-label="Close">' + UI.icon('x') + '</button>' + html + '</div>';
    document.body.appendChild(wrap);
    document.documentElement.classList.add('ui-modal-open');
    function key(e) { if (e.key === 'Escape') close(); }
    function close() {
      if (!wrap.parentNode) return;
      wrap.remove(); document.removeEventListener('keydown', key);
      if (!document.querySelector('.ui-modal-wrap')) document.documentElement.classList.remove('ui-modal-open');
      if (opts.onclose) opts.onclose();
      if (prev && prev.focus) prev.focus();
    }
    document.addEventListener('keydown', key);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    var first = wrap.querySelector('input, textarea, select');
    setTimeout(function () { (first || wrap.querySelector('.ui-modal')).focus && (first || wrap.querySelector('.ui-modal')).focus(); }, 30);
    return { el: wrap.querySelector('.ui-modal'), close: close };
  };
  UI.confirm = function (o) {
    o = typeof o === 'string' ? { title: o } : (o || {});
    return new Promise(function (resolve) {
      var answered = false;
      var m = UI.modal('<h2>' + UI.esc(o.title || 'Are you sure?') + '</h2>' + (o.text ? '<p class="muted">' + UI.esc(o.text) + '</p>' : '') +
        '<div class="ui-row end" style="margin-top:20px"><button class="ui-btn ghost" data-close>' + UI.esc(o.cancel || 'Cancel') + '</button>' +
        '<button class="ui-btn ' + (o.danger ? 'danger solid' : 'primary') + '" data-ok>' + UI.esc(o.ok || 'OK') + '</button></div>',
      { onclose: function () { if (!answered) resolve(false); } });
      m.el.querySelector('[data-ok]').onclick = function () { answered = true; m.close(); resolve(true); };
    });
  };

  /* ------------------------------------------------------------------ theme */
  UI.theme = function () { return UI.store.get('theme', 'auto'); };
  UI.applyTheme = function (t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('ui-dark', !!dark);
  };
  UI.setTheme = function (t) { UI.store.set('theme', t); UI.applyTheme(t); };
  UI.applyTheme(UI.theme());
  if (window.matchMedia) {
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { UI.applyTheme(UI.theme()); }); } catch (e) {}
  }

  /* ------------------------------------------------------------------ server bridge */
  var bridge = null;
  function send(kind, payload) {
    if (!bridge) return Promise.reject(new Error('The app is still starting.'));
    var out;
    try { out = bridge(kind, JSON.stringify(payload || {})); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(out).then(function (r) {
      r = typeof r === 'string' ? JSON.parse(r) : (r || {});
      if (r.error) {
        var err = new Error(r.error); err.uiApi = true; err.denied = !!r.denied;
        if (r.detail) console.error(kind, payload && payload.fn, r.detail);
        if (r.reload) setTimeout(function () { location.reload(); }, 2500);
        throw err;
      }
      return r.result;
    });
  }
  function apiCall(quiet, fn, args) {
    return send('call', { fn: fn, args: args, quiet: quiet }).then(function (res) {
      if (res && typeof res === 'object' && res.ok === false) {
        var err = new Error(res.error || 'That didn\'t work.'); err.uiApi = true; err.expected = true; err.result = res;
        throw err;
      }
      return res;
    });
  }
  UI.api = function (fn) { return apiCall(false, fn, Array.prototype.slice.call(arguments, 1)); };
  UI.apiQuiet = function (fn) { return apiCall(true, fn, Array.prototype.slice.call(arguments, 1)); };
  /* Errors nobody caught become a toast, so a failed action is never silent. */
  window.addEventListener('unhandledrejection', function (e) {
    if (e.reason && e.reason.uiApi) { e.preventDefault(); UI.toast(e.reason.message, 'error'); }
  });

  /* Sign in / up / out. On success it navigates: to where the visitor was heading (UI.after) or home
     after signing in, to the landing page after signing out. */
  UI.auth = function (kind, payload) {
    return send(kind, payload || {}).then(function (r) {
      if (r && r.ok === false) { var err = new Error(r.error); err.uiApi = true; err.expected = true; throw err; }
      if (r && 'me' in r && (r.me || kind === 'logout')) {
        UI.me = r.me || null;
        var target = r.me ? (UI.after || '#' + UI.config.home) : '#' + UI.config.landing;
        UI.after = null;
        if (location.hash === target) route(); else location.hash = target;
      }
      return r;
    });
  };
  /* Update the signed-in user's details (e.g. a new name) and redraw the header, without reloading the page. */
  UI.setMe = function (me) {
    UI.me = me || null;
    if (shellRoot) renderChrome(current.name);
  };

  /* ------------------------------------------------------------------ pages and routing */
  UI.page = function (name, opts, mount) {
    if (typeof opts === 'function') { mount = opts; opts = {}; }
    opts.name = name; opts.mount = mount;
    UI.pages[name] = opts;
  };
  UI.allowed = function (p) {
    if (!p) return false;
    if (p.auth === 'user') return !!UI.me;
    if (p.auth === 'admin') return !!(UI.me && UI.me.is_admin);
    if (p.auth === 'guest') return !UI.me;
    return true;
  };
  UI.navPages = function () {
    return Object.keys(UI.pages).map(function (k) { return UI.pages[k]; })
      .filter(function (p) { return p.nav && UI.allowed(p) && (!p.when || p.when()); })
      .sort(function (a, b) { return (a.order || 50) - (b.order || 50); });
  };
  UI.parseHash = function () {
    var h = (location.hash || '').replace(/^#!?\/?/, '');
    var parts = h.split('?')[0].split('/').filter(function (x) { return x !== ''; }).map(decodeURIComponent);
    return { name: parts[0] || '', args: parts.slice(1) };
  };
  UI.hashFor = function (name) {
    var args = Array.prototype.slice.call(arguments, 1).filter(function (a) { return a != null && a !== ''; });
    return '#' + [name].concat(args.map(encodeURIComponent)).join('/');
  };
  UI.go = function (name) {
    var h = UI.hashFor.apply(null, arguments);
    if (location.hash === h) route(); else location.hash = h;
  };
  UI.refresh = function () { route(); };
  UI.after = null;  // where to go after signing in

  var shellRoot = null, view = null, current = { name: null, destroy: null }, routeSeq = 0;

  function defaultPage() { return UI.me ? UI.config.home : UI.config.landing; }

  function route() {
    var r = UI.parseHash(), name = r.name || defaultPage(), p = UI.pages[name];
    if (!p) { name = defaultPage(); p = UI.pages[name]; r.args = []; }
    if (p.auth === 'guest' && UI.me) { p = UI.pages[UI.config.home]; name = UI.config.home; r.args = []; }
    if ((p.auth === 'user' || p.auth === 'admin') && !UI.me) {
      UI.after = location.hash && location.hash !== '#' ? location.hash : null;
      p = UI.pages.auth; name = 'auth'; r.args = [];
    }
    if (p.auth === 'admin' && !(UI.me && UI.me.is_admin)) {
      UI.toast('That page is for admins only.', 'error');
      p = UI.pages[UI.config.home]; name = UI.config.home; r.args = [];
    }
    var seq = ++routeSeq;
    window.UI_READY = false;
    if (current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
    current = { name: name, args: r.args, destroy: null };
    if (shellRoot) {
      shellRoot.className = 'ui ui-shell page-' + name + (UI.me ? ' signed-in' : ' signed-out') + (p.chrome === false ? ' no-chrome' : '');
      renderChrome(name);
    }
    // A fresh element for every page, so listeners a page adds to `view` never pile up.
    var fresh = view.cloneNode(false);
    view.parentNode.replaceChild(fresh, view);
    view = fresh;
    window.scrollTo(0, 0);
    document.title = (p.title ? (typeof p.title === 'function' ? p.title(r.args) : p.title) + ' · ' : '') + UI.config.name;
    var ctx = { name: name, args: r.args, me: UI.me, go: UI.go, api: UI.api, page: p };
    var out;
    try { out = p.mount(view, ctx); } catch (e) { console.error(e); out = Promise.reject(e); }
    var ready = out && typeof out.then === 'function' ? out : (out && out.ready) || Promise.resolve();
    if (out && out.destroy) current.destroy = out.destroy;
    Promise.resolve(ready).then(function () { if (seq === routeSeq) window.UI_READY = true; },
      function (e) {
        if (seq !== routeSeq) return;
        console.error(e);
        if (!view.innerHTML) view.innerHTML = '<div class="ui-wrap"><div class="ui-empty">' + UI.icon('info') +
          '<h3>This page didn\'t load</h3><p class="muted">' + UI.esc(e && e.message || 'Something went wrong.') + '</p>' +
          '<button class="ui-btn" onclick="UI.refresh()">Try again</button></div></div>';
        window.UI_READY = true;
      });
  }
  UI.current = function () { return current; };

  /* The shell's parts come from web/app.js: UI.shell = {header(me, active), footer(me), tabbar(me, active)} */
  function renderChrome(active) {
    var S = UI.shell || {};
    var hd = shellRoot.querySelector('[data-ui-header]'), ft = shellRoot.querySelector('[data-ui-footer]'), tb = shellRoot.querySelector('[data-ui-tabbar]');
    if (hd) hd.innerHTML = S.header ? S.header(UI.me, active) : '';
    if (ft) ft.innerHTML = S.footer ? S.footer(UI.me, active) : '';
    if (tb) tb.innerHTML = S.tabbar ? S.tabbar(UI.me, active) : '';
  }
  UI.renderChrome = function () { if (shellRoot) renderChrome(current.name); };

  /* Called by client_code/Main.py (and by the local harness) once the page is up. */
  UI.start = function (node, bridgeFn, bootJson) {
    bridge = bridgeFn;
    var boot = typeof bootJson === 'string' ? JSON.parse(bootJson || '{}') : (bootJson || {});
    UI.me = boot.me || null;
    var host = node && node.matches && node.matches('[data-ui-app]') ? node : (node && node.querySelector('[data-ui-app]')) || node || document.body;
    host.innerHTML = '<div class="ui ui-shell">' +
      '<header class="ui-header" data-ui-header></header>' +
      '<main class="ui-main" data-ui-view></main>' +
      '<footer class="ui-footer" data-ui-footer></footer>' +
      '<nav class="ui-tabbar" data-ui-tabbar aria-label="Main"></nav></div>';
    shellRoot = host.firstChild;
    view = host.querySelector('[data-ui-view]');
    if (UI.shell && UI.shell.wire) UI.shell.wire(shellRoot);
    window.addEventListener('hashchange', route);
    route();
  };

  /* ------------------------------------------------------------------ feedback form (footer + menu) */
  UI.feedback = function (kind) {
    var kinds = [['bug', 'Something\'s broken', 'bug'], ['idea', 'An idea', 'bulb'], ['question', 'A question', 'info'], ['other', 'Something else', 'chat']];
    var m = UI.modal('<h2>Send feedback</h2><p class="muted">Found a bug or have an idea? It goes straight to the people who make ' + UI.esc(UI.config.name) + '.</p>' +
      '<form class="ui-stack" data-fb>' +
      '<div class="ui-choices">' + kinds.map(function (k) {
        return '<label class="ui-choice"><input type="radio" name="kind" value="' + k[0] + '"' + ((kind || 'bug') === k[0] ? ' checked' : '') + '>' +
          '<span>' + UI.icon(k[2]) + UI.esc(k[1]) + '</span></label>';
      }).join('') + '</div>' +
      '<label class="ui-field"><span>What happened, or what would you like?</span><textarea name="message" rows="5" required minlength="5" placeholder="The more detail, the better."></textarea></label>' +
      (UI.me ? '' : '<label class="ui-field"><span>Your email <em>(optional, if you\'d like a reply)</em></span><input type="email" name="email" autocomplete="email"></label>') +
      '<p class="ui-hint">We also send the page you were on, your screen size and browser, to help us fix bugs.</p>' +
      '<div class="ui-row end"><button type="button" class="ui-btn ghost" data-close>Cancel</button><button class="ui-btn primary" type="submit">' + UI.icon('arrow') + 'Send</button></div></form>');
    var form = m.el.querySelector('[data-fb]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = UI.formData(form);
      var ctx = { page: location.hash || '#', screen: innerWidth + 'x' + innerHeight, browser: navigator.userAgent.slice(0, 280), theme: UI.theme() };
      UI.busy(form.querySelector('[type=submit]'), UI.api('submit_feedback', v.kind, v.message, v.email || null, ctx)).then(function () {
        m.close(); UI.toast('Thank you! Your message was sent.', 'ok');
      });
    });
    return m;
  };

  /* Shared clicks: [data-go="page/arg"], [data-feedback], [data-theme-set] anywhere in the app. */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-go],[data-feedback],[data-theme-set]');
    if (!el) return;
    if (el.hasAttribute('data-go')) { e.preventDefault(); UI.go.apply(null, el.getAttribute('data-go').split('/')); }
    else if (el.hasAttribute('data-feedback')) { e.preventDefault(); UI.feedback(el.getAttribute('data-feedback') || null); }
    else if (el.hasAttribute('data-theme-set')) { e.preventDefault(); UI.setTheme(el.getAttribute('data-theme-set')); if (UI.shell && UI.shell.onTheme) UI.shell.onTheme(); }
  });
})();


/* app.js: this app's identity and frame: name, header, footer, phone tab bar, extra icons.
   Pages live in web/pages/*.html (shared parts start with "_"). The engine (window.UI) is web/core.js. */
(function () {
  'use strict';
  UI.configure({
    name: 'Yabanana',
    key: 'yabanana',             // prefix for this app's browser storage
    tagline: 'Write bars. Write lines. Write hooks. Over real beats.',
    home: 'home',                // first page after signing in
    landing: 'landing'           // first page for visitors who aren't signed in
  });

  // Extra icons for this app (24x24, stroke).
  var I = UI.ICONS;
  I.banana = '<path d="M17.5 4.5c1.6 6.5-2.4 13.4-11.5 14.6-.9.1-1.2-.9-.4-1.3 6.6-3 9.6-7.6 9.6-13"/><path d="M15.2 4.8 15.6 2.5"/><path d="M14 8.5c-.6 4-3.2 7.2-7 8.8"/>';
  I.play = '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>';
  I.stop = '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>';
  I.mic = '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>';
  I.pen = '<path d="M4 20l1.2-4.3L15.8 5.1a2 2 0 0 1 2.9 0l.2.2a2 2 0 0 1 0 2.9L8.3 18.8z"/><path d="M13.5 7.5l3 3"/>';
  I.flame = '<path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.8 3-5.6 3.7-9.3 2.6 1.6 3.4 4 3.3 5.6 1-.6 1.7-1.7 1.9-3 2.4 1.9 4.1 4.4 4.1 6.8C18.5 18.3 16 21 12 21z"/>';
  I.shuffle = '<path d="M3 7h3.5c4.5 0 6.5 10 11 10H21"/><path d="M3 17h3.5c2 0 3.3-1.6 4.4-3.6M13.1 9.6C14.2 8.1 15.4 7 17.5 7H21"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/>';
  I.trophy = '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20.5h7M9.5 17.5h5"/>';
  I.wave = '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10"/>';
  I.book = '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>';
  I.flag = '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>';
  I.remix = '<path d="M4 8h11a4 4 0 0 1 0 8H9"/><path d="m7 5-3 3 3 3"/><path d="m12 13-3 3 3 3"/>';
  I.share = '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>';
  I.eye = '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>';
  I.quote = '<path d="M9.5 7C6.5 7.5 5 9.5 5 13v4h5v-5H7.5c0-2 .8-3 2.5-3.5zM18.5 7c-3 .5-4.5 2.5-4.5 6v4h5v-5h-2.5c0-2 .8-3 2.5-3.5z"/>';

  var esc = UI.esc;

  function brand() {
    return '<a class="ui-brand" href="#" data-go="' + (UI.me ? UI.config.home : UI.config.landing) + '" aria-label="' + esc(UI.config.name) + ' home">' +
      '<img src="_/theme/icon.svg" alt="" width="34" height="34"><span>' + esc(UI.config.name) + '</span></a>';
  }

  function themeSwitch() {
    var t = UI.theme();
    return '<div class="ui-seg" role="group" aria-label="Appearance">' + [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
      return '<button type="button" data-theme-set="' + o[0] + '" class="' + (t === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function userMenu(me) {
    return '<div class="ui-menu" data-menu hidden>' +
      '<div class="ui-menu-head"><strong>' + esc(me.name) + '</strong><span class="muted small">' + esc(me.email) + '</span></div>' +
      '<a href="#writer/' + esc(me.id) + '" data-go="writer/' + esc(me.id) + '">' + UI.icon('mic') + 'Your writer page</a>' +
      '<a href="#profile" data-go="profile">' + UI.icon('user') + 'Your profile</a>' +
      '<a href="#beats" data-go="beats">' + UI.icon('wave') + 'Beats &amp; theory</a>' +
      '<a href="#lab" data-go="lab">' + UI.icon('book') + 'Rhyme lab</a>' +
      (me.is_admin ? '<a href="#admin" data-go="admin">' + UI.icon('shield') + 'Admin</a>' : '') +
      '<div class="ui-menu-block"><span class="small muted">Appearance</span>' + themeSwitch() + '</div>' +
      '<button type="button" data-feedback>' + UI.icon('chat') + 'Send feedback</button>' +
      '<button type="button" data-lk-open="overview">' + UI.icon('lock') + 'Privacy &amp; Terms</button>' +
      '<button type="button" data-signout>' + UI.icon('logout') + 'Sign out</button></div>';
  }

  // Pages anyone can open, shown in the header for visitors who aren't signed in.
  var PUBLIC_NAV = [['home', 'Stage', 'shuffle'], ['charts', 'Charts', 'trophy'], ['beats', 'Beats', 'wave'], ['lab', 'Rhyme lab', 'book']];

  UI.shell = {
    header: function (me, active) {
      var nav = me ? UI.navPages().map(function (p) { return [p.name, p.nav, p.icon]; }) : PUBLIC_NAV;
      return '<div class="ui-header-in">' + brand() +
        '<nav class="ui-nav" aria-label="Main">' + nav.map(function (p) {
          return '<a href="#' + p[0] + '" class="' + (p[0] === active ? 'on' : '') + '">' + UI.icon(p[2]) + '<span>' + esc(p[1]) + '</span></a>';
        }).join('') + '</nav>' +
        '<div class="ui-header-right">' +
        (me ? '<a class="ui-btn primary sm yb-newbtn" href="#studio/new" data-go="studio/new">' + UI.icon('pen') + '<span>Write</span></a>' +
          '<button type="button" class="ui-avatar-btn" data-menu-toggle aria-label="Your account" aria-haspopup="true">' + esc(UI.initials(me.name)) + '</button>' + userMenu(me)
          : (active === 'auth' ? '' : '<a class="ui-btn ghost" href="#auth" data-go="auth">Sign in</a><a class="ui-btn primary" href="#auth/signup" data-go="auth/signup">Join</a>')) +
        '</div></div>';
    },
    footer: function (me) {
      return '<div class="ui-footer-in"><div class="ui-footer-brand">' + brand() + '<p class="muted small">' + esc(UI.config.tagline) + '</p>' +
        '<p class="small faint" style="margin-top:6px">Rhymes and syllables from the CMU Pronouncing Dictionary (Carnegie Mellon University). Beats are synthesized in your browser.</p></div>' +
        '<div class="ui-footer-links">' +
        '<a href="#home" data-go="home">Stage</a><a href="#charts" data-go="charts">Charts</a><a href="#beats" data-go="beats">Beats &amp; theory</a><a href="#lab" data-go="lab">Rhyme lab</a>' +
        '<a href="#landing" data-go="landing">About</a>' +
        '<button type="button" data-feedback>Send feedback</button>' +
        '<button type="button" data-lk-open="overview">Privacy &amp; Terms</button>' +
        '</div><p class="ui-footer-legal small muted">© ' + new Date().getFullYear() + ' ' + esc(UI.config.name) + ' · Peel back the beat 🍌</p></div>';
    },
    tabbar: function (me, active) {
      var nav = UI.navPages();
      if (!me || nav.length < 2) return '';
      return nav.slice(0, 4).map(function (p) {
        return '<a href="#' + p.name + '" class="' + (p.name === active ? 'on' : '') + '">' + UI.icon(p.icon) + '<span>' + esc(p.nav) + '</span></a>';
      }).join('') + '<a href="#profile" class="' + (active === 'profile' ? 'on' : '') + '">' + UI.icon('user') + '<span>You</span></a>';
    },
    wire: function (root) {
      root.addEventListener('click', function (e) {
        var t = e.target.closest('[data-menu-toggle]');
        var menu = root.querySelector('[data-menu]');
        if (t && menu) { menu.hidden = !menu.hidden; t.setAttribute('aria-expanded', String(!menu.hidden)); return; }
        if (e.target.closest('[data-signout]')) { UI.auth('logout').then(function () { UI.toast('Signed out. Keep writing!'); }); }
        if (menu && !menu.hidden && !e.target.closest('[data-menu] .ui-seg')) menu.hidden = true;
      });
      document.addEventListener('keydown', function (e) {
        var menu = root.querySelector('[data-menu]');
        if (e.key === 'Escape' && menu) menu.hidden = true;
      });
    },
    onTheme: function () {  // redraw the menu's Auto/Light/Dark buttons and keep the menu open
      var menu = document.querySelector('[data-menu]'), open = menu && !menu.hidden;
      UI.renderChrome();
      if (open) document.querySelector('[data-menu]').hidden = false;
    }
  };
})();


/* ===== _beats.html ===== */
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
  YB.lightSteps = function (root) {
    return P.on(function (ev) {
      if (ev.type === 'state' && !ev.playing) { root.querySelectorAll('.yb-steps i.now').forEach(function (i) { i.classList.remove('now'); }); return; }
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

/* ===== _perform.html ===== */
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

/* ===== _shared.html ===== */
(function () {
  'use strict';
  var YB = window.YB = window.YB || {};
  var esc = UI.esc;

  YB.SCENES = { rap: { name: 'Rap', word: 'bars', desc: 'Flow, punchlines, multis' }, poetry: { name: 'Poetry', word: 'lines', desc: 'Meter, images, the turn' },
                pop: { name: 'Pop', word: 'hooks', desc: 'Hooks, choruses, singability' } };
  YB.sceneName = function (s) { return (YB.SCENES[s] || YB.SCENES.rap).name; };
  YB.sceneBadge = function (s) { return '<span class="yb-scene sc-' + esc(s || 'rap') + '">' + esc(YB.sceneName(s)) + '</span>'; };
  YB.MOODS = ['Hype', 'Defiant', 'Tender', 'Heartbroken', 'Dreamy', 'Nostalgic', 'Playful', 'Dark', 'Hopeful'];
  YB.KINDS = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Hook', 'Bridge', 'Outro', 'Stanza', 'Couplet', 'Refrain', 'Spoken'];
  YB.writerLink = function (a) {
    return a && a.id ? '<a href="#writer/' + esc(a.id) + '" data-go="writer/' + esc(a.id) + '">' + esc(a.name) + '</a>' : '<span>' + esc(a ? a.name : 'Someone') + '</span>';
  };
  YB.avatar = function (a, lg) {
    var s = (a && a.scene) || 'rap';
    var inner = esc(UI.initials(a ? a.name : '?'));
    return a && a.id ? '<a class="yb-avatar sc-' + esc(s) + (lg ? ' lg' : '') + '" href="#writer/' + esc(a.id) + '" data-go="writer/' + esc(a.id) + '" aria-label="' + esc(a.name) + '">' + inner + '</a>'
      : '<span class="yb-avatar sc-' + esc(s) + (lg ? ' lg' : '') + '">' + inner + '</span>';
  };
  YB.upBtn = function (s, lg) {
    return '<button type="button" class="yb-up' + (s.upvoted ? ' on' : '') + (lg ? ' lg' : '') + '" data-upvote="' + esc(s.id) + '"' + (s.mine ? ' data-mine="1"' : '') +
      ' aria-pressed="' + (s.upvoted ? 'true' : 'false') + '" aria-label="Upvote (' + s.upvotes + ')" title="' + (s.upvoted ? 'In your Bunch. Click to remove.' : 'Upvote: saves it to your Bunch') + '">' +
      UI.icon('banana') + '<span data-n>' + s.upvotes + '</span></button>';
  };

  /* A song card. opts: {rank, extra (html under the byline), noBeat} */
  YB.card = function (s, opts) {
    opts = opts || {};
    var flag = s.featured ? '<span class="flag">' + UI.icon('star') + 'Staff pick</span>' : s.boosts ? '<span class="flag">' + UI.icon('flame') + 'Promoted ×' + s.boosts + '</span>'
      : s.status && s.status !== 'published' ? '<span class="flag" style="color:var(--c-muted)">' + UI.icon('lock') + 'Draft</span>' : s.hidden ? '<span class="flag">Hidden</span>' : '';
    return '<article class="yb-card sc-' + esc(s.scene) + '" data-song="' + esc(s.id) + '">' +
      '<div class="yb-card-top">' + (opts.rank ? '<b style="font:800 1.3rem/1 var(--font-display)">#' + opts.rank + '</b>' : '') + YB.sceneBadge(s.scene) +
        (s.mood ? '<span class="mood">' + esc(s.mood) + '</span>' : '') + flag + '</div>' +
      '<h3><a href="#song/' + esc(s.id) + '" data-go="song/' + esc(s.id) + '">' + esc(s.title) + '</a></h3>' +
      '<blockquote class="yb-excerpt">' + (s.excerpt && s.excerpt.length ? s.excerpt.slice(0, 4).map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') : '<span class="faint">(no lines yet)</span>') + '</blockquote>' +
      '<div class="yb-card-by">by ' + YB.writerLink(s.author) + '<span>·</span><span>' + esc(UI.ago(s.published || s.updated || s.created)) + '</span>' +
        (s.remix_of ? '<span>·</span><span>remix</span>' : '') + '</div>' + (opts.extra || '') +
      '<div class="yb-card-foot">' + (opts.noBeat ? '' : YB.beatChip(s.beat, s.bpm, 'card-' + s.id)) + '<span class="grow"></span>' +
        (s.review_count ? '<span class="yb-count" title="Reviews">' + UI.icon('chat') + s.review_count + '</span>' : '') +
        (s.status === 'published' && !opts.noUp ? YB.upBtn(s) : '') + '</div></article>';
  };
  YB.cards = function (songs, opts) {
    return '<div class="yb-cards">' + songs.map(function (s, i) { return YB.card(s, opts && opts.ranked ? { rank: i + 1 } : opts); }).join('') + '</div>';
  };

  /* Ripeness: a writer's level from the bananas (upvotes) their songs received. */
  var RIPE = [[0, 'Green', '#7cc35a'], [5, 'Ripening', '#c9d64a'], [20, 'Ripe', '#ffc21a'], [50, 'Sweet', '#e8a317'], [100, 'Golden Bunch', '#d48a00']];
  YB.ripeness = function (n) {
    var lvl = RIPE[0], next = null;
    RIPE.forEach(function (r, i) { if (n >= r[0]) { lvl = r; next = RIPE[i + 1] || null; } });
    return { name: lvl[1], color: lvl[2], at: lvl[0], next: next ? { name: next[1], at: next[0] } : null };
  };
  YB.ripeBadge = function (n) {
    var r = YB.ripeness(n);
    return '<span class="yb-ripe" title="' + n + ' bananas received' + (r.next ? ', ' + (r.next.at - n) + ' more to ' + r.next.name : '') + '"><span style="color:' + r.color + '">' + UI.icon('banana') + '</span>' + esc(r.name) + '</span>';
  };

  YB.confetti = function (x, y, n) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#ffc21a', '#ff3d7f', '#3e5bd8', '#e8a317'];
    for (var i = 0; i < (n || 16); i++) {
      var d = document.createElement('span');
      d.className = 'yb-confetti';
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

  YB.joinNudge = function (what) {
    var m = UI.modal('<div style="text-align:center"><div style="font-size:3rem;line-height:1">🍌</div><h2 style="padding:0">Join the bunch</h2>' +
      '<p class="muted">' + esc(what || 'Sign up to upvote songs') + '. Upvoted songs are saved to your Bunch, so you can find them again. It\'s free.</p>' +
      '<div class="ui-row" style="justify-content:center;margin-top:16px"><a class="ui-btn primary" href="#auth/signup" data-go="auth/signup" data-close>Create an account</a>' +
      '<a class="ui-btn" href="#auth" data-go="auth" data-close>Sign in</a></div></div>');
    return m;
  };

  /* [data-upvote] anywhere: toggle, update every button for that song. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-upvote]');
    if (!b) return;
    e.preventDefault();
    var id = b.getAttribute('data-upvote');
    if (!UI.me) { UI.after = location.hash; YB.joinNudge('Sign up to upvote this song'); return; }
    if (b.hasAttribute('data-mine')) { UI.toast('That\'s your own song. Share the link instead!'); return; }
    var wasOn = b.classList.contains('on'), n = +(b.querySelector('[data-n]') || {}).textContent || 0;
    function paint(on, count) {
      document.querySelectorAll('[data-upvote="' + id + '"]').forEach(function (x) {
        x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false');
        var c = x.querySelector('[data-n]'); if (c) c.textContent = count;
      });
    }
    paint(!wasOn, n + (wasOn ? -1 : 1));
    if (!wasOn) { var r = b.getBoundingClientRect(); YB.confetti(r.left + 18, r.top + r.height / 2, 12); }
    UI.apiQuiet('toggle_upvote', id).then(function (res) {
      paint(res.upvoted, res.upvotes);
      if (res.upvoted && !UI.store.get('bunchTip')) { UI.store.set('bunchTip', 1); UI.toast('Saved to your Bunch. Find it under Bunch any time.', 'ok'); }
      document.dispatchEvent(new CustomEvent('yb-upvote', { detail: { id: id, upvoted: res.upvoted, upvotes: res.upvotes } }));
    }, function (err) { paint(wasOn, n); UI.toast(err.message, 'error'); });
  });

  /* Clicking a card anywhere that isn't a link or button opens the song. */
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.yb-card[data-song]');
    if (!c || e.target.closest('a, button, input, select, textarea, label')) return;
    if (window.getSelection && String(window.getSelection())) return;  // selecting text, not clicking
    UI.go('song', c.getAttribute('data-song'));
  });

  /* Full lyrics. opts: {scheme: true (needs YB.words loaded), fav: 'a line to highlight'} */
  YB.lyricsHtml = function (sections, opts) {
    opts = opts || {};
    var lines = [], where = [];
    sections.forEach(function (s, si) { (s.text || '').split('\n').forEach(function (l) { lines.push(l); where.push(si); }); });
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
  YB.lines = function (sections) {
    var out = [];
    (sections || []).forEach(function (s) { (s.text || '').split('\n').forEach(function (l) { if (l.trim()) out.push(l.trim()); }); });
    return out;
  };
  YB.copyLink = function (hash) {
    var url = location.href.split('#')[0].split('?')[0] + hash;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { UI.toast('Link copied', 'ok'); },
      function () { UI.modal('<h2>Share this song</h2><input type="text" readonly value="' + esc(url) + '" onclick="this.select()">'); });
  };
})();

/* ===== _words.html ===== */
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
    el.innerHTML = '<nav class="ui-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" data-htab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</nav>' +
      '<form class="yb-help-q" data-hq><input type="search" name="q" autocomplete="off" placeholder="A word…"><button class="ui-btn sm" type="submit">' + UI.icon('search') + '</button></form>' +
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
})();

/* ===== admin.html ===== */
(function () {
  var esc = UI.esc;
  var TABS = [['overview', 'Overview', 'grid'], ['songs', 'Songs', 'mic'], ['reports', 'Reports', 'flag'], ['feedback', 'Feedback', 'inbox'], ['users', 'Users', 'users'], ['demo', 'Demo data', 'database']];

  UI.page('admin', { title: 'Admin', auth: 'admin' }, function (view, ctx) {
    var tab = TABS.some(function (t) { return t[0] === ctx.args[0]; }) ? ctx.args[0] : 'overview';
    var fbFilter = 'new';
    view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><h1>Admin</h1><p class="muted">Only admins see this page.</p></div></div>' +
      '<nav class="ui-tabs">' + TABS.map(function (t) {
        return '<a href="#admin/' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + UI.icon(t[2]) + t[1] + '</a>';
      }).join('') + '</nav><div data-body><div class="ui-skel"></div></div></div>';
    var body = view.querySelector('[data-body]');

    function overview() {
      return UI.api('admin_overview').then(function (d) {
        var stat = function (n, label, go) { return '<a class="ui-card ui-stat" href="#admin/' + go + '" style="text-decoration:none;color:inherit"><b>' + n + '</b><span>' + label + '</span></a>'; };
        body.innerHTML = '<div class="ad-stats">' + stat(d.users, 'people signed up', 'users') + stat(d.admins, UI.plural(d.admins, 'admin').replace(/^\d+ /, ''), 'users') +
          stat(d.feedback_new, 'new feedback', 'feedback') + stat(d.songs, 'songs on stage', 'songs') + stat(d.drafts, 'drafts', 'songs') +
          stat(d.reports_open, 'open reports', 'reports') + stat(d.reviews, 'reviews', 'songs') + stat(d.upvotes, 'upvotes', 'songs') + '</div>' +
          '<p class="muted small" style="margin-top:18px">Demo data is <b>' + esc(d.demo.state) + '</b> (' + d.demo.counts.users + ' demo people). Manage it in the Demo data tab.</p>';
      });
    }

    function feedback() {
      return UI.api('list_feedback', null).then(function (d) {
        var items = d.items.filter(function (i) { return fbFilter === 'all' || i.status === fbFilter; });
        body.innerHTML = '<div class="ui-row" style="margin-bottom:16px"><div class="ui-seg">' + [['new', 'New'], ['read', 'Read'], ['done', 'Done'], ['all', 'All']].map(function (f) {
          var n = f[0] === 'all' ? d.items.length : d.counts[f[0]];
          return '<button data-filter="' + f[0] + '" class="' + (fbFilter === f[0] ? 'on' : '') + '">' + f[1] + ' (' + n + ')</button>';
        }).join('') + '</div></div>' +
          (items.length ? '<div class="ad-fb">' + items.map(function (i) {
            var c = i.context || {};
            return '<div class="ui-item" data-id="' + esc(i.id) + '"><div class="meta"><span class="ui-badge ' + (i.kind === 'bug' ? 'bad' : i.kind === 'idea' ? 'brand' : '') + '">' + esc(i.kind_label) + '</span>' +
              '<b>' + esc(i.name) + '</b>' + (i.email ? '<a href="mailto:' + esc(i.email) + '">' + esc(i.email) + '</a>' : '') + '<span>' + esc(UI.fmtDateTime(i.created)) + '</span></div>' +
              '<p class="msg">' + esc(i.message) + '</p>' +
              '<div class="ctx">' + esc([c.page, c.screen, c.theme, c.browser].filter(Boolean).join(' · ')) + '</div>' +
              '<textarea data-note placeholder="Private note (only admins see it)">' + esc(i.note) + '</textarea>' +
              '<div class="ui-row" style="margin-top:10px">' + ['new', 'read', 'done'].map(function (s) {
                return '<button class="ui-btn sm' + (i.status === s ? ' primary' : '') + '" data-status="' + s + '">' + s[0].toUpperCase() + s.slice(1) + '</button>';
              }).join('') + '<span class="ui-spacer"></span><button class="ui-btn sm danger" data-del-fb>' + UI.icon('trash') + 'Delete</button></div></div>';
          }).join('') + '</div>'
            : '<div class="ui-empty">' + UI.icon('inbox') + '<h3>No ' + (fbFilter === 'all' ? '' : fbFilter + ' ') + 'messages</h3><p>Messages from the "Send feedback" form show up here.</p></div>');
      });
    }

    function users(query) {
      return UI.api('list_users', query || null).then(function (d) {
        body.innerHTML = '<form class="ui-row" data-search style="margin-bottom:14px"><input type="search" name="q" placeholder="Search by name or email" value="' + esc(query || '') + '" style="max-width:360px">' +
          '<button class="ui-btn" type="submit">' + UI.icon('search') + 'Search</button><span class="muted small">' + UI.plural(d.total, 'person', 'people') + '</span></form>' +
          '<table class="ad-users"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Admin</th><th>Active</th></tr></thead><tbody>' +
          d.users.map(function (u) {
            return '<tr data-id="' + esc(u.id) + '"><td><b>' + esc(u.name) + '</b></td><td class="email">' + esc(u.email) + '</td><td class="joined muted">' + esc(UI.fmtDate(u.joined)) + '</td>' +
              '<td><label class="ui-check"><input type="checkbox" data-admin' + (u.is_admin ? ' checked' : '') + '> Admin</label></td>' +
              '<td><label class="ui-check"><input type="checkbox" data-enabled' + (u.enabled ? ' checked' : '') + '> Active</label></td></tr>';
          }).join('') + '</tbody></table>';
      });
    }

    function demo() {
      return UI.api('admin_overview').then(function (d) {
        var c = d.demo.counts;
        body.innerHTML = '<div class="ui-card ui-narrow" style="margin:0"><h3>Demo data</h3>' +
          '<p class="muted">Example people and content, so the app never looks empty for the first visitors. Demo rows are flagged, so removing them never touches real data. Once removed, it stays removed until you load it again.</p>' +
          '<p>Status: <b>' + esc(d.demo.state) + '</b> · ' + Object.keys(c).map(function (k) { return c[k] + ' ' + esc(k); }).join(', ') + '</p>' +
          '<div class="ui-row"><button class="ui-btn primary" data-demo="load">' + UI.icon('refresh') + (d.demo.state === 'loaded' ? 'Reload demo data' : 'Load demo data') + '</button>' +
          '<button class="ui-btn danger" data-demo="remove">' + UI.icon('trash') + 'Remove demo data</button></div></div>';
      });
    }

    var songShow = 'all';
    function songs(query) {
      return UI.api('admin_songs', query || null, songShow).then(function (d) {
        body.innerHTML = '<form class="ui-row" data-song-search style="margin-bottom:14px"><input type="search" name="q" placeholder="Title or writer" value="' + esc(query || '') + '" style="max-width:300px">' +
          '<button class="ui-btn" type="submit">' + UI.icon('search') + 'Search</button><div class="ui-seg">' + [['all', 'All'], ['featured', 'Staff picks'], ['hidden', 'Hidden'], ['drafts', 'Drafts']].map(function (f) {
            return '<button type="button" data-song-show="' + f[0] + '" class="' + (songShow === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div>' +
          '<span class="muted small">' + UI.plural(d.total, 'song') + '</span></form>' +
          (d.songs.length ? '<div class="ad-fb">' + d.songs.map(function (s) {
            return '<div class="ui-item sc-' + esc(s.scene) + '" data-sid="' + esc(s.id) + '"><div class="meta">' + YB.sceneBadge(s.scene) + '<b><a href="#song/' + esc(s.id) + '" data-go="song/' + esc(s.id) + '">' + esc(s.title) + '</a></b>' +
              '<span>by ' + esc(s.author.name) + '</span><span>' + esc(s.status) + '</span><span>' + UI.icon('banana') + ' ' + s.upvotes + '</span><span>' + UI.icon('chat') + ' ' + s.review_count + '</span>' +
              (s.open_reports ? '<span class="ui-badge bad">' + UI.plural(s.open_reports, 'report') + '</span>' : '') + (s.demo ? '<span class="ui-badge">Demo</span>' : '') + '</div>' +
              '<p class="msg" style="font-family:var(--font-lyric);font-style:italic">' + esc(s.excerpt.slice(0, 2).join(' / ')) + '</p>' +
              '<div class="ui-row"><label class="ui-check"><input type="checkbox" data-featured' + (s.featured ? ' checked' : '') + '> Staff pick</label>' +
              '<label class="ui-check"><input type="checkbox" data-hidden' + (s.hidden ? ' checked' : '') + '> Hidden</label><span class="ui-spacer"></span>' +
              '<button class="ui-btn sm danger" data-del-song>' + UI.icon('trash') + 'Delete</button></div></div>';
          }).join('') + '</div>' : '<div class="ui-empty">' + UI.icon('mic') + '<h3>No songs here</h3></div>');
      });
    }
    var repStatus = 'open';
    function reports() {
      return UI.api('list_reports', repStatus).then(function (d) {
        body.innerHTML = '<div class="ui-row" style="margin-bottom:16px"><div class="ui-seg">' + [['open', 'Open (' + d.open + ')'], ['resolved', 'Resolved']].map(function (f) {
          return '<button data-rep-status="' + f[0] + '" class="' + (repStatus === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div></div>' +
          (d.reports.length ? '<div class="ad-fb">' + d.reports.map(function (r) {
            var s = r.song;
            return '<div class="ui-item" data-rid="' + esc(r.id) + '"><div class="meta"><span class="ui-badge bad">' + esc(r.reason_label) + '</span><b>' + esc(r.by) + '</b><span>' + esc(UI.fmtDateTime(r.created)) + '</span>' +
              (s && s.hidden ? '<span class="ui-badge warn">Song hidden</span>' : '') + '</div>' +
              (s ? '<p class="msg"><a href="#song/' + esc(s.id) + '" data-go="song/' + esc(s.id) + '"><b>' + esc(s.title) + '</b></a> by ' + esc(s.author.name) + '</p>' +
                '<p class="msg" style="font-family:var(--font-lyric);font-style:italic">' + esc(s.excerpt.join(' / ')) + '</p>' : '<p class="msg muted">The song was deleted.</p>') +
              (r.note ? '<p class="msg">“' + esc(r.note) + '”</p>' : '') +
              (r.status === 'open' ? '<div class="ui-row"><button class="ui-btn sm" data-resolve="dismiss">' + UI.icon('check') + 'It\'s fine (unhide)</button>' +
                '<button class="ui-btn sm danger" data-resolve="hide">' + UI.icon('eye') + 'Hide the song</button></div>' : '') + '</div>';
          }).join('') + '</div>' : '<div class="ui-empty">' + UI.icon('flag') + '<h3>No ' + repStatus + ' reports</h3><p>Reports from members show up here. Three reports from different people hide a song automatically.</p></div>');
      });
    }

    var DRAW = { overview: overview, songs: songs, reports: reports, feedback: feedback, users: users, demo: demo };

    view.addEventListener('click', function (e) {
      var f = e.target.closest('[data-filter]');
      if (f) { fbFilter = f.getAttribute('data-filter'); feedback(); return; }
      var st = e.target.closest('[data-status]');
      if (st) {
        var card = st.closest('[data-id]');
        UI.api('set_feedback_status', card.getAttribute('data-id'), st.getAttribute('data-status'), card.querySelector('[data-note]').value).then(function () { UI.toast('Saved', 'ok'); feedback(); });
        return;
      }
      var del = e.target.closest('[data-del-fb]');
      if (del) {
        UI.confirm({ title: 'Delete this message?', ok: 'Delete', danger: true }).then(function (yes) {
          if (yes) UI.api('delete_feedback', del.closest('[data-id]').getAttribute('data-id')).then(feedback);
        });
        return;
      }
      var ss = e.target.closest('[data-song-show]');
      if (ss) { songShow = ss.getAttribute('data-song-show'); songs(); return; }
      var rs = e.target.closest('[data-rep-status]');
      if (rs) { repStatus = rs.getAttribute('data-rep-status'); reports(); return; }
      var rv = e.target.closest('[data-resolve]');
      if (rv) { UI.busy(rv, UI.api('resolve_report', rv.closest('[data-rid]').getAttribute('data-rid'), rv.getAttribute('data-resolve'))).then(function () { UI.toast('Done', 'ok'); reports(); }); return; }
      var ds = e.target.closest('[data-del-song]');
      if (ds) {
        UI.confirm({ title: 'Delete this song?', text: 'It is deleted with its upvotes, reviews and reports. This can\'t be undone.', ok: 'Delete', danger: true }).then(function (yes) {
          if (yes) UI.api('delete_song', ds.closest('[data-sid]').getAttribute('data-sid')).then(function () { UI.toast('Deleted', 'ok'); songs(); });
        });
        return;
      }
      var dm = e.target.closest('[data-demo]');
      if (dm) {
        var load = dm.getAttribute('data-demo') === 'load';
        UI.confirm({ title: load ? 'Load the demo data?' : 'Remove the demo data?', text: load ? 'Demo people and content are added (any old demo rows are replaced).' : 'Every demo row is deleted. Real data stays.', ok: load ? 'Load' : 'Remove', danger: !load })
          .then(function (yes) { if (yes) UI.busy(dm, UI.api(load ? 'demo_load' : 'demo_remove')).then(function () { UI.toast('Done', 'ok'); demo(); }); });
      }
    });
    view.addEventListener('change', function (e) {
      var sr = e.target.closest('[data-sid]');
      if (sr && (e.target.matches('[data-featured]') || e.target.matches('[data-hidden]'))) {
        var box0 = e.target, args = e.target.matches('[data-featured]') ? [box0.checked, null] : [null, box0.checked];
        UI.api('admin_set_song', sr.getAttribute('data-sid'), args[0], args[1]).then(function () { UI.toast('Saved', 'ok'); }, function (err) { box0.checked = !box0.checked; UI.toast(err.message, 'error'); });
        return;
      }
      var row = e.target.closest('tr[data-id]');
      if (!row) return;
      var id = row.getAttribute('data-id'), box = e.target;
      var fn = box.hasAttribute('data-admin') ? 'set_admin' : box.hasAttribute('data-enabled') ? 'set_enabled' : null;
      if (fn) UI.api(fn, id, box.checked).then(function () { UI.toast('Saved', 'ok'); }, function (err) { box.checked = !box.checked; UI.toast(err.message, 'error'); });
    });
    view.addEventListener('submit', function (e) {
      if (e.target.matches('[data-search]')) { e.preventDefault(); users(UI.formData(e.target).q); }
      if (e.target.matches('[data-song-search]')) { e.preventDefault(); songs(UI.formData(e.target).q); }
    });
    return DRAW[tab]();
  });
})();

/* ===== auth.html ===== */
(function () {
  var esc = UI.esc;
  function pw(name, auto) {
    return '<div class="au-pw"><input type="password" name="' + name + '" autocomplete="' + auto + '" required minlength="8">' +
      '<button type="button" data-show>Show</button></div>';
  }
  UI.page('auth', { title: 'Sign in', auth: 'guest' }, function (view, ctx) {
    var mode = ['signup', 'reset'].indexOf(ctx.args[0]) >= 0 ? ctx.args[0] : 'login';
    function draw(msg, isErr) {
      var heading = { login: 'Welcome back', signup: 'Create your account', reset: 'Reset your password' }[mode];
      var sub = { login: 'Sign in to continue to ' + esc(UI.config.name) + '.', signup: 'It\'s free and takes a few seconds.',
        reset: 'We\'ll email you a link to choose a new password.' }[mode];
      view.innerHTML = '<div class="au-wrap"><div class="ui-card au-card">' +
        '<h1>' + heading + '</h1><p class="muted">' + sub + '</p>' +
        (mode !== 'reset' ? '<div class="ui-seg" role="tablist"><button type="button" data-mode="login" class="' + (mode === 'login' ? 'on' : '') + '">Sign in</button>' +
          '<button type="button" data-mode="signup" class="' + (mode === 'signup' ? 'on' : '') + '">Create account</button></div>' : '<div style="height:14px"></div>') +
        '<form class="ui-stack" data-form="' + mode + '" novalidate>' +
        (mode === 'signup' ? '<label class="ui-field"><span>Your name</span><input type="text" name="name" autocomplete="name" required maxlength="60"></label>' : '') +
        '<label class="ui-field"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>' +
        (mode === 'login' ? '<label class="ui-field"><span>Password</span>' + pw('password', 'current-password') + '</label>' : '') +
        (mode === 'signup' ? '<label class="ui-field"><span>Password <em>(at least 8 characters)</em></span>' + pw('password', 'new-password') + '</label>' +
          (window.LegalKit ? '<div>' + LegalKit.consentField() + '</div>' : '') : '') +
        '<div data-msg role="alert"' + (msg ? ' class="' + (isErr ? 'ui-error' : 'ui-note') + '">' + esc(msg) : ' hidden>') + '</div>' +
        '<button class="ui-btn primary block" type="submit">' + { login: 'Sign in', signup: 'Create account', reset: 'Send the link' }[mode] + '</button></form>' +
        '<div class="au-links">' + (mode === 'login' ? '<a data-mode="reset">Forgot your password?</a>' : '<a data-mode="login">' + UI.icon('back') + ' Back to sign in</a>') +
        '<a href="#landing" data-go="landing">About ' + esc(UI.config.name) + '</a></div></div></div>';
      var first = view.querySelector('input');
      if (first && !msg) first.focus();
    }
    view.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mode]');
      if (m) { e.preventDefault(); mode = m.getAttribute('data-mode'); history.replaceState(null, '', '#auth' + (mode === 'login' ? '' : '/' + mode)); draw(); return; }
      var s = e.target.closest('[data-show]');
      if (s) { var i = s.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; s.textContent = i.type === 'password' ? 'Show' : 'Hide'; }
    });
    view.addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target, v = UI.formData(form);
      var problem = !/^\S+@\S+\.\S+$/.test(v.email || '') ? 'Please enter a valid email address.'
        : mode !== 'reset' && (v.password || '').length < (mode === 'signup' ? 8 : 1) ? (mode === 'signup' ? 'Please choose a password of at least 8 characters.' : 'Please enter your password.')
        : mode === 'signup' && (v.name || '').trim().length < 2 ? 'Please tell us your name.' : null;
      if (problem) { say(problem, true); return; }
      if (mode === 'signup' && window.LegalKit && !LegalKit.consentChecked(form)) return;  // the kit shows its own message
      UI.busy(form.querySelector('[type=submit]'), UI.auth(mode, v)).then(function (r) {
        if (mode === 'reset' || (r && !r.me)) { mode = 'login'; draw(r && r.message, false); restore({ email: v.email }); }
        else UI.toast(mode === 'signup' ? 'Welcome to ' + UI.config.name + '!' : 'Welcome back!', 'ok');
      }, function (err) { say(err.message, true); });
    });
    function say(msg, isErr) {
      var box = view.querySelector('[data-msg]');
      box.className = isErr ? 'ui-error' : 'ui-note'; box.textContent = msg; box.hidden = false;
    }
    function restore(v) {
      ['name', 'email'].forEach(function (k) { var i = view.querySelector('[name=' + k + ']'); if (i && v[k]) i.value = v[k]; });
    }
    draw();
  });
})();

/* ===== beats.html ===== */
(function () {
  var esc = UI.esc;
  var CRAFT = {
    rap: [['Multisyllabic rhyme', 'Rhyme two or three syllables at once: <i>broken heart / open art</i>. The Rhyme lab\'s "multis" find them.'],
          ['Internal rhyme', 'Rhymes inside the line, not just at the end: <i>stack the facts, back to back</i>.'],
          ['Punchline', 'Set up an image, then flip it in the last two words, landing on the snare.'],
          ['Flow switch', 'Change rhythm mid-verse: from 8th notes to triplets, or start lines off the beat.'],
          ['The pocket', 'Where your syllables sit against the drums. Aim the last stressed syllable at the snare on 4.']],
    poetry: [['Meter', 'The pattern of stressed (●) and unstressed (○) syllables. Iambs ○●, trochees ●○, anapests ○○●, dactyls ●○○.'],
             ['Enjambment', 'Let a sentence run over the line break so the reader leans into the next line.'],
             ['Caesura', 'A pause in the middle of a line (a comma, a dash): <i>I hold the hands — of strangers</i>.'],
             ['The volta', 'The turn: the place a poem changes its mind. Sonnets often turn at line 9.'],
             ['Slant rhyme', 'Rhymes that almost match: <i>rain / same, saucer / daughter</i>. Quieter than perfect rhyme.']],
    pop: [['The hook', 'The line people sing back. Short, repeated, usually the title.'],
          ['Pre-chorus lift', 'Shorter lines and rising tension right before the chorus "opens up".'],
          ['Prosody', 'Put stressed syllables on strong beats, and the emotional word on the longest note.'],
          ['Open vowels', '<i>Ooh, ay, oh, ah</i> are easy to hold and belt. Save them for long notes.'],
          ['Contrast', 'Verse low and wordy, chorus high and simple. The change is what feels big.']]
  };
  UI.page('beats', { title: 'Beats & theory' }, function (view, ctx) {
    var focus = ctx.args[0];
    function card(b) {
      return '<div class="bt-card sc-' + b.scene + (b.key === focus ? ' focus' : '') + '" id="beat-' + b.key + '"><div class="top">' +
        '<button type="button" class="play" data-play-beat="' + b.key + '" data-owner="lib" aria-label="Play ' + esc(b.name) + '"><span class="pb">' + UI.icon('play') + '</span></button>' +
        '<div style="min-width:0"><h3>' + esc(b.name) + '</h3><div class="feel">' + esc(b.feel) + '</div></div></div>' +
        YB.stepsHtml(b) + '<div class="meter">' + esc(b.meter) + '</div>' +
        '<div class="facts"><span class="ui-badge">' + b.bpm + ' BPM</span><span class="ui-badge">' + b.beatsPerBar + ' beats/bar</span>' +
          '<span class="ui-badge brand">' + b.target[0] + (b.target[1] !== b.target[0] ? '–' + b.target[1] : '') + ' syllables/line</span>' +
          (b.lines > 1 ? '<span class="ui-badge">' + b.lines + ' bars/line</span>' : '') + '</div>' +
        '<p class="theory">' + esc(b.theory) + '</p><p class="try">' + esc(b.tryLine) + '</p></div>';
    }
    view.innerHTML = '<div class="ui-wrap"><div class="bt-intro"><div class="eyebrow">Beats &amp; theory</div><h1>Twelve beats, three traditions</h1>' +
      '<p class="muted" style="font-size:1.08rem">Every beat here is built from a rule of song or poetry: a drum pattern from hip-hop, a chord progression from pop, a metrical foot from poetry. ' +
      'Each one tells you how many syllables fit a line. Tap ▶ to hear it, then write over it in the Studio.</p>' +
      (ctx.me ? '<a class="ui-btn primary" href="#studio/new" data-go="studio/new">' + UI.icon('pen') + 'Write over a beat</a>' : '<a class="ui-btn primary" href="#auth/signup" data-go="auth/signup">' + UI.icon('pen') + 'Join to write over them</a>') + '</div>' +
      ['rap', 'pop', 'poetry'].map(function (s) {
        return '<section class="bt-scene"><div class="bt-scene-head">' + YB.sceneBadge(s) + '<h2>' + esc({ rap: 'Rap: drums first', pop: 'Pop: chords and hooks', poetry: 'Poetry: meter as a beat' }[s]) + '</h2></div>' +
          '<div class="bt-grid">' + YB.BEATS.filter(function (b) { return b.scene === s; }).map(card).join('') + '</div></section>';
      }).join('') +
      '<section class="bt-scene"><div class="bt-scene-head"><h2>Craft cheat sheet</h2></div><div class="bt-craft">' + ['rap', 'poetry', 'pop'].map(function (s) {
        return '<div class="ui-card sc-' + s + '"><div style="margin-bottom:12px">' + YB.sceneBadge(s) + '</div><dl>' + CRAFT[s].map(function (c) { return '<dt>' + esc(c[0]) + '</dt><dd>' + c[1] + '</dd>'; }).join('') + '</dl></div>';
      }).join('') + '</div></section></div>';
    var unsub = YB.lightSteps(view);
    // only light the grid of the beat that's playing
    var unsub2 = YB.player.on(function (ev) {
      if (ev.type !== 'step') return;
      view.querySelectorAll('.bt-card').forEach(function (c) { if (c.id !== 'beat-' + ev.key) { var n = c.querySelector('.yb-steps i.now'); if (n) n.classList.remove('now'); } });
    });
    if (focus) setTimeout(function () { var el = view.querySelector('#beat-' + focus); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
    return { ready: Promise.resolve(), destroy: function () { unsub(); unsub2(); } };
  });
})();

/* ===== bunch.html ===== */
(function () {
  var esc = UI.esc;
  UI.page('bunch', { title: 'Your Bunch', nav: 'Bunch', icon: 'banana', auth: 'user', order: 40 }, function (view, ctx) {
    var all = [], scene = '', q = '';
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:360px"></div></div>';
    function list() {
      return all.filter(function (s) {
        return (!scene || s.scene === scene) && (!q || (s.title + ' ' + s.author.name + ' ' + s.excerpt.join(' ')).toLowerCase().indexOf(q) >= 0);
      });
    }
    function drawList() {
      var items = list();
      view.querySelector('[data-list]').innerHTML = items.length ? YB.cards(items.map(function (s) { return s; }), {}) :
        '<div class="ui-empty">' + UI.icon('banana') + '<h3>' + (all.length ? 'Nothing matches' : 'Your Bunch is empty') + '</h3><p>' +
        (all.length ? 'Try another search or scene.' : 'Upvote songs you love on the Stage: they\'re saved here so you can find them again.') + '</p>' +
        (all.length ? '' : '<a class="ui-btn primary" href="#home" data-go="home">' + UI.icon('shuffle') + 'Go to the Stage</a>') + '</div>';
      view.querySelectorAll('[data-list] .yb-card').forEach(function (c) {
        var s = all.filter(function (x) { return x.id === c.getAttribute('data-song'); })[0];
        if (s) c.querySelector('.yb-card-by').insertAdjacentHTML('beforeend', '<span class="bn-liked">· saved ' + esc(UI.ago(s.liked)) + '</span>');
      });
    }
    function onUp(e) {
      if (e.detail.upvoted) return;
      all = all.filter(function (s) { return s.id !== e.detail.id; });
      var n = view.querySelector('[data-count]'); if (n) n.textContent = UI.plural(all.length, 'song');
      UI.toast('Removed from your Bunch');
      drawList();
    }
    document.addEventListener('yb-upvote', onUp);
    var ready = UI.api('get_bunch').then(function (d) {
      all = d.songs;
      view.innerHTML = '<div class="ui-wrap"><div class="bn-hero"><div class="big">' + UI.icon('banana') + '</div><div><div class="eyebrow">Your Bunch</div><h1>Songs you upvoted</h1>' +
        '<p><span data-count>' + UI.plural(all.length, 'song') + '</span> saved. Tap a banana again to remove one.</p></div></div>' +
        (all.length ? '<div class="bn-tools"><input type="search" data-q placeholder="Search your Bunch"><div class="yb-scenes-pick">' + [['', 'All']].concat(Object.keys(YB.SCENES).map(function (k) { return [k, YB.SCENES[k].name]; })).map(function (s) {
          return '<button type="button" data-scene="' + s[0] + '" class="' + (s[0] ? 'sc-' + s[0] : '') + (s[0] === scene ? ' on' : '') + '">' + esc(s[1]) + '</button>'; }).join('') + '</div></div>' : '') +
        '<div data-list></div></div>';
      drawList();
    });
    view.addEventListener('input', function (e) { if (e.target.matches('[data-q]')) { q = e.target.value.trim().toLowerCase(); drawList(); } });
    view.addEventListener('click', function (e) {
      var s = e.target.closest('[data-scene]');
      if (!s) return;
      scene = s.getAttribute('data-scene');
      view.querySelectorAll('[data-scene]').forEach(function (b) { b.classList.toggle('on', b === s); });
      drawList();
    });
    return { ready: ready, destroy: function () { document.removeEventListener('yb-upvote', onUp); } };
  });
})();

/* ===== charts.html ===== */
(function () {
  var esc = UI.esc;
  var PERIODS = [['week', 'This week', 'Most bananas in the last 7 days'], ['all', 'All time', 'The most-upvoted songs ever'], ['reviewed', 'Best reviewed', 'Highest average rating from reviews']];
  UI.page('charts', { title: 'Charts', nav: 'Charts', icon: 'trophy', order: 30 }, function (view, ctx) {
    var period = PERIODS.some(function (p) { return p[0] === ctx.args[0]; }) ? ctx.args[0] : 'week';
    var scene = YB.SCENES[ctx.args[1]] ? ctx.args[1] : '';
    var P = PERIODS.filter(function (p) { return p[0] === period; })[0];
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:400px"></div></div>';
    return UI.api('get_charts', scene || null, period).then(function (d) {
      view.innerHTML = '<div class="ui-wrap"><div class="ch-head"><div><div class="eyebrow">Charts</div><h1 style="margin:0">' + esc(P[1]) + '</h1><p class="muted" style="margin:6px 0 0">' + esc(P[2]) +
        (scene ? ' in ' + esc(YB.sceneName(scene)) : '') + '.</p></div></div>' +
        '<div class="ch-tools"><div class="ui-seg">' + PERIODS.map(function (p) { return '<button data-period="' + p[0] + '" class="' + (p[0] === period ? 'on' : '') + '">' + esc(p[1]) + '</button>'; }).join('') + '</div>' +
        '<div class="yb-scenes-pick">' + [['', 'All']].concat(Object.keys(YB.SCENES).map(function (k) { return [k, YB.SCENES[k].name]; })).map(function (s) {
          return '<button type="button" data-scene="' + s[0] + '" class="' + (s[0] ? 'sc-' + s[0] : '') + (s[0] === scene ? ' on' : '') + '">' + esc(s[1]) + '</button>'; }).join('') + '</div></div>' +
        (d.songs.length ? '<div class="ch-list">' + d.songs.map(function (s, i) {
          var sc = period === 'reviewed' ? (s.score ? s.score.toFixed(1) + ' / 5' : '') : (period === 'week' ? '+' + s.score + ' this week' : '');
          return '<div class="ch-row sc-' + esc(s.scene) + '"><div class="rk">' + (i + 1) + '</div>' + YB.avatar(s.author) +
            '<div style="min-width:0"><h3><a href="#song/' + esc(s.id) + '" data-go="song/' + esc(s.id) + '">' + esc(s.title) + '</a></h3>' +
            '<div class="ex">' + esc(s.excerpt[0] || '') + '</div><div class="meta">' + YB.sceneBadge(s.scene) + '<span>by ' + YB.writerLink(s.author) + '</span>' +
            (s.review_count ? '<span>' + UI.icon('chat') + ' ' + s.review_count + '</span>' : '') + '</div></div>' +
            '<div class="score">' + YB.upBtn(s) + (sc ? '<small>' + esc(sc) + '</small>' : '') + '</div></div>';
        }).join('') + '</div>'
          : '<div class="ui-empty">' + UI.icon('trophy') + '<h3>The chart is empty</h3><p>' + (period === 'week' ? 'No upvotes in the last 7 days' + (scene ? ' for this scene' : '') + '. Go give some bananas!' : 'Nothing here yet.') + '</p>' +
            '<a class="ui-btn primary" href="#home" data-go="home">' + UI.icon('shuffle') + 'Go to the Stage</a></div>') + '</div>';
      view.addEventListener('click', function (e) {
        var p = e.target.closest('[data-period]');
        if (p) { UI.go('charts', p.getAttribute('data-period'), scene); return; }
        var s = e.target.closest('[data-scene]');
        if (s) UI.go('charts', period, s.getAttribute('data-scene'));
      });
    });
  });
})();

/* ===== home.html ===== */
(function () {
  var esc = UI.esc;
  var GREET = ['What are we writing today?', 'The beat is warming up.', 'Fresh page, fresh bars.', 'Somebody needs your chorus.', 'Peel back a new verse.'];

  UI.page('home', { title: 'The Stage', nav: 'Stage', icon: 'shuffle', order: 10 }, function (view, ctx) {
    var scene = YB.SCENES[ctx.args[0]] ? ctx.args[0] : '';
    var me = ctx.me;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:120px;margin-bottom:20px"></div><div class="yb-cards">' +
      '<div class="ui-skel" style="height:260px"></div><div class="ui-skel" style="height:260px"></div><div class="ui-skel" style="height:260px"></div></div></div>';

    function filters() {
      return '<div class="yb-scenes-pick" role="group" aria-label="Scene">' + [['', 'All scenes']].concat(Object.keys(YB.SCENES).map(function (k) { return [k, YB.SCENES[k].name]; })).map(function (s) {
        return '<button type="button" data-scene="' + s[0] + '" class="' + (s[0] ? 'sc-' + s[0] : '') + (s[0] === scene ? ' on' : '') + '">' + esc(s[1]) + '</button>';
      }).join('') + '</div>';
    }
    function shuffleGrid(songs) {
      return songs.length ? YB.cards(songs) : '<div class="ui-empty">' + UI.icon('mic') + '<h3>No ' + (scene ? esc(YB.sceneName(scene)) + ' ' : '') + 'songs yet</h3>' +
        '<p>Be the first on stage.</p>' + (me ? '<a class="ui-btn primary" href="#studio/new" data-go="studio/new">' + UI.icon('pen') + 'Write one</a>' : '<a class="ui-btn primary" href="#auth/signup" data-go="auth/signup">Join and write one</a>') + '</div>';
    }
    function draw(d) {
      var hello = me ? 'Hey ' + esc(me.name.split(' ')[0]) + '. <span class="hl">' + esc(YB.pick(GREET)) + '</span>' : 'Fresh off the <span class="hl">shuffle</span>';
      view.innerHTML = '<div class="ui-wrap">' +
        '<div class="st-hero"><div><div class="eyebrow">The Stage</div><h1>' + hello + '</h1>' +
          '<p>Random songs from rappers, poets and pop writers. ' + (me ? 'Upvote what you love: it lands in your Bunch.' : 'Sign up to upvote, review and write your own.') + '</p></div>' +
          (me ? '<a class="ui-btn primary lg" href="#studio/new" data-go="studio/new">' + UI.icon('pen') + 'Start a song</a>' : '<a class="ui-btn primary lg" href="#auth/signup" data-go="auth/signup">' + UI.icon('banana') + 'Join the bunch</a>') + '</div>' +
        (!me ? '<div class="st-cta"><div><h3>Twelve beats. Twenty-four thousand rhymes. Zero blank-page panic.</h3><p>Write over boom bap, four-on-the-floor or iambic pentameter, with rhymes, similes and metaphors on tap.</p></div>' +
          '<a class="ui-btn" href="#landing" data-go="landing">How it works ' + UI.icon('arrow') + '</a></div>' : '') +
        '<div class="st-filter">' + filters() + '<button class="ui-btn" data-shuffle>' + UI.icon('shuffle') + 'Shuffle</button></div>' +
        '<div class="st-shuffle" data-grid>' + shuffleGrid(d.songs) + '</div>' +
        (d.spotlight.length ? '<section class="st-sec"><div class="st-sec-head"><div><h2>' + UI.icon('flame') + 'Spotlight</h2><p>Staff picks and songs members promoted this week.' +
          (me ? ' You have <b>' + UI.plural(d.promos_left, 'promotion') + '</b> left this week.' : '') + '</p></div></div>' +
          '<div class="st-rail">' + d.spotlight.map(function (s) { return YB.card(s); }).join('') + '</div></section>' : '') +
        (d.fresh.length ? '<section class="st-sec"><div class="st-sec-head"><div><h2>' + UI.icon('sparkle') + 'Fresh drops</h2><p>The newest songs on the stage.</p></div>' +
          '<a class="ui-btn sm" href="#charts" data-go="charts">' + UI.icon('trophy') + 'See the charts</a></div><div class="st-fresh">' + d.fresh.map(function (s) {
            return '<div class="st-row sc-' + esc(s.scene) + '">' + YB.avatar(s.author) + '<div class="grow"><b><a href="#song/' + esc(s.id) + '" data-go="song/' + esc(s.id) + '">' + esc(s.title) + '</a></b>' +
              '<div class="small muted">' + esc(s.author.name) + ' · ' + esc(YB.sceneName(s.scene)) + ' · ' + esc(UI.ago(s.published)) + '</div></div>' + YB.upBtn(s) + '</div>';
          }).join('') + '</div></section>' : '') +
        '<div class="st-stats"><div class="st-stat"><b>' + d.counts.songs + '</b><span>songs on stage</span></div><div class="st-stat"><b>' + d.counts.writers + '</b><span>writers</span></div>' +
          '<div class="st-stat"><b>' + d.counts.upvotes + '</b><span>bananas given</span></div></div></div>';
    }
    view.addEventListener('click', function (e) {
      var sc = e.target.closest('[data-scene]');
      if (sc) { var s = sc.getAttribute('data-scene'); UI.go('home', s); return; }
      var sh = e.target.closest('[data-shuffle]');
      if (sh) {
        UI.busy(sh, UI.apiQuiet('shuffle', scene || null, 12)).then(function (d) {
          view.querySelector('[data-grid]').innerHTML = shuffleGrid(d.songs);
        });
      }
    });
    return UI.api('get_stage', scene || null).then(draw);
  });
})();

/* ===== lab.html ===== */
(function () {
  var esc = UI.esc;
  var DEMO = 'I hold the hands of strangers until dawn\nand learn their names the way you learn the rain\nCounting hi-hats like they\'re sheep but I never get to sleep\nThere\'s a cat on the roof who collects every moon';
  UI.page('lab', { title: 'Rhyme lab' }, function (view, ctx) {
    view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><div class="eyebrow">Rhyme lab</div><h1>Find the word. Check the line.</h1>' +
      '<p class="muted">Rhymes from a 24,000-word pronouncing dictionary, plus hand-picked similes, metaphors and word palettes. No AI: just a very big rhyming dictionary.</p></div></div>' +
      '<div class="lb-grid"><div class="lb-panel" data-help></div><div class="lb-side">' +
      '<div class="lb-panel lb-check"><h3>' + UI.icon('wave') + 'Line checker</h3><textarea data-check spellcheck="true" placeholder="Paste or write a few lines…"></textarea>' +
        '<div class="lb-legend">● stressed · ○ unstressed · ◌ unknown word · letters (A, B…) show the rhyme scheme · coloured words rhyme</div><div class="lb-out" data-out></div></div>' +
      '<div class="lb-panel lb-scratch"><h3>' + UI.icon('pen') + 'Scratchpad</h3><textarea data-scratch placeholder="Words you click on the left land here. Kept in this browser only."></textarea>' +
        '<div class="ui-row" style="margin-top:10px"><button type="button" class="ui-btn sm" data-copy>' + UI.icon('copy') + 'Copy</button><button type="button" class="ui-btn sm ghost" data-clear>Clear</button>' +
        (ctx.me ? '<button type="button" class="ui-btn sm primary" data-tosong>' + UI.icon('pen') + 'Start a song with this</button>' : '') + '</div></div>' +
      '</div></div></div>';
    var scratch = view.querySelector('[data-scratch]'), check = view.querySelector('[data-check]');
    scratch.value = UI.store.get('scratch', '');
    check.value = UI.store.get('checker', DEMO);
    var helper = YB.helper(view.querySelector('[data-help]'), {
      scene: ctx.me && ctx.me.scene,
      onInsert: function (t) {
        scratch.value = (scratch.value && !/\s$/.test(scratch.value) ? scratch.value + (t.length > 20 ? '\n' : ' ') : scratch.value) + t;
        UI.store.set('scratch', scratch.value);
        UI.toast('Added to your scratchpad');
      }
    });
    if (ctx.args[0]) helper.show('rhymes', ctx.args[0]);
    function analyse() {
      var lines = check.value.split('\n');
      UI.store.set('checker', check.value);
      var out = view.querySelector('[data-out]');
      if (!YB.words.ready) { out.innerHTML = '<div class="ui-skel" style="min-height:80px"></div>'; return; }
      var sch = YB.words.scheme(lines);
      out.innerHTML = lines.map(function (l, i) {
        if (!l.trim()) return '';
        var a = YB.words.line(l), m = YB.words.meter(a.stress);
        return '<div class="yb-meter-line"><span class="n">' + a.syllables + '</span><div><div class="t">' + YB.words.markHtml(sch.marks[i]) + ' <b class="faint small">' + esc(sch.letters[i]) + '</b></div>' +
          '<div class="s"><span class="yb-stress">' + YB.words.stressMarks(a.stress) + '</span>' + (m ? ' · ' + esc(m.name) + ' (' + esc(m.foot) + ' ×' + m.feet + ')' : '') + '</div></div></div>';
      }).join('') || '<p class="muted small">Write something above.</p>';
    }
    var t = null;
    check.addEventListener('input', function () { clearTimeout(t); t = setTimeout(analyse, 200); });
    scratch.addEventListener('input', function () { UI.store.set('scratch', scratch.value); });
    view.addEventListener('click', function (e) {
      if (e.target.closest('[data-copy]')) { (navigator.clipboard ? navigator.clipboard.writeText(scratch.value) : Promise.reject()).then(function () { UI.toast('Copied', 'ok'); }, function () { scratch.select(); }); }
      if (e.target.closest('[data-clear]')) { scratch.value = ''; UI.store.set('scratch', ''); }
      var ts = e.target.closest('[data-tosong]');
      if (ts) {
        var text = scratch.value.trim() || check.value.trim();
        UI.busy(ts, UI.api('create_song', ctx.me.scene || 'rap', null, [{ kind: 'Verse', text: text }])).then(function (r) { UI.go('studio', r.song.id); });
      }
    });
    analyse();
    return YB.words.load().then(analyse, function (e) { view.querySelector('[data-out]').innerHTML = '<p class="ui-error">' + esc(e.message) + '</p>'; });
  });
})();

/* ===== landing.html ===== */
(function () {
  var COPY = {
    eyebrow: 'For rappers, poets and pop writers',
    lead: 'Pick one of twelve beats built from song and poetry theory, write your lyrics over it with rhymes, similes and metaphors one click away, then share them, get reviews, and collect bananas.',
    cta: 'Start writing, it\'s free',
    proof: ['12 beats, played live in your browser', '24,000-word rhyme dictionary', 'Free, no ads'],
    trio: [
      ['rap', 'Bars', 'Boom bap, trap, drill and lo-fi. Multisyllabic rhymes, flow checks, a syllable count for every bar.', ['Multis and internal rhymes', 'Syllables per bar vs the beat', 'Rhyme map colours your scheme'], 'Counting hi-hats like they\'re sheep but I never get to sleep'],
      ['poetry', 'Lines', 'Iambic heartbeat, trochaic march, dactyl waltz, anapest gallop: meter you can hear.', ['Stress marks and meter detection', 'Slant rhymes and assonance', 'Similes and metaphors by concept'], 'I hold the hands of strangers until dawn'],
      ['pop', 'Hooks', 'Four-on-the-floor, piano ballad, dembow and disco, with the chord theory behind each.', ['Chorus-friendly line lengths', 'Theme palettes for every mood', 'Perform mode: karaoke over the beat'], 'There\'s glitter in the gutter, there\'s a bassline in the rain']
    ],
    steps: [['Pick a beat', 'Twelve beats, four per scene, each with the rule behind it: how many syllables fit, where the stress falls.'],
            ['Write with helpers', 'Put your cursor on a word: rhymes appear. Need an image? Similes, metaphors and theme palettes are in the same panel.'],
            ['Share and get reviewed', 'Publish to the Stage. Others upvote, review with banana ratings, promote you to the Spotlight, or remix you.']],
    features: [['banana', 'Upvotes that save', 'Every song you upvote lands in your Bunch, so you never lose a favourite.'],
               ['mic', 'Perform mode', 'The beat plays, your lyrics light up word by word, one line per bar. Rehearse anywhere.'],
               ['wave', 'Rhyme map', 'See your rhyme scheme (A, B, A, B) and every rhyming word colour-coded.'],
               ['chat', 'Real reviews', 'Three ratings made for each scene (flow, imagery, hook…) plus a favourite line.'],
               ['flame', 'Spotlight', 'Three promotions a week to push someone else\'s song onto the front page.'],
               ['remix', 'Remix', 'Start from someone\'s song with full credit, and make it yours.']],
    faq: [['Is it free?', 'Yes. Writing, sharing, upvoting and reviewing are free. There are no ads.'],
          ['Do you use AI to write?', 'No. Rhymes and syllables come from the CMU Pronouncing Dictionary, and the similes, metaphors and theme words are a hand-written word bank. Your words stay yours.'],
          ['Who owns my lyrics?', 'You do. Sharing a song lets others read, upvote, review and remix it on Yabanana (remixes always credit you). You can unpublish or delete it any time.'],
          ['Can I keep songs private?', 'Yes. Songs start as drafts that only you can see. You choose when to share them to the Stage.'],
          ['What are bananas?', 'Upvotes. Collect enough and your writer level ripens: Green, Ripening, Ripe, Sweet, Golden Bunch.'],
          ['Does it work on my phone?', 'Yes, in any modern browser. Turn your sound on for the beats.']],
    bandTitle: 'Your next verse is one beat away.',
    bandLead: 'Free to join. Your first song can be on the Stage in five minutes.'
  };

  function heroArt() {
    var lit = 'x...x...x...x...';
    return '<div class="lp-art" aria-hidden="true">' +
      '<svg class="moon" viewBox="0 0 64 64"><circle cx="32" cy="32" r="29" fill="var(--c-surface)" stroke="var(--c-edge)" stroke-width="3"/>' +
      '<path d="M45 15C49 35 36 51 13 47C11.5 46.7 11.5 45 13 44.5C28 40 39 31 40.5 16Z" fill="#ffc21a" stroke="var(--c-edge)" stroke-width="2.5" stroke-linejoin="round"/><path d="M41.3 16.5L42 9.5" stroke="var(--c-edge)" stroke-width="4" stroke-linecap="round"/></svg>' +
      '<div class="paper"><span class="k">Verse</span>' +
        '<div class="l"><span>Fourth floor walk-up, radiator <span class="rh0">banging</span></span><b>A</b></div>' +
        '<div class="l"><span>Mama on the phone like <span class="rh1">"did you eat?"</span></span><b>B</b></div>' +
        '<div class="l"><span>Milk crate, notebook on my <span class="rh2">kneecap</span>,</span><b>C</b></div>' +
        '<div class="l"><span>writing like the rent is in the <span class="rh2">recap</span></span><b>C</b></div></div>' +
      '<div class="beat"><div class="t">Boom Bap <span>90 BPM · 12 syllables</span></div><div class="g">' +
        lit.split('').map(function (c, i) { return '<i class="' + (c === 'x' ? (i % 8 === 4 ? 's' : 'on') : '') + '" style="animation-delay:' + (i * 0.1666).toFixed(3) + 's"></i>'; }).join('') + '</div></div>' +
      '<span class="stk a">Rap</span><span class="stk b">Poetry</span><span class="stk c">Pop</span></div>';
  }

  UI.page('landing', { title: 'Write lyrics over beats' }, function (view, ctx) {
    var me = ctx.me, C = COPY, esc = UI.esc;
    var primary = me ? '<a class="ui-btn primary lg" href="#studio/new" data-go="studio/new">' + UI.icon('pen') + 'Write a song</a><a class="ui-btn lg" href="#home" data-go="home">The Stage</a>'
      : '<a class="ui-btn primary lg" href="#auth/signup" data-go="auth/signup">' + esc(C.cta) + ' ' + UI.icon('arrow') + '</a>' +
        '<a class="ui-btn lg" href="#home" data-go="home">' + UI.icon('shuffle') + 'Peek at the stage</a>';
    view.innerHTML =
      '<section class="lp-hero"><div class="ui-wrap"><div>' +
        '<div class="eyebrow">' + esc(C.eyebrow) + '</div><h1>Write <span class="w rap">bars</span>, <span class="w poetry">lines</span> &amp; <span class="w pop">hooks</span> over real beats.</h1>' +
        '<p class="lp-lead">' + esc(C.lead) + '</p><div class="lp-cta">' + primary + '</div>' +
        '<div class="lp-proof">' + C.proof.map(function (p) { return '<span>' + UI.icon('check') + esc(p) + '</span>'; }).join('') + '</div>' +
      '</div>' + heroArt() + '</div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>Three scenes, one stage</h2><p>Rappers, poets and pop writers have different tools. Yabanana has all three.</p></div>' +
        '<div class="lp-trio">' + C.trio.map(function (t) {
          return '<div class="ui-card sc-' + t[0] + '">' + YB.sceneBadge(t[0]) + '<h3>' + esc(t[1]) + '</h3><p class="muted">' + esc(t[2]) + '</p><ul>' + t[3].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
            '<p class="q">' + esc(t[4]) + '</p></div>';
        }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>Fresh off the shuffle</h2><p>Random songs from the Stage, right now. Tap ▶ to hear the beat each one was written on.</p></div>' +
        '<div data-live><div class="yb-cards"><div class="ui-skel" style="height:240px"></div><div class="ui-skel" style="height:240px"></div><div class="ui-skel" style="height:240px"></div></div></div>' +
        '<div style="text-align:center;margin-top:22px"><a class="ui-btn" href="#home" data-go="home">' + UI.icon('shuffle') + 'More on the Stage</a></div></div></section>' +
      '<section class="lp-section" id="how"><div class="ui-wrap"><div class="lp-head"><h2>How it works</h2><p>From blank page to the Stage in three steps.</p></div>' +
        '<div class="lp-steps">' + C.steps.map(function (s) { return '<div class="ui-card lp-step"><h3>' + esc(s[0]) + '</h3><p class="muted">' + esc(s[1]) + '</p></div>'; }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>More than a notebook</h2></div>' +
        '<div class="ui-grid lp-features">' + C.features.map(function (f) { return '<div class="ui-card lp-feature">' + UI.icon(f[0]) + '<h3>' + esc(f[1]) + '</h3><p>' + esc(f[2]) + '</p></div>'; }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>Questions</h2></div><div class="lp-faq">' +
        C.faq.map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-band"><div><h2>' + esc(C.bandTitle) + '</h2><p>' + esc(C.bandLead) + '</p></div>' +
        (me ? '<a class="ui-btn lg" href="#studio/new" data-go="studio/new">Write a song</a>' : '<a class="ui-btn lg" href="#auth/signup" data-go="auth/signup">' + esc(C.cta) + '</a>') +
      '</div></div></section>';
    return UI.apiQuiet('shuffle', null, 6).then(function (d) {
      var box = view.querySelector('[data-live]');
      if (box) box.innerHTML = d.songs.length ? YB.cards(d.songs) : '<div class="ui-empty">' + UI.icon('mic') + '<h3>The stage is waiting</h3><p>Be the first to share a song.</p></div>';
    }, function () { var box = view.querySelector('[data-live]'); if (box) box.innerHTML = ''; });
  });
})();

/* ===== profile.html ===== */
(function () {
  var esc = UI.esc;
  UI.page('profile', { title: 'Your profile', auth: 'user' }, function (view, ctx) {
    var me = ctx.me, scene = me.scene || '';
    view.innerHTML = '<div class="ui-wrap ui-narrow"><div class="pf-head"><span class="ui-avatar">' + esc(UI.initials(me.name)) + '</span>' +
      '<div><h1>' + esc(me.name) + '</h1><div class="muted">' + esc(me.email) + (me.joined ? ' · member since ' + esc(UI.fmtDate(me.joined, { month: 'long', year: 'numeric' })) : '') + '</div></div></div>' +
      '<div class="pf-grid"><form class="ui-card ui-stack" data-name><h3>Your writer card</h3><label class="ui-field"><span>Pen name <em>(shown on your songs)</em></span>' +
      '<input type="text" name="name" value="' + esc(me.name) + '" maxlength="60" required></label>' +
      '<div class="ui-field"><span>Your scene</span><div class="yb-scenes-pick" data-scene-pick>' + [['', 'All of them']].concat([['rap', 'Rap'], ['poetry', 'Poetry'], ['pop', 'Pop']]).map(function (s) {
        return '<button type="button" data-scene="' + s[0] + '" class="' + (s[0] ? 'sc-' + s[0] : '') + ((me.scene || '') === s[0] ? ' on' : '') + '">' + s[1] + '</button>'; }).join('') + '</div></div>' +
      '<label class="ui-field"><span>Bio <em>(optional, 280 characters)</em></span><textarea name="bio" maxlength="280" rows="3" placeholder="Night-shift poet. Boom bap at breakfast.">' + esc(me.bio || '') + '</textarea></label>' +
      '<div class="ui-row"><button class="ui-btn primary" type="submit">Save</button><a class="ui-btn ghost" href="#writer/' + esc(me.id) + '" data-go="writer/' + esc(me.id) + '">' + UI.icon('eye') + 'See your page</a></div></form>' +
      '<div class="ui-card ui-stack"><h3>Appearance</h3><p class="muted small">Follow your device, or pick one.</p><div data-theme-box></div>' +
      '<h3 style="margin-top:22px">Password</h3><p class="muted small">We\'ll email you a link to choose a new one.</p>' +
      '<button class="ui-btn" data-reset>' + UI.icon('mail') + 'Email me a reset link</button></div></div>' +
      '<div class="ui-card" style="margin-top:16px"><div class="pf-links">' +
      (me.is_admin ? '<a href="#admin" data-go="admin">' + UI.icon('shield') + 'Admin</a>' : '') +
      '<button data-feedback>' + UI.icon('chat') + 'Send feedback</button>' +
      '<button data-lk-open="overview">' + UI.icon('lock') + 'Privacy &amp; Terms, and your data</button>' +
      '<button data-signout-here>' + UI.icon('logout') + 'Sign out</button></div></div></div>';
    function themeBox() {
      var t = UI.theme();
      view.querySelector('[data-theme-box]').innerHTML = '<div class="ui-seg">' + [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
        return '<button type="button" data-theme-pick="' + o[0] + '" class="' + (t === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    }
    themeBox();
    view.addEventListener('click', function (e) {
      var t = e.target.closest('[data-theme-pick]');
      if (t) { UI.setTheme(t.getAttribute('data-theme-pick')); themeBox(); UI.renderChrome(); return; }
      var sp = e.target.closest('[data-scene-pick] [data-scene]');
      if (sp) { scene = sp.getAttribute('data-scene'); view.querySelectorAll('[data-scene-pick] button').forEach(function (b) { b.classList.toggle('on', b === sp); }); return; }
      if (e.target.closest('[data-reset]')) {
        UI.busy(e.target.closest('[data-reset]'), UI.auth('reset', { email: me.email })).then(function (r) { UI.toast(r.message, 'ok'); });
      }
      if (e.target.closest('[data-signout-here]')) UI.auth('logout');
    });
    view.querySelector('[data-name]').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = UI.formData(e.target);
      UI.busy(e.target.querySelector('[type=submit]'), UI.api('update_profile', v.name, scene, v.bio)).then(function (r) {
        UI.setMe(r.me); ctx.me = r.me; UI.toast('Saved', 'ok');
        view.querySelector('.pf-head h1').textContent = r.me.name;
      });
    });
  });
})();

/* ===== song.html ===== */
(function () {
  var esc = UI.esc;

  function stars(name, val) {
    var out = '<div class="sg-stars" data-rate="' + name + '" role="radiogroup">';
    for (var i = 1; i <= 5; i++) out += '<button type="button" data-v="' + i + '" class="' + (val >= i ? 'on' : '') + '" aria-label="' + i + ' of 5">' + UI.icon('banana') + '</button>';
    return out + '<input type="hidden" name="' + name + '" value="' + (val || '') + '"></div>';
  }

  UI.page('song', { title: 'Song' }, function (view, ctx) {
    var id = ctx.args[0], me = ctx.me, scheme = UI.store.get('rhymeMap', true), data = null;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:80px;margin-bottom:18px"></div><div class="ui-skel" style="height:420px"></div></div>';

    function avg(i) { var r = data.reviews; return r.length ? r.reduce(function (a, v) { return a + v.r[i]; }, 0) / r.length : 0; }
    function lyrics() {
      var s = data.song;
      view.querySelector('[data-lyrics]').innerHTML = YB.lyricsHtml(s.sections, { scheme: scheme });
    }
    function reviewHtml(v) {
      return '<div class="sg-review" data-rid="' + esc(v.id) + '"><div class="top">' + YB.avatar(v.author) + '<div class="grow"><b>' + YB.writerLink(v.author) + '</b>' +
        '<div class="small muted">' + esc(UI.ago(v.created)) + '</div></div>' + (v.can_delete ? '<button class="ui-btn ghost icon" data-del-review aria-label="Delete review">' + UI.icon('trash') + '</button>' : '') + '</div>' +
        '<div class="rs">' + data.criteria.map(function (c, i) { return '<span>' + esc(c) + ' <b>' + v.r[i] + '/5</b></span>'; }).join('') + '</div>' +
        '<p class="txt">' + esc(v.text) + '</p>' + (v.fav_line ? '<p class="fav">“' + esc(v.fav_line) + '”</p>' : '') + '</div>';
    }
    function formHtml() {
      var mr = data.my_review, lines = YB.lines(data.song.sections);
      return '<form class="ui-card sg-form" data-review><h3>' + (mr ? 'Your review (edit it any time)' : 'Write a review') + '</h3>' +
        data.criteria.map(function (c, i) { return '<div class="sg-rate"><span class="lbl">' + esc(c) + '</span>' + stars('r' + (i + 1), mr ? mr.r[i] : 0) + '</div>'; }).join('') +
        '<label class="ui-field"><span>What worked? What would you change?</span><textarea name="text" maxlength="1500" required placeholder="Be specific and kind: name a line, an image, a rhyme.">' + esc(mr ? mr.text : '') + '</textarea></label>' +
        '<label class="ui-field"><span>Favourite line <em>(optional)</em></span><select name="fav"><option value="">None picked</option>' +
          lines.map(function (l) { return '<option' + (mr && mr.fav_line === l ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select></label>' +
        '<div class="ui-row end">' + (mr ? '<button type="button" class="ui-btn ghost danger" data-del-mine>Delete</button>' : '') + '<button class="ui-btn primary" type="submit">' + UI.icon('check') + (mr ? 'Update review' : 'Post review') + '</button></div></form>';
    }
    function draw() {
      var s = data.song, b = YB.beat(s.beat), crit = data.criteria;
      document.title = s.title + ' · ' + UI.config.name;
      view.innerHTML = '<div class="ui-wrap sc-' + esc(s.scene) + '"><div class="sg-grid"><div>' +
        '<div class="sg-head">' + (s.status !== 'published' ? '<div class="ui-note sg-notice">' + UI.icon('lock') + ' This is a draft: only you can see it.</div>' : '') +
          (s.hidden ? '<div class="ui-error sg-notice">This song is hidden from the stage while an admin reviews it.</div>' : '') +
          '<div class="ui-row">' + YB.sceneBadge(s.scene) + (s.mood ? '<span class="ui-badge">' + esc(s.mood) + '</span>' : '') +
          (s.featured ? '<span class="ui-badge brand">' + UI.icon('star') + 'Staff pick</span>' : '') + (s.boosts ? '<span class="ui-badge" style="color:var(--c-accent-text)">' + UI.icon('flame') + 'Promoted ×' + s.boosts + '</span>' : '') + '</div>' +
          '<h1>' + esc(s.title) + '</h1>' +
          '<div class="sg-by">' + YB.avatar(s.author) + '<div><b>' + YB.writerLink(s.author) + '</b><div class="muted">' + (s.published ? 'Shared ' + esc(UI.ago(s.published)) : 'Draft, edited ' + esc(UI.ago(s.updated))) +
            (s.remix_of ? ' · remix of <a href="#song/' + esc(s.remix_of.id) + '" data-go="song/' + esc(s.remix_of.id) + '">' + esc(s.remix_of.title) + '</a> by ' + esc(s.remix_of.author.name) : '') + '</div></div></div></div>' +
        '<div class="sg-actions"><button class="ui-btn primary lg" data-perform>' + UI.icon('mic') + 'Perform</button>' +
          (s.status === 'published' ? YB.upBtn(s, true) : '') +
          (s.mine ? '<a class="ui-btn" href="#studio/' + esc(s.id) + '" data-go="studio/' + esc(s.id) + '">' + UI.icon('pen') + 'Edit</a>' : '') +
          (data.can_promote ? '<button class="ui-btn" data-promote title="Puts it in the Spotlight for 7 days">' + UI.icon('flame') + 'Promote</button>' : data.promoted ? '<span class="ui-badge" style="color:var(--c-accent-text)">' + UI.icon('flame') + 'You promoted this</span>' : '') +
          (me && s.status === 'published' ? '<button class="ui-btn" data-remix>' + UI.icon('remix') + 'Remix</button>' : '') +
          (s.status === 'published' ? '<button class="ui-btn ghost" data-share>' + UI.icon('share') + 'Share</button>' : '') +
          (me && !s.mine && s.status === 'published' ? '<button class="ui-btn ghost" data-report title="Report">' + UI.icon('flag') + (data.reported ? 'Reported' : 'Report') + '</button>' : '') +
          (me && me.is_admin && !s.mine ? '<button class="ui-btn ghost danger" data-admin-del>' + UI.icon('trash') + 'Delete</button>' : '') + '</div>' +
        '<div class="sg-paper"><div class="sg-paper-top">' + YB.beatChip(s.beat, s.bpm, 'song') +
          '<label class="ui-check small"><input type="checkbox" data-scheme' + (scheme ? ' checked' : '') + '> Rhyme map</label></div><div data-lyrics></div></div>' +
        '<section class="sg-reviews"><div class="ui-row between" style="margin-bottom:14px"><h2 style="margin:0">Reviews <span class="muted" style="font-size:1rem">' + data.reviews.length + '</span></h2></div>' +
          (data.can_review ? formHtml() : !me && s.status === 'published' ? '<div class="ui-note">' + UI.icon('chat') + ' <a href="#auth/signup" data-go="auth/signup">Join Yabanana</a> to review this song.</div>' :
            s.mine ? '<p class="muted">Reviews from other writers show up here.</p>' : '') +
          '<div style="margin-top:16px" data-list>' + (data.reviews.length ? data.reviews.filter(function (v) { return !v.mine; }).map(reviewHtml).join('') :
            '<div class="ui-empty">' + UI.icon('chat') + '<h3>No reviews yet</h3><p>Be the first to say what landed.</p></div>') + '</div></section>' +
        '</div><aside class="sg-side">' +
          '<div class="ui-card"><h3>' + UI.icon('wave') + esc(b.name) + '</h3>' + YB.stepsHtml(b) + '<div class="sg-meter">' + esc(b.meter) + '</div><p>' + esc(b.theory) + '</p>' +
            '<a href="#beats/' + esc(b.key) + '" data-go="beats/' + esc(b.key) + '" class="small">More about this beat</a></div>' +
          '<div class="ui-card"><div class="sg-nums"><div><b data-upcount>' + s.upvotes + '</b><span>bananas</span></div><div><b>' + (s.rating ? s.rating.toFixed(1) : '–') + '</b><span>avg rating</span></div>' +
            '<div><b>' + data.remixes + '</b><span>' + (data.remixes === 1 ? 'remix' : 'remixes') + '</span></div></div>' +
            (data.reviews.length ? '<div class="sg-crit">' + crit.map(function (c, i) { var a = avg(i); return '<div><span>' + esc(c) + '</span><i><em style="width:' + (a / 5 * 100) + '%"></em></i><b>' + a.toFixed(1) + '</b></div>'; }).join('') + '</div>' : '') + '</div>' +
          (data.more.length ? '<div class="ui-card"><h3>More by ' + esc(s.author.name.split(' ')[0]) + '</h3><div class="sg-more">' + data.more.map(function (m) {
            return '<a href="#song/' + esc(m.id) + '" data-go="song/' + esc(m.id) + '">' + esc(m.title) + ' <span class="faint small">· ' + esc(YB.sceneName(m.scene)) + '</span></a>'; }).join('') + '</div></div>' : '') +
        '</aside></div></div>';
      lyrics();
      if (unsub) unsub();
      unsub = YB.lightSteps(view);
      if (scheme && !YB.words.ready) YB.words.load().then(function () { if (view.isConnected) lyrics(); });
    }
    var unsub = null;
    function load() { return UI.api('get_song', id).then(function (d) { data = d; draw(); }); }

    view.addEventListener('change', function (e) {
      if (e.target.matches('[data-scheme]')) {
        scheme = e.target.checked; UI.store.set('rhymeMap', scheme);
        if (scheme && !YB.words.ready) YB.words.load().then(lyrics); else lyrics();
      }
    });
    view.addEventListener('click', function (e) {
      var st = e.target.closest('[data-rate] [data-v]');
      if (st) {
        var box = st.closest('[data-rate]'), v = +st.getAttribute('data-v');
        box.querySelector('input').value = v;
        box.querySelectorAll('[data-v]').forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-v') <= v); });
        return;
      }
      if (e.target.closest('[data-perform]')) { YB.perform(Object.assign({}, data.song, { author: data.song.author })); return; }
      if (e.target.closest('[data-share]')) { YB.copyLink('#song/' + id); return; }
      var pr = e.target.closest('[data-promote]');
      if (pr) {
        UI.confirm({ title: 'Promote this song?', text: 'It goes into the Spotlight on the Stage for 7 days. You have ' + UI.plural(data.promos_left, 'promotion') + ' left this week.', ok: 'Promote it' })
          .then(function (yes) {
            if (!yes) return;
            UI.busy(pr, UI.api('promote_song', id)).then(function () { var r = pr.getBoundingClientRect(); YB.confetti(r.left + 30, r.top + 20, 22); UI.toast('Promoted! It\'s in the Spotlight.', 'ok'); load(); });
          });
        return;
      }
      var rx = e.target.closest('[data-remix]');
      if (rx) { UI.busy(rx, UI.api('remix_song', id)).then(function (r) { UI.toast('Remix started in your Studio', 'ok'); UI.go('studio', r.song.id); }); return; }
      if (e.target.closest('[data-report]')) { report(); return; }
      if (e.target.closest('[data-admin-del]')) {
        UI.confirm({ title: 'Delete this song?', text: 'Admin action: the song and its upvotes and reviews are deleted for good.', ok: 'Delete', danger: true })
          .then(function (yes) { if (yes) UI.api('delete_song', id).then(function () { UI.toast('Deleted', 'ok'); UI.go('home'); }); });
        return;
      }
      var dr = e.target.closest('[data-del-review]') || e.target.closest('[data-del-mine]');
      if (dr) {
        var rid = dr.closest('[data-rid]') ? dr.closest('[data-rid]').getAttribute('data-rid') : data.my_review.id;
        UI.confirm({ title: 'Delete this review?', ok: 'Delete', danger: true }).then(function (yes) { if (yes) UI.api('delete_review', rid).then(load); });
      }
    });
    view.addEventListener('submit', function (e) {
      if (!e.target.matches('[data-review]')) return;
      e.preventDefault();
      var v = UI.formData(e.target);
      if (!v.r1 || !v.r2 || !v.r3) { UI.toast('Tap 1 to 5 bananas for each rating.', 'error'); return; }
      UI.busy(e.target.querySelector('[type=submit]'), UI.api('save_review', id, +v.r1, +v.r2, +v.r3, v.text, v.fav || null)).then(function () {
        UI.toast('Review posted. Thank you!', 'ok'); load();
      });
    });
    document.addEventListener('yb-upvote', onUp);
    function onUp(e) { if (e.detail.id === id) { var c = view.querySelector('[data-upcount]'); if (c) c.textContent = e.detail.upvotes; } }

    function report() {
      if (data.reported) { UI.toast('You already reported this song. An admin will look at it.'); return; }
      var reasons = [['spam', 'Spam or advertising'], ['hate', 'Hateful or harassing'], ['copied', 'Copied from someone else'], ['explicit', 'Sexual or graphic content'], ['other', 'Something else']];
      var m = UI.modal('<h2>Report this song</h2><p class="muted">Admins review every report. Songs reported by several people are hidden until then.</p><form class="ui-stack" data-rep>' +
        '<div class="ui-stack">' + reasons.map(function (r, i) { return '<label class="ui-check"><input type="radio" name="reason" value="' + r[0] + '"' + (i === 0 ? ' checked' : '') + '> ' + esc(r[1]) + '</label>'; }).join('') + '</div>' +
        '<label class="ui-field"><span>Anything to add? <em>(optional)</em></span><textarea name="note" maxlength="500" rows="3"></textarea></label>' +
        '<div class="ui-row end"><button type="button" class="ui-btn ghost" data-close>Cancel</button><button class="ui-btn danger solid" type="submit">' + UI.icon('flag') + 'Send report</button></div></form>');
      m.el.querySelector('[data-rep]').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var v = UI.formData(ev.target);
        UI.busy(ev.target.querySelector('[type=submit]'), UI.api('report_song', id, v.reason, v.note)).then(function (r) { m.close(); UI.toast(r.message, 'ok'); data.reported = true; });
      });
    }
    return { ready: load(), destroy: function () { document.removeEventListener('yb-upvote', onUp); if (unsub) unsub(); } };
  });
})();

/* ===== studio.html ===== */
(function () {
  var esc = UI.esc;
  var SAMPLE = {
    rap: [{ kind: 'Verse', text: '' }, { kind: 'Hook', text: '' }],
    poetry: [{ kind: 'Stanza', text: '' }],
    pop: [{ kind: 'Verse', text: '' }, { kind: 'Chorus', text: '' }]
  };
  var POETIC = { iambic: 'iambic', trochaic: 'trochaic', dactyl: 'dactylic', anapest: 'anapestic' };

  /* ------------------------------------------------------------------ #studio: your songs */
  function listPage(view) {
    return UI.api('my_songs').then(function (d) {
      var t = d.totals;
      view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><div class="eyebrow">Studio</div><h1>Your notebook</h1><p class="muted">Drafts stay private until you share them.</p></div>' +
        '<a class="ui-btn primary lg" href="#studio/new" data-go="studio/new">' + UI.icon('plus') + 'New song</a></div>' +
        '<div class="sd-totals">' + [[t.published, 'on stage'], [t.drafts, t.drafts === 1 ? 'draft' : 'drafts'], [t.upvotes, 'bananas'], [t.reviews, 'reviews']].map(function (x) {
          return '<div class="ui-card ui-stat"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
        (d.songs.length ? '<div class="sd-list">' + d.songs.map(function (s) {
          return '<div class="sd-song sc-' + esc(s.scene) + '">' + YB.avatar({ name: s.title, scene: s.scene }) + '<div style="min-width:0"><h3><a href="#studio/' + esc(s.id) + '" data-go="studio/' + esc(s.id) + '">' + esc(s.title) + '</a></h3>' +
            '<div class="meta">' + YB.sceneBadge(s.scene) + (s.status === 'published' ? '<span class="ui-badge good">On stage</span>' : '<span class="ui-badge">Draft</span>') +
            (s.hidden ? '<span class="ui-badge bad">Hidden</span>' : '') + '<span>' + UI.plural(s.lines, 'line') + '</span><span>edited ' + esc(UI.ago(s.updated)) + '</span>' +
            (s.status === 'published' ? '<span>' + UI.icon('banana') + ' ' + s.upvotes + '</span><span>' + UI.icon('chat') + ' ' + s.review_count + '</span>' : '') + '</div></div>' +
            '<div class="acts"><a class="ui-btn sm primary" href="#studio/' + esc(s.id) + '" data-go="studio/' + esc(s.id) + '">' + UI.icon('pen') + 'Write</a>' +
            '<a class="ui-btn sm" href="#song/' + esc(s.id) + '" data-go="song/' + esc(s.id) + '">' + UI.icon('eye') + 'View</a></div></div>';
        }).join('') + '</div>'
          : '<div class="ui-empty">' + UI.icon('pen') + '<h3>Your notebook is empty</h3><p>Pick a scene and a beat, and write your first lines. Rhymes are one click away.</p>' +
            '<a class="ui-btn primary" href="#studio/new" data-go="studio/new">' + UI.icon('plus') + 'Start your first song</a></div>') + '</div>';
    });
  }

  /* ------------------------------------------------------------------ #studio/new */
  function newPage(view, ctx) {
    var def = ctx.me.scene || '';
    view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><div class="eyebrow">New song</div><h1>What are we writing?</h1>' +
      '<p class="muted">Pick a scene: it sets the starting beat and sections. You can change everything later.</p></div></div>' +
      '<div class="sd-pick">' + ['rap', 'poetry', 'pop'].map(function (k) {
        var b = YB.beat({ rap: 'boombap', poetry: 'iambic', pop: 'fourfloor' }[k]);
        return '<button type="button" class="sc-' + k + '" data-new="' + k + '"' + (def === k ? ' style="outline:3px solid var(--c-accent);outline-offset:3px"' : '') + '>' +
          YB.sceneBadge(k) + '<b>' + esc({ rap: 'Bars', poetry: 'Lines', pop: 'Hooks' }[k]) + '</b>' +
          '<span class="muted">' + esc(YB.SCENES[k].desc) + '. Starts on <b style="font-size:inherit;font-family:inherit">' + esc(b.name) + '</b>.</span>' +
          '<em>' + esc(b.tryLine) + '</em></button>';
      }).join('') + '</div>' +
      '<p class="muted small" style="margin-top:22px">' + UI.icon('bulb') + ' Tip: the Rhyme lab and Beats &amp; theory pages are open to everyone if you want to warm up first.</p></div>';
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-new]');
      if (!b) return;
      var sc = b.getAttribute('data-new');
      UI.busy(b, UI.api('create_song', sc, null, SAMPLE[sc])).then(function (r) { location.replace('#studio/' + r.song.id); });
    });
  }

  /* ------------------------------------------------------------------ #studio/<id>: the editor */
  function editor(view, ctx, id) {
    var song = null, dirty = false, saving = false, saveT = null, lastTa = null, helper = null, unsubs = [], lastWordT = null;

    function beat() { return YB.beat(song.beat); }
    function target() {
      var b = beat(), k = (song.bars_per_line || 1) / (b.lines || 1);
      return [Math.max(1, Math.round(b.target[0] * k)), Math.max(1, Math.round(b.target[1] * k))];
    }
    function setStatus(text, cls) { var el = view.querySelector('[data-save]'); if (el) { el.className = 'sd-save ' + (cls || ''); el.innerHTML = text; } }
    function markDirty() { dirty = true; setStatus(UI.icon('edit') + 'Unsaved changes', 'dirty'); clearTimeout(saveT); saveT = setTimeout(save, 1400); }
    function payload() {
      return { title: song.title, scene: song.scene, mood: song.mood, beat: song.beat, bpm: song.bpm, bars_per_line: song.bars_per_line, sections: song.sections };
    }
    function save() {
      clearTimeout(saveT);
      if (!dirty || saving) return Promise.resolve();
      saving = true; dirty = false; setStatus(UI.icon('refresh') + 'Saving…');
      return UI.apiQuiet('save_song', id, payload()).then(function () {
        saving = false; setStatus(UI.icon('check') + 'Saved', '');
        if (dirty) markDirty();
      }, function (err) { saving = false; dirty = true; setStatus(UI.icon('info') + 'Not saved', 'dirty'); UI.toast(err.message, 'error'); });
    }

    function sectionHtml(s, i) {
      return '<div class="sd-sec sc-' + esc(song.scene) + '" data-sec="' + i + '"><div class="sd-sec-head"><select data-kind aria-label="Section type">' +
        YB.KINDS.map(function (k) { return '<option' + (k === s.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select><span class="grow"></span>' +
        '<button type="button" class="ui-btn ghost icon" data-move="-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '>' + UI.icon('chevron', '') .replace('<svg', '<svg style="transform:rotate(180deg)"') + '</button>' +
        '<button type="button" class="ui-btn ghost icon" data-move="1" aria-label="Move down"' + (i === song.sections.length - 1 ? ' disabled' : '') + '>' + UI.icon('chevron') + '</button>' +
        '<button type="button" class="ui-btn ghost icon" data-dup aria-label="Repeat this section">' + UI.icon('copy') + '</button>' +
        '<button type="button" class="ui-btn ghost icon" data-del-sec aria-label="Delete section">' + UI.icon('trash') + '</button></div>' +
        '<textarea data-text rows="4" spellcheck="true" placeholder="' + esc(i === 0 ? 'Write your first line… (the helper rhymes with the word at your cursor)' : 'Keep going…') + '">' + esc(s.text) + '</textarea>' +
        '<div class="sd-flow" data-flow></div></div>';
    }
    function flowHtml(text) {
      var lines = text.split('\n'), t = target(), poetic = POETIC[song.beat];
      var sch = YB.words.ready ? YB.words.scheme(lines) : null;
      var chips = lines.map(function (l, i) {
        if (!l.trim()) return '';
        var a = YB.words.line(l), ok = a.syllables >= t[0] && a.syllables <= t[1];
        var m = poetic && YB.words.ready ? YB.words.meter(a.stress) : null;
        var tip = a.syllables + ' syllables' + (m ? ', ' + m.name : '') + ' · ' + YB.words.stressMarks(a.stress);
        return '<span class="sd-chip ' + (ok ? 'ok' : 'off') + '" title="' + esc(tip) + '">' + a.syllables + (sch && sch.letters[i] ? '<sup>' + esc(sch.letters[i]) + '</sup>' : '') + '</span>' +
          (poetic && m ? '<span class="sd-chip m" title="' + esc(tip) + '">' + (m.name === poetic ? '✓ ' : '') + esc(m.name.slice(0, 4)) + '</span>' : '');
      }).join('');
      return chips ? '<span class="lbl">Syllables/line · aim ' + t[0] + (t[1] !== t[0] ? '–' + t[1] : '') + '</span>' + chips : '<span class="lbl">Syllable counts and rhyme letters show up here as you write.</span>';
    }
    function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(130, ta.scrollHeight + 4) + 'px'; }
    function refreshFlow(sec) {
      var i = +sec.getAttribute('data-sec');
      sec.querySelector('[data-flow]').innerHTML = flowHtml(song.sections[i].text);
    }
    function drawSections() {
      var box = view.querySelector('[data-secs]');
      box.innerHTML = song.sections.map(sectionHtml).join('');
      box.querySelectorAll('[data-sec]').forEach(function (sec) { autosize(sec.querySelector('textarea')); refreshFlow(sec); });
      drawPreview();
    }
    function drawPreview() {
      var p = view.querySelector('[data-preview]');
      if (p && p.parentNode.open) p.innerHTML = YB.lyricsHtml(song.sections, { scheme: true });
    }
    function drawCtl() {
      var b = beat();
      view.querySelector('[data-ctl]').innerHTML =
        '<div class="grp"><span class="lbl">Scene</span><div class="ui-seg" data-scene-seg>' + ['rap', 'poetry', 'pop'].map(function (k) {
          return '<button type="button" data-v="' + k + '" class="' + (song.scene === k ? 'on' : '') + '">' + YB.sceneName(k) + '</button>'; }).join('') + '</div></div>' +
        '<div class="grp"><span class="lbl">Mood</span><select data-mood><option value="">None</option>' + YB.MOODS.map(function (m) { return '<option' + (m === song.mood ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
        '<div class="grp"><span class="lbl">Beat</span><button type="button" class="ui-btn sm" data-pick-beat>' + UI.icon('wave') + esc(b.name) + ' ' + UI.icon('chevron') + '</button>' +
          '<button type="button" class="ui-btn sm' + (YB.player.playing && YB.player.owner === 'studio' ? ' primary' : '') + '" data-play-studio aria-label="Play the beat">' + UI.icon(YB.player.playing && YB.player.owner === 'studio' ? 'stop' : 'play') + '</button></div>' +
        '<div class="grp"><span class="lbl">Tempo</span><input type="range" min="50" max="180" step="1" value="' + (song.bpm || b.bpm) + '" data-bpm aria-label="Tempo"><b data-bpm-v>' + (song.bpm || b.bpm) + '</b></div>' +
        '<div class="grp"><span class="lbl">Bars/line</span><div class="ui-seg" data-bpl-seg>' + [[0.5, '½'], [1, '1'], [2, '2']].map(function (o) {
          return '<button type="button" data-v="' + o[0] + '" class="' + ((song.bars_per_line || 1) === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
        YB.stepsHtml(b);
    }
    function draw() {
      view.innerHTML = '<div class="ui-wrap"><div class="sd-bar"><a class="ui-btn ghost sm" href="#studio" data-go="studio">' + UI.icon('back') + 'Notebook</a>' +
        '<span class="sd-save" data-save>' + UI.icon('check') + 'Saved</span><span class="grow"></span>' +
        '<span data-status></span>' +
        '<button class="ui-btn" data-perform>' + UI.icon('mic') + 'Perform</button>' +
        '<button class="ui-btn primary" data-publish></button>' +
        '<button class="ui-btn ghost icon" data-delete aria-label="Delete song">' + UI.icon('trash') + '</button></div>' +
        '<input type="text" class="sd-title" data-title maxlength="80" value="' + esc(song.title === 'Untitled' ? '' : song.title) + '" placeholder="Untitled" aria-label="Title">' +
        (song.remix_of ? '<p class="small muted" style="margin:8px 0 0">Remix of <a href="#song/' + esc(song.remix_of.id) + '" data-go="song/' + esc(song.remix_of.id) + '">' + esc(song.remix_of.title) + '</a> by ' + esc(song.remix_of.author.name) + '</p>' : '') +
        '<div class="sd-ctl" data-ctl></div>' +
        '<div class="sd-grid"><div><div data-secs></div>' +
        '<div class="sd-add">' + ['Verse', 'Chorus', 'Hook', 'Bridge', 'Stanza'].map(function (k) { return '<button type="button" class="ui-btn sm" data-add="' + k + '">' + UI.icon('plus') + k + '</button>'; }).join('') + '</div>' +
        '<details class="ui-card sd-preview"' + (UI.store.get('previewOpen') ? ' open' : '') + '><summary>Rhyme map preview</summary><div data-preview style="margin-top:12px"></div></details></div>' +
        '<aside class="sd-help" data-helpwrap><div class="sd-help-head"><b>Writing helpers</b><button type="button" class="ui-btn ghost icon" data-help-close aria-label="Close">' + UI.icon('x') + '</button></div><div data-help></div></aside></div>' +
        '<button type="button" class="ui-btn primary sd-fab" data-help-open>' + UI.icon('book') + 'Helpers</button></div>';
      drawStatus(); drawCtl(); drawSections();
      helper = YB.helper(view.querySelector('[data-help]'), { onInsert: insert, scene: song.scene });
      unsubs.push(YB.lightSteps(view));
      unsubs.push(YB.player.on(function (ev) { if (ev.type === 'state') { var b = view.querySelector('[data-play-studio]'); if (b) { var on = ev.playing && ev.owner === 'studio'; b.classList.toggle('primary', on); b.innerHTML = UI.icon(on ? 'stop' : 'play'); } } }));
      YB.words.load().then(function () { if (view.isConnected) view.querySelectorAll('[data-sec]').forEach(refreshFlow); drawPreview(); }, function () {});
    }
    function drawStatus() {
      var pub = song.status === 'published';
      view.querySelector('[data-status]').innerHTML = pub ? '<a class="ui-badge good" href="#song/' + esc(id) + '" data-go="song/' + esc(id) + '">' + UI.icon('eye') + 'On stage</a>' : '<span class="ui-badge">' + UI.icon('lock') + 'Draft</span>';
      view.querySelector('[data-publish]').innerHTML = pub ? UI.icon('lock') + 'Unpublish' : UI.icon('banana') + 'Share to the stage';
      view.querySelector('[data-publish]').classList.toggle('primary', !pub);
    }
    function insert(text) {
      var ta = lastTa && lastTa.isConnected ? lastTa : view.querySelector('[data-sec]:last-child textarea');
      if (!ta) return;
      var start = ta.selectionStart != null ? ta.selectionStart : ta.value.length, end = ta.selectionEnd != null ? ta.selectionEnd : start;
      var before = ta.value.slice(0, start), after = ta.value.slice(end);
      var sel = ta.value.slice(start, end);
      if (!sel) {
        // replace the half-typed word at the cursor? no: add after it, with a space
        if (before && !/[\s\n]$/.test(before)) text = ' ' + text;
      }
      ta.value = before + text + after;
      var pos = before.length + text.length;
      ta.focus(); ta.setSelectionRange(pos, pos);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      UI.toast('Added "' + text.trim() + '"');
    }
    function wordAtCaret(ta) {
      var v = ta.value, s = ta.selectionStart, e = ta.selectionEnd;
      if (s !== e) return v.slice(s, e).trim().split(/\s+/).slice(-3).join(' ');
      var lineStart = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(lineStart, (v.indexOf('\n', s) + 1 || v.length + 1) - 1);
      if (!line.trim()) {
        // empty line: rhyme with the end of the line above
        var prev = v.slice(0, Math.max(0, lineStart - 1)).split('\n').filter(function (l) { return l.trim(); }).pop() || '';
        return (prev.match(/[A-Za-z']+/g) || []).slice(-1)[0] || '';
      }
      var left = v.slice(lineStart, s).match(/[A-Za-z']+$/), right = v.slice(s).match(/^[A-Za-z']+/);
      var w = (left ? left[0] : '') + (right ? right[0] : '');
      if (w) return w;
      return (v.slice(lineStart, s).match(/[A-Za-z']+/g) || []).slice(-1)[0] || '';
    }
    function followCaret(ta) {
      clearTimeout(lastWordT);
      lastWordT = setTimeout(function () { if (helper) helper.setWord(wordAtCaret(ta)); }, 280);
    }

    view.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('[data-title]')) { song.title = t.value.trim() || 'Untitled'; markDirty(); return; }
      if (t.matches('[data-text]')) {
        var sec = t.closest('[data-sec]'), i = +sec.getAttribute('data-sec');
        lastTa = t;
        song.sections[i].text = t.value; autosize(t); markDirty();
        clearTimeout(t._flowT); t._flowT = setTimeout(function () { refreshFlow(sec); drawPreview(); }, 220);
        followCaret(t);
        return;
      }
      if (t.matches('[data-bpm]')) { song.bpm = +t.value; view.querySelector('[data-bpm-v]').textContent = song.bpm; if (YB.player.playing && YB.player.owner === 'studio') YB.player.setBpm(song.bpm); markDirty(); }
    });
    view.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('[data-kind]')) { song.sections[+t.closest('[data-sec]').getAttribute('data-sec')].kind = t.value; markDirty(); }
      if (t.matches('[data-mood]')) { song.mood = t.value; markDirty(); }
    });
    view.addEventListener('toggle', function (e) { if (e.target.matches('.sd-preview')) { UI.store.set('previewOpen', e.target.open); drawPreview(); } }, true);
    ['focusin', 'click', 'keyup'].forEach(function (type) {
      view.addEventListener(type, function (e) {
        if (e.target.matches && e.target.matches('[data-text]')) { lastTa = e.target; if (type !== 'focusin' || !e.target.value) followCaret(e.target); }
      });
    });
    view.addEventListener('click', function (e) {
      var t = e.target;
      var sc = t.closest('[data-scene-seg] [data-v]');
      if (sc) { song.scene = sc.getAttribute('data-v'); drawCtl(); drawSections(); if (helper) helper.setScene(song.scene); markDirty(); return; }
      var bp = t.closest('[data-bpl-seg] [data-v]');
      if (bp) { song.bars_per_line = +bp.getAttribute('data-v'); drawCtl(); view.querySelectorAll('[data-sec]').forEach(refreshFlow); markDirty(); return; }
      if (t.closest('[data-play-studio]')) { YB.player.toggle(song.beat, { bpm: song.bpm, owner: 'studio' }); return; }
      if (t.closest('[data-pick-beat]')) { pickBeat(); return; }
      var add = t.closest('[data-add]');
      if (add) {
        song.sections.push({ kind: add.getAttribute('data-add'), text: '' }); drawSections(); markDirty();
        var tas = view.querySelectorAll('[data-text]'); tas[tas.length - 1].focus(); return;
      }
      var mv = t.closest('[data-move]');
      if (mv) {
        var i = +mv.closest('[data-sec]').getAttribute('data-sec'), j = i + +mv.getAttribute('data-move');
        if (j < 0 || j >= song.sections.length) return;
        var tmp = song.sections[i]; song.sections[i] = song.sections[j]; song.sections[j] = tmp; drawSections(); markDirty(); return;
      }
      var dup = t.closest('[data-dup]');
      if (dup) { var k = +dup.closest('[data-sec]').getAttribute('data-sec'); song.sections.splice(k + 1, 0, { kind: song.sections[k].kind, text: song.sections[k].text }); drawSections(); markDirty(); UI.toast('Section repeated: handy for choruses.'); return; }
      var del = t.closest('[data-del-sec]');
      if (del) {
        var n = +del.closest('[data-sec]').getAttribute('data-sec');
        var go = function () { song.sections.splice(n, 1); if (!song.sections.length) song.sections.push({ kind: 'Verse', text: '' }); drawSections(); markDirty(); };
        if (song.sections[n].text.trim()) UI.confirm({ title: 'Delete this ' + song.sections[n].kind.toLowerCase() + '?', ok: 'Delete', danger: true }).then(function (y) { if (y) go(); }); else go();
        return;
      }
      if (t.closest('[data-perform]')) { save(); YB.perform(Object.assign({}, song, { author: ctx.me })); return; }
      var pub = t.closest('[data-publish]');
      if (pub) {
        var flag = song.status !== 'published';
        UI.busy(pub, save().then(function () { return UI.api('set_published', id, flag); })).then(function (r) {
          song.status = r.status; drawStatus();
          if (flag) { var rc = pub.getBoundingClientRect(); YB.confetti(rc.left + rc.width / 2, rc.top + 10, 30); UI.toast('It\'s on the stage! 🍌', 'ok'); }
          else UI.toast('Back to drafts. Only you can see it now.');
        });
        return;
      }
      if (t.closest('[data-delete]')) {
        UI.confirm({ title: 'Delete "' + song.title + '"?', text: 'The song, its upvotes and its reviews are deleted for good.', ok: 'Delete', danger: true }).then(function (y) {
          if (y) { dirty = false; UI.api('delete_song', id).then(function () { UI.toast('Deleted'); UI.go('studio'); }); }
        });
        return;
      }
      if (t.closest('[data-help-open]')) { view.querySelector('[data-helpwrap]').classList.add('open'); return; }
      if (t.closest('[data-help-close]')) { view.querySelector('[data-helpwrap]').classList.remove('open'); }
    });

    function pickBeat() {
      var groups = ['rap', 'pop', 'poetry'];
      var m = UI.modal('<h2>Pick a beat</h2><p class="muted">Every beat works with every scene. Tap ▶ to preview.</p>' + groups.map(function (g) {
        return '<h4 style="margin:18px 0 8px">' + YB.sceneBadge(g) + '</h4><div class="ui-stack">' + YB.BEATS.filter(function (b) { return b.scene === g; }).map(function (b) {
          return '<div class="ui-item sc-' + g + '" style="align-items:center' + (b.key === song.beat ? ';border-color:var(--c-accent)' : '') + '">' + YB.beatChip(b.key, b.bpm, 'pick') +
            '<div class="grow"><b>' + esc(b.feel) + '</b><div class="small muted">' + esc(b.meter) + ' · ' + b.target[0] + (b.target[1] !== b.target[0] ? '–' + b.target[1] : '') + ' syllables/line</div></div>' +
            '<button class="ui-btn sm' + (b.key === song.beat ? ' primary' : '') + '" data-use="' + b.key + '">' + (b.key === song.beat ? 'Using' : 'Use') + '</button></div>';
        }).join('') + '</div>';
      }).join(''), { wide: true, onclose: function () { if (YB.player.owner === 'pick') YB.player.stop(); } });
      m.el.addEventListener('click', function (e) {
        var u = e.target.closest('[data-use]');
        if (!u) return;
        var b = YB.beat(u.getAttribute('data-use'));
        song.beat = b.key; song.bpm = b.bpm; song.bars_per_line = b.lines || 1;
        m.close(); drawCtl(); view.querySelectorAll('[data-sec]').forEach(refreshFlow); markDirty();
        UI.toast(b.name + ' it is. Aim for ' + b.target[0] + (b.target[1] !== b.target[0] ? '–' + b.target[1] : '') + ' syllables per line.');
      });
    }

    function beforeUnload(e) { if (dirty || saving) { e.preventDefault(); e.returnValue = ''; } }
    window.addEventListener('beforeunload', beforeUnload);
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:60px;margin-bottom:16px"></div><div class="ui-skel" style="height:360px"></div></div>';
    var ready = UI.api('get_draft', id).then(function (r) {
      song = r.song;
      if (!song.sections.length) song.sections = [{ kind: 'Verse', text: '' }];
      song.bpm = song.bpm || YB.beat(song.beat).bpm;
      draw();
    });
    return {
      ready: ready,
      destroy: function () {
        window.removeEventListener('beforeunload', beforeUnload);
        unsubs.forEach(function (u) { u(); });
        if (dirty && song) UI.apiQuiet('save_song', id, payload()).catch(function () {});
        clearTimeout(saveT);
      }
    };
  }

  UI.page('studio', { title: 'Studio', nav: 'Studio', icon: 'pen', auth: 'user', order: 20 }, function (view, ctx) {
    var a = ctx.args[0];
    if (!a) return listPage(view);
    if (a === 'new') { newPage(view, ctx); return Promise.resolve(); }
    return editor(view, ctx, a);
  });
})();

/* ===== writer.html ===== */
(function () {
  var esc = UI.esc;
  UI.page('writer', { title: 'Writer' }, function (view, ctx) {
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:200px;margin-bottom:20px"></div><div class="ui-skel" style="height:300px"></div></div>';
    return UI.api('get_writer', ctx.args[0] || '').then(function (d) {
      var w = d.writer, t = d.totals, r = YB.ripeness(t.upvotes), sc = w.scene || 'rap';
      document.title = w.name + ' · ' + UI.config.name;
      var pct = r.next ? Math.round((t.upvotes - r.at) / (r.next.at - r.at) * 100) : 100;
      view.innerHTML = '<div class="ui-wrap"><div class="wr-head sc-' + esc(sc) + '">' + YB.avatar({ name: w.name, scene: sc }, true) +
        '<div style="position:relative;z-index:1;min-width:0"><div class="wr-badges">' + (w.scene ? YB.sceneBadge(w.scene) : '') + YB.ripeBadge(t.upvotes) +
          (w.joined ? '<span class="small muted">joined ' + esc(UI.fmtDate(w.joined, { month: 'long', year: 'numeric' })) + '</span>' : '') + '</div>' +
        '<h1>' + esc(w.name) + '</h1>' + (w.bio ? '<p class="bio">' + esc(w.bio) + '</p>' : w.me ? '<p class="muted small">Add a bio and your scene in <a href="#profile" data-go="profile">your profile</a>.</p>' : '') +
        '<div class="wr-nums"><div><b>' + t.songs + '</b><span>songs on stage</span></div><div><b>' + t.upvotes + '</b><span>bananas received</span></div>' +
          '<div><b>' + t.reviews_given + '</b><span>reviews written</span></div><div><b>' + t.bunch + '</b><span>songs in their Bunch</span></div></div>' +
        (r.next ? '<div class="wr-meter"><i><em style="width:' + Math.min(100, pct) + '%"></em></i><small>' + (r.next.at - t.upvotes) + ' more bananas to ' + esc(r.next.name) + '</small></div>' : '') +
        (w.me ? '<div class="ui-row" style="margin-top:14px"><a class="ui-btn sm" href="#profile" data-go="profile">' + UI.icon('edit') + 'Edit profile</a><a class="ui-btn sm primary" href="#studio" data-go="studio">' + UI.icon('pen') + 'Your studio</a></div>' : '') +
        '</div></div>' +
        '<h2>Songs</h2>' + (d.songs.length ? YB.cards(d.songs) : '<div class="ui-empty">' + UI.icon('mic') + '<h3>No songs on stage yet</h3><p>' +
          (w.me ? 'Share a song from your studio and it shows up here.' : esc(w.name.split(' ')[0]) + ' hasn\'t shared anything yet.') + '</p></div>') + '</div>';
    });
  });
})();
