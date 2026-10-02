// Dev check (v177 A/B) — the scrum shoves, and he spins out of it.
//
//   1. THE SCRUM SHOVES (src/04-engine.js `scrumStartV177A` / `scrumTickV177A` / `scrumCrowdV177A`): a grip with two
//      or more defenders in it becomes a scrum that really goes back and forth (the carrier's own frames change
//      direction several times), the men in it never stand still, team-mates and defenders run in and join it,
//      the stronger side (summed push, `pOff` vs `pDef`) wins more ground, the swing is a few yards at most, and
//      nobody who only joined to push is credited with the tackle (stat-credit truth)
//   2. THE CROWD MOVES: through a grip the men who are not in it keep moving (before v177 they froze on a pixel)
//   3. HE SPINS OUT AND RESETS (v177 B): a few scrums end with the carrier breaking free — he goes BACKWARDS out
//      of it first, then out to the side; the men he spun out of are beaten; sometimes he is caught behind it
//   4. the kill switches: `TU("v177Ascrum", 0)` emits none of it and the bystanders freeze through a grip exactly
//      as they did; `TU("v177Bbreak", 0)` keeps the scrum and never breaks free; the run game stays in its band
//   5. the broadcast: a scrum fired on a live carrier is drawn — the men lean into it, churn the run cycle in
//      place and rock (`window.__V177A_R`), and a break-free staggers the men he left
//   6. no page errors
//
//   GAME_URL=http://localhost:5173/ node scripts/scrumcheck.mjs   (G=games ON, default 36; SKIP_LIVE=1 skips 5)
import { gameUrl, launch } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'

const G = +(process.env.G || 36)
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__simGameV2 && !!window.__FieldSim, null, { timeout: 40000 })
await page.waitForTimeout(1000)

