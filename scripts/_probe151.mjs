import { gameUrl, launch } from './lib/env.mjs'
const b = await launch()
const errs = []
for (const q of ['', 'monetize=1&monetizeAdMs=300']) {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 } })
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(q + ': ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(q + ' console: ' + m.text().slice(0, 200)) })
  await p.goto(gameUrl('index.html?stayStale&noFilmV114&' + q), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__, null, { timeout: 40000 }); await p.waitForTimeout(1500)
  const r = await p.evaluate(async () => {
    const G = window.__V151A, M = window.RIB_MONETIZE
    const out = { gates: G.gates(), skips: G.skips(), on: M.enabled, s3: G.speedOk(3), s4: G.speedOk(4) }
    if (M.enabled) { M.openStore(); await new Promise((r) => setTimeout(r, 300)); const st = document.querySelector('#mz149Store .mz149-card').getBoundingClientRect(); out.store = { h: st.height, top: st.top, bottom: st.bottom, secs: [...document.querySelectorAll('#mz149Store [data-sec]')].map((x) => x.dataset.sec) } }
    return out
  })
  console.log(q || 'OFF', JSON.stringify(r))
  if (q) await p.screenshot({ path: '/tmp/claude-0/-home-user-Footballers/beb97d45-9ec3-5bc0-8e84-ee0273de3356/scratchpad/store.png' })
  await ctx.close()
}
console.log(errs)
await b.close()
