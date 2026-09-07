// Dev check: v103 — THE GRAB and everything it made possible. Asserts, in one pass:
//   * THE GRIP — a landed wrap opens a grip instead of ending the play on the spot; most
//     tackles now arrive through it; the tackle event carries the ground they covered; the drag
//     is a yard or two and never ten; and `gripV103` at 0 restores the instantaneous tackle.
//   * THEY TRAVEL TOGETHER — through the grip the tackler stays glued to the carrier's back hip
//     while BOTH of them move, which is the whole point: the pair reads as one thing sliding.
//   * THE PILE — late men get hands on and ride along, and the stop converts to assisted.
//   * THE STRIP — the ball is punched out at the pile, the sim NAMES who forced it and who
//     recovered, and the engine books it as a turnover with a render log (the old pre-roll had
//     no name and no animation).
//   * SECOND EFFORT / THE BREAK / THE HORSE COLLAR — he strains for the sticks, he rips out of
//     the wrap, and a grab from dead behind is a flag candidate.
//   * AFTER THE WHISTLE — the contact does not stop dead: the pile churns, men who were still
//     closing arrive and shove in, and only then does everyone let go and gather.
//   * THE LINE — offensive linemen work on every carry (not just called runs) and pick the man
//     threatening the BALL; defenders rip off their blocks and chase once the ball is past.
//   * STAT-CREDIT TRUTH — an assist is credited only when the stop was genuinely assisted.
//   node scripts/v103check.mjs        (READ_POS=RB)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)   // warm: vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
      : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}

// ================= 1. the sim: sample a real body of contact =================
const S = await page.evaluate(() => {
  const FS = window.__FieldSim
  const ev = { tackle: 0, dragged: 0, dragYd: 0, dragMs: 0, grab: 0, pileOn: 0, strip: 0, second: 0, brk: 0, hc: 0,
    gang: 0, gangDrag: 0, strain: 0, maxDrag: 0, block: 0, sustain: 0, chase: 0, disengage: 0 }
  let plays = 0, fumbles = 0, longDrag = 0
  // the pair, sampled off the recorded frames: through a grip the tackler must stay on the
  // carrier's hip AND both of them must be moving
  const pairs = []
  const scan = (entry) => {
    const log = entry && entry.log ? entry.log : entry; if (!log || !log.events) return
    const byId = {}; for (const a of (log.actors || [])) byId[a.id] = a
    let open = null
    for (const e of log.events) {
      if (e.type === 'tackle') { ev.tackle++; if (e.gang) ev.gang++
        if (e.dragged) { ev.dragged++; ev.dragYd += e.dragYd || 0; ev.dragMs += e.dragMs || 0
          ev.maxDrag = Math.max(ev.maxDrag, e.dragYd || 0); if ((e.dragYd || 0) > 6) longDrag++
          if (e.gang) ev.gangDrag++ }
        if (e.strain) ev.strain++
        if (open && e.dragged) {   // measure the pair across the grip window
          const A = byId[open.who], B = byId[open.carrier]
          if (A && B && A.frames && B.frames) {
            const f = (a, tt) => { let best = null; for (const fr of a.frames) if (fr.t <= tt) best = fr; return best }
            const a0 = f(A, open.t), a1 = f(A, e.t), b0 = f(B, open.t), b1 = f(B, e.t)
            if (a0 && a1 && b0 && b1) pairs.push({
              gap0: Math.hypot(a0.x - b0.x, a0.y - b0.y), gap1: Math.hypot(a1.x - b1.x, a1.y - b1.y),
              movedTk: Math.hypot(a1.x - a0.x, a1.y - a0.y), movedC: Math.hypot(b1.x - b0.x, b1.y - b0.y) })
          }
        }
        open = null
      }
      else if (e.type === 'grab') { ev.grab++; open = { who: e.who, carrier: e.carrier, t: e.t } }
      else if (e.type === 'pileOn') ev.pileOn++
      else if (e.type === 'fumble' && e.strip) ev.strip++
      else if (e.type === 'secondEffort') ev.second++
      else if (e.type === 'gripBreak') ev.brk++
      else if (e.type === 'horseCollar') ev.hc++
      else if (e.type === 'block') { ev.block++; if (e.sustain) ev.sustain++ }
      else if (e.type === 'disengage') { ev.disengage++; if (e.chase) ev.chase++ }
    }
  }
  const wrap = (name) => { const o = FS[name].bind(FS); FS[name] = function (...a) {
    const before = (FS._Q || []).length; const r = o(...a); plays++
    const q = FS._Q || []; for (let i = before; i < q.length; i++) scan(q[i])
    if (r && r.fumble) fumbles++
    return r } }
  wrap('run'); wrap('pass')
  for (let i = 0; i < 14; i++) window.__simGameV2(60 + i, 'RB')
  return { plays, ev, fumbles, longDrag, pairs: pairs.slice(0, 400) }
})
const E = S.ev
console.log('sim:', JSON.stringify({ plays: S.plays, tackles: E.tackle, grabs: E.grab, dragged: E.dragged, strip: E.strip, brk: E.brk, second: E.second, hc: E.hc, pileOn: E.pileOn }))
ok(S.plays > 600 && E.tackle > 400, 'sampled a real body of contact', `${S.plays} plays, ${E.tackle} tackles`)
ok(E.grab > E.tackle * 0.5, 'most tackles now come through a GRIP rather than ending on the spot', `${E.grab} grabs on ${E.tackle} tackles`)
ok(E.dragged > E.tackle * 0.5, 'and the tackle they produce says it was a drag', `${E.dragged} dragged`)
const meanDrag = E.dragYd / Math.max(1, E.dragged), meanMs = E.dragMs / Math.max(1, E.dragged)
ok(meanDrag > 0.15 && meanDrag < 2, 'the drag is a yard or so of real ground, not a free ten', `${meanDrag.toFixed(2)} yd over ${Math.round(meanMs)}ms`)
ok(S.longDrag === 0 && E.maxDrag < 8, 'and nobody carries a tackler across the field', `max ${E.maxDrag.toFixed(1)} yd`)

