// Dev check (v151 A THE FREE GAME IS THE GAME, AND THE STORE IS A LADDER · v151 A THE GATES ARE EARNED ON THE FIELD)
// — src/27-monetize.js (the store: tiers, rewarded conveniences, the pass, packs, expansions, the guard) and
// src/07-career-app.js (the progression gates, live whatever the master switch says). docs/MONETIZATION.md.
//
// OFF (the default): no store, no ads, no prices, no storage write from the module — and the owner's PROGRESSION gates
//   apply exactly as they do with the module blocked: 3× after a full UFF season, 4× for the UFF title (v156 C),
//   My Plays Only free since v153 B (was: after the first finished career), season sims a CAREER off the Legacy medal
//   groups since v156 B (1 on a fresh account; was a day off lifetime PP — the ladder is still the kill switch's path),
//   Quick Play never counted, lifetime PP never lowered by spending, the advanced filters free.
// ON (`?monetize=1`, dev host): the tier chain (No Ads ⊂ Pro ⊂ Founder, upgrades priced at the difference, restore
//   brings the chain back), 4× is Pro's (the 20-minute ad lends it), Pro adds 3 season sims a career, the ad cap (4 a day, never
//   over 5) and its rollover on the fake clock, rewards are conveniences only, the PP double is gone, the catalogue
//   guard refuses a power product (in the config and by hand), the pass is per season and calls RIB_SEASONS.grantPremium,
//   a pack grants its items through RIB_COSMETICS (stubbed when absent), `unlock_all_team_style`, a 24h cosmetic trial,
//   expansions are never purchasable, the filters lock for a free player, and the store fits 400x860 with one inner scroller.
//
//   GAME_URL=http://localhost:5601/index.html node scripts/v151Acheck.mjs
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const ON = ['monetize=1', 'monetizeAdMs=300']
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const W = 400, H = 860
const newCtx = async (tune) => {
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  await context.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
  if (tune) await context.addInitScript((t) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, t) }, tune)
  return context
}
const booted = (page) => page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V151A, null, { timeout: 40000 })
  .then(() => page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null))
  .then(() => page.waitForTimeout(900))
const open = async (ctx, tag, q = [], block = false) => {
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  if (block) await p.route(/27-monetize\.js/, (r) => r.abort())
  await p.goto(U(...q), { waitUntil: 'networkidle', timeout: 60000 }); await booted(p); return p
}
const M = (page, fn, arg) => page.evaluate(fn, arg)
// a seeded career with a season in hand (no clicking: the audit's own state tools, then startSeasonGames)
const seed = (page, o = {}) => M(page, (o) => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
  S.pp = o.pp || 0; S.bestLevel = o.bestLevel || 0; S.careersCompleted = o.careers || 0; if (o.hof) S.hof = o.hof
  S.player = A.newPlayer(); S.player.name = 'Test Man'; S.player.pos = 'RB'; S.player.level = o.level || 0; A.setState(S)
  try { window.startSeasonGames() } catch (e) {} document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove()
  S.view = 'season'; window.GridironStorage.save(S); return !!(S.player.weekResults && S.player.weekResults.length) }, o)
const goLive = (page) => M(page, async () => { const S = window.S, t = S.player, a = t.weekResults.findIndex((n) => !n.played); t.currentWeek = a
  S._liveGame = window.__simGameV2(t.weekResults[a].perf, t.pos); S._oppName = t.weekResults[a].opp; window.go('live')
  for (let i = 0; i < 40 && !document.querySelector('.speed-row'); i++) await new Promise((r) => setTimeout(r, 150)) })
const row = (page) => M(page, () => { const r = document.querySelector('.speed-row'); if (!r) return null; const c = r.cloneNode(true); c.querySelectorAll('.speed-btn').forEach((b) => b.classList.remove('active')); return c.outerHTML })
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
// a clean account, reloaded, then a real first season through the menu (the silent sim needs a career the game built)
const freshCareer = async (page, q = []) => { await M(page, () => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); window.GridironStorage.save(S) })
  await page.goto(U(...q), { waitUntil: 'networkidle' }); await booted(page); return toSeason(page) }
