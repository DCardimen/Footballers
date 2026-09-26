// Dev check (v158 B TRY BOTH SIDES OF THE STORE) — Settings › EXPERIENCE (src/07 `experienceRowV158B`), the preview
// sandbox and the 15 s ad placeholder (src/27-monetize.js `v158 B`), docs/MONETIZATION.md §10.
//
//   1. OFF (the default — no `rib.experience.v158`, or a bad value): the module is off, no preview key, no chip, no
//      store node; the Settings EXPERIENCE row is there with "Off" chosen and the Settings markup is the SAME as a boot
//      with 27-monetize.js blocked (the v150 C identity). v149Echeck / v150Ccheck prove the rest of OFF.
//   2. F2P preview: the store is ON with nothing bought (not grandfathered, no member), the provider is "preview", the
//      chip reads "PREVIEW · F2P"; each rewarded placement (4×, game sims from a locked Quick Play tap, a cosmetic
//      trial) opens the full-screen placeholder — "An ad will be placed here", 15 s, the reward named, a countdown ring,
//      SKIP focused and live at once — and skip (button or Esc) grants the reward: 4× for 20 min, unlimited GAME sims for
//      30 min, a 24 h trial; a finished countdown grants it too; TU adSkipAfterV158B > 0 holds SKIP back; member looks
//      stay locked; the season report card shows the "break between seasons" placeholder ONCE a season (TU
//      adBreakV158B 0: never); every entitlement lives in the sandbox keys, never the save or the real store key; the
//      placeholder fits 400x860.
//   3. MEMBER preview (switched from Settings through the ribDialog confirm): the F2P sandbox is gone, `member` held,
//      no ad anywhere (the 4× offer is not needed, no placeholder, no break), 4× allowed, Quick Play free, season sims doubled (and counted), a member
//      look owned and equipped; the chip reads "PREVIEW · MEMBER".
//   4. Back to OFF: the store is off again, every preview key is deleted, the member look is not owned and the slot
//      falls back to its default; no chip. No page errors throughout.
//
//   GAME_URL=http://localhost:5451/index.html node scripts/v158Bcheck.mjs
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const W = 400, H = 860
const SHOTS = process.env.SHOTS || ''
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/v158B-${name}.png` }) } }
const newCtx = async () => {
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  await context.addInitScript(() => {
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove(); document.getElementById('growV132')?.remove() }, 60)
  })
  return context
}
const booted = (page) => page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.RIB_MONETIZE && !!window.__V156B, null, { timeout: 40000 })
  .then(() => page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null))
  .then(() => page.waitForTimeout(900))
const M = (page, fn, arg) => page.evaluate(fn, arg)
const PV = /^rib\.monetize\.preview\.v158\./
const settingsHtml = (p) => M(p, async () => { window.go('settings'); for (let i = 0; i < 25 && !document.getElementById('experienceV158B'); i++) await new Promise((r) => setTimeout(r, 120)); await new Promise((r) => setTimeout(r, 900))
  const c = document.getElementById('screen').cloneNode(true); c.querySelectorAll('canvas,[data-live],.threshold-note').forEach((n) => n.remove()); return c.innerHTML.replace(/\s+/g, ' ') })
// a career with a regular season in hand (the v156Bcheck route)
const seed = (page) => M(page, () => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.tree = S.tree || {}; A.setState(S)
  S.player = A.newPlayer(); const p = S.player; p.name = 'Test Man'; p.pos = 'QB'; p.age = 22; p.originV11 = p.originV11 || 'walk-on'; p._wonShown = true; p.level = 2
  p.training = 'balanced'; A.startSeasonGames(); window.go('season'); window.GridironStorage.save(S)
  return (p.weekResults || []).length
})
// the season played out to its report card (the growcheck route: resolve every week, then finishSeasonGames)
const toResultSrc = `async () => { const A = window.__GRIDIRON_AUDIT__, S = window.S
  for (let i = 0; i < 12 && S.view !== 'result'; i++) {
    const p = S.player; for (const w of (p.weekResults || [])) { if (!w || w.played) continue; try { A.resolveSequentialWeekV11(p, w, 'balanced') } catch (e) {} w.played = true; w.won = !!(w.us > w.them) }
    try { window.finishSeasonGames() } catch (e) {} await new Promise((r) => setTimeout(r, 300)) }
  return S.view }`
const adState = (page) => M(page, () => { const v = document.getElementById('mz149Ad'); if (!v) return null
  const r = v.querySelector('.mz149-card').getBoundingClientRect(), sk = v.querySelector('[data-skip]')
  return { text: v.textContent.replace(/\s+/g, ' '), n: +(v.querySelector('[data-n]') || {}).textContent, arc: +(v.querySelector('[data-arc]') || { getAttribute: () => 0 }).getAttribute('stroke-dashoffset'),
    skip: !!sk && !sk.disabled, focus: document.activeElement === sk, card: v.querySelector('.mz158-card') ? 1 : 0, fit: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, scroll: document.documentElement.scrollWidth <= innerWidth } })
const waitAd = (page, t = 4000) => page.waitForSelector('#mz149Ad', { timeout: t }).then(() => true).catch(() => false)
const gone = (page) => page.waitForFunction(() => !document.getElementById('mz149Ad'), null, { timeout: 6000 }).then(() => true).catch(() => false)
const confirmDlg = async (page) => { await page.waitForSelector('#ribDlgV149 button.primary-v149', { timeout: 5000 }); await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }), page.click('#ribDlgV149 button.primary-v149')]); await booted(page) }

const ctx = await newCtx()

// ============================== 1. OFF ==============================
{
  const b = await ctx.newPage(); b.on('pageerror', (e) => errors.push('blocked: ' + (e.message || e)))
  await b.route(/27-monetize\.js/, (r) => r.abort())
  await b.goto(U(), { waitUntil: 'networkidle', timeout: 60000 }); await b.waitForFunction(() => !!window.__GRIDIRON_AUDIT__, null, { timeout: 40000 }); await b.waitForTimeout(1500)
  const hb = await settingsHtml(b); await b.close()
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push('off: ' + (e.message || e)))
  await p.goto(U(), { waitUntil: 'networkidle', timeout: 60000 }); await booted(p)
  const ha = await settingsHtml(p)
  const off = await M(p, () => ({ on: RIB_MONETIZE.enabled, pv: RIB_MONETIZE.preview, keys: Object.keys(localStorage).filter((k) => /monetize|experience/.test(k)), chip: !!document.getElementById('mz158Chip'),
    nodes: document.querySelectorAll('[id^="mz149"],[class*="mz149"],[class*="mz151"],[class*="mz158"]').length, row: !!document.getElementById('experienceV158B'),
    chosen: (document.querySelector('#experienceV158B [aria-checked="true"]') || {}).dataset?.exp158, api: typeof window.experienceSetV158B }))
  ok(!off.on && off.pv === null && !off.keys.length && !off.chip && !off.nodes, 'OFF: the module is off, no preview, no key, no chip, no store node', off)
  ok(off.row && off.chosen === 'off' && off.api === 'function', 'OFF: Settings shows EXPERIENCE with "Off (current build)" chosen', off)
  ok(ha === hb && /experienceV158B/.test(ha), 'OFF: the Settings markup is identical with the module blocked (the row reads storage, not the switch)', ha === hb ? '' : { a: ha.length, b: hb.length })
  await shot(p, 'settings-off')
  // a bad value is off; the kill switch hides the row and ignores the flag
  await M(p, () => localStorage.setItem('rib.experience.v158', 'gold'))
  await p.reload({ waitUntil: 'networkidle' }); await booted(p)
  const bad = await M(p, () => ({ on: RIB_MONETIZE.enabled, pv: RIB_MONETIZE.preview, keys: Object.keys(localStorage).filter((k) => /^rib\.monetize/.test(k)) }))
  ok(!bad.on && bad.pv === null && !bad.keys.length, 'OFF: an unknown experience value is off', bad)
  await p.addInitScript(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { experienceV158B: 0 }) })
  await M(p, () => localStorage.setItem('rib.experience.v158', 'member'))
  await p.reload({ waitUntil: 'networkidle' }); await booted(p)
  const ks = await M(p, async () => { const r = { on: RIB_MONETIZE.enabled, pv: RIB_MONETIZE.preview }; window.go('settings'); await new Promise((x) => setTimeout(x, 600)); r.row = !!document.getElementById('experienceV158B'); return r })
  ok(!ks.on && ks.pv === null && !ks.row, 'kill switch: TU experienceV158B 0 ignores the flag and hides the row', ks)
  await M(p, () => localStorage.removeItem('rib.experience.v158'))
  await p.close()
}

// ============================== 2. F2P preview ==============================
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push('preview: ' + (e.message || e)))
await p.goto(U(), { waitUntil: 'networkidle', timeout: 60000 }); await booted(p)
await M(p, () => { window.go('settings') }); await p.waitForTimeout(700)
await shot(p, 'settings-toggle')
await p.click('#experienceV158B [data-exp158="f2p"]')
await confirmDlg(p)
{
  const s = await M(p, () => { const R = RIB_MONETIZE, c = document.getElementById('mz158Chip'), cr = c && c.getBoundingClientRect()
    return { on: R.enabled, pv: R.preview, prov: R.provider, member: R.has('member'), noAds: R.has('noAds'), s4: R.speedAllowed(4), ads: R.adsAllowed(), chip: c ? c.textContent : null, chipOn: !!cr && cr.width > 0 && cr.right <= innerWidth && cr.bottom <= innerHeight,
      keys: Object.keys(localStorage).filter((k) => /monetize|experience/.test(k)), chosen: (document.querySelector('#experienceV158B [aria-checked="true"]') || {}).dataset?.exp158 } })
  ok(s.on && s.pv === 'f2p' && s.prov === 'preview' && !s.member && !s.noAds && !s.s4 && s.ads, 'F2P: the store is ON as a device with nothing bought — no member, ads allowed, 4× locked, the preview provider', s)
  ok(s.chip === 'PREVIEW · F2P' && s.chipOn, 'F2P: the "PREVIEW · F2P" chip is on screen', s)
  ok(!s.keys.includes('rib.monetize.ents.v1') && s.keys.every((k) => PV.test(k) || k === 'rib.experience.v158'), 'F2P: only the sandbox keys (never the real entitlement store)', s.keys)
  await shot(p, 'chip-f2p')
  const tap = await M(p, async () => { document.getElementById('mz158Chip').click(); await new Promise((r) => setTimeout(r, 500)); return window.S.view })
  ok(tap === 'settings', 'F2P: the chip opens Settings', tap)

  await seed(p); await p.waitForTimeout(500)
  // (a) 4× for 20 min — the placeholder, mid-countdown, then Esc
  await M(p, () => { window.__r4 = null; RIB_MONETIZE.rewardSpeed().then((r) => { window.__r4 = r }) })
  ok(await waitAd(p), 'F2P: the 4× placement opens the ad placeholder')
  await p.waitForTimeout(1300)
  const a1 = await adState(p)
  ok(a1 && a1.card && /An ad will be placed here/.test(a1.text) && /15 s/.test(a1.text) && /reward: 4× for 20 min/.test(a1.text) && /\bAD\b/.test(a1.text), 'F2P: "An ad will be placed here · 15 s · (reward: 4× for 20 min)" in a big AD slot', a1 && a1.text.slice(0, 160))
  ok(a1 && a1.n >= 12 && a1.n <= 14 && a1.arc > 0, 'F2P: the countdown ring runs down from 15', a1)
  ok(a1 && a1.skip && a1.focus && a1.fit && a1.scroll, 'F2P: SKIP is live at once and focused; the placeholder fits 400x860', a1)
  await shot(p, 'ad-placeholder')
  await p.keyboard.press('Escape')
  ok(await gone(p), 'F2P: Esc skips the placeholder')
  await p.waitForTimeout(200)
  const g4 = await M(p, () => ({ r: window.__r4, s4: RIB_MONETIZE.speedAllowed(4), left: Math.round((RIB_MONETIZE.until('speed4') - RIB_MONETIZE.dev.now()) / 60000) }))
  ok(g4.r && g4.r.rewarded && g4.s4 && g4.left >= 19 && g4.left <= 20, 'F2P: skip counts as watched "for now" — 4× unlocked for 20 minutes', g4)

  // (b) v158 B: Quick Play is locked → the member-perk sheet → the placeholder → skip → 30 min of unlimited GAME sims
  const qp = await M(p, async () => { window.go('season'); const b = [...document.getElementById('dock').querySelectorAll('button')].find((x) => /Quick Play/.test(x.textContent))
    const tag = b ? b.textContent.replace(/\s+/g, ' ') : '', n0 = window.S.player.weekResults.filter((w) => w.played).length; window.__qpN0 = n0
    window.playWeek(false); await new Promise((r) => setTimeout(r, 400)); const s = document.getElementById('mz149Sheet')
    return { tag, n0, n1: window.S.player.weekResults.filter((w) => w.played).length, sheet: s ? s.textContent.replace(/\s+/g, ' ') : null } })
  ok(/🔒 AD/.test(qp.tag) && qp.n1 === qp.n0 && /QUICK PLAY IS A MEMBER PERK/.test(qp.sheet || '') && /watch an ad for 30 minutes of game sims/.test(qp.sheet || ''), 'F2P: Quick Play is locked ("🔒 AD"); a tap opens "Quick Play is a member perk — or watch an ad for 30 minutes of game sims"', qp)
  await p.click('#mz149Sheet [data-yes]')
  ok(await waitAd(p), 'F2P: the game-sims offer opens the placeholder')
  const a2 = await adState(p)
  ok(a2 && /unlimited game sims for 30 min/.test(a2.text), 'F2P: it names the game-sims reward', a2 && a2.text.slice(0, 140))
  await p.click('#mz149Ad [data-skip]'); await gone(p); await p.waitForTimeout(1800)
  const gs = await M(p, async () => { const R = RIB_MONETIZE, n1 = window.S.player.weekResults.filter((w) => w.played).length; window.playWeek(false); await new Promise((r) => setTimeout(r, 1500))
    const s = window.__V156B.skips(); window.go('season'); const b = [...document.getElementById('dock').querySelectorAll('button')].find((x) => /Quick Play/.test(x.textContent))
    return { n0: window.__qpN0, n1, n2: window.S.player.weekResults.filter((w) => w.played).length, left: Math.round((R.until('gameSims') - R.dev.now()) / 60000), unl: s.unlimited, tag: b ? b.textContent.replace(/\s+/g, ' ') : '' } })
  ok(gs.n1 === gs.n0 + 1 && gs.n2 === gs.n1 + 1 && gs.left >= 29 && gs.left <= 30 && /∞ (29|30) min/.test(gs.tag), 'F2P: skip grants 30 min of game sims — the tapped Quick Play goes on, the next one just plays, the button says "∞ 30 min"', gs)
  const ss = await M(p, async () => { const p = window.S.player, n0 = p.weekResults.filter((w) => w.played).length; p.simsUsedV156B = 99; window.go('season'); window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 400))
    const s = document.getElementById('mz149Sheet'), t = s ? s.textContent.replace(/\s+/g, ' ') : null; s?.remove(); return { unl: window.__V156B.skips().unlimited, n0, n1: p.weekResults.filter((w) => w.played).length, t } })
  ok(!ss.unl && ss.n1 === ss.n0 && /NO SEASON SIMS LEFT/.test(ss.t || ''), 'F2P: season sims stay counted with the boost — none left → the medals sheet, nothing simmed', ss)
  // (c) a cosmetic trial (a shop look) — through the placeholder
  const shopId = await M(p, () => { const C = window.RIB_COSMETICS; const it = C.catalog().find((i) => i.source === 'shop' && !C.owned(i.id)); window.__rt = null; if (it) RIB_MONETIZE.rewardTrial(it.id).then((r) => { window.__rt = r }); return it && it.id })
  ok(!!shopId && await waitAd(p), 'F2P: a cosmetic trial opens the placeholder', shopId)
  const a3 = await adState(p)
  ok(a3 && /try a cosmetic for 24 hours/.test(a3.text), 'F2P: it names the trial', a3 && a3.text.slice(0, 140))
  await p.click('#mz149Ad [data-skip]'); await gone(p); await p.waitForTimeout(200)
  const gt = await M(p, (id) => ({ r: window.__rt, acc: RIB_MONETIZE.cosmeticAccess(id) }), shopId)
  ok(gt.r && gt.r.rewarded && gt.acc === 'trial', 'F2P: skip grants the 24 h trial', gt)

  // (d) the countdown finishing grants too; TU adSkipAfterV158B holds SKIP back (TU adSecsV158B shortens it for the check)
  await M(p, () => { window.RIB_TUNE.adSecsV158B = 2; window.RIB_TUNE.adSkipAfterV158B = 5; window.__rp = null; RIB_MONETIZE.placeholderAd('speed4').then((r) => { window.__rp = r }) })
  await waitAd(p)
  const a4 = await adState(p)
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  const still = await M(p, () => !!document.getElementById('mz149Ad'))
  await gone(p)
  const done = await M(p, () => { delete window.RIB_TUNE.adSecsV158B; delete window.RIB_TUNE.adSkipAfterV158B; return window.__rp })
  ok(a4 && !a4.skip && /SKIP IN/.test(a4.text) && still, 'F2P: TU adSkipAfterV158B > 0 disables SKIP (and Esc) until it runs out', a4 && a4.text.slice(-120))
  ok(done && done.rewarded && !done.skipped, 'F2P: a countdown that runs out resolves as watched', done)

  // (e) member looks stay locked
  const ml = await M(p, () => { const C = window.RIB_COSMETICS, it = C.catalog().find((i) => i.source === 'member'); return { id: it.id, cat: it.cat, own: C.owned(it.id), eq: C.equip(it.cat, it.id), how: C.howTo(it) } })
  ok(ml.own === false && ml.eq === false && ml.how === 'Membership', 'F2P: a member look stays locked ("Membership")', ml)

  // (f) the break between seasons: once a season on the report card
  const br = await M(p, async (src) => { const S = window.S; await eval('(' + src + ')')()
    for (let i = 0; i < 20 && !document.getElementById('mz149Ad'); i++) await new Promise((r) => setTimeout(r, 150))
    const v = document.getElementById('mz149Ad'); return { view: S.view, ad: !!v, text: v ? v.textContent.replace(/\s+/g, ' ') : '' } }, toResultSrc)
  ok(br.view === 'result' && br.ad && /break between seasons/.test(br.text) && /An ad will be placed here/.test(br.text), 'F2P: the season report card shows the "break between seasons" placeholder', br)
  await p.click('#mz149Ad [data-skip]'); await gone(p)
  const br2 = await M(p, async () => { window.go('result'); await new Promise((r) => setTimeout(r, 900)); const a = !!document.getElementById('mz149Ad')
    const again = await RIB_MONETIZE.adBreak(); return { a, again: again.shown } })
  ok(!br2.a && !br2.again, 'F2P: at most once a season — a redraw of the same report card shows none', br2)
  const br3 = await M(p, async () => { window.RIB_TUNE.adBreakV158B = 0; window.S.player.totalSeasons = (window.S.player.totalSeasons || 0) + 1; window.go('result'); await new Promise((r) => setTimeout(r, 900))
    const off = !!document.getElementById('mz149Ad'); delete window.RIB_TUNE.adBreakV158B; window.go('result')
    for (let i = 0; i < 20 && !document.getElementById('mz149Ad'); i++) await new Promise((r) => setTimeout(r, 150)); return { off, next: !!document.getElementById('mz149Ad') } })
  ok(!br3.off && br3.next, 'F2P: TU adBreakV158B 0 shows no break; the next season shows it again', br3)
  await M(p, () => document.querySelector('#mz149Ad [data-skip]')?.click()); await gone(p)

  // (g) the store says it is a preview; the save and the real store hold nothing of it
  const st = await M(p, async () => { RIB_MONETIZE.openStore(); await new Promise((r) => setTimeout(r, 400)); const f = document.querySelector('#mz149Store [data-sec="preview"]'); const t = f ? f.innerText : ''; RIB_MONETIZE.closeStore()
    window.GridironStorage.save(window.S); const sv = localStorage.getItem('gridiron_save_v1') || ''
    return { t, inSave: /simUnlimited|gameSims|"speed4"|rib\.monetize|rib\.experience|"try:/.test(sv), real: localStorage.getItem('rib.monetize.ents.v1'), keys: Object.keys(localStorage).filter((k) => /^rib\.monetize\.preview\.v158\./.test(k) || /monetize/.test(k)) } })
  ok(/PREVIEW · FREE-TO-PLAY/.test(st.t) && /EXPERIENCE/.test(st.t), 'F2P: the store\'s foot says PREVIEW and links back to the toggle', st.t)
  ok(!st.inSave && st.real === null && st.keys.length >= 1 && st.keys.every((k) => PV.test(k)), 'F2P: the preview\'s entitlements are in the sandbox — never the save, never the real store', st)
}

// ============================== 3. MEMBER preview ==============================
{
  await M(p, () => { window.go('settings') }); await p.waitForTimeout(700)
  await p.click('#experienceV158B [data-exp158="member"]')
  await confirmDlg(p)
  const s = await M(p, () => { const R = RIB_MONETIZE, c = document.getElementById('mz158Chip')
    return { on: R.enabled, pv: R.preview, member: R.has('member'), noAds: R.has('noAds'), s4: R.speedAllowed(4), ads: R.adsAllowed(), chip: c ? c.textContent : null,
      f2pKeys: Object.keys(localStorage).filter((k) => /preview\.v158\.f2p/.test(k)), trial: R.until('speed4') } })
  ok(s.on && s.pv === 'member' && s.member && s.noAds && !s.ads && s.s4 && s.trial === Infinity, 'MEMBER: member held — no ads, 4× for good', s)
  ok(s.chip === 'PREVIEW · MEMBER' && !s.f2pKeys.length, 'MEMBER: the chip reads "PREVIEW · MEMBER"; the F2P sandbox was deleted on the switch', s)
  await shot(p, 'chip-member')
  await seed(p); await p.waitForTimeout(400)
  const na = await M(p, async () => { const r4 = await RIB_MONETIZE.rewardSpeed(); const brk = await RIB_MONETIZE.adBreak(true); await new Promise((r) => setTimeout(r, 300)); return { r4: r4.reason, brk: brk.shown, ad: !!document.getElementById('mz149Ad') } })
  ok(na.r4 === 'already-held' && !na.brk && !na.ad, 'MEMBER: no placeholder anywhere — 4× is already held, no break between seasons', na)
  const sim = await M(p, async () => { const p = window.S.player, R = RIB_MONETIZE; const n0 = p.weekResults.filter((w) => w.played).length; window.playWeek(false); await new Promise((r) => setTimeout(r, 1500))
    const q = p.weekResults.filter((w) => w.played).length, s = window.__V156B.skips(); p.simsUsedV156B = 1; window.go('season'); window.seasonSkipV151A(); await new Promise((r) => setTimeout(r, 2500))
    return { n0, q, n1: p.weekResults.filter((w) => w.played).length, used: p.simsUsedV156B, mult: s.mult, allowed: s.allowed, club: s.club, games: R.until('gameSims') === Infinity, sheet: !!document.getElementById('mz149Sheet') } })
  ok(sim.games && sim.q === sim.n0 + 1, 'MEMBER: Quick Play is free for good (unlimited game sims)', sim)
  ok(sim.mult === 2 && sim.allowed === 2 && !sim.club && sim.n1 > sim.q && sim.used === 2 && !sim.sheet, 'MEMBER: twice the season sims (a fresh account: 2) — counted, never unlimited', sim)
  const br = await M(p, async (src) => { const S = window.S; await eval('(' + src + ')')(); if (S.view !== 'result') return 'no result: ' + S.view; await new Promise((r) => setTimeout(r, 1200)); return !!document.getElementById('mz149Ad') }, toResultSrc)
  ok(br === false, 'MEMBER: the report card shows no break', br)
  const ml = await M(p, () => { const C = window.RIB_COSMETICS, it = C.catalog().find((i) => i.source === 'member' && i.cat === 'wings') || C.catalog().find((i) => i.source === 'member'); window.__ml = it.id
    return { id: it.id, cat: it.cat, own: C.owned(it.id), eq: C.equip(it.cat, it.id), now: C.equipped(it.cat), pass: window.RIB_SEASONS ? window.RIB_SEASONS.premiumOwned() : null } })
  ok(ml.own && ml.eq && ml.now === ml.id, 'MEMBER: a member look is owned and equipped', ml)
  ok(ml.pass !== false, 'MEMBER: the premium Career Pass track rides the membership', ml.pass)
  await M(p, async (cat) => { window.go('locker'); await new Promise((r) => setTimeout(r, 900)); const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click(); await new Promise((r) => setTimeout(r, 500)); window.cosCatV151B && window.cosCatV151B(cat); await new Promise((r) => setTimeout(r, 700)) }, ml.cat)
  await shot(p, 'locker-member')
  var memberLook = ml
}

// ============================== 4. back to OFF ==============================
{
  await M(p, () => { window.go('settings') }); await p.waitForTimeout(700)
  await p.click('#experienceV158B [data-exp158="off"]')
  await confirmDlg(p)
  const s = await M(p, (ml) => { const R = RIB_MONETIZE, C = window.RIB_COSMETICS
    return { on: R.enabled, pv: R.preview, member: R.has('member'), keys: Object.keys(localStorage).filter((k) => /monetize|experience/.test(k)), chip: !!document.getElementById('mz158Chip'),
      nodes: document.querySelectorAll('[id^="mz149"],[class*="mz149"],[class*="mz151"],[class*="mz158"]').length, own: C.owned(ml.id), eq: C.equipped(ml.cat), def: C.equip(ml.cat, ml.id) } }, memberLook)
  ok(!s.on && s.pv === null && !s.member && !s.keys.length && !s.chip && !s.nodes, 'OFF again: the store is off, every preview key deleted, no chip, no store node', s)
  ok(!s.own && s.eq !== memberLook.id && !s.def, 'OFF again: the member look is not owned — the slot falls back to its default', s)
}
await ctx.close()
ok(!errors.length, 'no page errors', errors.slice(0, 5))
await browser.close()
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
