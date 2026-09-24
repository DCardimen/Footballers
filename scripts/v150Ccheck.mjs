// Dev check (v150 C THE HOOKS ARE IN, THE SWITCH IS STILL OFF) — the in-game hooks H1–H11 of docs/MONETIZATION.md §8
// (src/07-career-app.js `v150 C` banner, public/rib-menu.js + rib-menu-navigation.js, src/26-platform.js) and the
// module's side of them (src/27-monetize.js).
//
// OFF (the default — every player): each hook is the identity. Proved against a boot with 27-monetize.js BLOCKED:
//   the live speed row's markup is byte-for-byte the same (½× / 1× / 2× / 4×, no 3×), the Settings screen and the
//   main menu's tiles are the same markup (no store row, no STORE tile), both career-end payouts settle to exactly
//   the same PP and write exactly the same player fields, Android back never reports "monetize", and the module
//   still makes no timer / listener / storage write (v149Echeck proves that part).
// ON (`?monetize=1` on a dev host, or window.RIB_MONETIZE_CONFIG injected before the file):
//   H1 the game's own setSpeed refuses a locked 4× and opens the offer (nothing wraps window.setSpeed), a mock ad
//   gives 4× for 20 min; H3 a carried-over 4× is clamped to 2× the moment playback restarts; Pro → permanent 4× +
//   no ads; H4/H5 the payout boost pays once (a held ppDouble AT the settle; the chip on the win screen after it)
//   and never twice; H9 the STORE tile shows and opens the store; H10 the Settings row shows and RESTORE works;
//   H11 back closes the ad (no reward), the checkout (cancelled), the offer and the store; H2 3× appears only with
//   features.speed3 and is gated only with gateSpeed3; H8 a tagged cosmetic entry is hidden until owned.
//
//   GAME_URL=http://localhost:5541/index.html node scripts/v150Ccheck.mjs
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const ON = ['monetize=1', 'monetizeAdMs=400']
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const W = 400, H = 860
const newCtx = async (cfg) => {
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  await context.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
  // straight into this week's game on the live screen (the pregame wizard's own flow is covered by v112Dcheck / v149Echeck)
  await context.addInitScript(() => { window.__goLiveV150C = () => { const S = window.S, t = S.player, a = t.weekResults.findIndex((n) => !n.played); t.currentWeek = a; S._liveGame = window.__simGameV2(t.weekResults[a].perf, t.pos); S._oppName = t.weekResults[a].opp; window.go('live') } })
  if (cfg) await context.addInitScript((c) => { window.RIB_MONETIZE_CONFIG = c }, cfg)
  return context
}
const watch = (page, tag) => page.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
const booted = (page) => page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__, null, { timeout: 40000 })
  .then(() => page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null))
  .then(() => page.waitForTimeout(1000))
