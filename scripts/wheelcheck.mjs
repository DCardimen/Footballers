// Dev check: v50 decision wheel — the three claims the system makes.
//
//   1. SPIN WHEEL      the wheel's wedge arcs ARE the personality weights, and a
//                      character's traits visibly re-cut the same wheel
//   2. FIT ROLL        the +/neutral/- band is its own roll: near-even for a
//                      character with no opinion, strongly positive when the
//                      landed theme jives with them, negative when it fights them
//   3. SPEED THROUGH   tapping a rolling decision runs the rest of it at 5x
//
// Parts 1-2 run headless off window.__GROWTH_V42; part 3 drives the real overlay
// in a live career and times it. Exits non-zero on any failure.
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => {
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1200)

const fails = []
const ok = (cond, label, detail) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (detail ? '  ' + detail : '')); if (!cond) fails.push(label) }

// ---- 1. the wheel is cut by personality -------------------------------------
const cut = await page.evaluate(() => {
  const G = window.__GROWTH_V42
  const mk = p => ({ pos: 'RB', seasonSeed: 4242, seasonsPlayedTotal: 0, personaV13: p, coachTrust: 50 })
  const GRINDER = { aggression: 9, iq: 3, eq: 4, longterm: 4, workethic: 10, loyalty: 5, confidence: 8, coachability: 3 }
  const PROF = { aggression: 1, iq: 10, eq: 9, longterm: 9, workethic: 4, loyalty: 6, confidence: 2, coachability: 9 }
  const share = pl => {
    const rand = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(99)
    const opts = G.genOptions(pl, rand, 5)
    const tot = opts.reduce((a, o) => a + o.w, 0)
    return opts.map(o => ({ theme: o.theme, pct: +(o.w / tot * 100).toFixed(1) }))
  }
  const a = share(mk(GRINDER)), b = share(mk(PROF))
  // same seed -> same option set, so any difference in share is personality alone
  const sameSet = a.map(x => x.theme).join() === b.map(x => x.theme).join()
  const spread = s => Math.max(...s.map(x => x.pct)) - Math.min(...s.map(x => x.pct))
  const moved = a.reduce((m, x, i) => Math.max(m, Math.abs(x.pct - b[i].pct)), 0)
  return { sameSet, grinder: a, prof: b, spreadA: +spread(a).toFixed(1), spreadB: +spread(b).toFixed(1), moved: +moved.toFixed(1) }
})
console.log('wheel cut:', JSON.stringify(cut))
ok(cut.sameSet, 'same seed draws the same five options for both characters')
ok(cut.moved >= 4, 'personality re-cuts the wedges', `biggest share move ${cut.moved}pp`)
ok(cut.spreadA >= 8 && cut.spreadB >= 8, 'wedges are visibly unequal', `spreads ${cut.spreadA}pp / ${cut.spreadB}pp`)

// ---- 2. the fit roll is its own system --------------------------------------
const fit = await page.evaluate(() => {
  const G = window.__GROWTH_V42
  const odds = j => G.bandOdds(j, 0)
  const even = odds(0), hi = odds(1), lo = odds(-1)
  const sums = [even, hi, lo].map(o => +(o.g + o.n + o.r).toFixed(3))
  // jive actually reads the character: build one who lives for iron work and one who does not
  const mk = p => ({ pos: 'RB', personaV13: p })
  const lifter = mk({ aggression: 9, workethic: 10, iq: 5, eq: 5, longterm: 5, loyalty: 5, confidence: 5, coachability: 5 })
  const yogi = mk({ aggression: 0, workethic: 0, iq: 5, eq: 5, longterm: 5, loyalty: 5, confidence: 5, coachability: 5 })
  return {
    even: { g: +even.g.toFixed(2), n: +even.n.toFixed(2), r: +even.r.toFixed(2) },
    hi: { g: +hi.g.toFixed(2), n: +hi.n.toFixed(2), r: +hi.r.toFixed(2) },
    lo: { g: +lo.g.toFixed(2), n: +lo.n.toFixed(2), r: +lo.r.toFixed(2) },
    sums,
    jiveLifterIron: +G.jiveOf(lifter, 'iron').toFixed(2),
    jiveYogiIron: +G.jiveOf(yogi, 'iron').toFixed(2),
    traits: G.jiveTraits(lifter, 'iron').map(t => t.key),
  }
})
console.log('fit roll:', JSON.stringify(fit))
ok(fit.sums.every(v => Math.abs(v - 1) < 0.02), 'band odds always total 100%', fit.sums.join(' / '))
ok(Math.abs(fit.even.g - fit.even.r) <= 0.06 && Math.abs(fit.even.g - fit.even.n) <= 0.06,
  'no-opinion character rolls a near-even three-way split', JSON.stringify(fit.even))
