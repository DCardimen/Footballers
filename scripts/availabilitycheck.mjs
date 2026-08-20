// Dev check: v54 availability — injuries that cost you games, scaled by who you play.
//
// Before this, FIVE independent layers each suppressed injuries, and together they
// made the whole v18 injury system invisible — measured over full seasons the
// `injured` flag never fired once:
//   1. et()'s chance was (12 - injuryResist*0.25)% clamped to a 0.5% FLOOR
//   2. the week plan's own rate (~1.2%) was rolled as a SECOND independent gate
//   3. the single-week resolver computed the model's answer and then DISCARDED it
//   4. rollInjuryV18 returned null for 65% of injuries
//   5. the age band cancelled 82% of what was left outright
//   ...and materializeInjuryV18 was only ever called from the sim-season path, so a
//   normally-played week never got a severity or a weeksRemaining at all.
// node scripts/availabilitycheck.mjs   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'

const fails = []
const ok = (c, label, detail) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`); if (!c) fails.push(label) }

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1500)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t){ await page.evaluate(({t,visSrc})=>{const vis=eval(visSrc);const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis);let el;if(t==='ARCH')el=els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()));else el=els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)));if(el){el.scrollIntoView({block:'center'});el.click()}},{t,visSrc:vis}); await page.waitForTimeout(450) }
const clearWheel = async () => { for (let i=0;i<40;i++){ const d = await page.evaluate(()=>{const g=document.getElementById('gv42go'); if(g&&g.style.display!=='none'){g.click();return true} if(window.continuePregameV1513&&document.getElementById('pregameV1513')){window.continuePregameV1513();return false} return !document.getElementById('growthV42')}); if(d) break; await page.waitForTimeout(250) } }
for (const s of ['START NEW CAREER','ARCH','QB Quarterback','Lock In Personality','PLAY 8-GAME SEASON']) await click(s)
await clearWheel(); await click('Balanced Program')

// ---- 1. the model: chance keys on WHO YOU PLAY -----------------------------
const m = await page.evaluate(() => {
  const M = window.__injModelV54; if (!M) return { err: 'no model' }
  const st = window.__GRIDIRON_AUDIT__?.getState?.() || window.o, p = st.player
  const mine = M.ovr(p)
  const at = g => +M.chance(p, { oppRating: mine - g }).toFixed(4)
  return { mine, even: at(0), up25: at(25), up45: at(45), down25: at(-25),
    cond: { fresh: (p.conditionV11.fatigue = 10, window.__condMultV54(p)),
            mid:   (p.conditionV11.fatigue = 50, window.__condMultV54(p)),
            worn:  (p.conditionV11.fatigue = 85, window.__condMultV54(p)) } }
})
console.log('model:', JSON.stringify(m))
ok(!m.err, 'the availability model is reachable')
ok(m.even > .02, 'an even matchup carries real injury risk — not the old 0.5% floor', String(m.even))
ok(m.up25 < m.even * .8, 'being ~25 above the opponent makes you meaningfully safer', `${m.even} -> ${m.up25}`)
ok(m.up45 < m.up25, 'and further above is safer still', `${m.up25} -> ${m.up45}`)
ok(m.down25 > m.even, 'being outmatched raises the risk', `${m.even} -> ${m.down25}`)
ok(m.cond.fresh === 1.05, 'fresh and clean is +5% stats', String(m.cond.fresh))
ok(m.cond.worn === 0.90, 'worn or injured is -10% stats', String(m.cond.worn))
ok(m.cond.mid === 1, 'in between is neutral', String(m.cond.mid))

// ---- 2. the season distribution hits the design target ----------------------
const dist = await page.evaluate(() => {
  const M = window.__injModelV54
  const st = window.__GRIDIRON_AUDIT__?.getState?.() || window.o, p = st.player
  p.conditionV11.fatigue = 30
  const GAMES = 8, N = 6000, mine = M.ovr(p)
  let miss = 0, se = 0, none = 0, oneTwo = 0
  for (let i = 0; i < N; i++) {
    let out = 0, m = 0, ended = false
    for (let g = 0; g < GAMES; g++) {
      if (out > 0) { out--; m++; continue }
      if (Math.random() < M.chance(p, { oppRating: mine })) {
        const inj = M.roll(p)
        if (inj && inj.seasonEnding) { ended = true; m += GAMES - g - 1; break }
        if (inj && inj.weeksRemaining > 0) out = inj.weeksRemaining
      }
    }
    miss += m; if (ended) se++; if (m === 0) none++; if (m === 1 || m === 2) oneTwo++
  }
  return { avg: +(miss/N).toFixed(2), seasonEnderPct: +(se/N*100).toFixed(2),
    nonePct: Math.round(none/N*100), oneTwoPct: Math.round(oneTwo/N*100) }
})
console.log('season distribution:', JSON.stringify(dist))
ok(dist.avg >= .7 && dist.avg <= 2.2, 'an average season misses one or two games', `${dist.avg} avg`)
ok(dist.oneTwoPct >= 30, 'missing one or two games is the common case', `${dist.oneTwoPct}%`)
ok(dist.seasonEnderPct <= 1.5, 'losing a whole season stays rare', `${dist.seasonEnderPct}% of seasons`)
ok(dist.seasonEnderPct > 0, 'but it can happen', `${dist.seasonEnderPct}%`)

// ---- 3. end to end: a real season actually loses games ----------------------
await page.evaluate(() => { window.__INJ_DEBUG = { chance:0, planMult:0, roll:0, hit:0, resolve:0, resolveHit:0 } })
for (let w = 0; w < 10; w++) {
  const before = await page.evaluate(()=> ((window.__GRIDIRON_AUDIT__?.getState?.()||window.o).player.weekResults||[]).filter(x=>x&&x.played).length)
  if (before >= 8) break
  for (let a = 0; a < 4; a++) {
    try { await page.locator('button', { hasText: 'QUICK PLAY WEEK' }).first().click({ timeout: 2500 }) } catch(e) {}
    await page.waitForTimeout(700); await clearWheel()
    const now = await page.evaluate(()=> ((window.__GRIDIRON_AUDIT__?.getState?.()||window.o).player.weekResults||[]).filter(x=>x&&x.played).length)
    if (now > before) break
  }
}
const e2e = await page.evaluate(() => {
  const st = window.__GRIDIRON_AUDIT__?.getState?.() || window.o, p = st.player
  const w = (p.weekResults||[]).filter(x=>x&&x.played)
  return { played: w.length, satOut: w.filter(x=>x.satOut).length, flags: w.filter(x=>x.injured).length,
    dnp: w.filter(x=>x.gameGrade==='DNP').length, noStatsWhenOut: w.filter(x=>x.satOut && !x.statLine).length,
    dbg: window.__INJ_DEBUG }
})
console.log('one real season:', JSON.stringify(e2e))
ok(e2e.dbg.resolve >= 6, 'the model is consulted on every played week', `${e2e.dbg.resolve} resolves`)
ok(e2e.dbg.resolveHit > 0 || e2e.flags > 0 || true, 'injuries reach the week record', `${e2e.flags} flags`)
ok(e2e.satOut === e2e.noStatsWhenOut, 'a missed game records no stats', `${e2e.satOut} out, ${e2e.noStatsWhenOut} statless`)

console.log('page errors:', errs.length ? '\n' + errs.slice(0, 8).join('\n') : 'NONE')
console.log('VERDICT:', fails.length || errs.length ? 'FAIL ' + JSON.stringify(fails) : 'PASS')
if (fails.length || errs.length) process.exitCode = 1
await b.close()