const played = (page) => M(page, () => window.S.player.weekResults.filter((w) => w.played).length)

// ============================== 1. OFF: no store — and the progression gates, the same with the module blocked ==============================
{
  const ca = await newCtx(), cb = await newCtx()
  const a = await open(ca, 'off'), b = await open(cb, 'blocked', [], true)
  const api = await M(a, () => { const R = window.RIB_MONETIZE; return { on: R.enabled, keys: Object.keys(localStorage).filter((k) => /monetize/.test(k)), nodes: document.querySelectorAll('[id^="mz149"],[class*="mz149"],[class*="mz151"]').length,
    filters: R.filtersLocked(), cos: R.cosmeticAccess('x'), exp: R.expansionUnlocked('coach'), valid: R.validateProduct({ id: 'rib.x', grants: { pp: {} } }).ok, tier: R.tier(), boost: R.claimPayoutBoost(1000) } })
  ok(!api.on && !api.keys.length && !api.nodes && api.filters === false && api.cos === 'off' && api.exp === true && api.valid === false && api.tier === 'free' && api.boost === 0,
    'OFF: no store UI, no storage, filters unlocked, expansions ungated; the pure answers (the guard) still work', api)
  ok(await seed(a) && await seed(b), 'OFF: a season is seeded with and without the module')
  await goLive(a); await goLive(b)
  const ra = await row(a), rb = await row(b)
  const g = await M(a, () => { window.setSpeed(2); window.setSpeed(3); const s3 = window.__getGridironLiveSpeed(); window.setSpeed(4); const s4 = window.__getGridironLiveSpeed()
    const lab = [...document.querySelectorAll('.speed-btn[data-spd]')].map((x) => x.dataset.spd + ':' + (x.querySelector('small') || {}).textContent + ':' + (x.getAttribute('title') || '')).join('|')
    // v156 C: reaching the UFF is no longer enough — 3× after a full UFF season, 4× for the UFF title (account-wide flags)
    window.S.bestLevel = 7; window.__V151A.relabel(); window.setSpeed(3); const r3 = window.__getGridironLiveSpeed()
    window.S.uffSeasonV156C = { at: 1 }; window.__V151A.relabel(); window.setSpeed(3); const u3 = window.__getGridironLiveSpeed(); window.setSpeed(4); const r4 = window.__getGridironLiveSpeed()
    window.S.uffTitleV156C = { at: 1 }; window.__V151A.relabel(); window.setSpeed(4); const u4 = window.__getGridironLiveSpeed()
    return { s3, s4, lab, r3, u3, r4, u4, sheet: !!document.getElementById('mz149Sheet'), locked: document.querySelectorAll('.speed-lock-v151').length } })
  ok(ra && ra === rb && /data-spd="3"/.test(ra), 'OFF: the live speed row (with its 3× rung) is byte-for-byte the row with the module blocked')
  ok(g.s3 === 2 && g.s4 === 2 && /3:🔒 UFF:Finish a full UFF season/.test(g.lab) && /4:🔒 RING:Win the UFF championship/.test(g.lab), 'OFF (v156 C): a fresh player\'s 3× and 4× are locked — "🔒 UFF" (a full UFF season) and "🔒 RING" (the UFF title) — and the tap keeps 2×', g)
  ok(g.r3 === 2 && g.u3 === 3 && g.r4 === 3 && g.u4 === 4 && !g.sheet && g.locked === 0, 'OFF (v156 C): reaching the UFF opens nothing; a full UFF season opens 3×, the UFF title opens 4× — no offer anywhere', g)
  // My Plays Only
  const po = await M(a, async () => { const S = window.S; S.bestLevel = 0; S.settings.onlyInvolved = true; const out = { forced: window.__getGridironState ? null : null }
    out.locked = !window.__V151A.gates().playsOnly.ok; try { window.skipLive() } catch (e) {}
    window.go('settings'); await new Promise((r) => setTimeout(r, 500))
    out.row = [...document.querySelectorAll('.toggle-row')].map((r) => r.textContent.replace(/\s+/g, ' ')).find((t) => /My plays only/i.test(t)) || ''
    const before = S.settings.onlyInvolved; window.toggleSetting('onlyInvolved'); out.refused = S.settings.onlyInvolved === before
    S.careersCompleted = 1; out.after = window.__V151A.gates().playsOnly.ok; window.toggleSetting('onlyInvolved'); out.toggled = S.settings.onlyInvolved !== before
    return out })
  // v153 B: the owner made My Plays Only FREE and on by default — no gate, no lock, it toggles from the first career
  ok(!po.locked && !/🔒/.test(po.row) && !po.refused && po.after, 'OFF: My Plays Only is free (v153 B) — never locked, it toggles for a fresh player', po)
  // season sims (v156 B): a career's, off the medal groups — lifetime PP, the button, Quick Play, no day
  const lad = await M(a, () => [999, 1000, 99999, 100000, 1e7, 1e9].map((L) => window.__V151A.ladder(L).perDay))
  ok(lad.join(',') === '0,1,1,3,5,7', 'OFF: the old skip ladder (TU v156Bskips 0) — 0 under 1,000 lifetime PP, 1 at 1,000, 3 at 100,000, 5 at 10M, 7 at 1B', lad)
  ok(await freshCareer(a), 'OFF: a real first season is started through the menu')
  const sk0 = await M(a, () => window.__V151A.skips())
  ok(sk0.model === 'career' && sk0.allowed === 1 && sk0.left === 1 && sk0.used === 0 && sk0.gated, 'OFF: a fresh account has 1 season sim this career (v156 B)', sk0)
  const qp = await M(a, async () => { const n0 = window.S.player.weekResults.filter((w) => w.played).length; window.playWeek(false); await new Promise((r) => setTimeout(r, 1500)); document.getElementById('growthV42')?.remove()
    return { n0, n1: window.S.player.weekResults.filter((w) => w.played).length, used: window.__V151A.skips().used } })
  ok(qp.n1 === qp.n0 + 1 && qp.used === 0, 'OFF: Quick Play sims one week, free, and is never counted as a skip', qp)
  const lt = await M(a, () => { const S = window.S; S.pp = (S.pp || 0) + 1500; window.GridironStorage && window.__V151A.track(); const L1 = window.__V151A.lifetime(); S.pp -= 1200; window.__V151A.track(); return { L1, L2: window.__V151A.lifetime(), allowed: window.__V151A.skips().allowed } })
  ok(lt.L1 >= 1500 && lt.L2 === lt.L1 && lt.allowed === 1, 'OFF: PP earned raises lifetime PP, spending never lowers it — and PP no longer buys season sims', lt)
  await M(a, () => { window.S.view = 'season'; window.go('season') }); await a.waitForTimeout(500)
  const btn = await M(a, () => { const b = document.querySelector('[onclick^="seasonSkipV151A"]'); return b ? { t: b.textContent.replace(/\s+/g, ' '), r: Math.round(b.getBoundingClientRect().right) } : null })
  ok(btn && /1 left this career/.test(btn.t) && btn.r <= W, 'OFF: the ⏭ button says how many sims are left this career', btn)
  const sk1 = await M(a, async () => { const n0 = window.S.player.weekResults.filter((w) => w.played).length; window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 2500)); document.getElementById('growthV42')?.remove()
    return { n0, n1: window.S.player.weekResults.filter((w) => w.played).length, s: window.__V151A.skips() } })
  ok(sk1.n1 > sk1.n0 + 1 && sk1.s.used === 1 && sk1.s.left === 0, 'OFF: the sim runs the rest of the regular season and spends the career\'s one', { n0: sk1.n0, n1: sk1.n1, used: sk1.s.used, left: sk1.s.left })
  const roll = await M(a, () => { window.S.skipsV151A = { day: '1999-1-1', used: 0 }; return window.__V151A.skips().left })
  ok(roll === 0, 'OFF: there is no day any more — an old day record brings nothing back', roll)
  // the advanced filters: free while the store is off
  await M(a, () => { const S = window.S; S.hof = ['QB', 'RB', 'QB', 'LB'].map((pos, i) => ({ name: 'Bust ' + i, pos, goat: 100 + i * 10, peak: 60 + i, titles: i, seasons: 5 + i, reached: 5, won: false, power: 0 })); window.go('hof') }); await a.waitForTimeout(500)
  const hf = await M(a, () => { const bar = document.querySelector('[data-advf-bar="hof"]'); window.advfSetV151A('hof', 'pos', 'QB'); const vis = [...document.querySelectorAll('[data-advf="hof"] [data-advf-row]')].filter((r) => !r.hidden).map((r) => r.dataset.pos)
    window.advfSetV151A('hof', 'pos', ''); window.advfSetV151A('hof', 'sort', 'titles', 'asc'); const first = document.querySelector('[data-advf="hof"] [data-advf-row]').dataset.sTitles
    return { bar: !!bar && !bar.classList.contains('locked'), vis, first } })
  ok(hf.bar && hf.vis.join() === 'QB,QB' && hf.first === '0', 'OFF: the Hall of Fame\'s advanced filters are free — a position filter and a sort both work', hf)
  await ca.close(); await cb.close()
}