ok(fit.hi.g >= 0.65 && fit.hi.g > fit.even.g + 0.25, 'a theme you jive with is much more likely to pay', `${fit.hi.g} vs ${fit.even.g}`)
ok(fit.lo.r >= 0.5 && fit.lo.g <= 0.15, 'a theme that fights you is much more likely to backfire', JSON.stringify(fit.lo))
ok(fit.jiveLifterIron >= 0.5, 'a relentless, aggressive kid jives with iron work', String(fit.jiveLifterIron))
ok(fit.jiveYogiIron <= -0.5, 'a soft, coasting kid does not', String(fit.jiveYogiIron))
ok(fit.traits.includes('workethic'), 'the named driving trait is real', JSON.stringify(fit.traits))

// the whole distribution, over many rolled careers: does jive dominate outcomes?
const dist = await page.evaluate(() => {
  const G = window.__GROWTH_V42
  const rows = G.simulate(400)
  const b = { lowJive: { green: 0, neutral: 0, red: 0, n: 0 }, midJive: { green: 0, neutral: 0, red: 0, n: 0 }, highJive: { green: 0, neutral: 0, red: 0, n: 0 } }
  for (const r of rows) {
    const k = r.jive >= .28 ? 'highJive' : r.jive <= -.28 ? 'lowJive' : 'midJive'
    b[k][r.band]++; b[k].n++
  }
  const pct = o => o.n ? { green: Math.round(o.green / o.n * 100), neutral: Math.round(o.neutral / o.n * 100), red: Math.round(o.red / o.n * 100), n: o.n } : o
  return { low: pct(b.lowJive), mid: pct(b.midJive), high: pct(b.highJive) }
})
console.log('outcome distribution by jive:', JSON.stringify(dist))
ok(dist.high.n > 25 && dist.low.n > 25, 'the sample covers both ends of jive', `${dist.low.n} low / ${dist.high.n} high`)
ok(dist.high.green > dist.low.green + 20, 'high-jive careers get the positive band far more often',
  `${dist.high.green}% vs ${dist.low.green}%`)
ok(dist.low.red > dist.high.red + 15, 'low-jive careers backfire far more often', `${dist.low.red}% vs ${dist.high.red}%`)

// ---- 3. tap to speed through ------------------------------------------------
// Drive a real career to the season-commitment wheel and time it with and
// without a tap. Same seeded roll both times, so only the animation differs.
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
  }, { t, visSrc: vis })
  await page.waitForTimeout(700)
}
for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(s)

// the season-commitment wheel fires on its own the moment the season starts —
// clear it before timing anything, so we are not measuring someone else's roll
await page.evaluate(() => document.getElementById('growthV42')?.remove())
await page.waitForTimeout(400)

// time one roll end to end; `tap` decides whether we poke it mid-spin
async function timeRoll(tap) {
  const started = await page.evaluate(() => {
    document.getElementById('growthV42')?.remove()
    const st = window.__GRIDIRON_AUDIT__?.getState?.() || window.o
    const pl = st && st.player; if (!pl) return 'no-player'
    window.__GROWTH_V42.showWheel(pl, 'check|' + Math.random(), 'CHECK ROLL', () => {})
    return !!document.getElementById('growthV42')
  })
  if (started !== true) throw new Error('wheel did not open: ' + started)
  await page.waitForSelector('#growthV42', { timeout: 5000 })
  const t0 = Date.now()
  let rate = 1
  if (tap) { await page.waitForTimeout(260); await page.locator('#gv50wheel').click({ force: true }) }
  // read the rate WHILE the roll is running — landing disarms and resets it
  rate = await page.evaluate(() => window.__DECIDE_SPEED_V50.rate)
  await page.waitForFunction(() => {
    const b = document.getElementById('gv42go'); return b && b.style.display !== 'none'
  }, { timeout: 20000 })
  const ms = Date.now() - t0
  await page.evaluate(() => document.getElementById('growthV42')?.remove())
  await page.waitForTimeout(250)
  return { ms, rate }
}
const slow = await timeRoll(false)
const fast = await timeRoll(true)
const ratio = +(slow.ms / Math.max(1, fast.ms)).toFixed(2)
console.log('speed through:', JSON.stringify({ slowMs: slow.ms, fastMs: fast.ms, ratio, rateDuringTap: fast.rate, rateUntouched: slow.rate }))
ok(fast.rate === 5, 'a tap sets the decision rate to 5x mid-roll', String(fast.rate))
ok(slow.rate === 1, 'an untouched roll stays at 1x', String(slow.rate))
ok(ratio >= 2.2, 'the tapped roll finishes far sooner', `${slow.ms}ms -> ${fast.ms}ms (${ratio}x)`)

