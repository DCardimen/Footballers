// Dev check: the shimmer that sweeps the wordmark (and the header brand) — two flashes, one shape.
// The complaint it exists for: the first flash looked right, the second crawled. Two causes, both
// measurable from the computed style alone:
//   * `background-repeat` was the default `repeat`, so a SECOND copy of the highlight band sat one
//     background-width behind the first and dragged across the letters at the tail of the travel;
//   * that tail is exactly where the sweep's cubic-bezier decelerates, so the copy crawled.
// So this reads the band's own geometry rather than trusting the keyframes: for a background whose
// width is S element-widths, a percentage position p puts the image's left edge at p*(1-S) element
// widths and the band's centre half an image further on — centre = p*(1-S) + S/2, in element
// widths. The band is ON the wordmark while that centre is inside 0..1.
// It samples one whole cycle by driving the CSSAnimation's own currentTime (deterministic — no
// frame-rate luck): a coarse 40ms pass for the crossing count, a 5ms pass for the shape of each
// crossing. Then it asserts, for `.rib9-sheen` and `.rib9-brand b`:
//   * exactly TWO crossings per cycle, no repeated copies anywhere;
//   * the two last within 15% of each other, and each carries the same fastest-to-slowest speed
//     ratio (the same easing on both, not a fast one and a decelerating one);
//   * a real beat between them and a real hold at the end of the cycle, with no crossing inside it;
//   * `background-repeat: no-repeat`, and the brand's letters still painted (its gradient is the
//     text's own colour, so an uncovered stretch would leave the word invisible).
// It re-asserts what v102check.mjs reads off the same menu — every hero FX element still animating,
// the sheen still masked by a document-absolute URL of the wordmark — and that prefers-reduced-
// motion still kills the lot.
//   node scripts/sheencheck.mjs          (dev server on :5173)
import { chromium } from 'playwright'
const URL = process.env.MENU_URL || 'http://127.0.0.1:5173/index.html'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const r2 = n => Math.round(n * 100) / 100

const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
page.on('requestfailed', r => bad.push('FAILED ' + r.url()))
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })                 // warm: vite's one-time reload after an edit
await page.waitForSelector('#rib-main-menu-v2 .rib9-sheen', { timeout: 30000 })
await page.waitForTimeout(2500)

/* ===== the sweep, measured off the band's centre ===== */
const probe = async sel => page.evaluate(({ sel, COARSE, FINE }) => {
  const el = document.querySelector(sel)
  if (!el) return { err: 'no ' + sel }
  const cs = getComputedStyle(el), W = el.getBoundingClientRect().width
  if (!(W > 0)) return { err: sel + ' has no width' }
  const sizeX = cs.backgroundSize.split(/[ ,]/)[0]
  const S = sizeX.endsWith('%') ? parseFloat(sizeX) / 100 : parseFloat(sizeX) / W      // background width, in element widths
  const anim = el.getAnimations().find(a => a.animationName) || el.getAnimations()[0]
  if (!anim) return { err: sel + ' is not animating' }
  const dur = anim.effect.getComputedTiming().duration
  anim.pause()
  // the band's centre at time t, in element widths (0..1 is over the element)
  const centreAt = t => {
    anim.currentTime = t
    const raw = getComputedStyle(el).backgroundPositionX.split(/[ ,]/)[0]
    const left = raw.endsWith('%') ? (parseFloat(raw) / 100) * (1 - S) : parseFloat(raw) / W
    return left + S / 2
  }
  // every tiled copy of the band, when the background repeats
  const repeat = cs.backgroundRepeat, tiles = /no-repeat/.test(repeat) ? [0] : [-4, -3, -2, -1, 0, 1, 2, 3, 4]
  const scan = step => { const out = []
    for (let t = 0; t < dur; t += step) { const c = centreAt(t)
      let on = null
      for (const k of tiles) { const ck = c + k * S; if (ck >= 0 && ck <= 1) { on = ck; break } }
      out.push({ t, c, on }) }
    return out }
  const runs = s => { const out = []; let cur = null
    for (const p of s) { if (p.on !== null) { if (!cur) cur = { i0: p.t, i1: p.t, pts: [] }; cur.i1 = p.t; cur.pts.push(p) } else if (cur) { out.push(cur); cur = null } }
    if (cur) out.push(cur)
    return out }
  const coarse = scan(COARSE), fine = scan(FINE)
  const R = runs(fine).map(run => { const pts = run.pts
    // sub-sample the edges: the centre enters at 0 and leaves at 1
    const speeds = []
    for (let i = 1; i < pts.length; i++) speeds.push(Math.abs(pts[i].on - pts[i - 1].on) / FINE)
    // the edge lies inside the sample step either side, never beyond it — clamp, or a run that is
    // still on at the last sample (a band parked ON the letters) extrapolates off to infinity
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const last = pts[pts.length - 1], prev = pts[pts.length - 2] || last
    const t0 = pts.length > 1 && pts[0].t > 0 ? cl(pts[0].t - FINE * (pts[0].on / (pts[1].on - pts[0].on || 1)), pts[0].t - FINE, pts[0].t) : pts[0].t
    const t1 = pts.length > 1 && last.t < dur - FINE ? cl(last.t + FINE * ((1 - last.on) / (last.on - prev.on || 1)), last.t, last.t + FINE) : Math.min(dur, last.t + FINE)
    return { t0: Math.round(t0), t1: Math.round(t1), ms: Math.round(t1 - t0),
      fast: Math.max(...speeds), slow: Math.min(...speeds), ratio: Math.max(...speeds) / (Math.min(...speeds) || 1e-9) } })
  // the hold: the trailing stretch of the cycle where the band does not move at all
  let holdStart = dur
  for (let i = fine.length - 1; i > 0; i--) { if (Math.abs(fine[i].c - fine[fine.length - 1].c) > 1e-6) { holdStart = fine[i + 1].t; break } }
  anim.currentTime = 0; anim.play()
  return { W: Math.round(W), S, dur, repeat, runsCoarse: runs(coarse).length, runs: R, holdStart, holdMs: Math.round(dur - holdStart),
    bg: cs.backgroundColor, name: anim.animationName, timing: cs.animationTimingFunction }
}, { sel, COARSE: 40, FINE: 5 })

