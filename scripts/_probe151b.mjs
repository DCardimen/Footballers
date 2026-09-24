import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage()
await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function')
const R = await page.evaluate(({ G, tune, K }) => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune)
  const dims = { PLAY_L: 66, PLAY_R: 654, F_TOP: 14, F_BOT: 426 }
  const causes = {}; const ex = []; let seg = 0; const H = {sim:new Array(12).fill(0), choreo:new Array(12).fill(0)}
  for (let g = 0; g < G; g++) {
    window.__FieldSim._Q.length = 0
    const r = window.__simGameV2(50 + (g % 9) * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5])
    for (const p of r.plays) {
      if (p.header || /^(xp|twopt|timeout|warning|period|toss)$/.test(p.event)) continue
      let s; try { s = window.buildPlayScript(p, { dims, rand: Math.random }) } catch (e) { continue }
      const eng = s.meta.fieldSim ? 'sim' : 'choreo'
      const snap = (s.events.find(e => e.type === 'snap') || { t: 0 }).t
      for (const a of s.actors) { const fr = a.frames; if (!fr || fr.length < 3) continue
        for (let i = 1; i < fr.length; i++) { const dt = (fr[i].t - fr[i-1].t) / 1000; if (dt <= 0 || fr[i].t < snap + 60) continue
          seg++
          const v = Math.hypot(fr[i].x - fr[i-1].x, fr[i].y - fr[i-1].y) / dt
          H[eng][Math.min(11, Math.floor(v / (a.sp||150) / 0.25))]++
          if (v > (a.sp || 150) * K) {
            const near = s.events.filter(e => Math.abs(e.t - fr[i].t) <= 40 && (e.who === a.id || e.tackler === a.id || e.carrier === a.id || e.by === a.id)).map(e => e.type)
            const k = eng + ':' + (near.length ? [...new Set(near)].sort().join('+') : ('none:' + a.side + (fr[i].t > s.duration - 1100 ? ':end' : '')))
            causes[k] = (causes[k] || 0) + 1
            if (!near.length && ex.length < 8) ex.push({ eng, id: a.id, lab: a.label, v: Math.round(v), sp: a.sp, t: fr[i].t, dur: s.duration, ev: s.events.filter(e => Math.abs(e.t - fr[i].t) <= 70).map(e => e.type + ':' + (e.who||e.tackler||'')) })
          } } }
    }
  }
  return { seg, H, causes: Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 30), ex }
}, { G: Number(process.env.GAMES || 6), tune: JSON.parse(process.env.TUNE || '{}'), K: Number(process.env.K || 1.6) })
console.log(JSON.stringify(R))
await browser.close()