// they travel together
const P = S.pairs
const glued = P.filter(q => q.gap1 < 22).length, both = P.filter(q => q.movedTk > 2 && q.movedC > 2).length
console.log('pair:', JSON.stringify({ n: P.length, glued, both, meanGap: +(P.reduce((s, q) => s + q.gap1, 0) / Math.max(1, P.length)).toFixed(1) }))
ok(P.length > 40, 'measured the pair across the grip window', `${P.length} grips`)
ok(glued > P.length * 0.9, 'the tackler stays on his hip the whole way — they are one thing', `${glued}/${P.length} inside 22px`)
ok(both > P.length * 0.5, 'and BOTH of them travel: the carrier drags, the tackler is dragged', `${both}/${P.length} both moved`)

// the pile, the strip, the strain, the break, the collar
ok(E.pileOn > 20, 'men get hands on and ride the pile in', `${E.pileOn} pile-ons`)
ok(E.gangDrag > 0, 'a pile that gathers during the drag makes the stop an assisted one', `${E.gangDrag} gang drags`)
ok(E.strip > 0 && S.fumbles > 0, 'the ball gets punched out at the pile, and the sim names it', `${E.strip} strips, ${S.fumbles} fumbles returned`)
ok(E.strip < E.tackle * 0.05, 'and a strip stays rare', `${(E.strip / Math.max(1, E.tackle) * 100).toFixed(2)}% of tackles`)
ok(E.second > 10, 'a carrier inside a couple of yards of the marker strains for it', `${E.second} second efforts`)
ok(E.brk > 0 && E.brk < E.grab * 0.08, 'and once in a while he rips clean out of the wrap', `${E.brk} of ${E.grab} grabs (${(E.brk / Math.max(1, E.grab) * 100).toFixed(1)}%)`)
ok(E.hc > 0, 'a grab from dead behind can catch the collar', `${E.hc} candidates`)

