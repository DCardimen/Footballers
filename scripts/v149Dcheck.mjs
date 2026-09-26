// Dev check: v149 D — IT INSTALLS. No dev server needed: it builds and serves the real outputs itself.
//
//   * the manifest is valid, linked from the page, and every icon it names loads at its stated size;
//   * `vite build` (dist/) and the Pages assembly (_site/) both carry <meta name="rib-sw"> and a sw.js whose
//     precache lists the page, every src/ file and the core art, with content revisions;
//   * on the built site the worker registers, precaches, takes control — and after ONE online visit the site
//     works with the network gone: the menu loads, a seeded career continues (a whole regular season simmed
//     and saved), and it is still there on a second offline reload;
//   * the v106.1 freshness flow still works with the worker in charge: page A over a site whose rib-build.json
//     says B reloads once and settles (no loop), and when the site really IS build B the one reload lands the
//     new page and the new worker;
//   * inside a stubbed Capacitor shell: no worker, the freshness probe is held, the hardware back maps the
//     views (browse screen → its Back, hub → menu, menu → exitApp, live → held, an open dialog → closed),
//     navigator.vibrate reaches Haptics, and the save is mirrored to Preferences;
//   * ribDialog confirm / prompt / alert / queue / Escape; ribSave export ↔ parse round trip, import through
//     the storage lock; the rolling backup keeps exactly `keep` newest copies; Settings grows the button;
//   * no page errors anywhere.
//
//   node scripts/v149Dcheck.mjs              (SKIP_BUILD=1 reuses dist/; PORT_BASE=5341)
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const ROOT = process.cwd()
const BASE = +(process.env.PORT_BASE || 5341)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- 0. the builds
if (!process.env.SKIP_BUILD) execFileSync('npm', ['run', 'build'], { stdio: 'pipe' })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rib-v149d-'))
const siteA = path.join(tmp, 'A'), siteB = path.join(tmp, 'B')
execFileSync('node', ['scripts/assemble-pages.mjs', siteA], { env: { ...process.env, RIB_BUILD_VERSION: 'buildA' }, stdio: 'pipe' })
execFileSync('node', ['scripts/assemble-pages.mjs', siteB], { env: { ...process.env, RIB_BUILD_VERSION: 'buildB' }, stdio: 'pipe' })

// ---- 1. the manifest and the icons (static)
const man = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'))
ok(man.name && man.short_name && man.short_name.length <= 15 && man.display === 'standalone' && man.orientation === 'portrait' && /^#[0-9a-f]{6}$/i.test(man.theme_color) && /^#[0-9a-f]{6}$/i.test(man.background_color) && man.start_url && man.scope,
  'the manifest names the app, standalone, portrait, with theme/background colours and a start URL', { short: man.short_name, theme: man.theme_color })
const pngSize = (f) => { const b = fs.readFileSync(f); return b.toString('ascii', 1, 4) === 'PNG' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null }
const iconBad = man.icons.filter((i) => { const s = pngSize(path.join('public', i.src)); return !s || `${s[0]}x${s[1]}` !== i.sizes })
ok(iconBad.length === 0 && man.icons.some((i) => i.sizes === '192x192' && i.purpose === 'any') && man.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any') && man.icons.some((i) => i.purpose === 'maskable'),
  'every manifest icon exists at its stated size, with 192 + 512 "any" and a maskable one', iconBad.map((i) => i.src).join(','))
ok(JSON.stringify(pngSize('public/apple-touch-icon.png')) === '[180,180]' && JSON.stringify(pngSize('public/icon-1024.png')) === '[1024,1024]' && fs.readFileSync('public/icon-1024.png')[25] === 2,
  'the Apple touch icon is 180 and the store icon is 1024 RGB with no alpha (App Store rule)')
