// temp probe (v151 D) — not committed
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && typeof window.buildPlayScript === 'function', null, { timeout: 60000 })
const tune = JSON.parse(process.env.TUNE || '{}')
const R = await page.evaluate(({ G, tune }) => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune)
  const dims = { PLAY_L: 66, PLAY_R: 654, F_TOP: 14, F_BOT: 426 }
  const at = (fr, t) => { if (t <= fr[0].t) return fr[0]; for (let i = 1; i < fr.length; i++) if (fr[i].t >= t) { const a = fr[i - 1], b = fr[i], k = (t - a.t) / ((b.t - a.t) || 1); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k } } return fr[fr.length - 1] }
  const A = { scripts: 0, tk: 0, byWhy: {}, ratioHist: [0, 0, 0, 0, 0, 0], worst: [], allOver: 0, allSeg: 0, dist: [] }
  const speedMax = (fr, t0, t1, win, skip) => { let m = 0
    for (let i = 1; i < fr.length; i++) { const a = fr[i - 1], b = fr[i]; if (b.t < t0 || a.t > t1) continue
      if (skip && skip.some(q => Math.abs(q - b.t) < 120)) continue
      // speed over a sliding window (~win ms) to avoid sampling noise
      let j = i; while (j < fr.length - 1 && fr[j].t - a.t < win) j++
      const c = fr[j], dt = (c.t - a.t) / 1000; if (dt <= 0) continue
      m = Math.max(m, Math.hypot(c.x - a.x, c.y - a.y) / dt) }
    return m }
  for (let g = 0; g < G; g++) {
    window.__FieldSim._Q.length = 0
    const r = window.__simGameV2(50 + (g % 9) * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5])
    for (const p of r.plays) {
      if (p.header || /^(xp|twopt|timeout|warning|period|toss)$/.test(p.event)) continue
      let s; try { s = window.buildPlayScript(p, { dims, rand: Math.random }) } catch (e) { continue }
      A.scripts++
      const snap = (s.events.find(e => e.type === 'snap') || { t: 0 }).t
      for (const a of s.actors) { if (!a.frames || a.frames.length < 3) continue
        const m = speedMax(a.frames, snap + 100, 1e9, 99); A.allSeg++; if (m > (a.sp || 150) * 1.35) A.allOver++ }
      const tks = s.events.filter(e => e.type === 'tackle' && e.tackler && e.carrier && e.tackler !== e.carrier); if (!tks.length) continue
      const e = tks[tks.length - 1], by = {}; for (const a of s.actors) by[a.id] = a
      const K = by[e.tackler], C = by[e.carrier]; if (!K || !C) continue
      A.tk++
      const why = (e.v146 && e.v146.why) || (s.meta.fieldSim ? 'sim' : 'choreo')
      const sp = K.sp || 150
      const skip = s.events.filter(q => (q.who === K.id || q.tackler === K.id) && /^(brokenTackle|stiffarm|bounce|hurdle|pileOn|wrapIn|tackleWhiff|stagger|pilePush)$/.test(q.type)).map(q => q.t)
      const m = speedMax(K.frames, e.t - 1200, e.t, 99, skip), ratio = m / sp
      const B = A.byWhy[why] = A.byWhy[why] || { n: 0, over: 0, sumR: 0, maxR: 0, fixed: 0, d0: 0 }
      B.n++; B.sumR += ratio; B.maxR = Math.max(B.maxR, +ratio.toFixed(2)); if (ratio > 1.5) B.over++; if (e.v146 && e.v146.fixPx) { B.fixed++; B.d0 += e.v146.d0 }
      A.ratioHist[Math.min(5, Math.floor(ratio / 0.5))]++
      const k0 = at(K.frames, e.t), c0 = at(C.frames, e.t); A.dist.push(Math.hypot(k0.x - c0.x, k0.y - c0.y))
      if (ratio > 1.6 && A.worst.length < 8) A.worst.push({ why, ratio: +ratio.toFixed(2), sp, d0: e.v146 && e.v146.d0, fix: e.v146 && e.v146.fixMs, ev: p.event })
    }
  }
  for (const k in A.byWhy) { const B = A.byWhy[k]; B.meanR = +(B.sumR / B.n).toFixed(2); delete B.sumR; B.d0 = B.fixed ? Math.round(B.d0 / B.fixed) : 0 }
  A.dist.sort((a, b) => a - b); A.distP = [0.5, 0.9, 0.99, 1].map(q => +A.dist[Math.min(A.dist.length - 1, Math.floor(q * A.dist.length))].toFixed(1)); delete A.dist
  return A
}, { G: Number(process.env.GAMES || 20), tune })
console.log(JSON.stringify(R))
console.log('errs', errs.slice(0, 3))
await browser.close()
