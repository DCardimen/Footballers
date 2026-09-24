/* ===== v149 D IT INSTALLS — the service worker =====
 * The TEMPLATE. scripts/lib/pwa.mjs writes <out>/sw.js = `self.__RIB_SW = {version, precache}` + this file, at
 * build time (vite build → dist/, scripts/assemble-pages.mjs → _site/). It is never served by `vite` dev.
 *
 * Strategy
 *   navigations          NETWORK FIRST (4s, then the cached shell). Online you always get what the server sends —
 *                        the same page the browser would have had with no worker — so v106.1's freshness reload
 *                        (rib-build.json vs <meta name="rib-build">) keeps working unchanged; offline you get the
 *                        last page that loaded, and a career continues.
 *   cache:'reload' /     THROUGH to the network (freshV106 fetches location.href with cache:'reload' before its one
 *   'no-cache' fetches   reload: that must reach the server), and a fresh page is kept as the new shell.
 *   rib-build.json, sw.js, byte-range (video) requests, other origins: never touched.
 *   ?v=<hash> URLs       CACHE FIRST: the build stamps src/ with content hashes and the menu files with
 *                        RIB_MENU_VERSION, so a URL never changes meaning.
 *   precached files      CACHE FIRST, kept current by REVISION: a new build re-fetches only the files whose
 *                        content hash moved (the manifest carries one per file).
 *   everything else      STALE-WHILE-REVALIDATE into the runtime cache; offline, a stamped URL falls back to
 *                        the same file without its query (the menu art is asked for as x.webp?v=<build>).
 * A new build's worker installs, skips waiting and claims the page: the running page keeps its code, the next
 * load is the new build. */
'use strict';
const CFG = self.__RIB_SW || { version: 'dev', precache: [] };
const PRE = 'rib-precache-v149', RUN = 'rib-runtime-v149';
const META = '__rib_sw_meta__';
const SCOPE = new URL(self.registration.scope);
const abs = (u) => new URL(u, SCOPE).href;
const SHELL = abs('./');
const NEVER = new Set([abs('./sw.js'), abs('./rib-build.json')]);
const NAV_TIMEOUT_MS = 4000;
const state = { version: CFG.version, installed: 0, fetched: 0, reused: 0, failed: [] };

async function readMeta(cache) {
  try { const r = await cache.match(abs(META)); return r ? await r.json() : { revs: {} }; } catch (e) { return { revs: {} }; }
}
function freshMode(url) { return /[?&]v=/.test(url) || url === SHELL ? 'default' : 'no-cache'; }

async function precache() {
  const cache = await caches.open(PRE);
  const old = await readMeta(cache);
  const revs = {};
  const todo = [];
  for (const e of CFG.precache) {
    const u = abs(e.url); revs[u] = e.rev;
    if (old.revs[u] === e.rev && await cache.match(u)) { state.reused++; continue; }
    todo.push(e);
  }
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const e = todo[i++], u = abs(e.url);
      let ok = false;
      for (let t = 0; t < 2 && !ok; t++) {
        try {
          const r = await fetch(u, { cache: freshMode(u), credentials: 'same-origin' });
          if (r.ok) { await cache.put(u, r); ok = true; state.fetched++; }
        } catch (err) {}
      }
      if (!ok) { state.failed.push(e.url); delete revs[u]; if (e.req) throw new Error('precache failed: ' + e.url); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  await cache.put(abs(META), new Response(JSON.stringify({ version: CFG.version, revs }), { headers: { 'content-type': 'application/json' } }));
  state.installed = Object.keys(revs).length;
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set(CFG.precache.map((e) => abs(e.url)).concat([abs(META)]));
    const pre = await caches.open(PRE);
    for (const req of await pre.keys()) if (!keep.has(req.url)) await pre.delete(req);
    const run = await caches.open(RUN);
    for (const req of await run.keys()) if (/[?&]v=/.test(req.url) && !keep.has(req.url)) await run.delete(req);   // an older build's stamps
    for (const name of await caches.keys()) if (/^rib-/.test(name) && name !== PRE && name !== RUN) await caches.delete(name);
    await self.clients.claim();
  })());
});

function isShellUrl(url) {
  const u = new URL(url); u.search = ''; u.hash = '';
  return u.href === SHELL || u.href === abs('./index.html');
}
async function keepShell(res) {
  try {
    if (res && res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      const c = await caches.open(PRE); await c.put(SHELL, res.clone());
    }
  } catch (e) {}
  return res;
}
async function cachedShell() {
  return (await caches.match(SHELL)) || (await caches.match(abs('./index.html'), { ignoreSearch: true }));
}

async function navigate(event) {
  const req = event.request, shell = isShellUrl(req.url);
  const cached = shell ? await cachedShell() : await caches.match(req);
  const net = fetch(req).then((r) => (shell ? keepShell(r) : r));
  if (!cached) return net.catch(() => offlinePage());
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(cached); } }, NAV_TIMEOUT_MS);
    net.then((r) => { if (!done) { done = true; clearTimeout(t); resolve(r); } })
      .catch(() => { if (!done) { done = true; clearTimeout(t); resolve(cached); } });
  });
}
function offlinePage() {
  return new Response('<!doctype html><meta name=viewport content="width=device-width"><body style="background:#070b12;color:#e9eef2;font:16px system-ui;padding:32px">' +
    '<h2 style="color:#f0bb45">RUNNING IT BACK</h2><p>You are offline and this page has not been saved for offline play yet. Open it once while online.</p>',
    { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function passThrough(req) {
  try {
    const r = await fetch(req);
    if (isShellUrl(req.url)) keepShell(r.clone());
    return r;
  } catch (e) {
    const c = await caches.match(req, { ignoreSearch: isShellUrl(req.url) });
    if (c) return c;
    throw e;
  }
}

async function asset(event) {
  const req = event.request, url = req.url;
  const hit = await caches.match(req);
  const stamped = /[?&]v=/.test(url);
  if (hit && stamped) return hit;
  if (hit) {
    const pre = await (await caches.open(PRE)).match(req);
    if (pre) return pre;                                           // precached: current by revision
    event.waitUntil(fetch(req).then(async (r) => { if (r.ok) await (await caches.open(RUN)).put(req, r); }).catch(() => {}));
    return hit;                                                    // stale-while-revalidate
  }
  try {
    const r = await fetch(req);
    if (r.ok && r.type === 'basic') { const c = await caches.open(RUN); await c.put(req, r.clone()); }
    return r;
  } catch (e) {
    const loose = await caches.match(req, { ignoreSearch: true });  // offline: x.webp?v=<build> is the precached x.webp
    if (loose) return loose;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.href.startsWith(SCOPE.href)) return;
  const bare = url.origin + url.pathname;
  if (NEVER.has(bare)) return;
  if (req.headers.has('range') || req.destination === 'video' || req.destination === 'audio') return;
  if (req.mode === 'navigate') { event.respondWith(navigate(event)); return; }
  if (req.cache === 'no-store') return;
  if (req.cache === 'reload' || req.cache === 'no-cache') { event.respondWith(passThrough(req)); return; }
  event.respondWith(asset(event));
});

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'status') {
    caches.open(PRE).then((c) => c.keys()).then((keys) => {
      event.source && event.source.postMessage({ type: 'status', version: CFG.version, precache: CFG.precache.length, cached: keys.length - 1, ...state });
    });
  } else if (d.type === 'skipWaiting') self.skipWaiting();
});