for (const [label, dir] of [['dist', 'dist'], ['_site', siteA]]) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
  const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8')
  const cfg = JSON.parse(sw.slice(sw.indexOf('=') + 1, sw.indexOf(';\n')))
  const urls = cfg.precache.map((e) => e.url)
  ok(/<meta name="rib-sw" content="\.\/sw\.js">/.test(html) && /<link rel="manifest" href="\.\/public\/manifest\.webmanifest"/.test(html),
    `${label}: the page links the manifest (not hashed into /assets) and carries the worker meta`)
  ok(urls.includes('./') && urls.some((u) => /^\.\/src\/07-career-app\.js\?v=/.test(u)) && urls.some((u) => /^\.\/src\/26-platform\.js\?v=/.test(u)) && urls.includes('./public/rib_atlas_v22.png') && urls.includes('./public/rib_field_v91.png') && !urls.some((u) => /\.(mp4|webm)$/.test(u)) && cfg.precache.every((e) => e.rev),
    `${label}: sw.js precaches the page, every src/ file as stamped, the sheets — not the film encodes — each with a revision`, `${urls.length} entries, ${cfg.precache.filter((e) => e.req).length} required`)
}

// ---- a static server with GitHub Pages' caching, switchable roots, a down switch and hit counts
function server(port, rootOf) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' }
  const S = { down: false, hits: {}, buildJson: null }
  const srv = http.createServer((req, res) => {
    if (S.down) { req.socket.destroy(); return }
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'
    S.hits[p] = (S.hits[p] || 0) + 1
    if (p === '/rib-build.json' && S.buildJson) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'max-age=600' }); return res.end(JSON.stringify({ version: S.buildJson })) }
    const f = path.join(rootOf(), p)
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'max-age=600' }); res.end(fs.readFileSync(f))
  })
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r({ srv, S, url: `http://127.0.0.1:${port}/` })))
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const allErrs = []
async function ctxPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow', ...opts })
  await ctx.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 80); try { localStorage.setItem('rib.coachTour.v119', 'off') } catch (e) {} })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => allErrs.push(e.message))
  return { ctx, page }
}
const VIS = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function clickText(page, t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const el = els.find((e) => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.click(); return true } return false }, { t, visSrc: VIS })
  await page.waitForTimeout(700); return r
}
async function newCareer(page) {
  await clickText(page, 'START NEW CAREER')
  for (let i = 0; i < 8; i++) {
    const done = await page.evaluate(({ visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find((e) => txt(e).includes(want)); if (b) { b.click(); return false } }
      const card = els.find((e) => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (card) { card.click(); return false } return true }, { visSrc: VIS })
    await page.waitForTimeout(450); if (done) break
  }
  await clickText(page, 'PLAY 8-GAME SEASON'); await clickText(page, 'Balanced Program'); await clickText(page, 'CONFIRM TRAINING')
  await page.evaluate(() => { document.getElementById('growthV42')?.remove(); window.go('season') }); await page.waitForTimeout(500)
}
const waitMenu = (page) => page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 40000 })
const swReady = (page) => page.waitForFunction(() => window.__PLATFORM_V149 && window.__PLATFORM_V149.sw.state === 'ready' && !!navigator.serviceWorker.controller, null, { timeout: 90000 })
const swStatus = (page) => page.evaluate(() => new Promise((res) => {
  const ch = (e) => { if (e.data && e.data.type === 'status') { navigator.serviceWorker.removeEventListener('message', ch); res(e.data) } }
  navigator.serviceWorker.addEventListener('message', ch); navigator.serviceWorker.controller.postMessage({ type: 'status' }); setTimeout(() => res(null), 5000)
}))