// ================= 1-4. the engine: sample games =================
const sample = (games, tune) => page.evaluate(({ games, tune }) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.pos = 'RB'
  const keep = Object.assign({}, window.RIB_TUNE || {})
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, tune)
  const V0 = JSON.stringify([window.__V177A || null, window.__V177B || null])
  const FS = window.__FieldSim, rec = [], o = {}
  for (const name of ['run', 'pass']) { o[name] = FS[name]; FS[name] = function (...a) { const r = o[name].apply(FS, a); const q = FS._Q; if (q && q.length && r) rec.push({ log: q[q.length - 1].log, yards: r.yards, kind: name }); return r } }
  try { for (let g = 0; g < games; g++) window.__simGameV2(45 + (g % 9) * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g % 5]) }
  finally { FS.run = o.run; FS.pass = o.pass; window.RIB_TUNE = keep }
  const V1 = JSON.stringify([window.__V177A || null, window.__V177B || null])
  const at = (fr, t) => { let b = fr[0]; for (const f of fr) { if (f.t <= t + 1e-6) b = f; else break } return b }
  const R = { plays: 0, runs: 0, runYd: 0, ev177: 0, hookMoved: V0 !== V1,
    scrums: 0, ends: 0, flipsEv: 0, osc: [], menTicks: 0, menMoved: 0, joinOff: 0, joinDef: 0, yd: [], ydMax: 0,
    credBad: 0, credChecked: 0, gripN: 0, gripMovers: 0, gripBystanders: 0,
    brk: 0, brkCaught: 0, brkBack: 0, brkLat: 0, brkChecked: 0, brkGrabbers: 0, brkLoss: 0, brkEnd: 0, worst: [] }
  for (const { log, yards, kind } of rec) {
    if (!log || !log.events) continue
    R.plays++; if (kind === 'run') { R.runs++; R.runYd += yards || 0 }
    const Aid = {}; for (const a of log.actors) Aid[a.id] = a
    const ev = log.events
    let open = null
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i]
      if (/V177[AB]$/.test(e.type)) R.ev177++
      // 2. THE CROWD MOVES: from a grab to the next tackle/escape, the men who are nowhere near the pile
      if (e.type === 'grab') {
        const c = Aid[e.carrier], end = ev.slice(i + 1).find(q => q.carrier === e.carrier && /^(tackle|gripBreak|escapeV153A|scrumV177A|breakFreeV177B)$/.test(q.type))
        if (c && end && end.t - e.t >= 99) {
          R.gripN++
          const c0 = at(c.frames, e.t)
          for (const a of log.actors) { if (a === c || a.id === e.who) continue
            const p0 = at(a.frames, e.t), p1 = at(a.frames, end.t - 1)
            if (Math.hypot(p0.x - c0.x, p0.y - c0.y) < 40) continue
            R.gripBystanders++; if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 0.3) R.gripMovers++ }
        }
      }
      if (e.type === 'scrumV177A') { R.scrums++; open = { e, men: new Set([e.carrier].concat(e.def || [])), sup: new Set((e.sup || []).concat(e.def || [])) } }
      if (e.type === 'scrumJoinV177A') { if (e.side === 'off') R.joinOff++; else R.joinDef++; if (open) open.men.add(e.who) }
      if (e.type === 'pileOn' && open) open.sup.add(e.who)
      if (e.type === 'scrumSurgeV177A') R.flipsEv++
      if (e.type === 'scrumEndV177A' && open) {
        const c = Aid[e.carrier]
        if (!e.broke) { R.ends++; R.yd.push([e.pOff - e.pDef, e.yd]); R.ydMax = Math.max(R.ydMax, Math.abs(e.yd)) }
        if (c) {
          // the carrier's own frames through the scrum: how many times the pile changed direction
          const dir = c.side === 'off' ? 1 : -1, fr = c.frames.filter(f => f.t >= open.e.t && f.t <= e.t)
          let last = 0, flips = 0
          for (let k = 1; k < fr.length; k++) { const d = (fr[k].x - fr[k - 1].x) * dir, s = d > .15 ? 1 : d < -.15 ? -1 : 0; if (s && last && s !== last) flips++; if (s) last = s }
          if (!e.broke && fr.length > 8) R.osc.push(flips)
          // the men in it never stand still
          for (const id of open.men) { const a = Aid[id]; if (!a) continue
            const f2 = a.frames.filter(f => f.t > open.e.t + 60 && f.t <= e.t)
            for (let k = 1; k < f2.length; k++) { R.menTicks++; if (Math.hypot(f2[k].x - f2[k - 1].x, f2[k].y - f2[k - 1].y) > .05) R.menMoved++ } }
        }
        if (!e.broke) {
          // stat-credit truth: the tackle that follows names only the wrap's men and the v103 joiners
          const tk = ev.slice(i + 1).find(q => q.type === 'tackle' && q.carrier === e.carrier)
          if (tk) { R.credChecked++
            if (tk.tackler !== open.e.by || (tk.sup || []).some(id => !open.sup.has(id))) R.credBad++ }
        }
        open = null
      }
      if (e.type === 'breakFreeV177B') {
        R.brk++
        const c = Aid[e.carrier]; if (!c) continue
        const dir = c.side === 'off' ? 1 : -1, p0 = at(c.frames, e.t), p1 = at(c.frames, e.t + 200), p2 = at(c.frames, e.t + 500)
        const tk = ev.slice(i + 1).find(q => q.type === 'tackle' && q.carrier === e.carrier)
        if (tk && tk.t - e.t < 200) continue   // caught on the spot: nothing to measure
        R.brkChecked++
        if ((p1.x - p0.x) * dir < -0.5) R.brkBack++
        const caught = ev.slice(i + 1).find(q => q.carrier === e.carrier && /^(grab|tackle)$/.test(q.type))   // run down (or wrapped again) before he could get round
        if (caught && caught.t - e.t < 500) R.brkCaught++
        else if (Math.abs(p2.y - p0.y) >= 8) R.brkLat++; else if (R.worst.length < 6) R.worst.push({ back: +((p1.x - p0.x) * dir).toFixed(1), lat: +(p2.y - p0.y).toFixed(1), y: Math.round(p0.y), side: e.side, tk: tk ? Math.round(tk.t - e.t) : null })
        if (tk && tk.t - e.t < 450 && (e.from || []).includes(tk.tackler)) R.brkGrabbers++
        if (tk) { R.brkEnd++; if ((tk.x - e.x) * dir < 0) R.brkLoss++ }
      }
    }
  }
  R.ypc = +(R.runYd / Math.max(1, R.runs)).toFixed(3)
  return R
}, { games, tune })

const ON = await sample(G, {})
const OFFA = await sample(Math.max(8, Math.round(G / 3)), { v177Ascrum: 0 })
const OFFB = await sample(Math.max(10, Math.round(G / 2)), { v177Bbreak: 0 })
const brief = R => ({ plays: R.plays, scrums: R.scrums, ends: R.ends, brk: R.brk, ypc: R.ypc, joinOff: R.joinOff, joinDef: R.joinDef, grip: [R.gripMovers, R.gripBystanders] })
console.log('ON  :', JSON.stringify(brief(ON))); console.log('OFFA:', JSON.stringify(brief(OFFA))); console.log('OFFB:', JSON.stringify(brief(OFFB)))