// ---- wheel geometry, on the live canvas -------------------------------------
await page.evaluate(() => {
  document.getElementById('growthV42')?.remove()
  const st = window.__GRIDIRON_AUDIT__?.getState?.() || window.o
  window.__GROWTH_V42.showWheel(st.player, 'shot|1', 'CHECK ROLL', () => {})
})
await page.waitForSelector('#gv50wheel', { timeout: 5000 })
const geo = await page.evaluate(() => {
  const cv = document.getElementById('gv50wheel')
  const g = cv.getContext('2d'), W = cv.width, R = W / 2 - 4, cx = W / 2, cy = W / 2
  const d = g.getImageData(0, 0, W, W).data
  const last = window.__WHEEL_V50_LAST
  // The face is a shaded radial ramp now, so exact-colour run detection shatters
  // on rounding. Every shade of a wedge is its base scaled uniformly, though, and
  // that preserves HUE exactly — so classify each sample to the nearest option
  // hue and run-length THAT. Robust to any amount of shading or vignette.
  const hueOf = (r, gg, b) => {
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), c = mx - mn
    if (!c) return -1
    let h = mx === r ? ((gg - b) / c) % 6 : mx === gg ? (b - r) / c + 2 : (r - gg) / c + 4
    h *= 60; return h < 0 ? h + 360 : h
  }
  const want = last.cols.map(hx => { const n = parseInt(hx.slice(1), 16); return hueOf(n >> 16 & 255, n >> 8 & 255, n & 255) })
  const dist = (a, b) => { const x = Math.abs(a - b) % 360; return x > 180 ? 360 - x : x }
  const classify = (x, y) => {
    const i = ((y | 0) * W + (x | 0)) * 4, h = hueOf(d[i], d[i + 1], d[i + 2])
    if (h < 0) return -1
    let best = -1, bd = 1e9
    want.forEach((wh, k) => { const dd = dist(h, wh); if (dd < bd) { bd = dd; best = k } })
    return bd <= 40 ? best : -1
  }
  // r = 0.30R sits inside the icon ring, outside the hub, and clear of both the
  // drawn rim and the sheen (which is clipped to the outer half)
  const runs = []
  let prev = null
  for (let k = 0; k < 720; k++) {
    const a = k / 720 * Math.PI * 2 - Math.PI / 2
    const c = classify(cx + Math.cos(a) * R * 0.30, cy + Math.sin(a) * R * 0.30)
    if (c !== prev) { runs.push({ c, n: 1 }); prev = c } else runs[runs.length - 1].n++
  }
  const solid = runs.filter(r => r.c >= 0 && r.n > 12)
  // measured arc per option index, against the weight that asked for it
  const measured = {}
  for (const r of solid) measured[r.c] = (measured[r.c] || 0) + r.n / 720
  const err = last.want.map((w, i) => Math.round(Math.abs((measured[i] || 0) - w) * 100))
  let painted = 0
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) painted++
  return {
    w: W, h: cv.height, wedges: Object.keys(measured).length,
    want: last.want.map(v => Math.round(v * 100)),
    drawn: last.want.map((w, i) => Math.round((measured[i] || 0) * 100)),
    worstErrPP: Math.max(...err),
    paintedPct: Math.round(painted / (W * W) * 100),
  }
})
console.log('wheel canvas:', JSON.stringify(geo))
ok(geo.w >= 200 && geo.h >= 200, 'the wheel canvas is a real, sized element', `${geo.w}x${geo.h}`)
ok(geo.wedges === geo.want.length, 'the face carries one wedge per option', `${geo.wedges} of ${geo.want.length}`)
ok(geo.worstErrPP <= 3, 'every drawn arc matches the weight that asked for it',
  `want ${geo.want.join('/')}% drawn ${geo.drawn.join('/')}% (worst ${geo.worstErrPP}pp)`)
ok(Math.max(...geo.drawn) - Math.min(...geo.drawn) >= 6,
  'the wedges are cut to unequal arcs, not fifths', `arc shares ${geo.drawn.join('/')}%`)
ok(geo.paintedPct >= 55, 'the wheel fills its canvas', `${geo.paintedPct}%`)
await page.screenshot({ path: 'scripts/_wheel.png' })

// and once more after it lands, so the fit strip and the result are eyeballable
await page.locator('#gv50wheel').click({ force: true })
await page.waitForFunction(() => { const b = document.getElementById('gv42go'); return b && b.style.display !== 'none' }, { timeout: 20000 })
const landed = await page.evaluate(() => {
  const f = document.getElementById('gv50fit')
  const bars = f ? [...f.querySelectorAll('i')].map(i => parseFloat(i.style.flex) || 0) : []
  return { fitShown: !!f && f.style.display !== 'none', bars, jv: document.getElementById('gv50jv')?.textContent }
})
console.log('fit strip:', JSON.stringify(landed))
ok(landed.fitShown, 'the fit roll is shown as its own panel before the result')
ok(landed.bars.length === 3 && Math.abs(landed.bars.reduce((a, b) => a + b, 0) - 100) <= 2,
  'the fit panel plots all three bands', JSON.stringify(landed.bars))
await page.screenshot({ path: 'scripts/_wheel_landed.png' })

console.log('page errors:', errs.length ? '\n' + errs.slice(0, 10).join('\n') : 'NONE')
console.log('VERDICT:', fails.length || errs.length ? 'FAIL ' + JSON.stringify(fails) : 'PASS')
if (fails.length || errs.length) process.exitCode = 1
await browser.close()
