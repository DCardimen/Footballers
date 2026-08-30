// Dev check: v68 TRAINING PAYOFF — does the offseason program actually decide
// anything, and can the player see that it did?
//
// Two claims:
//   1. THE PAYOFF   a point spent on a stat the season's program trains buys `mult`
//                   of it instead of one, at the same cost, and undoing gives back
//                   exactly what it took
//   2. THE PRICE    the twelve programs carry twelve different injury multipliers.
//                   They used to carry ONE: the training program's `injury` is a
//                   relative multiplier (~1.0) but it was being fed to a function
//                   that rebases an absolute per-game probability (~.06), so every
//                   program divided to 6.7-29 and clamped flat to the maximum. The
//                   SAFE/HIGH RISK labels on the board meant nothing.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => {
  setInterval(() => {
    try { const s = window.__getGridironState && window.__getGridironState(); if (s) s.tutorialSeen = true } catch {}
    document.querySelector('.onboard')?.remove()
  }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1300)

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const el = t === 'ARCH'
      ? els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑|🌱|🐺)/.test((e.innerText || '').trim()))
      : els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(600); return r
}

// ---------- 1. the table ----------
const tbl = await page.evaluate(() => {
  const V = window.__TRAIN_V68
  if (!V) return { err: 'no __TRAIN_V68' }
  const progs = ['balanced', 'speed', 'weight', 'film', 'skills', 'hops',
                 'conditioning', 'grind', 'yoga', 'contact', 'track', 'lab']
  const out = {}
  for (const k of progs) {
    const pl = { training: k, attrs: {} }
    const plan = V.plan(pl)
    const focus = plan.focus || []
    out[k] = {
      n: focus.length,
      mult: plan.mult || 1,
      inj: +window.__trainInjMultV68(plan).toFixed(3),
      onFocus: focus.map(s => V.mult(pl, s)),
      offFocus: ['grit', 'blocking', 'catching'].filter(s => focus.indexOf(s) < 0).map(s => V.mult(pl, s)),
    }
  }
  return out
})
console.log('programs:', JSON.stringify(tbl))
ok(!tbl.err, 'the training payoff table is on the page')
const rows = Object.entries(tbl).filter(([, v]) => v && v.n !== undefined)
ok(rows.length === 12, 'all twelve programs resolve', rows.length)
ok(rows.every(([, v]) => v.onFocus.every(m => m === v.mult)),
  'every stat a program names pays its own multiplier')
ok(rows.every(([, v]) => v.offFocus.every(m => m === 1)),
  'and every stat it does not name pays 1 — the bonus is targeted, not a blanket buff')
ok(rows.filter(([, v]) => v.n === 0).every(([, v]) => v.mult === 1),
  'the two programs that name no stats have nothing to multiply',
  rows.filter(([, v]) => v.n === 0).length + ' unfocused')
const x3 = rows.filter(([, v]) => v.mult === 3)
ok(x3.length >= 2 && x3.length <= 4, 'a few programs pay ×3, not most of them', x3.map(r => r[0]).join(', '))
ok(x3.every(([, v]) => v.inj >= 1.1),
  '×3 is only ever paid by a program that carries real injury risk',
  x3.map(([k, v]) => k + ' ' + v.inj).join(', '))

// ---------- 2. the price ----------
const injs = rows.map(([, v]) => v.inj)
const distinct = new Set(injs).size
ok(distinct >= 10, 'the twelve programs carry distinct injury risk, not one flattened value',
  distinct + ' distinct, ' + Math.min(...injs) + '–' + Math.max(...injs))
ok(Math.max(...injs) / Math.min(...injs) >= 3,
  'and the safest program is dramatically safer than the most violent one',
  '×' + (Math.max(...injs) / Math.min(...injs)).toFixed(2) + ' spread')
// the exact regression: the old path rebased a relative multiplier as an absolute risk
const oldWay = await page.evaluate(() =>
  ['yoga', 'balanced', 'contact'].map(k => +window.__injPlanMultV54(window.__TRAIN_V68.plan({ training: k })).toFixed(3)))
ok(new Set(oldWay).size === 1,
  'confirms the bug this replaces: the old path really did flatten them all',
  'injPlanMultV54 gives ' + oldWay.join(' / ') + ' for yoga / balanced / contact')