// ============================== 2. OFF → the gates grandfather an existing save ==============================
{
  const c = await newCtx(), p = await open(c, 'gf')
  // v156 C: the record grandfathers the speed rungs — a Hall career with a finished UFF season and a ring
  const gf = await M(p, () => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.bestLevel = 7; S.careersCompleted = 2; S.pp = 50; S.tree = {}
    S.hof = [{ name: 'Old Pro', pos: 'QB', rings: 1, won: true, reached: 7, goat: 100, box: { log: [{ n: 9, level: 7, champion: true, awards: [] }] } }]; A.setState(S); delete S.ppLifetimeV151A; return window.__V151A.gates() })
  ok(gf.speed3.ok && gf.speed4.ok && gf.playsOnly.ok, 'OFF: a save whose record shows a UFF season and a UFF ring keeps 3×, 4× and My Plays Only', gf)
  await c.close()
}

// ============================== 3. ON: tiers, restore, 4×, skips, ads, the guard ==============================
{
  const c = await newCtx(), p = await open(c, 'on', ON)
  const buy = (id) => M(p, async (id) => { const pr = RIB_MONETIZE.purchase(id); for (let i = 0; i < 20 && !document.querySelector('#mz149Buy [data-yes]'); i++) await new Promise((r) => setTimeout(r, 50)); document.querySelector('#mz149Buy [data-yes]')?.click(); return pr }, id)
  const H = () => M(p, () => Object.fromEntries(['noAds', 'pro', 'founder', 'speed4', 'speed3', 'simPlus', 'filters', 'customPlus'].map((k) => [k, RIB_MONETIZE.has(k)])))
  ok(await seed(p, { pp: 0 }), 'ON: a season is seeded')
  // the guard
  const gd = await M(p, () => { const R = RIB_MONETIZE; return { pp: R.validateProduct({ id: 'rib.ppmega', grants: { pp: { value: 1e6 } } }), stat: R.validateProduct({ id: 'rib.boost', grants: { statBoost: {} } }).ok, reroll: R.validateProduct({ id: 'rib.reroll', grants: { reroll: {} } }).ok, cos: R.validateProduct({ id: 'rib.cos.x', grants: { 'cos:x': {} } }).ok,
    grant: R.grant('pp', { value: 5 }) || R.grant('prestige') || R.grant('gearRoll'), cat: R.catalog().tiers.map((t) => t.id + '=' + t.price).join(','), ups: R.catalog().upgrades.map((t) => t.id + '=' + t.price).join(','),
    place: Object.entries(R.config.placements).map(([k, v]) => k + ':' + v.reward.key).join(','), allOk: Object.values(R.config.placements).every((v) => R.keyAllowed(v.reward.key === 'try:*' ? 'try:x' : v.reward.key)) } })
  ok(!gd.pp.ok && /never sold/.test(gd.pp.errors.join()) && !gd.stat && !gd.reroll && gd.cos && gd.grant === false, 'ON: the catalogue guard refuses PP / stat / reroll products and grant() refuses power keys; a cosmetic passes', gd)
  ok(gd.cat === 'rib.noads=$3.99,rib.pro=$8.99,rib.founder=$14.99' && /rib\.upgrade\.noads_pro=\$5\.00/.test(gd.ups) && /rib\.upgrade\.pro_founder=\$6\.00/.test(gd.ups), 'ON: the three tiers at $3.99 / $8.99 / $14.99, upgrades at the difference', { cat: gd.cat, ups: gd.ups })
  ok(gd.place === 'speed4:speed4,simUnlimited:simUnlimited,cosTrial:try:*' && gd.allOk, 'ON: every rewarded placement is a convenience (4× for 20 min, 30 min of unlimited season sims, a 24h trial) — no PP double', gd.place)
  // 4× is Pro's; 3× is still the UFF's
  await goLive(p)
  const s4 = await M(p, async () => { window.setSpeed(2); window.setSpeed(4); await new Promise((r) => setTimeout(r, 200)); const o = { speed: window.__getGridironLiveSpeed(), sheet: !!document.getElementById('mz149Sheet'), lab: (document.querySelector('.speed-btn[data-spd="4"] small') || {}).textContent }
    document.getElementById('mz149Sheet')?.remove(); window.S.uffSeasonV156C = { at: 1 }; o.four = window.__V151A.speedOk(4); o.three = window.__V151A.speedOk(3); delete window.S.uffSeasonV156C; return o })
  ok(s4.speed === 2 && s4.sheet && /RING/.test(s4.lab || '') && !s4.four && s4.three, 'ON: a locked 4× (🔒 RING) opens the offer; a full UFF season opens 3× but not 4×', s4)
  // No Ads → upgrade to Pro (the difference) → Founder
  const r1 = await buy('rib.noads'), h1 = await H()
  ok(r1.ok && h1.noAds && !h1.pro && !h1.speed4, 'ON: Ad Free grants noAds only', h1)
  await M(p, () => RIB_MONETIZE.openStore('pro')); await p.waitForTimeout(300)
  const up = await M(p, () => ({ btn: !!document.querySelector('#mz149Store [data-buy="rib.upgrade.noads_pro"]'), full: !!document.querySelector('#mz149Store [data-buy="rib.pro"]') }))
  ok(up.btn && !up.full, 'ON: an Ad Free owner is offered the Pro UPGRADE product (the difference), not the full price', up)
  await M(p, () => RIB_MONETIZE.closeStore())
  // Ad Free: the rewarded 4× is claimed with no ad shown
  const af = await M(p, async () => { const r = await RIB_MONETIZE.showRewarded('speed4'); return { r: r.rewarded, adFree: r.adFree, s4: RIB_MONETIZE.has('speed4'), left: RIB_MONETIZE.adsLeft() } })
  ok(af.r && af.adFree && af.s4 && af.left === 3, 'ON: Ad Free claims the 20-minute 4× without an ad (inside the daily cap)', af)
  const r2 = await buy('rib.upgrade.noads_pro'), h2 = await H()
  ok(r2.ok && h2.pro && h2.speed4 && h2.speed3 && h2.simPlus && h2.filters && h2.noAds && !h2.founder, 'ON: Pro implies Ad Free + permanent 4× + advanced sim + filters', h2)
  const sk = await M(p, () => window.__V151A.skips())
  ok(sk.pro === 3 && sk.allowed === sk.base + sk.earned + 3, 'ON: Pro adds 3 season sims a career on top of the medals\'', sk)
  // cosmetics / seasons: the real workers, or stubs standing in for the contract
  const stub = await M(p, () => {
    const out = { cosReal: !!window.RIB_COSMETICS, seaReal: !!window.RIB_SEASONS }
    window.__cosGrants = []; window.__seaGrants = []
    if (!window.RIB_COSMETICS) { const items = [{ id: 'uni_a', cat: 'uniform', name: 'Throwback A', source: 'shop', packs: ['uni1'] }, { id: 'uni_b', cat: 'uniform', name: 'Throwback B', source: 'shop', packs: ['uni1'] }, { id: 'fd_1', cat: 'helmet', name: 'Founder shell', source: 'founder', packs: [] }]
      const own = {}; window.RIB_COSMETICS = { catalog: () => items.map((i) => Object.assign({ preview: (el) => { el.textContent = i.name } }, i)), packs: () => [{ id: 'uni1', name: 'Throwbacks', cat: 'uniform', items: ['uni_a', 'uni_b'] }], owned: (id) => !!own[id], grant: (id, src) => { own[id] = 1; window.__cosGrants.push(id + ':' + src) }, equip() {}, equipped() {}, onChange() {} } }
    else { const g = window.RIB_COSMETICS.grant; window.RIB_COSMETICS.grant = function (id, src) { window.__cosGrants.push(id + ':' + src); return g.apply(this, arguments) } }
    if (!window.RIB_SEASONS) window.RIB_SEASONS = { current: () => ({ id: 's1', name: 'Season 1', start: 0, end: 1, daysLeft: 90 }), pass: () => ({ owned: false }), grantPremium: (id) => { window.__seaGrants.push(id) } }
    else { const g = window.RIB_SEASONS.grantPremium; window.RIB_SEASONS.grantPremium = function (id) { window.__seaGrants.push(id); return g.apply(this, arguments) } }
    return out })
  // Founder via the Pro upgrade: the founder bundle through the contract
  const r3 = await buy('rib.upgrade.pro_founder'), h3 = await H()
  const fi = await M(p, () => ({ items: RIB_COSMETICS.catalog().filter((i) => i.source === 'founder').map((i) => i.id), grants: window.__cosGrants.slice() }))
  ok(r3.ok && h3.founder && h3.pro && h3.customPlus && fi.items.every((id) => fi.grants.includes(id + ':founder')), 'ON: Founder implies Pro and hands the founder cosmetic bundle to RIB_COSMETICS', { h3, fi })
  // the pass is per season
  const ps = await M(p, async () => { const c = RIB_SEASONS.current(), P = RIB_MONETIZE.catalog().pass[0]; const pr = RIB_MONETIZE.purchasePass(c.id); for (let i = 0; i < 20 && !document.querySelector('#mz149Buy [data-yes]'); i++) await new Promise((r) => setTimeout(r, 50)); document.querySelector('#mz149Buy [data-yes]')?.click(); const r = await pr
    return { id: c.id, pid: P && P.id, price: P && P.price, ok: r.ok, has: RIB_MONETIZE.has('pass:' + c.id), other: RIB_MONETIZE.has('pass:' + c.id + 'x'), called: window.__seaGrants.includes(c.id) } })
  ok(ps.ok && ps.pid === 'rib.pass.' + ps.id.toLowerCase().replace(/[^a-z0-9_.]/g, '_') && ps.price === '$9.99' && ps.has && !ps.other && ps.called, 'ON: the $9.99 pass is a product per season — pass:<seasonId> only for that season, and RIB_SEASONS.grantPremium is called', ps)
  // a pack grants its items through the contract
  const pk = await M(p, async () => { const P = RIB_MONETIZE.catalog().packs[0]; if (!P) return null; const pr = RIB_MONETIZE.purchase(P.id); for (let i = 0; i < 20 && !document.querySelector('#mz149Buy [data-yes]'); i++) await new Promise((r) => setTimeout(r, 50)); document.querySelector('#mz149Buy [data-yes]')?.click(); const r = await pr
    return { P, ok: r.ok, owned: P.items.every((id) => RIB_MONETIZE.cosmeticAccess(id) === 'owned'), granted: P.items.every((id) => window.__cosGrants.includes(id + ':shop')) } })
  ok(pk && pk.ok && pk.owned && pk.granted && /^\$[1-4]\.99$/.test(pk.P.price), 'ON: a cosmetic pack ($1.99–$4.99) grants cos:<item> for each item and RIB_COSMETICS.grant(item, "shop")', pk)
  const ts = await buy('unlock_all_team_style'), tsh = await M(p, () => RIB_MONETIZE.has('cos:team_style_all'))
  ok(ts.ok && tsh, 'ON: unlock_all_team_style grants cos:team_style_all', ts)
  // expansions are listed, never sold
  const ex = await M(p, async () => ({ list: RIB_MONETIZE.expansions().map((x) => x.id + ':' + x.status + ':' + x.price).join(','), buy: (await RIB_MONETIZE.purchase('rib.exp.coach')).reason, unlocked: RIB_MONETIZE.expansionUnlocked('coach') }))
  ok(/coach:soon:\$4\.99/.test(ex.list) && /universe:soon:\$14\.99/.test(ex.list) && ex.buy === 'coming-soon' && !ex.unlocked, 'ON: expansions are COMING SOON — not purchasable, exp:<id> not held', ex)
  // restore from nothing brings the whole chain back
  await M(p, () => localStorage.removeItem('rib.monetize.ents.v1'))
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const rr = await M(p, async () => { const r = await RIB_MONETIZE.restore(); return { n: r.restored.length, founder: RIB_MONETIZE.has('founder'), pro: RIB_MONETIZE.has('pro'), noAds: RIB_MONETIZE.has('noAds'), ts: RIB_MONETIZE.has('cos:team_style_all') } })
  ok(rr.founder && rr.pro && rr.noAds && rr.ts, 'ON: RESTORE brings the tier chain and the cosmetics back from the provider\'s records', rr)
  await c.close()
}

