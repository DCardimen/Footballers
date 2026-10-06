// Dev check: v187 MEDAL LOOKS & THE RING RESPEC (src/07-career-app.js).
//   1. the medal deck never deals a look (small or major) — 400 medals' worth of deals, no "skin" / "skinMajor"
//   2. every 10 medals EARNS a look, automatically (the sync), worn at once; rarer as the medals climb (rare < 50, epic
//      < 100, legendary < 200, mythic after); an old save catches up on the milestones it already passed
//   3. the ring respec: one ring clears every medal bonus and the majors owned, deals every claimed choice again (new
//      cards, no windfall), keeps the looks; with no ring it refuses
//   4. the medal card on the prestige screen says so (the looks line, the respec button)
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v187check.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } })
await ctx.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate']) document.querySelector(s)?.remove() }, 80)
})
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e.message || e)))
await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V187 && !!window.RIB_COSMETICS, null, { timeout: 40000 })
await p.waitForTimeout(500); await p.evaluate(() => document.getElementById('splash')?.remove())

// 1. no looks in the deck
const D = await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; S.careers = 4; A.setState(S)
  const Md = window.__V179.medals, st = Md.store(); let looks = 0, cards = 0, short = 0
  for (let r = 1; r <= 400; r++) { const P = Md.deal(r, st); cards += P.opts.length; if (P.opts.length !== 2) short++; looks += P.opts.filter((c) => c && (c.id === 'skin' || c.id === 'skinMajor' || c.look)).length }
  return { looks, cards, short }
})
ok(D.looks === 0 && D.short === 0, 'the medal deck deals no look — 400 medals, two cards each', D)

// 2. a look every 10 medals, automatically, rarer as they climb; an old save catches up
const L = await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), Md = window.__V179.medals, st = Md.store(), C = window.RIB_COSMETICS
  st.lookMarkV187 = 0; st.looksV187 = []
  S.honorsV156A = { floor: 35 }; Md.sync()                       // an old save at 35: medals 10, 20, 30
  const first = st.looksV187.map((x) => ({ rank: x.rank, rar: x.rar }))
  S.honorsV156A = { floor: 39 }; Md.sync(); const none = st.looksV187.length
  S.honorsV156A = { floor: 40 }; Md.sync()
  const at40 = st.looksV187[st.looksV187.length - 1]
  const worn = at40 && C.equipped(at40.cat) === at40.id, owned = st.looksV187.every((x) => C.owned(x.id))
  S.honorsV156A = { floor: 215 }; Md.sync()
  const all = st.looksV187.map((x) => [x.rank, x.rar])
  const tiers = [10, 49, 50, 99, 100, 199, 200].map((n) => window.__V187.tier(n))
  st.pending = []
  return { first, none, at40: at40 && { rank: at40.rank, rar: at40.rar }, worn, owned, all, tiers }
})
ok(L.first.length === 3 && L.first.map((x) => x.rank).join() === '10,20,30', 'an old save at 35 medals catches up: looks for medals 10, 20, 30', L.first)
ok(L.none === 3 && L.at40 && L.at40.rank === 40, 'nothing between milestones; medal 40 earns the next one', { none: L.none, at40: L.at40 })
ok(L.worn && L.owned, 'each earned look is in the Locker, and the newest is worn at once', { worn: L.worn, owned: L.owned })
ok(L.tiers.join() === 'rare,rare,epic,epic,legendary,legendary,mythic', 'rarity by medals: rare < 50, epic < 100, legendary < 200, mythic after', L.tiers)
const rk = { rare: 0, epic: 1, legendary: 2, mythic: 3 }
const late = L.all.filter((x) => x[0] >= 100), early = L.all.filter((x) => x[0] < 50)
ok(late.length > 0 && Math.min(...late.map((x) => rk[x[1]] ?? 0)) > Math.max(...early.map((x) => rk[x[1]] ?? 0)), 'the looks at 100+ medals are rarer than the early ones', L.all)

// 3. the ring respec
const R = await p.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState(), Md = window.__V179.medals, st = Md.store()
  st.pending = []; st.log = []; st.fx = {}; st.owned = {}; st.seen = 0
  S.honorsV156A = { floor: 12 }; Md.sync(); Md.autoQuiet('good')
  const before = { fx: Object.keys(st.fx).length, owned: Object.keys(st.owned).length, log: st.log.length, looks: st.looksV187.length }
  S.rings = 0; const refused = window.__V187.respec()
  S.rings = 2; const pp0 = S.pp || 0
  const r = window.__V187.respec()
  const after = { fx: Object.keys(st.fx).length, owned: Object.keys(st.owned).length, pending: st.pending.length, rings: S.rings, looks: st.looksV187.length, windfall: st.pending.some((P) => P.opts.some((c) => c.id === 'pp')) }
  Md.autoQuiet('good')
  const again = { fx: Object.keys(st.fx).length, log: st.log.length, pp: (S.pp || 0) - pp0 }
  return { before, refused, r, after, again }
})
ok(R.refused === null, 'with no ring the respec refuses', R.refused)
ok(R.r && R.r.cost === 1 && R.after.rings === 1 && R.after.fx === 0 && R.after.owned === 0 && R.after.pending === R.before.log, 'one ring clears every medal bonus and deals every claimed choice again', { before: R.before, after: R.after })
ok(!R.after.windfall && R.again.pp === 0 && R.after.looks === R.before.looks, 'no windfall PP in the re-deal; the earned looks stay', { windfall: R.after.windfall, pp: R.again.pp, looks: R.after.looks })
ok(R.again.fx > 0 && R.again.log === R.before.log, 'choosing again rebuilds the bonuses', R.again)

// 4. the medal card says so
const H = await p.evaluate(async () => {
  window.go('shop'); await new Promise((r) => setTimeout(r, 400))
  const c = document.getElementById('medalCardV179'); const t = c ? c.textContent.replace(/\s+/g, ' ') : ''
  return { has: !!c, looks: /EARNED LOOKS/.test(t), respec: /RE-PICK YOUR REWARDS/.test(t) && !!(c && c.querySelector('button[onclick*="medalRespecV187"]')) }
})
ok(H.has && H.looks && H.respec, 'the prestige screen\'s medal card shows the earned looks and the 💍 re-pick button', H)

console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
if (errors.length) console.log('page errors:', errors.slice(0, 6))
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