// ---------- 3. the payoff, on the real screen ----------
for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(s)
await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g) g.click(); document.getElementById('growthV42')?.remove() })
await page.waitForTimeout(300)
const boardMults = await page.evaluate(() =>
  [...document.querySelectorAll('.train-card')].map(c => (/×(\d) POINTS/.exec(c.innerText) || [0, '-'])[1]))
ok(boardMults.filter(m => m === '2').length + boardMults.filter(m => m === '3').length === 10,
  'the board states the multiplier on all ten focused programs', boardMults.join(','))

await click('Track Club')                     // a ×3 program: speed / acceleration / quickness
// drive by what is on screen rather than a fixed sequence: a midseason roll can open
// on any week, and the season screen changes its buttons as the weeks are played
let lastSeen = null
for (let i = 0; i < 30; i++) {
  const st = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc)
    const s = window.__getGridironState && window.__getGridironState()
    return { view: s && s.view, btns: [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      .map(e => (e.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean) }
  }, { visSrc: vis })
  if (st.view === 'upgrade') break
  const next = st.btns.find(t => /SIM REMAINING/i.test(t)) || st.btns.find(t => /FINISH SEASON/i.test(t))
    || st.btns.find(t => /SPEND \d+ UPGRADE/i.test(t)) || st.btns.find(t => /^CONTINUE$/i.test(t))
  lastSeen = st
  if (next) await click(next)
  else {
    // a midseason roll, or a screen whose button we do not know: clear any overlay
    // and take the most advancing thing on offer
    await page.evaluate(() => { for (const id of ['growthV42', 'gv62roll']) document.getElementById(id)?.remove() })
    const any = st.btns.find(t => /CONTINUE|NEXT|CLAIM|DONE|PROCEED|ADVANCE|SPEND/i.test(t))
    if (any) await click(any); else await page.waitForTimeout(400)
  }
}
await page.evaluate(() => { for (const id of ['growthV42', 'gv62roll']) document.getElementById(id)?.remove() })
const reached = !!(await page.$('#ptsLeft'))
ok(reached, 'a season reaches the allocation screen',
  reached ? '' : 'stuck at view=' + (lastSeen && lastSeen.view) + ' with ' + JSON.stringify((lastSeen && lastSeen.btns || []).slice(0, 8)))