// ---- 2. the built site works offline after one visit (dist, then _site)
const distSrv = await server(BASE, () => path.join(ROOT, 'dist'))
let curSite = siteA
const siteSrv = await server(BASE + 1, () => curSite)
for (const [label, S] of [['dist', distSrv], ['_site', siteSrv]]) {
  const { ctx, page } = await ctxPage()
  const errs0 = allErrs.length
  await page.goto(S.url, { waitUntil: 'domcontentloaded' })
  await waitMenu(page)
  const manLoaded = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href, m = await (await fetch(href)).json()
    const icons = await Promise.all(m.icons.map((i) => new Promise((r) => { const im = new Image(); im.onload = () => r(`${im.naturalWidth}x${im.naturalHeight}` === i.sizes); im.onerror = () => r(false); im.src = new URL(i.src, href).href })))
    return { ok: icons.every(Boolean), n: icons.length }
  })
  ok(manLoaded.ok, `${label}: the linked manifest fetches and all ${manLoaded.n} of its icons load in the browser`)
  let ready = true; try { await swReady(page) } catch (e) { ready = false }
  const st = ready ? await swStatus(page) : null
  ok(ready && st && st.failed.length === 0 && st.cached >= st.precache - 1, `${label}: the worker registers, precaches everything and controls the page`, st ? { version: st.version, precache: st.precache, cached: st.cached, failed: st.failed.slice(0, 3) } : await page.evaluate(() => window.__PLATFORM_V149.sw))

  // start a career online the way a player does (v90check's walk: new career, a position, the season, a program)
  await sleep(1500); await newCareer(page)
  const seeded = await page.evaluate(() => { const s = window.__GRIDIRON_AUDIT__.getState(); return { name: s.player && s.player.name, weeks: ((s.player && s.player.weekResults) || []).length } })
  // the network goes away: the browser is offline AND the server stops answering
  await ctx.setOffline(true); S.down = true
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  let offMenu = true; try { await page.waitForFunction(() => window.__GRIDIRON_AUDIT__ && document.querySelector('#screen') && (document.querySelector('#rib-main-menu-v2') || window.__GRIDIRON_AUDIT__.getState().view), null, { timeout: 40000 }) } catch (e) { offMenu = false }
  const off = await page.evaluate(async () => {
    const s = window.__GRIDIRON_AUDIT__.getState()
    const name = s.player && s.player.name
    const c = s.player.conditionV11 || {}; c.fatigue = 10; c.injury = null
    document.getElementById('growthV42')?.remove(); window.go('season'); window.simRemainingWeeks(); await new Promise((r) => setTimeout(r, 1500))
    const reg = (s.player.weekResults || []).filter((w) => !w.playoff)
    const sheets = ['rib_atlas_v22.png', 'rib_field_v91.png', 'rib_crowd_v57.png'].map((f) => new Promise((r) => { const im = new Image(); im.onload = () => r(true); im.onerror = () => r(false); im.src = window.__RIB_ASSET(f) }))
    return { name, played: reg.filter((w) => w.played).length, total: reg.length, view: s.view, sheets: (await Promise.all(sheets)).every(Boolean), styles: document.styleSheets.length > 3 }
  }).catch((e) => ({ err: String(e) }))
  ok(offMenu && off.name === seeded.name, `${label}: offline, a reload still boots the game with the career in it`, { seeded: seeded.name, offline: off.name })
  ok(off.total > 0 && off.played === off.total && off.sheets && off.styles, `${label}: offline, the career continues — the whole regular season sims, and the live-field sheets load from the cache`, off)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForFunction(() => window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.getState().player, null, { timeout: 40000 }).catch(() => {})
  const again = await page.evaluate(() => { const p = window.__GRIDIRON_AUDIT__.getState().player; return p && (p.weekResults || []).filter((w) => !w.playoff && w.played).length })
  ok(again === off.total, `${label}: the offline progress was saved — a second offline reload still has ${off.total} weeks played`, again)
  const eN = allErrs.length - errs0
  ok(eN === 0, `${label}: no page errors online or offline`, allErrs.slice(errs0, errs0 + 3).join(' | '))
  S.down = false; await ctx.close()
}