for (const [sel, label] of [['.rib9-sheen', 'the wordmark'], ['.rib9-brand b', 'the brand']]) {
  const P = await probe(sel)
  console.log('\n== ' + label + ' (' + sel + ') ==')
  if (P.err) { ok(false, P.err); continue }
  console.log('   ' + JSON.stringify({ W: P.W, size: P.S, dur: P.dur, repeat: P.repeat, hold: P.holdMs + 'ms', runs: P.runs }))
  ok(P.repeat === 'no-repeat', label + ': the band does not repeat behind itself', P.repeat)
  ok(P.runsCoarse === 2 && P.runs.length === 2, label + ': exactly two flashes cross it per cycle',
    `${P.runsCoarse} at 40ms, ${P.runs.length} at 5ms`)
  if (P.runs.length === 2) {
    const [a, b] = P.runs, dm = Math.abs(a.ms - b.ms) / Math.max(a.ms, b.ms)
    ok(dm <= 0.15, label + ': the second flash lasts as long as the first', `${a.ms}ms vs ${b.ms}ms (${(dm * 100).toFixed(1)}% apart)`)
    const dr = Math.abs(a.ratio - b.ratio) / Math.max(a.ratio, b.ratio)
    ok(dr <= 0.10, label + ': and moves through it on the same curve', `fast/slow ${r2(a.ratio)} vs ${r2(b.ratio)} (${(dr * 100).toFixed(1)}% apart)`)
    ok(b.t0 > a.t1, label + ': there is a beat between them', `${Math.round(b.t0 - a.t1)}ms dark`)
    ok(P.holdMs > 0 && a.t1 <= P.holdStart && b.t1 <= P.holdStart, label + ': neither lands inside the hold at the end of the cycle',
      `hold ${P.holdStart}..${P.dur}ms, flashes end ${a.t1}ms / ${b.t1}ms`)
  }
  if (sel === '.rib9-brand b') ok(!/^rgba\(0, 0, 0, 0\)$/.test(P.bg), 'the brand letters are still painted where the band is not', P.bg)
}

/* ===== what v102check reads off the same menu ===== */
const v102 = await page.evaluate(() => {
  const sel = ['.rib9-hero-art', '.rib9-lamp', '.rib9-sheen', '.rib9-swash', '.rib9-sun', '.rib9-sun-rays', '.rib9-portrait img', '.rib9-brand b']
  const anim = sel.map(q => { const el = document.querySelector(q); return [q, el ? getComputedStyle(el).animationName : null] })
  const sheen = document.querySelector('.rib9-sheen'), wm = sheen ? sheen.style.getPropertyValue('--wm') : ''
  const mask = sheen ? (getComputedStyle(sheen).maskImage || getComputedStyle(sheen).webkitMaskImage || '') : ''
  const blend = sheen ? getComputedStyle(sheen).mixBlendMode : ''
  return { anim, wm, maskSet: /url\(/.test(mask), blend, lamps: document.querySelectorAll('.rib9-lamp').length }
})
console.log('\n== the rest of the hero (v102) ==')
ok(v102.anim.every(a => a[1] && a[1] !== 'none'), 'every piece of the hero still animates', JSON.stringify(v102.anim))
ok(/^url\(['"]?https?:\/\//.test(v102.wm) && v102.maskSet, 'the sheen is still masked through the wordmark itself', v102.wm.slice(0, 70))
ok(v102.blend === 'screen', 'and still blends as screen', v102.blend)
ok(v102.lamps === 5, 'five floodlights still stand on the far rim', String(v102.lamps))

/* ===== the reduced-motion door ===== */
const rc = await browser.newContext({ viewport: { width: 430, height: 932 }, reducedMotion: 'reduce' })
const rp = await rc.newPage()
await rp.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
await rp.waitForSelector('#rib-main-menu-v2 .rib9-sheen', { timeout: 30000 }); await rp.waitForTimeout(800)
const still = await rp.evaluate(() => ['.rib9-sheen', '.rib9-brand b'].map(q => { const el = document.querySelector(q)
  return [q, el ? getComputedStyle(el).animationName : null, el ? el.getAnimations().length : -1] }))
ok(still.every(s => s[1] === 'none' && s[2] === 0), 'prefers-reduced-motion still holds both bands still', JSON.stringify(still))
await rc.close()

console.log('\n' + JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
console.log('failed requests:', bad.length ? [...new Set(bad)].slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length || bad.length ? 1 : 0)
