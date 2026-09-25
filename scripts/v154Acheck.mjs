// Dev check: v154 A — THE UFF IS WHERE THE CAREER GOES ON.
//
// Reaching the UFF settled the career, and "Keep Playing UFF Seasons" left it settled: retire did
// nothing, the retire buttons never drew, a cut-out never ended it. Now keep playing reopens it, the
// real end settles the tail once, cuts count over the career (1 by default, 2 with FREE AGENCY at
// 200K PP), and the career-end screen offers every vow, a skip, the vault and the Hall.
//
// Asserts:
//   - the arrival settles; KEEP PLAYING reopens (`_settled` false, `_arrivedV154` kept)
//   - the Life (management) screen draws RETIRE FROM FOOTBALL, the hub dock draws LIFE & RETIRE
//   - retiring through the Life screen's button (and its confirm) lands on the retired career-end
//     screen, settles once: no second career counted, no second Hall row, only tail PP paid
//   - that end screen has the vault, RUN IT BACK, a skip and the Hall
//   - a reopened career cut by the UFF (default: one cut) ends on the cut screen with all four vows,
//     a skip and the Hall — not two buttons
//   - Free Agency: 200K, one level, two cuts; old Second Chances levels refunded down to one
//   - a save stuck settled after "keep playing" is reopened at boot
//   - no page errors
//   node scripts/v154Acheck.mjs   (GAME_URL=http://localhost:5302/ to point it elsewhere)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'

const url = GAME_URL
const b = await chromium.launch({ executablePath: CHROME })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []

async function boot(init) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 } })
  const page = await ctx.newPage()
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  await page.addInitScript(() => {
    try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
  })
  if (init) await page.addInitScript(init)
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForTimeout(2500)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  return { ctx, page }
}

// a College senior advanced into the UFF, signed, then the arrival screen
const arrive = (page, tree) => page.evaluate((tree) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState()
  S.tree = Object.assign({}, tree || {})
  S.player = A.newPlayer(); const p = S.player
  p.pos = 'RB'; p.level = 6; p.age = 22; p.totalSeasons = 12; p.career = []
  p._wonShown = true
  S.view = 'hub'
  A.advance()
  window.__V146B.sign(0)
  p._wonShown = false
  window.go('win')
  return { level: p.level, view: S.view }
}, tree)

const snap = (page) => page.evaluate(() => {
  const S = window.S, p = S.player
  return {
    view: S.view, settled: !!(p && p._settled), arrived: !!(p && p._arrivedV154),
    careers: S.careersCompleted | 0, pp: S.pp | 0, hof: (S.hof || []).length,
    dock: [...document.querySelectorAll('#dock button')].map(x => x.innerText.replace(/\s+/g, ' ').trim()),
    screen: (document.getElementById('screen') || {}).textContent || ''
  }
})

// ------------------------------------------------------------------ arrive, keep playing, retire from the Life screen
{
  const { ctx, page } = await boot()
  await arrive(page, {})
  await page.waitForTimeout(600)
  const w = await snap(page)
  ok(w.view === 'win' && w.settled && w.careers >= 1 && w.hof >= 1, 'the arrival settles the career once', { view: w.view, careers: w.careers, hof: w.hof })
  await page.evaluate(() => window.continueNFL()); await page.waitForTimeout(700)
  const k = await snap(page)
  ok(k.view === 'hub' && !k.settled && k.arrived, 'KEEP PLAYING reopens it (not settled, the arrival remembered)', { view: k.view, settled: k.settled })
  ok(k.dock.some(t => /Life & Retire/i.test(t)), 'the hub dock offers LIFE & RETIRE', k.dock)
  // play on: a season after the arrival
  await page.evaluate(() => { const p = window.S.player; p.totalSeasons += 2; p.age += 2 })
  await page.evaluate(() => window.showLifeV12()); await page.waitForTimeout(700)
  const l = await snap(page)
  const retireBtns = await page.evaluate(() => [...document.querySelectorAll('button')].filter(x => /Retire From Football/i.test(x.innerText)).length)
  ok(l.view === 'life' && retireBtns >= 1, 'the Life (management) screen draws RETIRE FROM FOOTBALL', { view: l.view, n: retireBtns })
  await page.evaluate(() => document.querySelectorAll('.lgm-v152, #personaV13').forEach(x => x.remove()))   // a rank-up modal and a new player's persona card, not this screen's
  await page.click('.retire-chip-v147'); await page.waitForTimeout(600)
  const dlg = await page.evaluate(() => { const d = document.querySelector('.rib-dlg-v149'); return d ? d.innerText.replace(/\s+/g, ' ') : '' })
  ok(/Retire from football now/i.test(dlg), 'the button asks first (ribDialog)', dlg.slice(0, 80))
  await page.click('.rib-dlg-v149 .btns-v149 button.danger-v149, .rib-dlg-v149 .btns-v149 button.primary-v149')
  await page.waitForTimeout(1200)
  const r = await snap(page)
  const p = await page.evaluate(() => { const p = window.S.player; return p && { vol: !!p.voluntaryRetirementV12, gain: p._ppGain | 0 } })
  ok(r.view === 'gameover' && r.settled && p && p.vol, 'retiring there lands on the retired career-end screen', { view: r.view, settled: r.settled, p })
  ok(r.careers === k.careers && r.hof === k.hof, 'settled once: no second career, no second Hall row', { careers: [k.careers, r.careers], hof: [k.hof, r.hof] })
  ok(p && p.gain > 0 && p.gain < 200, 'the end pays only the seasons after the arrival', p)
  ok(r.dock.some(t => /Run It Back Now/i.test(t)) && r.dock.some(t => /Hall of Fame/i.test(t)) && r.dock.some(t => /RUN IT BACK|Prestige|vault|Vault/i.test(t)), 'the retired end offers the vault, RUN IT BACK, a skip and the Hall', r.dock)
  await ctx.close()
}