// ============================== 4. ON: the ad cap and its day, the trial, the skip ad, the filters lock ==============================
{
  const c = await newCtx(), p = await open(c, 'ads', ON)
  ok(await freshCareer(p, ON), 'ON: a real first season is started (free player)')
  const fl = await M(p, async () => { window.S.hof = [{ name: 'A', pos: 'QB', goat: 1, peak: 1, titles: 0, seasons: 1, reached: 1 }, { name: 'B', pos: 'RB', goat: 2, peak: 1, titles: 0, seasons: 1, reached: 1 }]; window.go('hof'); await new Promise((r) => setTimeout(r, 400)); const b = document.querySelector('[data-advf-bar="hof"]'); return { locked: !!b && b.classList.contains('locked'), text: b && b.textContent.trim() } })
  ok(fl.locked && /Pro/.test(fl.text), 'ON: a free player\'s advanced filters are a locked "Pro Career" chip', fl)
  const skip = await M(p, async () => { window.go('season'); window.S.player.simsUsedV156B = 1; const n0 = window.S.player.weekResults.filter((w) => w.played).length; window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 300))
    const sheet = document.getElementById('mz149Sheet'), txt = sheet ? sheet.textContent : ''; sheet?.remove()
    const ad = await RIB_MONETIZE.rewardSim(); const left = window.__V151A.skips().left; window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 2500)); document.getElementById('growthV42')?.remove()
    return { n0, txt, ad: ad.rewarded, left, n1: window.S.player.weekResults.filter((w) => w.played).length, used: window.S.player.simsUsedV156B, unl: RIB_MONETIZE.has('simUnlimited') } })
  ok(/NO SEASON SIMS LEFT THIS CAREER/.test(skip.txt) && /BRONZE medals/.test(skip.txt) && /Quick Play/.test(skip.txt) && skip.ad && skip.left === Infinity && skip.n1 > skip.n0 + 1 && skip.used === 1 && skip.unl, 'ON: no sims → the sheet says how medals add them (and that Quick Play is free); a watched ad makes sims unlimited, the sim runs and nothing is counted', skip)
  const cap = await M(p, async () => { const R = RIB_MONETIZE, out = { left0: R.adsLeft() }
    out.t = (await R.showRewarded('cosTrial', { item: 'uni_z' })).rewarded; out.trial = R.cosmeticAccess('uni_z')
    out.a = (await R.showRewarded('speed4')).rewarded; out.b = (await R.showRewarded('speed4')).rewarded; out.c = await R.showRewarded('speed4'); out.leftEnd = R.adsLeft()
    R.dev.advance(25 * 3600e3); out.trialLater = R.cosmeticAccess('uni_z'); out.nextDay = R.adsLeft()
    window.RIB_TUNE.adsPerDayV151A = 9; out.clamped = R.adsLeft(); delete window.RIB_TUNE.adsPerDayV151A; R.dev.advance(-25 * 3600e3); return out })
  ok(cap.left0 === 3 && cap.t && cap.trial === 'trial' && cap.a && cap.b && cap.c.reason === 'daily-cap' && cap.leftEnd === 0, 'ON: 4 rewarded ads a day (one already spent on the skip): a 24h trial, two 4× boosts, then "daily-cap"', cap)
  ok(cap.trialLater === null && cap.nextDay === 4 && cap.clamped === 5, 'ON: the trial expires after 24h, the next (fake-clock) day brings 4 back, and the dial never goes above 5', cap)
  // the store fits 400x860, one inner scroller, the ladder in the owner's order
  await M(p, () => RIB_MONETIZE.openStore()); await p.waitForTimeout(400)
  const st = await M(p, () => { const c = document.querySelector('#mz149Store .mz149-card'), r = c.getBoundingClientRect(), b = c.querySelector('.mz151-body'), s = document.scrollingElement
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), inner: getComputedStyle(b).overflowY, scrolls: b.scrollHeight > b.clientHeight, pageScroll: s.scrollHeight > innerHeight + 1 || s.scrollWidth > innerWidth + 1,
      order: [...b.querySelectorAll(':scope > [data-sec]')].map((x) => x.dataset.sec).join(','), wide: [...c.querySelectorAll('*')].filter((x) => x.getBoundingClientRect().right > r.right + 1).length,
      restore: !!c.querySelector('[data-restore]'), never: /Never for sale/.test(c.textContent) } })
  ok(st.top >= 0 && st.bottom <= H && st.left >= 0 && st.right <= W && st.inner === 'auto' && st.scrolls && !st.pageScroll && !st.wide && st.restore && st.never, 'ON: the store fits 400x860 — one inner scroller, no page scroll, nothing wider than the card, RESTORE in the foot', st)
  ok(/^free,ad,noAds,pro,founder(,pass)?,cos,exp,never$/.test(st.order), 'ON: the ladder reads FREE → REWARDED → AD FREE → PRO → FOUNDER → PASS → COSMETICS → EXPANSIONS', st.order)
  await c.close()
}

