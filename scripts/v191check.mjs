// Dev check: v191 (src/07-career-app.js, src/04-engine.js, src/05-field-renderer.js).
//   A: THE PRICES — the core branches ×24 (were ×6), a node already priced in thousands keeps ×6, Impossible ×8 (was ×500);
//      `v191price` 0 restores the v179 prices
//   B: THE LOCKER ROOM — six FOREVER team nodes at ×1.04 a level: each level is +1 OVR to the next teammate of a group
//      (`lockerAddsV191`), the Captain's Table to the weakest; never the you-player; the quick sim's team pair carries the
//      same total over the 22; the shop shows the branch
//   C: THE GANG GOES DOWN — FieldSim puts a scrum's defenders in the heap (`downV153A`); on the broadcast every man in it
//      leaves his feet (`gangFallV191`: the first in a short dive) and folds into the tackle sequence, then gets up
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v191check.mjs   (SKIP_LIVE=1 skips the broadcast)
import { gameUrl, launch } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V190 && !!window.__FieldSim && !!window.__simGameV2, null, { timeout: 40000 })
await page.waitForTimeout(800)
const M = (fn, arg) => page.evaluate(fn, arg)

// A: prices
const A = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tree = {}
  const N = X.TREE_NODES, c = k => X.nodeCost(N[k])
  const r = { genetics: c('genetics'), geneticsBase: N.genetics.cost, fa: c('secondChance'), faBase: N.secondChance.cost, imp: c('megaPP'), impBase: N.megaPP.cost, et: c('etGrowth'), etBase: N.etGrowth.cost }
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v191price: 0 }); r.old = c('genetics'); r.oldImp = c('megaPP'); delete window.RIB_TUNE.v191price
  return r
})
ok(A.genetics === A.geneticsBase * 24 && A.old === A.geneticsBase * 6, 'a core node costs ×24 (was ×6)', A)
ok(A.fa === A.faBase * 6, 'a node already priced in thousands (Free Agency) keeps its ×6', A)
ok(A.imp === A.impBase * 8 && A.oldImp === A.impBase * 500, 'Impossible costs ×8 (was ×500)', A)
ok(A.et === A.etBase, 'Eternal is unchanged', A)

// B: the Locker Room
const B = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), V = window.__V190, N = X.TREE_NODES
  S.player = X.newPlayer(); S.player.pos = 'RB'; S.player.level = 5
  const men = [{ pos: 'QB', ovr: 60 }, { pos: 'RB', ovr: 70, you: true }, { pos: 'WR', ovr: 50 }, { pos: 'WR', ovr: 52 }, { pos: 'TE', ovr: 55 },
    { pos: 'OL', ovr: 60 }, { pos: 'OL', ovr: 61 }, { pos: 'DL', ovr: 40 }, { pos: 'CB', ovr: 45 }]
  S.tree = { lkSkill: 9 }; const skill = V.locker(men)
  S.tree = { lkCaptain: 10 }; const cap = V.locker(men)
  S.tree = { lkLine: 101 }; const line = V.locker(men)
  S.tree = {}; const p0 = window.__TEAMPAIR_V76(S.player, { seed: 55 })
  S.tree = { lkAll: 220 }; const p1 = window.__TEAMPAIR_V76(S.player, { seed: 55 }), tot = V.lockerTotal()
  const nodes = ['lkSkill', 'lkLine', 'lkFront', 'lkBack', 'lkCaptain', 'lkAll'].map(k => N[k] && N[k].branch === 'locker' && N[k].max >= 999 && N[k].mult === 1.04)
  S.tree = { lkLine: 100 }; const c100 = X.nodeCost(N.lkLine)
  S.tree = {}
  return { skill, cap, line, p0: p0.us, p1: p1.us, opp: [p0.opp, p1.opp], tot, nodes, c0: X.nodeCost(N.lkLine), c100 }
})
ok(B.nodes.every(Boolean) && B.nodes.length === 6, 'six FOREVER Locker Room nodes at ×1.04 a level', B.nodes)
ok(B.skill[1] === 0 && B.skill.slice(0, 5).reduce((a, b) => a + b, 0) === 9 && B.skill[0] === 3 && B.skill[4] === 2, 'Huddle Mates hands +1s round the QB/WR/TE (never the you-player)', B.skill)
ok(B.cap[7] > 0 && B.cap[1] === 0 && Math.max(...B.cap) <= 10, 'the Captain\'s Table lifts the weakest first', B.cap)
ok(B.line[5] === 51 && B.line[6] === 50, 'Trench Brothers ×101: the two linemen +51 / +50', B.line)
ok(B.p1 - B.p0 === 10 && B.opp[0] === B.opp[1], 'the quick sim\'s team pair carries the total over the 22 (220 levels = +10)', B)
ok(B.c0 === 15 && B.c100 > 600 && B.c100 < 900, 'cheap and slow: 15 PP, ~760 at level 100', B)