// ---- 3. v106.1 with the worker in charge
{
  curSite = siteA; siteSrv.S.buildJson = null
  const { ctx, page } = await ctxPage()
  let navs = 0; page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs++ })
  await page.goto(siteSrv.url, { waitUntil: 'domcontentloaded' }); await waitMenu(page)
  await swReady(page).catch(() => {})
  const fresh1 = await page.evaluate(() => window.__RIB_FRESH_V106.state)
  ok(fresh1 === 'fresh', 'site A, page A: the freshness probe reads fresh with the worker installed', fresh1)
  // a deploy the browser has not seen, but the server still hands out page A (Pages' ten-minute cache)
  siteSrv.S.buildJson = 'buildB'; navs = 0
  await page.reload({ waitUntil: 'domcontentloaded' }); await waitMenu(page)
  await page.waitForFunction(() => !/^(idle|asked|reloading)$/.test(window.__RIB_FRESH_V106.state), null, { timeout: 20000 }).catch(() => {})
  await sleep(2500)
  const st2 = await page.evaluate(() => window.__RIB_FRESH_V106.state)
  ok(navs === 2 && st2 === 'gave-up', 'rib-build.json says B while the page is still A: one reload through the worker, then it settles (no loop)', { navs, state: st2 })
  // the site really is build B now: the one reload must land the new page and a new worker
  siteSrv.S.buildJson = null; curSite = siteB; navs = 0
  await page.evaluate(() => sessionStorage.removeItem('rib-fresh-v106'))
  await page.reload({ waitUntil: 'domcontentloaded' }); await waitMenu(page)
  await page.waitForFunction(() => document.querySelector('meta[name="rib-build"]').content === 'buildB', null, { timeout: 30000 }).catch(() => {})
  const meta = await page.evaluate(() => document.querySelector('meta[name="rib-build"]').content)
  await page.waitForFunction(() => window.__PLATFORM_V149.sw.state === 'ready', null, { timeout: 60000 }).catch(() => {})
  let swv = null
  for (let i = 0; i < 40 && swv !== 'buildB'; i++) { await sleep(1500); const s = await swStatus(page).catch(() => null); swv = s && s.version }
  ok(meta === 'buildB', 'the site moves to B: the page is B after the freshness reload (network-first navigation, the reload fetch passed through)', { meta, navs })
  ok(swv === 'buildB', 'and the new build\'s worker installs and takes over', swv)
  // B offline: the shell cached is B
  await ctx.setOffline(true); siteSrv.S.down = true
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {}); await waitMenu(page).catch(() => {})
  const offMeta = await page.evaluate(() => document.querySelector('meta[name="rib-build"]')?.content).catch(() => null)
  ok(offMeta === 'buildB', 'offline after the update, the cached page is the NEW build', offMeta)
  siteSrv.S.down = false; await ctx.close()
}

