// Dev check: v195 C THE BLOODLINE GROWS (src/07-career-app.js).
//   1. Every career end adds at least 1 to the account's bloodline (state.bloodlineV195C), once: a real
//      screenGameOver settle at Varsity with an empty tree adds exactly 1, the potential rises by it, a second render
//      adds nothing; the potential card names "careers' bloodline".
//   2. The 🧬 Bloodline branch: four nodes in TREE_NODES (Family Tree, Proven Stock, Pure Blood, Compound Genes),
//      bought through window.buy; the gain is 1 + Family + Proven × rungs, × Pure, + Compound % of the carried.
//   3. The UFF pays ×10: the arrival (screenWin) pays 10× what v195Cuff 0 pays; the estimator and the season
//      salary agree; the receipt has a "× the UFF" row.
//   4. Staying is hard: the UFF wear (6% + 4% a season after the first, eased over the bar, capped at 45%) raises the
//      season-end cut roll at level 7 only; the measured run of UFF seasons is shorter ON than OFF.
//   5. The card animates on the career-end screen (rows land, the total stamps, the bar fills) once the Vault is
//      closed. Kill switch v195C 0. No page errors.   GAME_URL=http://localhost:5173/ node scripts/v195Ccheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { careerVaultDelayMsV192B: 60000 })
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
})
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e.message || e)))
await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V195C && !!window.__V179, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove())
const M = (fn, arg) => page.evaluate(fn, arg)
const fresh = `(() => { const AU = window.__GRIDIRON_AUDIT__, S = AU.freshState(); S.tutorialSeen = true; S.tree = {}; S.pp = 0; AU.setState(S); S.player = AU.newPlayer(); const p = S.player; p.pos = 'QB'; p._wonShown = true; p.traits = []; return S })()`

// ---------------- 1. one bloodline, every career, once ----------------
const A1 = await M((fresh) => {
  const S = eval(fresh), p = S.player; p.level = 4; p.totalSeasons = 8
  const pot0 = window.__V179.potential()
  window.go('gameover')
  const after1 = S.bloodlineV195C, pot1 = window.__V179.potential(), card = !!document.getElementById('bloodV195C')
  window.go('gameover')
  const after2 = S.bloodlineV195C
  const parts = window.__V179.parts()
  window.RIB_TUNE.v195C = 0; const potOff = window.__V179.potential(); delete window.RIB_TUNE.v195C
  return { pot0, pot1, potOff, after1, after2, card, blood: parts.blood, rows: (p._bloodV195C || {}).rows }
}, fresh)
console.log('1:', JSON.stringify(A1))
ok(A1.after1 === 1 && A1.after2 === 1, 'a Varsity cut with an empty tree adds exactly 1 bloodline, once', A1)
ok(Math.abs(A1.pot1 - A1.potOff - 1) < 1e-9 && A1.pot1 > A1.pot0 && A1.blood === 1, 'the potential rises by it, and the potential card carries it', { pot0: A1.pot0, pot1: A1.pot1, potOff: A1.potOff, blood: A1.blood })
ok(A1.card, 'the career-end screen shows THE BLOODLINE GROWS card')

// ---------------- 2. the branch ----------------
const A2 = await M((fresh) => {
  const S = eval(fresh), N = window.__GRIDIRON_AUDIT__.TREE_NODES || null
  const keys = ['bloodFamily', 'bloodProven', 'bloodPure', 'bloodCompound']
  S.pp = 1e9
  const before = keys.map(k => (S.tree[k] | 0))
  window.buy('bloodFamily'); window.buy('bloodPure')
  const bought = { fam: S.tree.bloodFamily | 0, pureLocked: S.tree.bloodPure | 0 }
  S.tree = { bloodFamily: 3, bloodProven: 2, bloodPure: 2, bloodCompound: 1 }; S.bloodlineV195C = 50
  const P = window.__V195C.parts(7)
  const tab = (() => { window.go('shop'); return !!document.querySelector("[onclick=\"setBranch('bloodline')\"]") })()
  return { before, bought, total: P.total, rows: P.rows.map(r => r.op + r.v), tab }
}, fresh)
console.log('2:', JSON.stringify(A2))
ok(A2.bought.fam === 1 && A2.bought.pureLocked === 0, 'Family Tree buys through window.buy; Pure Blood waits on Family Tree Lv 3', A2.bought)
ok(Math.abs(A2.total - 11) < 1e-9, 'the gain at the UFF: (1 + 3 + 0.5·2·3) × 1.5 + 1% of 50 = 11', A2)
ok(A2.tab, 'the prestige tree has the 🧬 Bloodline tab')