// ============================== 5. ON: a power product injected into the config is dropped ==============================
{
  const c = await browser.newContext({ viewport: { width: W, height: H } })
  await c.addInitScript(() => { window.RIB_MONETIZE_CONFIG = { enabled: true, products: [{ id: 'rib.ppmega', kind: 'nonconsumable', title: 'PP MEGA', price: '$99', grants: { pp: { value: 1e6 } } }, { id: 'rib.noads', kind: 'nonconsumable', tier: 'noAds', title: 'Ad Free', price: '$3.99', grants: { noAds: {} } }] } })
  const p = await c.newPage(); p.on('pageerror', (e) => errors.push('inject: ' + e.message))
  await p.goto(U(), { waitUntil: 'networkidle' }); await booted(p)
  const inj = await M(p, async () => ({ refused: RIB_MONETIZE.catalog().refused.map((x) => x.id), buy: (await RIB_MONETIZE.purchase('rib.ppmega')).reason, ids: RIB_MONETIZE.config.products.map((x) => x.id) }))
  ok(inj.refused.includes('rib.ppmega') && inj.buy === 'unknown-product' && !inj.ids.includes('rib.ppmega'), 'ON: a PP product injected into the config is refused at load and cannot be bought', inj)
  await c.close()
}

// ============================== 6. the source ==============================
{
  const mz = fs.readFileSync(new URL('../src/27-monetize.js', import.meta.url), 'utf8'), src = fs.readFileSync(new URL('../src/07-career-app.js', import.meta.url), 'utf8')
  ok(/var MONETIZE_ENABLED = false;/.test(mz) && /v151 A THE FREE GAME IS THE GAME/.test(mz) && /v151 A THE GATES ARE EARNED ON THE FIELD/.test(src), 'the switch ships FALSE; both v151 A banners are in place')
  ok(!/ppDouble:\s*\{/.test(mz) && /function claimPayoutBoost\(\) \{ return 0 \}/.test(mz), 'the PP-double placement is gone and claimPayoutBoost is 0')
}

console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