// ---- 4. the native shell (a Capacitor stub): no worker, no freshness reload, the back button, haptics, the mirror
{
  curSite = siteA; siteSrv.S.buildJson = 'buildB'; siteSrv.S.hits = {}
  const { ctx, page } = await ctxPage()
  await page.addInitScript(() => {
    const calls = window.__capCalls = []
    const P = (v) => Promise.resolve(v)
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: {
      App: { addListener: (n, cb) => { calls.push('listen:' + n); if (n === 'backButton') window.__capBack = cb; return P({ remove() {} }) }, exitApp: () => { calls.push('exit') } },
      Haptics: { impact: (o) => { calls.push('impact:' + o.style); return P() }, vibrate: (o) => { calls.push('vibrate:' + o.duration); return P() }, notification: (o) => { calls.push('notify:' + o.type); return P() } },
      Preferences: { set: (o) => { window.__pref = o; calls.push('pref:set'); return P() }, get: () => P({ value: null }) },
      SplashScreen: { hide: () => { calls.push('splash:hide'); return P() } },
      StatusBar: { setOverlaysWebView: () => P(), setStyle: () => P() },
    } }
  })
  await page.goto(siteSrv.url, { waitUntil: 'domcontentloaded' }); await waitMenu(page); await sleep(6000)
  const n = await page.evaluate(() => ({ sw: window.__PLATFORM_V149.sw.state, ctl: !!navigator.serviceWorker.controller, fresh: window.__RIB_FRESH_V106.state, calls: window.__capCalls.slice(), listening: window.__PLATFORM_V149.back.listening }))
  ok(n.sw === 'native' && !n.ctl, 'in the shell no service worker is registered', n.sw)
  ok(n.fresh === 'native' && !siteSrv.S.hits['/rib-build.json'], 'in the shell the v106.1 probe is held — rib-build.json is never asked, nothing reloads', { state: n.fresh, asked: siteSrv.S.hits['/rib-build.json'] || 0 })
  ok(n.listening && n.calls.includes('listen:backButton') && n.calls.includes('splash:hide'), 'the shell listens for the hardware back and hands the splash to the film', n.calls)
  const back = await page.evaluate(async () => {
    const A = window.__GRIDIRON_AUDIT__, s = A.getState(), out = {}
    s.player = A.newPlayer(); s.player.pos = 'WR'; window.startSeasonGames()
    const press = async () => { window.__capBack(); await new Promise((r) => setTimeout(r, 250)); return window.__PLATFORM_V149.back.last }
    window.go('stats'); await new Promise((r) => setTimeout(r, 300)); out.stats = [await press(), s.view]
    window.go('settings'); await new Promise((r) => setTimeout(r, 300)); out.settings = [await press(), s.view]
    window.go('hub'); await new Promise((r) => setTimeout(r, 300)); out.hub = [await press(), s.view]
    s.view = 'live'; out.live = [await press(), s.view]
    window.go('menu'); await new Promise((r) => setTimeout(r, 300))
    const dlg = window.ribDialog.confirm('x'); out.dialog = [await press(), await dlg, !!document.getElementById('ribDlgV149')]
    window.__capCalls.length = 0; out.menu = [await press(), window.__capCalls.includes('exit')]
    window.__capCalls.length = 0; navigator.vibrate(12); navigator.vibrate([35, 45, 35]); out.haptics = window.__capCalls.slice()
    window.GridironStorage.save(s); await new Promise((r) => setTimeout(r, 1900)); out.pref = !!(window.__pref && window.__pref.key === 'gridiron_save_v1' && JSON.parse(window.__pref.value).player)
    return out
  })
  ok(/^button:/.test(back.stats[0]) && /^(hub|season)$/.test(back.stats[1]), 'back on a browse screen (stats) presses the screen\'s own Back (which returns to the season, or the hub)', back.stats)
  ok(back.settings[1] === 'hub', 'back on Settings lands on the hub', back.settings)
  ok(back.hub[1] === 'menu', 'back on the hub goes to the main menu', back.hub)
  ok(back.live[0] === 'hold:live' && back.live[1] === 'live', 'back during a live game is held (the game is not abandoned)', back.live)
  ok(back.dialog[0] === 'dialog' && back.dialog[1] === false && !back.dialog[2], 'back with a dialog open cancels the dialog first', back.dialog)
  ok(back.menu[0] === 'exit' && back.menu[1], 'back at the main menu exits the app', back.menu)
  ok(back.haptics.includes('impact:LIGHT') && back.haptics.some((c) => /^vibrate:/.test(c)), 'navigator.vibrate reaches Capacitor Haptics (a tap is an impact, a pattern a vibration)', back.haptics)
  ok(back.pref, 'the save is mirrored into Capacitor Preferences after a save')
  siteSrv.S.buildJson = null; await ctx.close()
}

