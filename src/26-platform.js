/* ===== v149 D IT INSTALLS — the platform layer: the offline worker, the native shell, dialogs, saves =====
 * One file, loaded LAST (after the menu), that attaches to what the game already exposes — `window.go`,
 * `window.__GRIDIRON_AUDIT__`, `window.GridironStorage`, `window.__RIB_FRESH_V106`, the menu/vault/coach
 * hooks — and edits no game code. What it adds:
 *
 *   ribDialog   an in-app modal (alert / confirm / prompt / show / frame) in the game's own look, Promise-based,
 *               so the six confirm(), three prompt() and one window.open() call sites can move off the browser's
 *               dialogs (docs/APP-STORE.md lists them; they are NOT rewritten here).
 *   ribSave     export the save to a file, import one (through a reload, so the boot's own migrations run),
 *               and a ROLLING BACKUP of the last `keep` distinct saves in localStorage (session start, every
 *               new season/career, and at most every 10 minutes of play), restorable from Settings.
 *   ribHaptics  Capacitor Haptics in the native shell, navigator.vibrate on the web; in the shell
 *               navigator.vibrate itself is pointed at Haptics, so the game's four existing calls just work.
 *   the shell   Android's hardware back walks the app's own views and exits at the menu; the v106.1
 *               freshness reload is switched off (a bundled app cannot be stale); the splash is handed to the
 *               film at once; the status bar sits over the page; a blank window.open() (the uniform preview)
 *               opens in an in-app frame; the save is mirrored into Capacitor Preferences so an iOS storage
 *               purge cannot take it; the screen stays awake during a live game (Wake Lock on the web).
 *   the worker  sw.js is registered only when a BUILD put <meta name="rib-sw"> into the page (never `vite`
 *               dev, never inside Capacitor), after the load has settled. `?noSW` unregisters it.
 *
 * window.__PLATFORM_V149 is the hook the checks read (scripts/v149Dcheck.mjs). */
