
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(process.env.GAME_URL || 'http://localhost:5173/', { waitUntil: 'commit', timeout: 30000 })
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 }); await page.waitForTimeout(500)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t){ await page.evaluate(({t,visSrc})=>{const vis=eval(visSrc);const els=[...document.querySelectorAll('button,[onclick],a')].filter(vis);let el;if(t==='ARCH')el=els.find(e=>/^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText||'').trim()));else el=els.find(e=>((e.innerText||e.textContent||'').replace(/\s+/g,' ').includes(t)));if(el)el.click()},{t,visSrc:vis}); await page.waitForTimeout(500) }
for (const s of ["START NEW CAREER","ARCH","RB Running","PLAY 8-GAME SEASON","Balanced Program"]) await click(s)
const TUNE = JSON.parse(process.env.TUNE || '{}'); await page.evaluate(t => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, t) }, TUNE)
const res = await page.evaluate((G) => {
  const FS = window.__FieldSim, rec = []; const orig = FS.run.bind(FS)
  const prof = {}; const addP = (side, p, att) => { for (const k of ['speed','strength','blocking','tackling','quickness','awareness','discipline','agility','burst','vision']) { const key = side + ':' + p.pos + ':' + k; const v = att(p, k); if (Number.isFinite(v)) { const o = prof[key] || (prof[key] = { n: 0, s: 0 }); o.n++; o.s += v } } }
  FS.run = function(...a){ const r = orig(...a); rec.push({ y: r && r.yards, c: a[5] || 'none' }); if (rec.length <= 60) { for (const p of a[1].off) addP('off', p, a[4]); for (const p of a[2].def) addP('def', p, a[4]) } return r }
  const prec = []; const origP = FS.pass.bind(FS)
  FS.pass = function(...a){ const r = origP(...a); if (r) prec.push({ pa: !!(a[8] && a[8].pa), c: a[7], comp: r.complete, y: r.yards, air: r.air || 0, yac: r.yac || 0, int: r.intercepted }); return r }
  const games = []
  for (let g = 0; g < G; g++) { const r = window.__simGameV2(55, ["RB","LB","QB","WR"][g%4]); games.push({ rush: r.team.rush, oppRush: r.oppTeam.rush, pass: r.team.pass, us: r.usScore, them: r.themScore, plays: r.plays.filter(p=>!p.header).length, runs: r.plays.filter(p=>p.event==='run').length, runYds: r.plays.filter(p=>p.event==='run').reduce((n,p)=>n+p.yards,0) }) }
  const H = {}; const byC = {}
  for (const p of rec) { const b = p.y < 0 ? 'neg' : p.y <= 2 ? '0-2' : p.y <= 5 ? '3-5' : p.y <= 9 ? '6-9' : p.y <= 14 ? '10-14' : p.y <= 24 ? '15-24' : '25+'; H[b] = (H[b]||0)+1; const c = byC[p.c] || (byC[p.c] = { n: 0, y: 0 }); c.n++; c.y += p.y }
  const avg = k => +(games.reduce((n,g)=>n+g[k],0)/games.length).toFixed(1)
  const P = { all: { n: 0, comp: 0, y: 0, air: 0, yac: 0, int: 0 }, pa: { n: 0, comp: 0, y: 0, air: 0, yac: 0, int: 0 }, plain: { n: 0, comp: 0, y: 0, air: 0, yac: 0, int: 0 } }
  for (const p of prec) for (const k of ['all', p.pa ? 'pa' : 'plain']) { const o = P[k]; o.n++; if (p.comp) { o.comp++; o.y += p.y; o.air += p.air; o.yac += p.yac } if (p.int) o.int++ }
  const passStats = Object.fromEntries(Object.entries(P).map(([k, o]) => [k, { n: o.n, compPct: +(o.comp / Math.max(1, o.n) * 100).toFixed(1), ypa: +(o.y / Math.max(1, o.n)).toFixed(2), airPerComp: +(o.air / Math.max(1, o.comp)).toFixed(1), yacPerComp: +(o.yac / Math.max(1, o.comp)).toFixed(1), intPct: +(o.int / Math.max(1, o.n) * 100).toFixed(1) }]))
  return { passStats, profile: Object.fromEntries(Object.entries(prof).map(([k,v])=>[k, Math.round(v.s/v.n)])), simRuns: rec.length, simYpc: +(rec.reduce((n,p)=>n+p.y,0)/rec.length).toFixed(2), hist: H, byConcept: Object.fromEntries(Object.entries(byC).map(([k,v])=>[k, { n: v.n, ypc: +(v.y/v.n).toFixed(2) }])),
    gameRush: avg('rush'), oppRush: avg('oppRush'), pass: avg('pass'), us: avg('us'), them: avg('them'), playRuns: avg('runs'), playRunYds: avg('runYds'), playYpc: +(games.reduce((n,g)=>n+g.runYds,0)/games.reduce((n,g)=>n+g.runs,0)).toFixed(2) }
}, +(process.env.GAMES || 30))
delete res.profile; console.log(JSON.stringify(res)); if (errs.length) console.log('ERRORS', errs.slice(0,3)); await browser.close()