const open = async (ctx, tag, q = [], block = false) => {
  const p = await ctx.newPage(); watch(p, tag)
  if (block) await p.route(/27-monetize\.js/, (r) => r.abort())
  await p.goto(U(...q), { waitUntil: 'networkidle', timeout: 60000 }); await booted(p); return p
}
const M = (page, fn, arg) => page.evaluate(fn, arg)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const click = async (page, t, wait = 600) => {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis).filter((e) => !e.closest('#rib-coach-v119') && !e.closest('.mz149-veil'))
    const el = els.find((e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis })
  await page.waitForTimeout(wait); return r
}
// a real career, a season started, then straight into week 1 live (the v85check route, no pregame wizard)
const toSeason = async (page) => {
  await page.waitForSelector('#rib-main-menu-v2 .rib9-tiles', { timeout: 30000 }).catch(() => null); await page.waitForTimeout(400)
  await click(page, 'START NEW CAREER')
  for (let i = 0; i < 8; i++) {
    const done = await page.evaluate(({ visSrc }) => { const vis = eval(visSrc)
      const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis).filter((e) => !e.closest('#rib-coach-v119'))
      const txt = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find((e) => txt(e).includes(want)); if (b) { b.click(); return false } }
      const card = els.find((e) => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (card) { card.click(); return false }
      return true }, { visSrc: vis })
    await page.waitForTimeout(450); if (done) break
  }
  await click(page, 'PLAY 8-GAME SEASON'); await click(page, 'Balanced Program'); await click(page, 'CONFIRM TRAINING')
  await M(page, () => { document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); window.go('season') }); await page.waitForTimeout(700)
  // a loaded box can drop a tap on the way: a player with a position but no season yet gets the season the button would have started
  await M(page, () => { const S = window.S; if (S.player && S.player.pos && !S.player.weekResults) { try { window.startSeasonGames() } catch (e) {} document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); window.go('season') } })
  await page.waitForTimeout(500)
  return M(page, () => !!(window.S.player && window.S.player.weekResults))
}
const toLive = async (page) => { await M(page, () => window.__goLiveV150C()); await page.waitForSelector('.speed-row', { timeout: 20000 }).catch(() => null); await page.waitForTimeout(300) }
const speedRow = (page) => M(page, () => { const r = document.querySelector('.speed-row'); if (!r) return null
  const c = r.cloneNode(true); c.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active')); return c.outerHTML })
const seedEnd = (page, view) => M(page, (view) => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true; S.pp = 100; S.ppBankV136 = 40
  S.player = A.newPlayer(); S.player.name = 'Test Man'; S.player.pos = 'RB'; S.player.level = view === 'win' ? 7 : 5; S.player.totalSeasons = 8; S.player.titles = 1; S.player.traits = []; S.player.tiers = {}   // a fresh account and no rolled trait (showman pays ×1.15): the same settle in both tabs
  S.player.career = [{ level: 'College', ovr: 60, age: 21 }]; S.view = view; window.GridironStorage.save(S) }, view)
const endFacts = (page) => M(page, () => { const S = __GRIDIRON_AUDIT__.getState(), e = S.player
  return { view: S.view, pp: S.pp, vault: e._vaultPayV137, bank: e._ppBankV136, doubled: e._ppDoubledV149E || 0, pay: e._payV150C, keys: Object.keys(e).filter((k) => /^_/.test(k)).sort().join(','),
    earned: [...document.querySelectorAll('#screen .statbox')].filter((b) => /PP Earned/.test(b.textContent)).map((b) => b.querySelector('.n').textContent)[0] || null,
    chip: !!document.getElementById('mz149Pay') } })

// ============================== 1. OFF: every hook is the identity ==============================
{
  const ctxA = await newCtx(), ctxB = await newCtx()
  const a = await open(ctxA, 'off'), b = await open(ctxB, 'blocked', [], true)
  // H9: the main menu's tiles
  const tiles = (p) => M(p, () => { const t = document.querySelector('#rib-main-menu-v2 .rib9-tiles'); return t ? t.innerHTML : null })
  const ta = await tiles(a), tb = await tiles(b)
  ok(ta && ta === tb && !/data-rib-action="store"/.test(ta), 'OFF H9: the main menu\'s tiles are byte-for-byte the tiles with the module blocked — no STORE tile', { len: ta && ta.length })
  // H10 / H8: Settings (with no career, and later with one)
  // the platform layer's 💾 button lands on its own slow tick, and the save's size moves with the clock — neither is ours
  const settings = (p) => M(p, async () => { window.go('settings'); for (let i = 0; i < 25 && !document.querySelector('#screen .hubv75-tabs'); i++) await new Promise((r) => setTimeout(r, 120)); await new Promise((r) => setTimeout(r, 1200)); const c = document.getElementById('screen').cloneNode(true)
    const sb = c.querySelector('#ribSaveBtnV149'); if (sb) { sb.previousElementSibling && sb.previousElementSibling.remove(); sb.remove() }
    // …and the v146 E shell's fit() measures a long card into a scroller on a layout pass of its own
    c.querySelectorAll('.fill-v146').forEach((x) => { x.classList.remove('fill-v146'); x.style.maxHeight = ''; x.style.overflowY = ''; if (!x.getAttribute('style')) x.removeAttribute('style') })
    return c.innerHTML.replace(/Save size: \d+ KB/, 'Save size: N KB') })
  const sa = await settings(a), sb = await settings(b)
  ok(sa === sb && !/storeRowV150C|Restore Purchases/.test(sa), 'OFF H10/H8: the Settings screen is the same markup — no Store & Purchases row, every camera and weather button', (() => { let i = 0; while (i < sa.length && sa[i] === sb[i]) i++; return i === sa.length && i === sb.length ? { len: sa.length } : { at: i, with: sa.slice(Math.max(0, i - 80), i + 120), without: sb.slice(Math.max(0, i - 80), i + 120) } })())
  // H11: back on Settings never reaches the module
  const bk = await M(a, () => window.__PLATFORM_V149 ? window.__PLATFORM_V149.back.handle() : 'no-platform')
  ok(bk !== 'monetize', 'OFF H11: Android back goes straight past the module', bk)
  // H1/H2/H3: the live speed row, and the speed the game starts at
  await M(a, () => window.go('menu')); await M(b, () => window.go('menu'))
  const ca = await toSeason(a), cb = await toSeason(b)
  ok(ca && cb, 'OFF: a career is started with and without the module', { with: ca, without: cb })
  await toLive(a); await toLive(b)
  const ra = await speedRow(a), rb = await speedRow(b)
  const btns = await M(a, () => [...document.querySelectorAll('.speed-row .speed-btn[data-spd]')].map((x) => x.dataset.spd).join(','))
  ok(ra && ra === rb && btns === '0.5,1,2,4', 'OFF H2: the live speed row is byte-for-byte the old one (½× / 1× / 2× / 4×, no 3×)', btns)
  const sp = await M(a, () => { const s0 = window.__getGridironLiveSpeed(); window.setSpeed(4); const s4 = window.__getGridironLiveSpeed(); window.setSpeed(2); const s2 = window.__getGridironLiveSpeed(); window.setSpeed(4); return { s0, s4, s2, sheet: !!document.getElementById('mz149Sheet') } })
  ok(sp.s4 === 4 && sp.s2 === 2 && !sp.sheet, 'OFF H1: setSpeed(4) is 4× straight away, free, with no offer', sp)
  // the carried speed: the live screen re-drawn mid-game (a render while the game is on) restarts playback with the controller's speed
  const carried = await M(a, () => { window.setSpeed(4); window.go('live'); return window.__getGridironLiveSpeed() })
  ok(carried === 4, 'OFF H3: a 4× carried through a re-drawn live screen stays 4×', carried)
  await M(a, () => { try { window.skipLive() } catch (e) {} }); await M(b, () => { try { window.skipLive() } catch (e) {} })
  // H4/H5: both career-end payouts settle to exactly the same numbers and write exactly the same fields
  for (const view of ['gameover', 'win']) {
    await seedEnd(a, view); await seedEnd(b, view)
    await a.goto(U(), { waitUntil: 'networkidle' }); await booted(a)
    await b.goto(U(), { waitUntil: 'networkidle' }); await booted(b)
    const fa = await endFacts(a), fb = await endFacts(b)
    ok(fa.view === view && fb.view === view && fa.pp === fb.pp && fa.vault === fb.vault && fa.bank === fb.bank && fa.earned === fb.earned && fa.keys === fb.keys && fa.pay === undefined && !fa.doubled && !fa.chip,
      `OFF H4/H5: the ${view} settle pays exactly what it pays with the module blocked, card and fields alike`, { with: fa, without: fb })
  }
  await ctxA.close(); await ctxB.close()
}

// ============================== 2. ON: speed — H1 (no wrapper), the ad, H3 the clamp, Pro ==============================
{
  const ctx = await newCtx(), p = await open(ctx, 'on-speed', ON)
  const s0 = await M(p, () => ({ on: RIB_MONETIZE.enabled, hooks: RIB_MONETIZE.hooks, fn: String(window.setSpeed).slice(0, 20), version: RIB_MONETIZE.version }))
  ok(s0.on && s0.hooks.speed === 'game' && s0.hooks.payout === 'game' && /^function setSpeed\(/.test(s0.fn) && !('setSpeed' in s0.hooks), 'ON: the game\'s hooks are found (speed, payout) and window.setSpeed is the game\'s own function — nothing wraps it', s0)
  ok(await toSeason(p), 'ON: a career is started')
  await toLive(p)
  const r0 = await M(p, () => ({ btns: [...document.querySelectorAll('.speed-row .speed-btn[data-spd]')].map((x) => x.dataset.spd).join(','), lock: document.querySelector('.speed-btn[data-spd="4"]')?.classList.contains('mz149-lock') }))
  ok(r0.btns === '0.5,1,2,4', 'ON H2: with features.speed3 off (the default) there is still no 3×', r0.btns)
  await M(p, () => window.setSpeed(2))
  const locked = await M(p, async () => { window.setSpeed(4); await new Promise((r) => setTimeout(r, 200)); return { speed: window.__getGridironLiveSpeed(), sheet: !!document.getElementById('mz149Sheet'), ev: RIB_MONETIZE.dev.events.map((e) => e.ev).slice(-1)[0] } })
  ok(locked.speed === 2 && locked.sheet && locked.ev === 'speed_locked_tap', 'ON H1: the game\'s setSpeed(4) keeps 2× and hands the tap to the module\'s offer', locked)
  // H11: back closes the offer sheet
  const back1 = await M(p, () => ({ r: window.__PLATFORM_V149.back.handle(), sheet: !!document.getElementById('mz149Sheet'), view: window.S.view }))
  ok(back1.r === 'monetize' && !back1.sheet && back1.view === 'live', 'ON H11: Android back closes the offer sheet and nothing else', back1)
  // the ad, watched through (mock, 400ms): 4× for 20 minutes and the game switches to it
  const ad = await M(p, async () => { const r = await RIB_MONETIZE.rewardSpeed(); const u = RIB_MONETIZE.until('speed4'); return { r: r.rewarded, mins: (u - RIB_MONETIZE.dev.now()) / 60000, speed: window.__getGridironLiveSpeed() } })
  ok(ad.r && ad.mins > 19.5 && ad.mins <= 20.01 && ad.speed === 4, 'ON: a watched mock ad grants 4× for 20 minutes and the game goes to 4×', ad)
  // H11: back during an ad forfeits it
  const back2 = await M(p, async () => { RIB_MONETIZE.config.mock.adMs = 8000; const pr = RIB_MONETIZE.showRewarded('speed4'); await new Promise((r) => setTimeout(r, 150)); const up = !!document.getElementById('mz149Ad')
    const b = window.__PLATFORM_V149.back.handle(); const res = await pr; RIB_MONETIZE.config.mock.adMs = 400; return { up, b, rewarded: res.rewarded, gone: !document.getElementById('mz149Ad') } })
  ok(back2.up && back2.b === 'monetize' && back2.rewarded === false && back2.gone, 'ON H11: back during an ad closes it and grants nothing', back2)
  // H3: the boost is taken away mid-game and the live screen is re-drawn — playback restarts at 2×, not the carried 4× (in the same task, before the 1s tick could)
  const h3 = await M(p, () => { const before = window.__getGridironLiveSpeed()
    RIB_MONETIZE.revoke('speed4'); window.go('live'); return { before, after: window.__getGridironLiveSpeed(), clamp: RIB_MONETIZE.clampSpeed(4), game: window.__V150C.clamp(4) } })
  ok(h3.before === 4 && h3.after === 2 && h3.clamp === 2 && h3.game === 2, 'ON H3: a 4× carried through a re-drawn live screen with no speed4 left restarts at 2× (before the 1s tick could step it down)', h3)
  // Pro through the mock checkout (H11 cancels one first)
  const back3 = await M(p, async () => { const pr = RIB_MONETIZE.purchase('rib.pro'); await new Promise((r) => setTimeout(r, 100)); const up = !!document.getElementById('mz149Buy'); const b = window.__PLATFORM_V149.back.handle(); const res = await pr; return { up, b, ok: res.ok, reason: res.reason, pro: RIB_MONETIZE.has('pro') } })
  ok(back3.up && back3.b === 'monetize' && !back3.ok && back3.reason === 'cancelled' && !back3.pro, 'ON H11: back on the checkout cancels it — nothing bought', back3)
  const pro = await M(p, async () => { const pr = RIB_MONETIZE.purchase('rib.pro'); await new Promise((r) => setTimeout(r, 100)); document.querySelector('#mz149Buy [data-yes]').click(); const res = await pr
    window.setSpeed(4); await new Promise((r) => setTimeout(r, 1300))
    const ad = await RIB_MONETIZE.showRewarded('speed4'); return { ok: res.ok, s4: RIB_MONETIZE.until('speed4') === Infinity, speed: window.__getGridironLiveSpeed(), ad: ad.reason, offer: !!document.querySelector('.mz149-offer-row'), lock: document.querySelector('.speed-btn[data-spd="4"]')?.classList.contains('mz149-lock') } })
  ok(pro.ok && pro.s4 && pro.speed === 4 && pro.ad === 'no-ads-entitlement' && !pro.offer && !pro.lock, 'ON: Pro = permanent 4× through the game\'s own setSpeed, no ads, no offer chip, no lock', pro)
  await M(p, () => { try { window.skipLive() } catch (e) {} })
  // H10: Settings › Store & Purchases, and RESTORE PURCHASES after the entitlement store is wiped
  await M(p, () => { localStorage.removeItem('rib.monetize.ents.v1') })
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const st = await M(p, async () => { window.go('settings'); await new Promise((r) => setTimeout(r, 500))
    // the v75 sectioner tabs Settings on its own observer: keep asking for the SAVE tab until the card is on screen
    for (let i = 0; i < 20; i++) { const tab = document.querySelector('.hubv75-tab[data-sec="save"]'); tab && !tab.classList.contains('on') && tab.click(); await new Promise((r) => setTimeout(r, 200))
      const b = document.querySelector('#storeRowV150C [data-mz150="restore"]'); if (b && b.getBoundingClientRect().width > 0) break }
    const row = document.getElementById('storeRowV150C'), btn = row && row.querySelector('[data-mz150="restore"]'), sec = row && row.closest('.hubv75-sec')
    const r = btn && btn.getBoundingClientRect(); return { row: !!row, tab: sec ? sec.dataset.sec : null, btn: !!btn, w: r ? Math.round(r.width) : 0, pro: RIB_MONETIZE.has('pro') } })
  ok(st.row && st.tab === 'save' && st.btn && st.w > 100 && !st.pro, 'ON H10: Settings › SAVE carries a Store & Purchases card with RESTORE PURCHASES', st)
  await M(p, () => document.querySelector('#storeRowV150C [data-mz150="restore"]').scrollIntoView({ block: 'center' }))
  await p.click('#storeRowV150C [data-mz150="restore"]'); await p.waitForTimeout(900)
  const rs = await M(p, () => ({ pro: RIB_MONETIZE.has('pro'), s4: RIB_MONETIZE.until('speed4') === Infinity, listed: /pro/.test((document.getElementById('storeRowV150C') || {}).textContent || ''), view: window.S.view }))
  ok(rs.pro && rs.s4 && rs.listed && rs.view === 'settings', 'ON H10: RESTORE PURCHASES brings Pro back from the provider and the row lists it', rs)
  await ctx.close()
}

// ============================== 3. ON: the payout boost — H4 at the settle, H5 by the chip, once ==============================
{
  const ctx = await newCtx(), p = await open(ctx, 'on-pay', ON)
  // a ppDouble already held is paid AT the gameover settle, through the game's own line, and the card shows it
  await seedEnd(p, 'gameover'); await M(p, () => RIB_MONETIZE.grant('ppDouble', { uses: 1, source: 'test' }))
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const g = await endFacts(p), gHeld = await M(p, () => RIB_MONETIZE.has('ppDouble'))
  ok(g.view === 'gameover' && g.pay > 0 && g.doubled === g.pay && g.pp - g.vault >= 100 && g.vault === 40 + 2 * g.pay && +String(g.earned).replace(/\D/g, '') === 40 + 2 * g.pay && !gHeld && !g.chip,
    'ON H4: a held ppDouble doubles the gameover settle at the settle — PP, the vault\'s payout and the card agree, the double is spent, no chip', g)
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const g2 = await endFacts(p)
  ok(g2.pp === g.pp && !g2.chip, 'ON H4: a reload pays nothing again', { pp: g2.pp })
  // the win screen: the chip, a watched ad, the game pays it and redraws the card
  await seedEnd(p, 'win')
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  await p.waitForSelector('#mz149Pay', { timeout: 8000 }).catch(() => null)
  const w0 = await endFacts(p)
  // (a settle drawn by the BOOT restore runs before 27-monetize.js has loaded, so _payV150C may be unset — the module then
  // hands __V150C.payout the settle it reads off the vault's payout minus the bank)
  ok(w0.view === 'win' && w0.chip && !w0.doubled, 'ON H5: the win screen offers the double', w0)
  await p.click('#mz149Pay button'); await p.waitForSelector('#mz149Ad', { timeout: 3000 }).catch(() => null)
  await p.waitForFunction(() => !document.getElementById('mz149Ad'), null, { timeout: 6000 }).catch(() => null); await p.waitForTimeout(600)
  const w1 = await endFacts(p), saved = await M(p, () => JSON.parse(localStorage.getItem('gridiron_save_v1')).pp)
  const settle = w0.pay != null ? w0.pay : w0.vault - w0.bank
  ok(settle > 0 && w1.doubled === settle && w1.pp === w0.pp + settle && w1.vault === w0.vault + settle && +String(w1.earned).replace(/\D/g, '') === +String(w0.earned).replace(/\D/g, '') + settle && !w1.chip && saved === w1.pp,
    'ON H5: the watched ad pays the settle once more through window.__V150C.payout — PP, vault, the redrawn card and the save agree', { before: w0, after: w1 })
  const w2 = await M(p, () => ({ again: window.__V150C.payout('win', 999), pp: window.S.pp, boost: RIB_MONETIZE.claimPayoutBoost(999, 'x') }))
  ok(w2.again === 0 && w2.pp === w1.pp && w2.boost === 0, 'ON H5: never twice — a second call pays nothing', w2)
  await ctx.close()
}

// ============================== 4. ON: the STORE tile (H9) and back on the store (H11) ==============================
{
  const ctx = await newCtx(), p = await open(ctx, 'on-menu', ON)
  await p.waitForSelector('#rib-main-menu-v2 [data-rib-action="store"]', { timeout: 15000 }).catch(() => null)
  const t = await M(p, () => { const el = document.querySelector('#rib-main-menu-v2 [data-rib-action="store"]'); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { t: el.textContent.replace(/\s+/g, ' ').trim(), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), pageX: document.scrollingElement.scrollWidth > innerWidth + 1 } })
  ok(t && /STORE/.test(t.t) && t.l >= 0 && t.r <= W && t.h > 30 && !t.pageX, 'ON H9: the main menu wears a STORE tile, on screen', t)
  await p.click('#rib-main-menu-v2 [data-rib-action="store"]'); await p.waitForSelector('#mz149Store', { timeout: 3000 }).catch(() => null)
  const up = await M(p, () => !!document.getElementById('mz149Store'))
  ok(up, 'ON H9: tapping it opens the store')
  const b = await M(p, () => ({ r: window.__PLATFORM_V149.back.handle(), store: !!document.getElementById('mz149Store'), menu: !!document.getElementById('rib-main-menu-v2') }))
  ok(b.r === 'monetize' && !b.store && b.menu, 'ON H11: Android back closes the store and leaves the menu where it was', b)
  const b2 = await M(p, () => window.__PLATFORM_V149.back.handle())
  ok(b2 !== 'monetize', 'ON H11: with no sheet up, back is the platform\'s own again', b2)
  await ctx.close()
}

// ============================== 5. ON with config injection: 3× (H2) and a cosmetic entry (H8) ==============================
{
  // injected before the module, the way a store build ships its config (the dev ?monetize flag is not used here)
  const ctx = await newCtx({ enabled: true, features: { speed3: true } }), p = await open(ctx, 'on-3x')
  ok(await M(p, () => RIB_MONETIZE.enabled && RIB_MONETIZE.config.features.speed3), 'ON: window.RIB_MONETIZE_CONFIG injected before the file turns it on with speed3')
  ok(await toSeason(p), 'ON: a career is started (3×)')
  await toLive(p)
  const r3 = await M(p, () => { const b = [...document.querySelectorAll('.speed-row .speed-btn[data-spd]')]; const row = document.querySelector('.speed-row').getBoundingClientRect()
    window.setSpeed(3); return { btns: b.map((x) => x.dataset.spd).join(','), label: (document.querySelector('.speed-btn[data-spd="3"]') || {}).textContent, speed: window.__getGridironLiveSpeed(), right: Math.round(row.right), active: (document.querySelector('.speed-btn.active[data-spd]') || {}).dataset?.spd } })
  ok(r3.btns === '0.5,1,2,3,4' && /3×/.test(r3.label || '') && r3.speed === 3 && r3.active === '3' && r3.right <= W, 'ON H2: with features.speed3 the row carries 3× between 2× and 4×, and it plays at 3×', r3)
  // gateSpeed3: 3× wants speed3 (or speed4) — the earned rung is not sold, the tap only says so
  const g3 = await M(p, async () => { RIB_MONETIZE.config.features.gateSpeed3 = true; window.setSpeed(2); window.setSpeed(3); await new Promise((r) => setTimeout(r, 1200))
    const a = { speed: window.__getGridironLiveSpeed(), sheet: !!document.getElementById('mz149Sheet'), dim: document.querySelector('.speed-btn[data-spd="3"]')?.classList.contains('mz149-lock3') }
    RIB_MONETIZE.grant('speed3', { minutes: 5, source: 'test' }); window.setSpeed(3); a.after = window.__getGridironLiveSpeed(); RIB_MONETIZE.config.features.gateSpeed3 = false; return a })
  ok(g3.speed === 2 && !g3.sheet && g3.dim && g3.after === 3, 'ON H2: with gateSpeed3 a 3× tap without speed3 stays at 2× (no ad offer — it is earned), and plays once speed3 is held', g3)
  await M(p, () => { try { window.skipLive() } catch (e) {} })
  // H8: a NEW camera tagged with a cosmetic entitlement is not offered until it is owned; every existing one still is
  const cos = await M(p, async () => { const L = window.__CAM_MODES_V112, n0 = L.length; L.push({ id: 'testcos', n: 'Test Cosmetic Cam', d: '', cos: 'cos_kits1' })
    const count = async () => { window.go('settings'); await new Promise((r) => setTimeout(r, 400)); return document.querySelectorAll('.camopt112').length }
    const before = await count(), cur = window.S.settings && window.S.settings.fxCam; window.camModeSet112(n0); const refused = (window.S.settings && window.S.settings.fxCam) === cur
    RIB_MONETIZE.grant('cos_kits1', { source: 'test' }); const after = await count(); L.pop(); RIB_MONETIZE.revoke('cos_kits1'); return { n0, before, refused, after } })
  ok(cos.before === cos.n0 && cos.refused && cos.after === cos.n0 + 1, 'ON H8: a tagged camera is hidden and refused until cos_kits1 is held; the untagged ones are all offered', cos)
  await ctx.close()
}

// ============================== 6. the source says what the hooks are ==============================
{
  const src = fs.readFileSync(new URL('../src/07-career-app.js', import.meta.url), 'utf8')
  const mz = fs.readFileSync(new URL('../src/27-monetize.js', import.meta.url), 'utf8')
  ok(/function mzV150C\(\) \{\s*const m = typeof window < "u" && window\.RIB_MONETIZE;\s*return m && m\.enabled \? m : null;/.test(src), 'every in-game hook goes through mzV150C(), which is null unless RIB_MONETIZE says enabled')
  ok(/function setSpeed\(e\) \{[\s\S]{0,200}mzV150C\(\)/.test(src) && /speedClampV150C\(\(liveCtl && liveCtl\.speed\)/.test(src), 'H1 is setSpeed\'s first statement and H3 wraps the carried speed')
  ok(/payoutBoostV150C\(e, r, "gameover"\)/.test(src) && /payoutBoostV150C\(e, n, "win"\)/.test(src) && !/payoutBoostV150C|claimPayoutBoost/.test(src.slice(src.indexOf('function bankPPV136'), src.indexOf('function bankedV136'))), 'H4/H5 are in the two settles and H6 (bankPPV136) has no boost')
  ok(!/window\.setSpeed\s*=\s*function/.test(mz) && /var MONETIZE_ENABLED = false;/.test(mz), 'the module no longer wraps window.setSpeed, and the switch still ships FALSE')
}

console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