ok(ON.plays > 800 && ON.scrums >= 100, 'sampled a real run of FieldSim snaps, and piles became scrums', `${ON.plays} plays, ${ON.scrums} scrums over ${G} games`)
const osc = ON.osc.slice().sort((a, b) => a - b), med = osc[osc.length >> 1] || 0, many = osc.filter(f => f >= 2).length
ok(med >= 2 && many >= osc.length * 0.7, 'the pile goes BACK AND FORTH: the carrier\'s own frames change direction several times', `median ${med} changes, ${many}/${osc.length} scrums with 2+, ${ON.flipsEv} surge events`)
ok(ON.menTicks > 500 && ON.menMoved >= ON.menTicks * 0.9, 'the men in a scrum never stand still', `${ON.menMoved}/${ON.menTicks} man-ticks moved`)
ok(ON.joinOff > 20 && ON.joinDef > 20, 'team-mates and defenders run in and join the scrum', { off: ON.joinOff, def: ON.joinDef })
{
  const rows = ON.yd.slice().sort((a, b) => a[0] - b[0]), n = Math.floor(rows.length / 3)
  const mean = a => a.reduce((s, r) => s + r[1], 0) / Math.max(1, a.length)
  const weak = mean(rows.slice(0, n)), strong = mean(rows.slice(rows.length - n)), all = mean(rows)
  const absMean = rows.reduce((s, r) => s + Math.abs(r[1]), 0) / Math.max(1, rows.length)
  ok(rows.length > 60 && strong - weak >= 0.8, 'the stronger side wins more ground: the offence\'s strongest-pushing third out-gains its weakest', `strong third ${strong.toFixed(2)} yd vs weak third ${weak.toFixed(2)} yd (all ${all.toFixed(2)}, n ${rows.length})`)
  ok(absMean >= 0.3 && absMean <= 2.2 && ON.ydMax <= 3.05, 'the swing is a few yards — never more than the cap', `mean |drift| ${absMean.toFixed(2)} yd, max ${ON.ydMax.toFixed(2)} yd`)
}
ok(ON.credChecked > 50 && ON.credBad === 0, 'stat-credit truth: a man who only joined to push is never the tackler or an assist', `${ON.credBad} bad of ${ON.credChecked}`)
ok(ON.gripBystanders > 200 && ON.gripMovers >= ON.gripBystanders * 0.6, 'through a grip the rest of the field keeps moving', `${ON.gripMovers}/${ON.gripBystanders} bystanders moved`)
const rate = ON.brk / Math.max(1, ON.scrums)
ok(ON.brk >= 5 && rate >= 0.015 && rate <= 0.12, 'he sometimes spins out of a scrum (a few in a hundred)', `${ON.brk} of ${ON.scrums} scrums (${(rate * 100).toFixed(1)}%)`)
ok(ON.brkChecked > 0 && ON.brkBack >= ON.brkChecked * 0.8, 'breaking free goes BACKWARDS out of the pile first', `${ON.brkBack}/${ON.brkChecked} moved back in the first 200ms`)
ok(ON.brkChecked - ON.brkCaught > 0 && ON.brkLat >= (ON.brkChecked - ON.brkCaught) * 0.8, '…then out to the side, looking for another way round', `${ON.brkLat}/${ON.brkChecked - ON.brkCaught} still loose at 500ms moved 8px+ sideways (${ON.brkCaught} wrapped up first) ${JSON.stringify(ON.worst)}`)
ok(ON.brkGrabbers === 0, 'the men he spun out of are beaten — none of them makes the stop straight after', ON.brkGrabbers)
ok(ON.brkEnd === 0 || ON.brkLoss > 0, 'it is a real risk: some break-frees are run down behind where he broke free', `${ON.brkLoss}/${ON.brkEnd} lost ground`)
ok(OFFA.ev177 === 0 && !OFFA.hookMoved, 'the kill switch TU("v177Ascrum", 0) emits none of it', { events: OFFA.ev177, hookMoved: OFFA.hookMoved })
ok(OFFA.gripBystanders > 50 && OFFA.gripMovers === 0, '…and the old grip comes back exactly: the bystanders freeze through it, as they did', `${OFFA.gripMovers}/${OFFA.gripBystanders} moved`)
ok(OFFB.scrums > 30 && OFFB.brk === 0, 'the kill switch TU("v177Bbreak", 0) keeps the scrum and never breaks free', { scrums: OFFB.scrums, brk: OFFB.brk })
ok(Math.abs(ON.ypc - OFFA.ypc) <= 1.2, 'the run game stays in a sane band (unseeded ON vs OFF — seeded scoreneutralcheck is the real gate)', `ON ${ON.ypc} vs OFF ${OFFA.ypc}`)