// ---- 5. dialogs, the save file, the rolling backup, the Settings button (web, on dist)
{
  const { ctx, page } = await ctxPage({ serviceWorkers: 'block' })
  await page.goto(distSrv.url, { waitUntil: 'domcontentloaded' }); await waitMenu(page); await sleep(2000)
  const d = await page.evaluate(async () => {
    const out = {}, D = window.ribDialog, click = (sel) => document.querySelector('#ribDlgV149 ' + sel).click()
    let p = D.confirm('Sure?', { ok: 'Yes' }); click('button.primary-v149'); out.confirmYes = await p
    p = D.confirm('Sure?'); click('button:not(.primary-v149)'); out.confirmNo = await p
    p = D.prompt('Name?', 'Rex'); document.querySelector('#ribDlgV149 input').value = 'Buck'; click('button.primary-v149'); out.prompt = await p
    p = D.prompt('Name?'); document.querySelector('#ribDlgV149 input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); out.escape = await p
    const a = D.alert('one'), b = D.confirm('two'); out.queued = document.querySelectorAll('.rib-dlg-v149').length
    click('button'); await a; await new Promise((r) => setTimeout(r, 30)); out.second = document.querySelector('#ribDlgV149 .msg-v149').textContent; click('button.primary-v149'); out.b = await b
    out.left = document.querySelectorAll('.rib-dlg-v149').length
    return out
  })
  ok(d.confirmYes === true && d.confirmNo === false && d.prompt === 'Buck' && d.escape === null, 'ribDialog: confirm resolves true/false, prompt returns the typed text, Escape cancels to null', d)
  ok(d.queued === 1 && d.second === 'two' && d.b === true && d.left === 0, 'ribDialog: dialogs queue one at a time and leave nothing behind', d)
  const s = await page.evaluate(async () => {
    const A = window.__GRIDIRON_AUDIT__, st = A.getState(), R = window.ribSave, out = {}
    st.player = A.newPlayer(); st.player.pos = 'QB'; st.prestige = 4321; window.GridironStorage.save(st)
    const text = R.exportText(), back = R.parse(text)
    out.round = back.prestige === 4321 && back.player.name === st.player.name && JSON.parse(text).format === 'rib-save'
    out.code = R.parse(btoa(unescape(encodeURIComponent(JSON.stringify(st))))).prestige === 4321   // the in-game backup code parses too
    let bad = false; try { R.parse('{"nope":1}') } catch (e) { bad = true } out.rejects = bad
    R.backups.keep = 3
    for (let i = 0; i < 5; i++) { st.markV149 = 100 + i; window.GridironStorage.save(st); R.backups.snapshot('t' + i) }
    const L = R.backups.list(); out.kept = L.length; out.newest = L[0].reason; out.order = L.map((m) => m.reason)
    out.stored = Object.keys(localStorage).filter((k) => k.startsWith('rib_backup_v149_')).length
    out.dataOk = JSON.parse(R.backups.data(L[0].id)).markV149 === 104
    window.__PLATFORM_V149.noReload = true
    const imp = JSON.parse(text); imp.save.pp = 999   // v156 A: prestige is a mirror of the medals now, recomputed at boot — PP is the marker
    out.imported = await R.importText(JSON.stringify(imp), { confirm: false })
    out.onDisk = JSON.parse(localStorage.getItem('gridiron_save_v1')).pp
    st.pp = 1; window.GridironStorage.save(st); out.locked = JSON.parse(localStorage.getItem('gridiron_save_v1')).pp
    out.beforeImport = R.backups.list()[0].reason
    return out
  })
  ok(s.round && s.code && s.rejects, 'ribSave: the exported file parses back to the same save; the in-game backup code parses too; a non-save is refused', s)
  ok(s.kept === 3 && s.stored === 3 && s.newest === 't4' && s.dataOk && s.order.join() === 't4,t3,t2', 'the rolling backup keeps exactly the newest `keep` copies, newest first, and drops the rest from storage', s.order)
  ok(s.imported === true && s.onDisk === 999 && s.locked === 999 && s.beforeImport === 'before-import', 'an import backs up what was there, writes the save, and holds the running game off it until the reload', { onDisk: s.onDisk, locked: s.locked })
  await page.reload({ waitUntil: 'domcontentloaded' }); await waitMenu(page); await sleep(1500)
  const after = await page.evaluate(async () => {
    const st = window.__GRIDIRON_AUDIT__.getState(); window.go('settings'); await new Promise((r) => setTimeout(r, 1200))
    const b = document.getElementById('ribSaveBtnV149'); b && b.click(); await new Promise((r) => setTimeout(r, 200))
    const rows = document.querySelectorAll('#ribDlgV149 .row-v149 button[data-restore]').length
    window.ribDialog.close(null)
    return { pp: st.pp, button: !!b, rows }
  })
  ok(after.pp === 999, 'after the reload the game is running the imported save (the boot migrations ran on it)', after.pp)
  ok(after.button && after.rows >= 1, 'Settings shows "Save File & Backups" and it lists restorable backups', after)
  await ctx.close()
}

ok(allErrs.length === 0, 'no page errors in any context', allErrs.slice(0, 4).join(' | '))
console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', allErrs.length)
await browser.close(); distSrv.srv.close(); siteSrv.srv.close(); fs.rmSync(tmp, { recursive: true, force: true })
process.exit(fail ? 1 : 0)