// ---------------- 3. the UFF pays ×10 ----------------
// each side on its own fresh browser context: a settle moves account-wide numbers (medals, wings) the next one reads
const winRun = async (on) => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await c.addInitScript((on) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { careerVaultDelayMsV192B: 60000, v195Cuff: on }); try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} }, on ? 1 : 0)
  const pg = await c.newPage(); pg.on('pageerror', (e) => errors.push(String(e.message || e)))
  await pg.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await pg.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V195C, null, { timeout: 40000 })
  const r = await pg.evaluate((fresh) => {
    const S = eval(fresh), p = S.player; p.level = 7; p.totalSeasons = 18; p.titles = 2; S.pp = 0
    const est = window.__V193E.payAt(7)
    window.go('win')
    const rows = [...document.querySelectorAll('#screen *')].map(x => x.textContent).filter(t => /× the UFF/.test(t)).length
    return { paid: p._ppGain, est, rows }
  }, fresh)
  await c.close()
  return r
}
const A3 = { on: await winRun(true), off: await winRun(false), sal: await M(() => window.__V195C.uffMult(7)), salCol: await M(() => window.__V195C.uffMult(5)) }
console.log('3:', JSON.stringify(A3))
ok(A3.off.paid > 0 && Math.abs(A3.on.paid / A3.off.paid - 10) < 0.1, 'the UFF arrival pays 10× (v195Cuff 0 vs 1)', { on: A3.on.paid, off: A3.off.paid })
ok(Math.abs(A3.on.est / A3.off.est - 10) < 0.1, 'the estimator agrees', { on: A3.on.est, off: A3.off.est })
ok(A3.on.rows > 0 && A3.off.rows === 0, 'the receipt names "× the UFF"', { on: A3.on.rows, off: A3.off.rows })
ok(A3.sal === 10 && A3.salCol === 1, 'the multiplier is ×10 at the UFF and ×1 below it', A3)

// ---------------- 4. staying is hard ----------------
const A4 = await M((fresh) => {
  const S = eval(fresh), p = S.player, V = window.__V195C
  p.level = 7; p.nflSeasons = 1; const w1 = V.wear(p, 58, 58)
  p.nflSeasons = 6; const w6 = V.wear(p, 58, 58), w6star = V.wear(p, 108, 58)
  p.nflSeasons = 40; const wCap = V.wear(p, 58, 58)
  const comb = V.cut(p, 0.2, 58, 58)
  p.level = 8; const ist = V.wear(p, 58, 58)
  p.level = 6; const comb6 = V.wear(p, 58, 58)
  return { w1, w6, w6star, wCap, comb, ist, comb6 }
}, fresh)
console.log('4:', JSON.stringify(A4))
ok(Math.abs(A4.w1 - 0.06) < 1e-9 && Math.abs(A4.w6 - 0.26) < 1e-9 && Math.abs(A4.wCap - 0.45) < 1e-9, 'the wear: 6% the first UFF season, +4% a season after, capped at 45%', A4)
ok(Math.abs(A4.w6star - 0.26 * 0.4) < 1e-9, 'a man far over the bar feels 40% of it', A4.w6star)
ok(Math.abs(A4.comb - (1 - 0.8 * 0.55)) < 1e-9, 'it combines with the roll: 1 − (1 − roll)(1 − wear)', A4.comb)
ok(A4.ist === 0 && A4.comb6 === 0, 'only the UFF (not the Interstellar League, not below)', A4)
// a measured run: real simSeason at the UFF, a solid starter's season, until the cut
const A4b = await M(async (fresh) => {
  const AU = window.__GRIDIRON_AUDIT__
  const tenure = (on, runs) => {
    window.RIB_TUNE.v195Ccut = on ? 1 : 0
    const out = []
    for (let r = 0; r < runs; r++) {
      const S = eval(fresh), p = S.player; p.level = 7; p.age = 24; p.nflSeasons = 0; p.coachTrust = 55
      for (const k in p.attrs) p.attrs[k] = 80
      try { window.__V146B && window.__V146B.sign && window.__V146B.sign(0) } catch {}
      let n = 0
      for (; n < 25; n++) {
        try { AU.startSeasonGames(); p.weekResults.forEach(w => { w.played = true; w.perf = 66; w.us = 24; w.them = 20; w.won = true }); const t = AU.simSeason(p); if (t && (t.nflCut || t.cutV146B)) break } catch (e) { return { err: String(e) } }
        p.coachTrust = 55
      }
      out.push(n + 1)
    }
    delete window.RIB_TUNE.v195Ccut
    out.sort((a, b) => a - b)
    return { median: out[out.length >> 1], mean: out.reduce((a, b) => a + b, 0) / out.length }
  }
  return { on: tenure(1, 40), off: tenure(0, 40) }
}, fresh)
console.log('4b:', JSON.stringify(A4b))
ok(!A4b.on.err && A4b.on.mean < A4b.off.mean, 'measured: a solid starter\'s UFF run is shorter with the wear', A4b)