// ================= 5. the broadcast =================
if (!process.env.SKIP_LIVE) {
  const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
  async function step (t) {
    await page.evaluate(({ t, visSrc }) => {
      const vis = eval(visSrc)
      const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
      const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
        : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
          : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
    }, { t, visSrc: vis })
    await page.waitForTimeout(t === 'PLAN' ? 3000 : 800)
  }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
  let live = await waitLive(page, 60000)
  ok(live, 'the broadcast came up')
  if (live) {
    // fire a scrum on a live carrier: the two nearest defenders on him, the nearest team-mate behind him
    let fired = null
    for (let i = 0; i < 300 && !fired; i++) {
      fired = await page.evaluate(() => {
        const sc = window.__gridironScene, P = sc && sc.play
        if (!P || !P.script || !P.snapped || P.done || !(P.carrierId >= 0) || P.carrierId > 21) return null
        const cm = sc.markers[P.carrierId]; if (!cm || !cm.root || cm.forceState) return null
        const near = (same) => sc.markers.map((m, j) => ({ m, j })).filter(({ m, j }) => m && m.root && j !== P.carrierId && ((j < 11) === (P.carrierId < 11)) === same)
          .sort((a, b) => Math.hypot(a.m.sx - cm.sx, a.m.sy - cm.sy) - Math.hypot(b.m.sx - cm.sx, b.m.sy - cm.sy))
        const D = near(false).slice(0, 2), O = near(true).slice(0, 1)
        if (D.length < 2) return null
        const id = j => P.script.actors[j].id, cid = id(P.carrierId)
        sc.fireEvent({ __inj: true, type: 'scrumV177A', t: P.t, carrier: cid, by: id(D[0].j), def: D.map(d => id(d.j)), off: O.map(o => id(o.j)), ms: 900, dir: 1, drift: 0, x: cm.sx, y: cm.sy }, P)
        sc.fireEvent({ __inj: true, type: 'scrumSurgeV177A', t: P.t, carrier: cid, dir: -1, n: 1, x: cm.sx, y: cm.sy }, P)
        window.__SCRUM_INJ = { c: P.carrierId, men: [P.carrierId].concat(D.map(d => d.j), O.map(o => o.j)), cid, def: D.map(d => id(d.j)) }
        return window.__SCRUM_INJ
      })
      if (!fired) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(q => /^(CONTINUE|NEXT PLAY|NEXT)$/i.test((q.innerText || '').trim()) && q.offsetParent); if (b) b.click() }); await page.waitForTimeout(60) }
    }
    ok(!!fired, 'a scrum could be fired on a live carrier')
    if (fired) {
      const seen = { lean: 0, rock: new Set(), cells: new Set(), inScrum: 0, samples: 0, flat: [] }
      await page.waitForTimeout(150)   // let the field draw a few frames of it first (a loaded box draws slowly)
      for (let k = 0; k < 8; k++) {
        await page.waitForTimeout(45)
        const r = await page.evaluate(() => { const sc = window.__gridironScene, I = window.__SCRUM_INJ
          return I.men.map(j => { const m = sc.markers[j]; return m ? { on: !!m._scrumV177A && !m.forceState, lean: m._lean || 0, bx: m.body ? +m.body.x.toFixed(2) : 0, tex: m.tex || '', src: m._leanSrc || null, vis: m.root ? m.root.visible : null, j } : null }).filter(Boolean) })
        for (const q of r) { seen.samples++; if (q.on) { seen.inScrum++; if (Math.abs(q.lean) > 0.05) seen.lean++; else if (seen.flat.length < 4) seen.flat.push(q); seen.rock.add(q.bx); const mm = /_(run\d)$/.exec(q.tex); if (mm) seen.cells.add(mm[1]) } }
      }
      const H = await page.evaluate(() => window.__V177A_R || {})
      ok(seen.inScrum > 0 && seen.lean >= seen.inScrum * 0.8, 'every man in the scrum leans into it', `${seen.lean}/${seen.inScrum} samples leaning ${seen.flat.length ? JSON.stringify(seen.flat) : ''}`)
      ok(seen.cells.size >= 2 && H.frames > 0, 'his legs churn — the run cycle plays in place', `cells ${[...seen.cells].join(',')}, ${H.frames} frames`)
      ok(seen.rock.size >= 3 && H.rock > 0, 'the cluster rocks — the bodies sway toward the pile', `${seen.rock.size} distinct offsets, surges ${H.surges}`)
      const B = await page.evaluate(() => { const sc = window.__gridironScene, P = sc.play, I = window.__SCRUM_INJ, cm = sc.markers[I.c]
        sc.fireEvent({ __inj: true, type: 'breakFreeV177B', t: P.t, carrier: I.cid, from: I.def, x: cm.sx, y: cm.sy, side: 1 }, P)
        return { stag: I.def.map(id => sc.markers[sc.actorIdx(id)]).filter(m => m && m.forceState === 'stagger').length, cleared: I.men.every(j => !sc.markers[j]._scrumV177A), breaks: (window.__V177A_R || {}).breaks } })
      ok(B.stag === 2 && B.cleared && B.breaks > 0, 'a break-free staggers the men he left and ends the scrum on screen', B)
    }
  }
}

ok(errs.length === 0, 'no page errors', errs.slice(0, 3))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