if (reached) {
  const ui = await page.evaluate(() => ({
    badged: [...document.querySelectorAll('.up-attr.trained-v68 .train-tag-v68')].map(e => e.textContent),
    plus: (document.querySelector('.up-attr.trained-v68 .step:last-of-type') || {}).textContent,
    banner: [...document.querySelectorAll('.threshold-note')].map(e => e.innerText).find(t => /buys/.test(t)) || '',
  }))
  console.log('screen:', JSON.stringify(ui))
  ok(ui.badged.length === 3 && ui.badged.every(t => t === '×3 TRAINED'),
    'the trained stats are marked on the row', ui.badged.join(', '))
  ok(/^\+3/.test(ui.plus || ''), 'and the + button shows what the point buys, not just a plus', ui.plus)
  ok(/buys/.test(ui.banner), 'the screen says in words what the program is doing', ui.banner.slice(0, 80))

  const G = () => page.evaluate(() => {
    const s = window.__getGridironState()
    return { spd: s.player.attrs.speed, grit: s.player.attrs.grit, pts: s.player.points }
  })
  const a = await G()
  await page.evaluate(() => window.alloc('speed', 1));  const b = await G()
  await page.evaluate(() => window.alloc('grit', 1));   const c = await G()
  await page.evaluate(() => window.alloc('speed', -1)); const d = await G()
  await page.evaluate(() => window.alloc('grit', -1));  const e = await G()
  console.log('spend:', JSON.stringify({ a, b, c, d, e }))
  ok(b.spd - a.spd === 3 && a.pts - b.pts === 1,
    'one point on a ×3 trained stat buys three of it', `+${b.spd - a.spd} for ${a.pts - b.pts} pt`)
  ok(c.grit - b.grit === 1 && b.pts - c.pts === 1,
    'and one point on an untrained stat still buys exactly one', `+${c.grit - b.grit} for ${b.pts - c.pts} pt`)
  ok(d.spd === a.spd && e.grit === a.grit && e.pts === a.pts,
    'undoing gives back exactly what each click took — the ×3 too',
    `speed ${d.spd}==${a.spd}, grit ${e.grit}==${a.grit}, pts ${e.pts}==${a.pts}`)

  // AUTO must spend the program, not spend it away. It used to buy strictly
  // cheapest-first, which was right when every stat returned 1 per point; a trained
  // stat and an untrained one cost the same and are 2-3x apart in value.
  const auto = await page.evaluate(() => {
    const s = window.__getGridironState(), P = s.player
    const keep = JSON.parse(JSON.stringify(P.attrs)), keepPts = P.points
    // Key Stats spends the POSITION's pool, so the rule only shows when the program
    // trains something that pool contains. Track Club trains sprinting on a QB, which
    // it correctly ignores — so pick a program that overlaps before testing the rule.
    const keyPool = Object.keys(window.__TRAIN_V68.keyPool(P))
    const wanted = ['skills', 'film', 'weight', 'speed', 'track', 'hops', 'yoga', 'contact']
      .find(k => (window.__TRAIN_V68.plan({ training: k }).focus || []).some(st => keyPool.indexOf(st) >= 0))
    if (wanted) P.training = wanted
    const focus = window.__TRAIN_V68.plan(P).focus || []
    const run = fn => {
      P.attrs = JSON.parse(JSON.stringify(keep)); P.points = 24
      const before = JSON.parse(JSON.stringify(P.attrs))
      fn()
      const g = k => (P.attrs[k] || 0) - (before[k] || 0)
      return { onFocus: focus.reduce((a, k) => a + g(k), 0),
               total: Object.keys(before).reduce((a, k) => a + g(k), 0),
               touched: Object.keys(before).filter(k => g(k) > 0).length }
    }
    const key = run(() => window.autoAllocKey())
    const spread = run(() => window.autoAllocSpread())
    P.attrs = keep; P.points = keepPts
    return { key, spread, focus: focus.length, program: P.training,
             overlap: focus.filter(st => keyPool.indexOf(st) >= 0) }
  })
  console.log('auto:', JSON.stringify(auto))
  ok(auto.key.total > 0 && auto.key.onFocus / auto.key.total >= auto.overlap.length / auto.key.touched,
    'AUTO: Key Stats spends into the program the player chose, not strictly cheapest-first',
    `${auto.program}: ${auto.key.onFocus} of ${auto.key.total} stat points on ${auto.overlap.length} of ${auto.key.touched} stats in the pool`)
  ok(auto.spread.touched >= 12,
    'AUTO: Balanced still spreads across the board rather than piling into the ×3',
    `touched ${auto.spread.touched} of 17`)
  ok(auto.spread.onFocus > 0 && auto.spread.total > auto.spread.touched,
    'and the multiplier still pays when the spread lands on a trained stat',
    `${auto.spread.total} stat points across ${auto.spread.touched} attributes`)

  // the multiplier must never carry a stat past the absolute cap, which is dynamic
  const capped = await page.evaluate(() => {
    const s = window.__getGridironState(), keep = s.player.attrs.speed, keepPts = s.player.points
    const cap = window.__TRAIN_V68.cap()
    s.player.attrs.speed = cap - 1; s.player.points = 40
    window.alloc('speed', 1)
    const at = s.player.attrs.speed
    window.alloc('speed', -1)
    const back = s.player.attrs.speed
    s.player.attrs.speed = keep; s.player.points = keepPts
    return { cap, at, back }
  })
  ok(capped.at === capped.cap,
    'a ×3 click one below the cap clips to the cap instead of overshooting it',
    `cap ${capped.cap}, landed ${capped.at}`)
  ok(capped.back === capped.cap - 1,
    'and undoing a clipped click gives back only what it actually granted',
    `${capped.back} == ${capped.cap - 1}`)
}

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'NONE')
console.log('VERDICT: ' + (fail === 0 && errs.length === 0 ? 'PASS' : 'FAIL') + `  (${pass} ok, ${fail} failed)`)
await browser.close()
process.exitCode = fail === 0 && errs.length === 0 ? 0 : 1