// ---------------- 5. the animation ----------------
await M((fresh) => { const S = eval(fresh), p = S.player; p.level = 5; p.totalSeasons = 10; S.tree = { bloodFamily: 2, bloodPure: 1 }; window.go('gameover') }, fresh)
await page.waitForFunction(() => !!document.querySelector('.hubv75-tab[data-sec="blood"]'), null, { timeout: 15000 }).catch(() => null)
const pulse = await page.waitForFunction(() => { const t = document.querySelector('.hubv75-tab[data-sec="blood"]'); return !!t && t.classList.contains('bl-tab-v195c') }, null, { timeout: 4000 }).then(() => true).catch(() => false)
await page.waitForTimeout(400)
const anim00 = await M(() => document.querySelectorAll('#bloodV195C .bl-row.on').length)
await M(() => { document.querySelectorAll('.onboard').forEach(x => x.remove()); document.querySelector('.hubv75-tab[data-sec="blood"]').click() })
ok(pulse && anim00 === 0, 'the paged end screen: the count-up waits on its own BLOODLINE tab (which pulses) until it is opened', { pulse, anim00 })
const anim0 = await M(() => ({ rows: document.querySelectorAll('#bloodV195C .bl-row.on').length, n: (document.querySelector('#bloodV195C .bl-n') || {}).textContent }))
await page.waitForFunction(() => { const S = window.__GRIDIRON_AUDIT__.getState(); return S.player && S.player._bloodV195C && S.player._bloodV195C.shown === 1 }, null, { timeout: 15000 }).catch(() => null)
const anim1 = await M(() => { const S = window.__GRIDIRON_AUDIT__.getState(); return { rows: document.querySelectorAll('#bloodV195C .bl-row.on').length, all: document.querySelectorAll('#bloodV195C .bl-row').length, n: (document.querySelector('#bloodV195C .bl-n') || {}).textContent, end: !!document.querySelector('#bloodV195C .bl-end.on'), gain: S.player._bloodV195C.gain } })
console.log('5:', JSON.stringify({ anim0, anim1 }))
ok(anim0.rows < 3, 'the rows start hidden and land one by one', anim0)
ok(anim1.rows === anim1.all && anim1.all === 3 && anim1.end && anim1.n === '+' + anim1.gain, 'the count-up lands on the gain ((1 + 2) × 1.25 = 3.8), the before → after and the bar show', anim1)
await page.screenshot({ path: process.env.SHOT || '/tmp/v195C-card.png', fullPage: false }).catch(() => null)

// ---------------- kill switch ----------------
const K = await M((fresh) => {
  const S = eval(fresh); S.bloodlineV195C = 40; const p = S.player; p.level = 7
  const on = window.__V179.potential()
  window.RIB_TUNE.v195C = 0
  const off = window.__V179.potential(), mult = window.__V195C.uffMult(7), wear = window.__V195C.wear(p, 58, 58), gain = window.__V195C.award(p, 3)
  delete window.RIB_TUNE.v195C
  return { on, off, mult, wear, gain }
}, fresh)
ok(K.on - K.off === 40 && K.mult === 1 && K.wear === 0 && K.gain === 0, 'v195C 0: no stored bloodline, ×1, no wear, no award', K)

ok(errors.length === 0, 'no page errors', errors.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