(function () {
  'use strict';
  if (window.__PLATFORM_V149) return;

  var P = window.__PLATFORM_V149 = {
    version: 'v149d',
    native: false, platform: 'web',
    sw: { state: 'idle', scope: '', error: '' },
    back: null, log: [], wake: { held: false, via: '' },
  };
  var note = function (m) { P.log.push(m); if (P.log.length > 40) P.log.shift(); };

  /* ---------- where are we ---------- */
  function cap() { return window.Capacitor || null; }
  function isNative() {
    var C = cap(); if (!C) return false;
    try { if (typeof C.isNativePlatform === 'function') return !!C.isNativePlatform(); } catch (e) {}
    try { return !!(C.getPlatform && C.getPlatform() !== 'web'); } catch (e) { return false; }
  }
  function plugin(name) {
    var C = cap(); if (!C) return null;
    var p = C.Plugins && C.Plugins[name];
    if (!p && typeof C.registerPlugin === 'function' && isNative()) { try { p = C.registerPlugin(name); } catch (e) { p = null; } }
    return p || null;
  }
  P.native = isNative();
  try { P.platform = P.native && cap().getPlatform ? cap().getPlatform() : 'web'; } catch (e) {}
  P.plugin = plugin;
  if (P.native) document.documentElement.classList.add('native-v149', 'native-' + P.platform + '-v149');

  function audit() { return window.__GRIDIRON_AUDIT__ || null; }
  function state() { try { var A = audit(); return A && A.getState ? A.getState() : null; } catch (e) { return null; } }
  function view() { var s = state(); return (s && s.view) || ''; }
  function toast(msg) { try { if (window.__ribToast) return window.__ribToast(msg); } catch (e) {} note('toast ' + msg); }
  function visible(el) { if (!el) return false; if (el.disabled) return false; var r = el.getClientRects(); if (!r.length) return false; var cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; }
  function menuUp() { return view() === 'menu' || !!document.getElementById('rib-main-menu-v2') && document.body.classList.contains('rib-menu-open'); }

  /* ---------- v106.1 in the shell: a bundled app cannot be stale ----------
   * freshV106 returns unless its verdict object says 'idle'. The menu files are baked in front of this file
   * today, but bake-menu-into-index.mjs re-inserts them just before </body> — so catch the object whichever
   * order it arrives in. */
  function holdFresh(o) { try { if (o && typeof o === 'object' && o.state === 'idle') o.state = 'native'; } catch (e) {} return o; }
  if (P.native) {
    if (window.__RIB_FRESH_V106) holdFresh(window.__RIB_FRESH_V106);
    else {
      var freshBox;
      try {
        Object.defineProperty(window, '__RIB_FRESH_V106', { configurable: true, enumerable: true,
          get: function () { return freshBox; }, set: function (v) { freshBox = holdFresh(v); } });
      } catch (e) {}
    }
  }

  /* ---------- ribDialog ---------- */
  var CSS = [
    '.rib-dlg-v149{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;',
    'padding:calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px);background:rgba(3,6,10,.72);',
    '-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .16s}',
    '.rib-dlg-v149.on{opacity:1}',
    '.rib-dlg-v149 .card-v149{width:100%;max-width:420px;max-height:100%;overflow:auto;background:linear-gradient(180deg,#131c29,#0b1119);',
    'border:1px solid rgba(240,187,69,.45);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.6);padding:18px 18px 14px;color:#e9eef2;',
    'font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
    '.rib-dlg-v149 h3{margin:0 0 8px;font:700 17px/1.2 Oswald,Impact,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#f0bb45}',
    '.rib-dlg-v149 .msg-v149{white-space:pre-wrap;color:#c9d3db}',
    '.rib-dlg-v149 input,.rib-dlg-v149 textarea{width:100%;box-sizing:border-box;margin-top:12px;padding:10px 12px;border-radius:10px;',
    'border:1px solid rgba(255,255,255,.18);background:#070b12;color:#fff;font:15px system-ui,sans-serif}',
    '.rib-dlg-v149 textarea{min-height:110px;font:12px ui-monospace,monospace;word-break:break-all}',
    '.rib-dlg-v149 .btns-v149{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:16px}',
    '.rib-dlg-v149 button{min-height:44px;padding:0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#1a2432;',
    'color:#e9eef2;font:700 13px Oswald,Impact,sans-serif;letter-spacing:1.4px;text-transform:uppercase;cursor:pointer}',
    '.rib-dlg-v149 button.primary-v149{background:linear-gradient(180deg,#f5c95a,#d9a132);color:#10151c;border-color:#f0bb45}',
    '.rib-dlg-v149 button.danger-v149{background:linear-gradient(180deg,#e0484f,#b8323a);color:#fff;border-color:#e0484f}',
    '.rib-dlg-v149 .list-v149{margin-top:10px;display:flex;flex-direction:column;gap:6px}',
    '.rib-dlg-v149 .row-v149{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.04);font-size:12px}',
    '.rib-dlg-v149 .row-v149 b{color:#fff}.rib-dlg-v149 .row-v149 span{flex:1}',
    '.rib-dlg-v149 .row-v149 button{min-height:34px;padding:0 10px;font-size:11px}',
    '.rib-dlg-v149.frame-v149 .card-v149{max-width:460px;height:100%;padding:0;display:flex;flex-direction:column;overflow:hidden}',
    '.rib-dlg-v149.frame-v149 iframe{flex:1;border:0;width:100%;background:#fff}',
    '.rib-dlg-v149.frame-v149 .bar-v149{display:flex;justify-content:space-between;align-items:center;padding:8px 10px 8px 16px}',
    '.rib-dlg-v149.frame-v149 .bar-v149 h3{margin:0}',
  ].join('');
  function ensureCss() {
    if (document.getElementById('ribDlgCssV149')) return;
    var st = document.createElement('style'); st.id = 'ribDlgCssV149'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var queue = [], cur = null;
  function pump() {
    if (cur || !queue.length) return;
    cur = queue.shift(); ensureCss();
    var o = cur.opts, root = document.createElement('div');
    root.className = 'rib-dlg-v149' + (o.frame ? ' frame-v149' : '');
    root.id = 'ribDlgV149'; root.setAttribute('role', o.buttons && o.buttons.length < 2 ? 'alertdialog' : 'dialog'); root.setAttribute('aria-modal', 'true');
    var btns = (o.buttons || []).map(function (b, i) {
      return '<button type="button" data-i="' + i + '" class="' + (b.kind === 'primary' ? 'primary-v149' : b.kind === 'danger' ? 'danger-v149' : '') + '">' + esc(b.label) + '</button>';
    }).join('');
    if (o.frame) {
      root.innerHTML = '<div class="card-v149"><div class="bar-v149"><h3>' + esc(o.title || '') + '</h3><div class="btns-v149" style="margin:0">' + btns + '</div></div><iframe title="' + esc(o.title || 'preview') + '"></iframe></div>';
    } else {
      var input = o.input ? (o.input.multiline ? '<textarea' + (o.input.readonly ? ' readonly' : '') + ' placeholder="' + esc(o.input.placeholder || '') + '">' + esc(o.input.value || '') + '</textarea>'
        : '<input type="text" maxlength="' + (o.input.maxLength || 500) + '" placeholder="' + esc(o.input.placeholder || '') + '" value="' + esc(o.input.value || '') + '">') : '';
      root.innerHTML = '<div class="card-v149">' + (o.title ? '<h3>' + esc(o.title) + '</h3>' : '') +
        (o.html != null ? '<div class="msg-v149">' + o.html + '</div>' : '<div class="msg-v149">' + esc(o.message || '') + '</div>') +
        input + '<div class="btns-v149">' + btns + '</div></div>';
    }
    cur.root = root;
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('button[data-i]');
      if (b && root.contains(b) && !b.closest('.list-v149')) { finish(o.buttons[+b.getAttribute('data-i')].value, true); return; }
      if (ev.target === root && o.dismissable !== false) finish(o.cancelValue, false);
    });
    root.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && o.dismissable !== false) { ev.preventDefault(); finish(o.cancelValue, false); }
      else if (ev.key === 'Enter' && !(ev.target && ev.target.tagName === 'TEXTAREA') && !(ev.target && ev.target.tagName === 'BUTTON')) {
        var pi = (o.buttons || []).findIndex(function (b) { return b.kind === 'primary'; });
        if (pi >= 0) { ev.preventDefault(); finish(o.buttons[pi].value, true); }
      }
    });
    document.body.appendChild(root);
    requestAnimationFrame(function () { root.classList.add('on'); });
    var f = root.querySelector('input,textarea') || root.querySelector('button.primary-v149') || root.querySelector('button');
    try { f && f.focus({ preventScroll: true }); if (f && f.select && o.input && !o.input.readonly) f.select(); } catch (e) {}
    if (o.onMount) try { o.onMount(root); } catch (e) {}
  }
  function finish(value, fromButton) {
    if (!cur) return;
    var c = cur, o = c.opts; cur = null;
    if (o.input && fromButton && value === true) {
      var el = c.root.querySelector('input,textarea'); value = el ? el.value : '';
    } else if (o.input && value === true) value = null;
    try { c.root.remove(); } catch (e) {}
    try { c.resolve(value); } catch (e) {}
    setTimeout(pump, 0);
  }
  var ribDialog = {
    /** show({title, message|html, buttons:[{label, value, kind:'primary'|'danger'}], input:{value,placeholder,multiline,readonly,maxLength}, cancelValue, dismissable, frame, onMount}) → Promise<value> */
    show: function (opts) { return new Promise(function (resolve) { queue.push({ opts: opts || {}, resolve: resolve }); pump(); }); },
    alert: function (message, o) { o = o || {}; return ribDialog.show({ title: o.title, message: message, buttons: [{ label: o.ok || 'OK', value: undefined, kind: 'primary' }] }).then(function () {}); },
    confirm: function (message, o) {
      o = o || {};
      return ribDialog.show({ title: o.title, message: message, cancelValue: false,
        buttons: [{ label: o.cancel || 'Cancel', value: false }, { label: o.ok || 'OK', value: true, kind: o.danger ? 'danger' : 'primary' }] }).then(function (v) { return v === true; });
    },
    prompt: function (message, def, o) {
      o = o || {};
      return ribDialog.show({ title: o.title, message: message, cancelValue: null,
        input: { value: def == null ? '' : String(def), placeholder: o.placeholder, maxLength: o.maxLength, multiline: !!o.multiline },
        buttons: [{ label: o.cancel || 'Cancel', value: null }, { label: o.ok || 'OK', value: true, kind: 'primary' }] }).then(function (v) { return v == null ? null : String(v); });
    },
    /** a same-origin blank frame in the dialog; resolves to its window once mounted (the uniform preview's home) */
    frame: function (title) {
      return new Promise(function (resolve) {
        ribDialog.show({ title: title || '', frame: true, cancelValue: undefined, buttons: [{ label: 'Close', value: undefined, kind: 'primary' }],
          onMount: function (root) { resolve(root.querySelector('iframe').contentWindow); } });
      });
    },
    close: function (value) { finish(value === undefined && cur ? cur.opts.cancelValue : value, false); },
    get isOpen() { return !!cur; },
  };
  window.ribDialog = ribDialog;

  /* ---------- ribSave: the file, the import, the rolling backup ---------- */
  var SAVE = 'gridiron_save_v1', BACKUP = 'gridiron_save_v1_backup';
  var IDX = 'rib_backups_v149', ITEM = 'rib_backup_v149_';
  var B = { keep: 5, minGapMs: 10 * 60 * 1000, lastAt: 0, lastSig: '', lastError: '', snaps: 0 };
  var ls = function () { try { return window.localStorage; } catch (e) { return null; } };
  function hash(s) { var h = 5381, i = s.length; while (i) h = (h * 33) ^ s.charCodeAt(--i); return (h >>> 0).toString(36) + ':' + s.length; }
  function readIdx() { try { var v = JSON.parse(ls().getItem(IDX) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function writeIdx(a) { ls().setItem(IDX, JSON.stringify(a)); }
  function sigOf(s) {
    if (!s || typeof s !== 'object') return '';
    var p = s.player || {};
    return [s.careers, s.careersCompleted, p.name || '', p.pos || '', p.level, p.totalSeasons, s.prestige].join('|');
  }
  function describe(s) {
    var p = (s && s.player) || {};
    return { name: p.name || '', pos: p.pos || '', level: p.level == null ? null : p.level, seasons: p.totalSeasons || 0, careers: (s && s.careers) || 0, prestige: (s && s.prestige) || 0 };
  }
  function snapshot(reason, force) {
    var L = ls(); if (!L) return null;
    var raw = L.getItem(SAVE); if (!raw) return null;
    var h = hash(raw), idx = readIdx();
    if (!force && idx[0] && idx[0].hash === h) return null;           // nothing new since the newest copy
    var obj = null; try { obj = JSON.parse(raw); } catch (e) { return null; }   // never back up something that does not parse
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var meta = Object.assign({ id: id, at: Date.now(), reason: reason || 'auto', hash: h, bytes: raw.length }, describe(obj));
    for (var tries = 0; tries < 3; tries++) {
      try {
        L.setItem(ITEM + id, raw);
        idx.unshift(meta);
        while (idx.length > B.keep) { var old = idx.pop(); try { L.removeItem(ITEM + old.id); } catch (e) {} }
        writeIdx(idx);
        B.lastAt = meta.at; B.lastSig = sigOf(obj); B.snaps++; B.lastError = '';
        return meta;
      } catch (e) {                                                    // quota: drop the oldest and try again
        B.lastError = String(e && e.name || e);
        idx = idx.filter(function (m) { return m.id !== id; });
        if (!idx.length) break;
        var drop = idx.pop(); try { L.removeItem(ITEM + drop.id); } catch (e2) {}
        try { writeIdx(idx); } catch (e3) {}
      }
    }
    return null;
  }
  function maybeSnapshot(s) {
    var now = Date.now(), sig = sigOf(s);
    if (sig !== B.lastSig) return snapshot(B.lastSig ? 'milestone' : 'session');
    if (now - B.lastAt > B.minGapMs) return snapshot('timer');
    return null;
  }
  function listBackups() { return readIdx().map(function (m) { return Object.assign({}, m); }); }
  function backupData(id) { var L = ls(); return L ? L.getItem(ITEM + id) : null; }

  // the one choke point every game save already goes through (I() → GridironStorage.save)
  var saveLocked = false, mirrorT = 0;
  function wrapStorage() {
    var GS = window.GridironStorage;
    if (!GS || GS.__v149) return !!GS;
    var orig = GS.save;
    GS.save = function (s) {
      if (saveLocked) { note('save held (import in flight)'); return; }
      var r = orig.apply(this, arguments);
      try { maybeSnapshot(s); } catch (e) {}
      if (P.native) { clearTimeout(mirrorT); mirrorT = setTimeout(mirrorNative, 1500); }
      return r;
    };
    GS.__v149 = true;
    return true;
  }

  function parseSave(text) {
    text = String(text == null ? '' : text).trim();
    if (!text) throw new Error('empty');
    var obj = null;
    if (text[0] === '{') {
      obj = JSON.parse(text);
      if (obj && obj.format === 'rib-save' && obj.save) obj = typeof obj.save === 'string' ? JSON.parse(obj.save) : obj.save;
    } else {
      obj = JSON.parse(decodeURIComponent(escape(atob(text.replace(/\s+/g, '')))));   // the in-game backup code (exportSave)
    }
    if (!obj || typeof obj !== 'object' || !('prestige' in obj)) throw new Error('not a Running It Back save');
    return obj;
  }
  function fileName() { var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; }; return 'running-it-back-save-' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + '.json'; }
  function exportText() {
    var raw = ls() && ls().getItem(SAVE);
    var s = raw ? JSON.parse(raw) : state();
    if (!s) throw new Error('no save yet');
    var meta = document.querySelector('meta[name="rib-build"]');
    return JSON.stringify({ format: 'rib-save', v: 1, app: 'Running It Back', build: meta ? meta.content : '', exportedAt: new Date().toISOString(), summary: describe(s), save: s });
  }
  function exportFile() {
    var text, name = fileName();
    try { text = exportText(); } catch (e) { toast('Nothing to export yet'); return Promise.resolve(null); }
    var FS = P.native && plugin('Filesystem'), SH = P.native && plugin('Share');
    if (FS && SH) {
      return FS.writeFile({ path: name, data: text, directory: 'CACHE', encoding: 'utf8' })
        .then(function (r) { return SH.share({ title: 'Running It Back save', text: name, url: r.uri, dialogTitle: 'Save your career' }); })
        .then(function () { return { name: name, bytes: text.length, via: 'share' }; })
        .catch(function (e) { note('native export ' + e); return showCode(text, name); });
    }
    if (P.native) return showCode(text, name);
    try {
      var url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      var a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
      toast('Save file downloaded');
      return Promise.resolve({ name: name, bytes: text.length, via: 'download' });
    } catch (e) { return showCode(text, name); }
  }
  function showCode(text, name) {
    return ribDialog.show({ title: 'Your save', message: 'Copy this text and keep it somewhere safe. Import it with "Import from file" or paste it into Settings › Paste & Import Code.',
      input: { value: text, multiline: true, readonly: true }, buttons: [{ label: 'Done', value: true, kind: 'primary' }] })
      .then(function () { return { name: name, bytes: text.length, via: 'text' }; });
  }
  function applySave(obj, reason) {
    snapshot('before-' + (reason || 'import'), true);                 // what you had is one tap away in the backups
    saveLocked = true;                                                 // the running game must not write over it before the reload
    var L = ls(), cur = L.getItem(SAVE);
    if (cur) L.setItem(BACKUP, cur);
    L.setItem(SAVE, JSON.stringify(obj));
    note('applied ' + reason);
    // a reload, not setState: the boot's mc()/ks() run every lazy migration on the way in (the in-game import skips them)
    if (P.noReload) return true;
    setTimeout(function () { location.reload(); }, 60);
    return true;
  }
  function importText(text, o) {
    o = o || {};
    var obj; try { obj = parseSave(text); } catch (e) { toast('That is not a Running It Back save'); return Promise.resolve(false); }
    var d = describe(obj);
    var go = o.confirm === false ? Promise.resolve(true) : ribDialog.confirm(
      'Replace the save on this device with ' + (d.name ? d.name + (d.pos ? ' (' + d.pos + ')' : '') : 'this save') + ' — ' + d.careers + ' careers, ' + (d.prestige || 0) + ' PP?\n\nYour current save is kept in the backups.',
      { title: 'Import save', ok: 'Import', danger: true });
    return go.then(function (yes) { return yes ? applySave(obj, 'import') : false; });
  }
  function importFile(file) {
    if (file) return file.text().then(function (t) { return importText(t); });
    return new Promise(function (resolve) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json,text/plain'; inp.style.display = 'none';
      inp.onchange = function () { var f = inp.files && inp.files[0]; inp.remove(); if (!f) return resolve(false); f.text().then(importText).then(resolve, function () { resolve(false); }); };
      document.body.appendChild(inp); inp.click();
    });
  }
  function restore(id, o) {
    o = o || {};
    var raw = backupData(id); if (!raw) { toast('That backup is gone'); return Promise.resolve(false); }
    var m = readIdx().filter(function (x) { return x.id === id; })[0] || {};
    var go = o.confirm === false ? Promise.resolve(true) : ribDialog.confirm('Go back to the save from ' + new Date(m.at).toLocaleString() + (m.name ? ' (' + m.name + ', ' + m.seasons + ' seasons)' : '') + '?\n\nWhat you have now is backed up first.', { title: 'Restore backup', ok: 'Restore', danger: true });
    return go.then(function (yes) { if (!yes) return false; try { return applySave(JSON.parse(raw), 'restore'); } catch (e) { toast('That backup does not parse'); return false; } });
  }
  function openPanel() {
    var rows = listBackups().map(function (m) {
      return '<div class="row-v149"><span><b>' + esc(new Date(m.at).toLocaleString()) + '</b><br>' + esc((m.name || 'no player') + (m.pos ? ' · ' + m.pos : '') + ' · ' + m.seasons + ' seasons · ' + m.careers + ' careers') +
        ' <i style="opacity:.6">(' + esc(m.reason) + ')</i></span><button type="button" data-restore="' + esc(m.id) + '">Restore</button></div>';
    }).join('') || '<div class="row-v149"><span>No backups yet — one is taken when a session starts and at every new season.</span></div>';
    var p = ribDialog.show({ title: '💾 Save file & backups',
      html: 'Keep a copy of your career outside the game, or step back to an earlier save. Your progress lives only on this device.<div class="list-v149">' + rows + '</div>',
      cancelValue: null, buttons: [{ label: 'Close', value: null }, { label: 'Import from file', value: 'import' }, { label: 'Export to file', value: 'export', kind: 'primary' }],
      onMount: function (root) {
        root.querySelector('.list-v149').addEventListener('click', function (ev) {
          var b = ev.target.closest('button[data-restore]'); if (!b) return;
          var id = b.getAttribute('data-restore'); ribDialog.close(null); setTimeout(function () { restore(id); }, 30);
        });
      } });
    return p.then(function (v) { if (v === 'export') return exportFile(); if (v === 'import') return importFile(); return v; });
  }
  window.ribSave = {
    exportFile: exportFile, exportText: exportText, importFile: importFile, importText: importText, parse: parseSave, openPanel: openPanel,
    backups: { list: listBackups, snapshot: function (why) { return snapshot(why || 'manual', true); }, restore: restore, data: backupData,
      get keep() { return B.keep; }, set keep(n) { B.keep = Math.max(1, n | 0); }, state: B },
  };

  /* ---------- the shell's save mirror (iOS may purge a WebView's localStorage under storage pressure) ---------- */
  function mirrorNative() {
    var Pref = plugin('Preferences'), raw = ls() && ls().getItem(SAVE);
    if (!Pref || !raw) return;
    Pref.set({ key: SAVE, value: raw }).catch(function (e) { note('mirror ' + e); });
  }
  function restoreFromMirror() {
    var Pref = plugin('Preferences'), L = ls();
    if (!Pref || !L || L.getItem(SAVE)) return;
    var once = false; try { once = sessionStorage.getItem('rib-mirror-v149') === '1'; } catch (e) {}
    if (once) return;
    Pref.get({ key: SAVE }).then(function (r) {
      if (!r || !r.value) return;
      try { JSON.parse(r.value); } catch (e) { return; }
      L.setItem(SAVE, r.value);
      try { sessionStorage.setItem('rib-mirror-v149', '1'); } catch (e) {}
      note('save restored from Preferences'); location.reload();
    }).catch(function () {});
  }

  /* ---------- haptics ---------- */
  function styleFor(ms) { return ms < 15 ? 'LIGHT' : ms < 40 ? 'MEDIUM' : 'HEAVY'; }
  var ribHaptics = {
    impact: function (style) {
      var H = P.native && plugin('Haptics');
      if (H) return H.impact({ style: String(style || 'MEDIUM').toUpperCase() }).catch(function () {});
      try { navigator.vibrate && navigator.vibrate({ LIGHT: 10, MEDIUM: 20, HEAVY: 40 }[String(style || 'MEDIUM').toUpperCase()] || 20); } catch (e) {}
    },
    notify: function (type) {
      var H = P.native && plugin('Haptics');
      if (H) return H.notification({ type: String(type || 'SUCCESS').toUpperCase() }).catch(function () {});
      try { navigator.vibrate && navigator.vibrate(type === 'error' ? [35, 45, 35] : [20, 35, 55]); } catch (e) {}
    },
    vibrate: function (p) { try { return navigator.vibrate ? navigator.vibrate(p) : false; } catch (e) { return false; } },
    calls: 0,
  };
  window.ribHaptics = ribHaptics;
  if (P.native && plugin('Haptics')) {
    var H = plugin('Haptics');
    var shim = function (p) {
      ribHaptics.calls++;
      var arr = Array.isArray(p) ? p : [p == null ? 18 : +p || 0];
      var first = arr[0] || 0; if (first <= 0) return true;
      if (arr.length > 1) { var total = arr.reduce(function (a, b, i) { return a + (i % 2 ? 0 : b); }, 0); H.vibrate({ duration: Math.min(400, total) }).catch(function () {}); }
      else H.impact({ style: styleFor(first) }).catch(function () {});
      return true;
    };
    try { Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: shim }); } catch (e) { try { navigator.vibrate = shim; } catch (e2) {} }
  }

  /* ---------- window.open in the shell: a blank window is an in-app frame, an outside link the system browser ---------- */
  if (P.native) {
    var nativeOpen = window.open;
    window.open = function (url, name) {
      var u = url == null ? '' : String(url);
      if (!u || u === 'about:blank') {
        // the caller writes into it synchronously (w.document.write): hand back a live same-origin frame now
        ensureCss();
        var holder = { win: null };
        ribDialog.show({ title: name === 'gridironUniformPreview' ? 'Uniform preview' : '', frame: true, buttons: [{ label: 'Close', value: undefined, kind: 'primary' }],
          onMount: function (root) { holder.win = root.querySelector('iframe').contentWindow; } });
        return holder.win || null;                                      // mounted synchronously when nothing else is queued
      }
      var abs = u; try { abs = new URL(u, location.href).href; } catch (e) {}
      if (/^https?:/i.test(abs) && abs.indexOf(location.origin) !== 0) {
        var Br = plugin('Browser'); if (Br) { Br.open({ url: abs }).catch(function () {}); return null; }
      }
      return nativeOpen ? nativeOpen.apply(window, arguments) : null;
    };
  }

  /* ---------- Android's hardware back ---------- */
  var BACK_RE = /^\s*(?:[←‹⬅◀<]\s*)?(?:back|menu)\b/i;
  // screens a player only browses: where back goes when the screen shows no Back of its own
  var HOME = function () { var s = state(); return s && s.player && s.player.pos ? 'hub' : 'menu'; };
  var PARENT = { stats: HOME, rank: HOME, challenges: HOME, locker: HOME, hof: HOME, dynasty: HOME, shop: HOME, upgrade: HOME,
    path: 'shop', tier: 'shop', settings: HOME, season: 'hub', life: 'hub', hub: 'menu', leaderboard: 'highscore', daily: 'highscore', highscore: 'menu' };
  // screens that ARE a step of the game (a decision, a game in progress, a career's end): back does not skip them
  var HOLD = { live: 'The game is on — use SKIP or finish it.', sim: 'The week is being played.', training: 'Pick a training program first.',
    event: 'Make the call first.', choosePos: 'Pick a position first.', club: 'Choose your club first.', result: 'Continue from the report card.',
    gameover: 'Continue from this screen.', win: 'Continue from this screen.', declineResult: 'Continue from this screen.' };
  function backButton() {
    var roots = ['#pregameV1513', '.dock', '.qa-row-v146', '#dock', '#screen', '#app'];
    for (var i = 0; i < roots.length; i++) {
      var r = document.querySelector(roots[i]); if (!r) continue;
      var bs = r.querySelectorAll('button,[role="button"],a.btn');
      for (var j = 0; j < bs.length; j++) {
        var b = bs[j], t = (b.textContent || '').trim(), oc = b.getAttribute('onclick') || '';
        if (b.closest('#rib-main-menu-v2') || b.closest('.rib-dlg-v149')) continue;
        if ((BACK_RE.test(t) || /\bshopBack\(|closeGamePlan103\(/.test(oc)) && visible(b)) return b;
      }
    }
    return null;
  }
  function exitApp() {
    var App = plugin('App');
    if (App && App.exitApp) { try { App.exitApp(); } catch (e) {} }
    return 'exit';
  }
  function back() {
    var r = (function () {
      // v150 C H11: the store's sheets (an ad, a checkout, an offer, the store itself) sit over everything — they go first.
      // RIB_MONETIZE.back() is false (and touches nothing) while monetization is off.
      try { var mz = window.RIB_MONETIZE; if (mz && mz.enabled && mz.back && mz.back()) return 'monetize'; } catch (e) {}
      if (ribDialog.isOpen) { ribDialog.close(); return 'dialog'; }
      try { if (window.__RIB_VAULT && window.__RIB_VAULT.isOpen()) { window.__RIB_VAULT.close('back'); return 'vault'; } } catch (e) {}
      try { if (window.__RIB_HOWTO && window.__RIB_HOWTO.isOpen) { window.__RIB_HOWTO.close(); return 'howto'; } } catch (e) {}
      try { if (window.__RIB_COACH && window.__RIB_COACH.isOpen) { window.__RIB_COACH.close('back'); return 'coach'; } } catch (e) {}
      var x = document.querySelector('.si-x-v142'); if (x && visible(x)) { x.click(); return 'statinfo'; }
      var v = view();
      if (HOLD[v] && v !== 'result' && v !== 'training') { toast(HOLD[v]); return 'hold:' + v; }
      if (v === 'menu' || (!v && menuUp())) return exitApp();
      var b = backButton(); if (b) { b.click(); return 'button:' + (b.textContent || '').trim().slice(0, 24); }
      if (HOLD[v]) { toast(HOLD[v]); return 'hold:' + v; }
      var to = PARENT[v]; to = typeof to === 'function' ? to() : to;
      if (to && typeof window.go === 'function') { window.go(to); return 'go:' + to; }
      if (typeof window.go === 'function') { window.go(HOME()); return 'go:' + HOME(); }
      return 'none';
    })();
    P.back.last = r; P.back.count++; note('back ' + r);
    return r;
  }
  P.back = { handle: back, last: '', count: 0, parent: PARENT, hold: HOLD, listening: false };

  /* ---------- keep the screen awake through a live game ---------- */
  var sentinel = null;
  function wake(on) {
    if (on === P.wake.held) return;
    P.wake.held = on;
    var KA = P.native && plugin('KeepAwake');
    if (KA) { P.wake.via = 'KeepAwake'; (on ? KA.keepAwake() : KA.allowSleep()).catch(function () {}); return; }
    if (on && navigator.wakeLock && navigator.wakeLock.request) {
      P.wake.via = 'wakeLock';
      navigator.wakeLock.request('screen').then(function (s) { sentinel = s; if (!P.wake.held) s.release().catch(function () {}); }).catch(function (e) { P.wake.via = 'denied'; });
    } else if (!on && sentinel) { sentinel.release().catch(function () {}); sentinel = null; }
  }

  /* ---------- Settings gets the file and the backups beside the backup code ---------- */
  function decorateSettings() {
    if (view() !== 'settings' || document.getElementById('ribSaveBtnV149')) return;
    var imp = document.querySelector('#screen button[onclick="importSave()"]'); if (!imp) return;
    var gap = document.createElement('div'); gap.style.height = '8px';
    var b = document.createElement('button'); b.id = 'ribSaveBtnV149'; b.className = 'btn secondary'; b.type = 'button';
    b.textContent = '💾 Save File & Backups'; b.onclick = function () { openPanel(); };
    imp.insertAdjacentElement('afterend', b); imp.insertAdjacentElement('afterend', gap);
  }

  /* ---------- one slow tick: the view, the wake lock, the Settings button ---------- */
  var lastView = '';
  function tick() {
    wrapStorage();
    var v = view();
    if (v !== lastView) { lastView = v; wake(v === 'live'); }
    if (v === 'settings') decorateSettings();
  }

  /* ---------- the offline worker ---------- */
  function registerSW() {
    var m = document.querySelector('meta[name="rib-sw"]');
    if (!('serviceWorker' in navigator)) { P.sw.state = 'unsupported'; return; }
    if (/[?&]noSW\b/.test(location.search)) {
      P.sw.state = 'disabled';
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      return;
    }
    if (!m || P.native) { P.sw.state = P.native ? 'native' : 'dev'; return; }
    if (!(location.protocol === 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname))) { P.sw.state = 'insecure'; return; }
    P.sw.state = 'registering';
    navigator.serviceWorker.register(m.content || './sw.js', { scope: './' }).then(function (reg) {
      P.sw.state = 'registered'; P.sw.scope = reg.scope; P.sw.reg = reg;
      navigator.serviceWorker.ready.then(function () { P.sw.state = 'ready'; });
    }).catch(function (e) { P.sw.state = 'error'; P.sw.error = String(e && e.message || e); });
    // a new build's worker takes over with skipWaiting(); this page keeps its own code, the NEXT load is the new
    // build — which is exactly what v106.1's one reload asks for at the menu
    navigator.serviceWorker.addEventListener('controllerchange', function () { P.sw.updated = true; note('sw controllerchange'); });
  }

  /* ---------- the native shell's chrome ---------- */
  function nativeBoot() {
    var App = plugin('App');
    if (App && App.addListener) {
      try { App.addListener('backButton', function () { back(); }); P.back.listening = true; } catch (e) { note('backButton ' + e); }
      try { App.addListener('pause', function () { try { var s = state(); if (s && window.GridironStorage) window.GridironStorage.save(s); } catch (e) {} mirrorNative(); }); } catch (e) {}
    }
    var SB = plugin('StatusBar');
    if (SB) { try { SB.setOverlaysWebView({ overlay: true }).catch(function () {}); SB.setStyle({ style: 'DARK' }).catch(function () {}); } catch (e) {} }
    var SS = plugin('SplashScreen');          // the game's own film is the loading screen: hand over at once
    if (SS) { try { SS.hide({ fadeOutDuration: 200 }).catch(function () {}); } catch (e) {} }
    restoreFromMirror();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && P.wake.held && P.wake.via === 'wakeLock') { P.wake.held = false; wake(true); }
  });
  function start() {
    wrapStorage();
    if (P.native) nativeBoot();
    setTimeout(function () { wrapStorage(); try { snapshot('session'); B.lastSig = sigOf(state()); } catch (e) {} }, 1500);
    setInterval(tick, 700);
    if (document.readyState === 'complete') setTimeout(registerSW, 4000);
    else window.addEventListener('load', function () { setTimeout(registerSW, 4000); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