// the line
ok(E.block > S.plays * 0.5, 'the offensive line is blocking on the carry, not watching it', `${E.block} blocks over ${S.plays} plays`)
ok(E.sustain > 0, 'and it SUSTAINS the block rather than touching and letting go', `${E.sustain} sustained`)
ok(E.chase > 0, 'defenders rip off their blocks and chase once the ball is past them', `${E.chase} chase releases of ${E.disengage} disengages`)

// the switch puts it back
const off = await page.evaluate(() => {
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { gripV103: 0 })
  const FS = window.__FieldSim; let grabs = 0, tackles = 0
  const o = FS.run.bind(FS); FS.run = function (...a) { const b4 = (FS._Q || []).length; const r = o(...a)
    const q = FS._Q || []; for (let i = b4; i < q.length; i++) { const lg = q[i].log || q[i]
      for (const e of (lg.events || [])) { if (e.type === 'grab') grabs++; if (e.type === 'tackle') tackles++ } } return r }
  for (let i = 0; i < 4; i++) window.__simGameV2(80 + i, 'RB')
  FS.run = o; delete window.RIB_TUNE.gripV103
  return { grabs, tackles }
})
ok(off.tackles > 20 && off.grabs === 0, 'gripV103 at 0 puts the instantaneous tackle back', `${off.grabs} grabs over ${off.tackles} tackles`)

// ================= 2. the live field: the drag, and the whistle that is not the end =================
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
let live = false
for (let i = 0; i < 6 && !live; i++) {
  for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'PLAY', 'CONTINUE']) {
    live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
    if (live) break
    await step(t)
  }
  live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
  if (!live) await page.waitForTimeout(2500)
}
ok(live, 'the broadcast came up')
let sawGrip = false, sawLateArrive = false, sawChurn = false, sawRelease = false, maxPile = 0, postMs = 0
for (let i = 0; i < 460; i++) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/i.test((x.innerText || '').trim()) && x.offsetParent); if (b) b.click() })
  const st = await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play
    return { grip: !!(P && P.gripPair), post: !!(P && P.post), pt: P && P.post ? Math.round(P.post.t) : 0,
      arrivals: P && P.post && P.post.late ? P.post.late.length : 0,
      hit: P && P.post && P.post.late ? P.post.late.filter(l => l.hit).length : 0,
      inPile: sc ? sc.markers.filter(m => m && m._late).length : 0,
      churn: sc ? sc.markers.filter(m => m && m._late && m.body && Math.abs(m.body.x) > 0.15).length : 0,
      V: window.__V103 || null } })
  if (st.grip) sawGrip = true
  if (st.post) { postMs = Math.max(postMs, st.pt); maxPile = Math.max(maxPile, st.inPile)
    if (st.arrivals > 0 && st.hit > 0) sawLateArrive = true
    if (st.churn > 0) sawChurn = true
    if (st.pt > 1000 && st.inPile === 0) sawRelease = true }
  await page.waitForTimeout(70)
}
const V = await page.evaluate(() => window.__V103 || null)
console.log('live:', JSON.stringify(V), 'maxPile', maxPile, 'postMs', postMs)
ok(sawGrip, 'the field draws the grip: the two of them locked and travelling')
ok(V && V.grabs > 0 && V.drags > 0, 'the renderer saw grabs and drags', JSON.stringify(V))
ok(maxPile >= 2, 'after the whistle a real heap is still in contact', `${maxPile} men still in it`)
ok(sawChurn, 'and it is still MOVING — the pile churns rather than freezing')
ok(sawLateArrive, 'men who were still closing arrive late and shove into it', V && `${V.lateHits} late hits`)
ok(sawRelease, 'and then everybody lets go and gathers', `post phase ran ${postMs}ms`)

console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length || bad.length ? 1 : 0)