// ------------------------------------------------------------------ a reopened career's one cut ends it, with every option
{
  const { ctx, page } = await boot()
  await arrive(page, {})
  await page.waitForTimeout(400)
  await page.evaluate(() => window.continueNFL()); await page.waitForTimeout(500)
  const before = await snap(page)
  const c = await page.evaluate(() => { const p = window.S.player; p.nflStateV11.security = 0; const r = window.__V146B.evaluate(5); return { cut: r && r.cutV146B, out: !!p.cutOutV146B, allowed: window.__V154A.cutsAllowed() } })
  ok(c.allowed === 1 && c.cut && c.cut.end && c.out, 'by default the first UFF cut ends the career', c)
  await page.evaluate(() => window.go('season')); await page.waitForTimeout(900)
  const e = await snap(page)
  const vows = await page.evaluate(() => document.querySelectorAll('.end-vow-v154').length)
  ok(e.view === 'gameover' && e.settled, 'and it reaches the career-end screen (a reopened career can end)', { view: e.view })
  ok(vows === 4 && e.dock.some(t => /Run It Back Now/i.test(t)) && e.dock.some(t => /Hall of Fame/i.test(t)), 'the end screen offers all four vows, a skip and the Hall — not two', { vows, dock: e.dock })
  ok(/Final Whistle/i.test(e.screen), 'the banner says the UFF career ended, not "cut before the UFF"', e.screen.replace(/\s+/g, ' ').slice(0, 90))
  ok(e.careers === before.careers && e.hof === before.hof, 'no second career counted, no second Hall row', { careers: [before.careers, e.careers], hof: [before.hof, e.hof] })
  await ctx.close()
}

// ------------------------------------------------------------------ Free Agency: two cuts
{
  const { ctx, page } = await boot()
  await arrive(page, { secondChance: 1 })
  await page.evaluate(() => window.continueNFL()); await page.waitForTimeout(400)
  const r = await page.evaluate(() => {
    const p = window.S.player, n = window.__GRIDIRON_AUDIT__.TREE_NODES.secondChance
    const cut = () => { p.nflStateV11.security = 0; const r = window.__V146B.evaluate(5); const c = r && r.cutV146B; if (p.offersV146B) window.__V146B.sign(0); return c }
    const c1 = cut(); p.totalSeasons += 1           // the count carries across seasons
    const c2 = cut()
    return { node: { name: n.name, cost: n.cost, max: n.max }, allowed: window.__V154A.cutsAllowed(), c1, c2, out: !!p.cutOutV146B }
  })
  ok(r.node.name === 'Free Agency' && r.node.cost === 200000 && r.node.max === 1, 'the node is FREE AGENCY: 200K PP, one level', r.node)
  ok(r.allowed === 2 && r.c1 && !r.c1.end, 'with it the first cut sends him to free agency', r.c1)
  ok(r.c2 && r.c2.end && r.out, 'and the second — a season later — ends the career', r.c2)
  await ctx.close()
}

// ------------------------------------------------------------------ old saves: refund, and the stuck settled career
{
  const { ctx, page } = await boot(() => {
    try {
      const k = Object.keys(localStorage).find(x => /gridiron/i.test(x) && /save|state/i.test(x))
      if (k) localStorage.removeItem(k)
    } catch {}
  })
  const r = await page.evaluate(() => {
    const S = window.S
    S.tree = { secondChance: 3 }; delete S.freeAgencyRefundV154
    const pp0 = S.pp | 0, t = window.__V154A.refund()
    return { t, lv: S.tree.secondChance, pp: (S.pp | 0) - pp0, again: window.__V154A.refund() }
  })
  ok(r.lv === 1 && r.t > 0 && r.pp === r.t && r.again === 0, 'old Second Chances levels beyond the first are refunded, once', r)
  await arrive(page, {})
  await page.waitForTimeout(300)
  const s = await page.evaluate(() => {
    const p = window.S.player
    window.S.view = 'hub'; delete p._arrivedV154; p._settled = true; p._wonShown = true         // an old save: kept playing, stuck settled
    window.__V154A.boot()
    return { settled: !!p._settled, arrived: !!p._arrivedV154 }
  })
  ok(!s.settled && s.arrived, 'a save stuck settled after keep playing is reopened at boot', s)
  await ctx.close()
}

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await b.close()
process.exit(fail || errs.length ? 1 : 0)
