// v150 B probe (not a check): the v110 credit over many seeds.
import { chromium } from 'playwright'
const SEEDS = +(process.env.SEEDS || 20), G = +(process.env.G || 10)
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const tot = { plays: 0, pickSwat: 0, good: 0, bad: 0, ballManPlays: 0, oldCheckWrong: 0, bmIsEnginePick: 0, bad_rows: [] }
for (let sd = 1; sd <= SEEDS; sd++) {
  const page = await browser.newPage()
  await page.addInitScript(seed => { let s = seed >>> 0
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 } }, sd * 7919)
  await page.goto(process.env.GAME_URL || 'http://localhost:5520/', { waitUntil: 'commit' })
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && !!window.__FieldSim, null, { timeout: 120000 })
  const R = await page.evaluate((G) => {
    const FS = window.__FieldSim, o = FS.pass.bind(FS)
    const t = { plays: 0, pickSwat: 0, good: 0, bad: 0, ballManPlays: 0, oldCheckWrong: 0, bmIsEnginePick: 0, bad_rows: [] }
    FS.pass = function (...a) { const r = o(...a); const q = FS._Q, e = q[q.length - 1]; const ev = (e && e.log && e.log.events) || []
      t.plays++
      const pick = ev.find(x => x.type === 'pick'), swat = ev.find(x => x.type === 'swat'), bm = ev.filter(x => x.type === 'ballMan')
      if (r && (pick || swat)) { t.pickSwat++
        const lb = (window.__V110 || {}).lastBall, by = (pick || swat).by
        const ok = !!lb && lb.by === by && r.cover === lb.player && r.coverBy === by
        ok ? t.good++ : (t.bad++, t.bad_rows.length < 5 && t.bad_rows.push({ by, lb: lb && lb.by, coverBy: r.coverBy }))
        if (bm.length) { t.ballManPlays++
          if (r.cover === a[5]) { t.oldCheckWrong++; if (lb && lb.player === a[5]) t.bmIsEnginePick++ } } }
      return r }
    for (let i = 0; i < G; i++) window.__simGameV2(58 + i * 2, ['LB', 'CB', 'S', 'DL', 'QB', 'WR'][i % 6])
    return t
  }, G)
  for (const k of Object.keys(tot)) if (k === 'bad_rows') tot.bad_rows.push(...R.bad_rows); else tot[k] += R[k]
  console.log('seed', sd, JSON.stringify(R))
  await page.close()
}
console.log('TOTAL', JSON.stringify(tot))
await browser.close()