// C: the engine lists the scrum's defenders in the heap
const C = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tutorialSeen = true; S.player = X.newPlayer(); S.player.pos = 'RB'
  const FS = window.__FieldSim, rec = [], o = {}
  for (const name of ['run', 'pass']) { o[name] = FS[name]; FS[name] = function (...a) { const r = o[name].apply(FS, a); const q = FS._Q; if (q && q.length && r) rec.push(q[q.length - 1].log); return r } }
  try { for (let g = 0; g < 14; g++) window.__simGameV2(45 + (g % 9) * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5]) } finally { FS.run = o.run; FS.pass = o.pass }
  const R = { scrumTk: 0, listed: 0, defIn: 0, defAll: 0 }
  for (const log of rec) {
    if (!log || !log.events) continue
    let def = null
    for (const e of log.events) {
      if (e.type === 'scrumV177A') def = new Set(e.def || [])
      if (e.type === 'scrumJoinV177A' && e.side === 'def' && def) def.add(e.who)
      if (e.type === 'tackle' && def) { R.scrumTk++; const d = new Set(e.downV153A || []); if (d.size) R.listed++; for (const id of def) { if (id === e.tackler) continue; R.defAll++; if (d.has(id)) R.defIn++ } def = null }
    }
  }
  return R
})
ok(C.scrumTk > 0 && C.listed / C.scrumTk > 0.7, 'a scrum that ends in a tackle names a heap', C)
ok(C.defAll === 0 || C.defIn / C.defAll > 0.6, 'the scrum\'s defenders are in it (they go down too)', C)

// C: the broadcast — every man in the heap leaves his feet, then gets up
if (!process.env.SKIP_LIVE) {
  async function step (t) {
    await page.evaluate((t) => {
      const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
      const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
      const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
        : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
          : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
    }, t)
    await page.waitForTimeout(t === 'PLAN' ? 3000 : 800)
  }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  const live = await waitLive(page, 60000)
  ok(live, 'the broadcast came up')
  if (live) {
    let fired = null
    for (let i = 0; i < 300 && !fired; i++) {
      fired = await page.evaluate(() => {
        const sc = window.__gridironScene, P = sc && sc.play
        if (!P || !P.script || !P.snapped || P.done || !(P.carrierId >= 0) || P.carrierId > 21) return null
        const cm = sc.markers[P.carrierId]; if (!cm || !cm.root || cm.forceState) return null
        const D = sc.markers.map((m, j) => ({ m, j })).filter(({ m, j }) => m && m.root && j !== P.carrierId && (j < 11) !== (P.carrierId < 11))
          .sort((a, b) => Math.hypot(a.m.sx - cm.sx, a.m.sy - cm.sy) - Math.hypot(b.m.sx - cm.sx, b.m.sy - cm.sy)).slice(0, 3)
        if (D.length < 3) return null
        const id = j => P.script.actors[j].id, cid = id(P.carrierId)
        sc.fireEvent({ __inj: true, type: 'scrumV177A', t: P.t, carrier: cid, by: id(D[0].j), def: D.slice(0, 2).map(d => id(d.j)), off: [], ms: 900, dir: 1, drift: 0, x: cm.sx, y: cm.sy }, P)
        window.__V191C_R = { falls: 0, dives: 0 }
        sc.fireEvent({ __inj: true, type: 'tackle', t: P.t, tackler: id(D[0].j), carrier: cid, x: cm.sx, y: cm.sy, gang: true, sup: [id(D[1].j)], handsOn: 3, downV153A: [id(D[1].j), id(D[2].j)], kb: 2, style: 'wrap' }, P)
        window.__G191 = { men: [D[1].j, D[2].j] }
        return window.__G191
      })
      if (!fired) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(q => /^(CONTINUE|NEXT PLAY|NEXT)$/i.test((q.innerText || '').trim()) && q.offsetParent); if (b) b.click() }); await page.waitForTimeout(60) }
    }
    ok(!!fired, 'a gang tackle could be fired on a live carrier')
    if (fired) {
      const seen = new Map()
      for (let k = 0; k < 40; k++) {
        await page.waitForTimeout(60)
        const r = await page.evaluate(() => window.__G191.men.map(j => { const m = window.__gridironScene.markers[j]; return m ? String(m.forceState || '') : '?' }))
        r.forEach((st, n) => { const s = seen.get(n) || new Set(); s.add(st); seen.set(n, s) })
      }
      const st = [...seen.values()].map(s => [...s])
      const R = await page.evaluate(() => window.__V191C_R)
      ok(st.every(s => s.includes('tackleSeq')), 'every man in the heap goes to the ground (tackleSeq), not left grabbing', st)
      ok(R && R.falls >= 2 && R.dives >= 1, 'the first of them leaves his feet in a dive', R)
    }
  }
}

console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
if (errs.length) console.log('page errors:', errs.slice(0, 6))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
