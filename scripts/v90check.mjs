import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
/* v90 — the rolls happen in the background; the upgrade sheet rounds; the ring fills to the soft max (v134; it was out of 250).
 *   node scripts/v90check.mjs   (dev server on :5173) */
const browser = await chromium.launch({ executablePath: CHROME })
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 } })).newPage()
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 25000 }); await page.waitForTimeout(1200)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const click = async (t) => { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis }); await page.waitForTimeout(700); return r }
await click('START NEW CAREER')
for (let i = 0; i < 8; i++) {
  const done = await page.evaluate(({ visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false } }
    const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (card) { card.click(); return false } return true }, { visSrc: vis })
  await page.waitForTimeout(450); if (done) break
}
await click('PLAY 8-GAME SEASON'); await click('Balanced Program'); await click('CONFIRM TRAINING')
await page.evaluate(() => { document.getElementById('growthV42')?.remove(); window.go('season') }); await page.waitForTimeout(500)

// ---- 1. a queued story stage no longer stops sim-the-rest: it is answered and rolled in the background
const sim = await page.evaluate(async () => {
  const pl = window.S.player; const c = pl.conditionV11 || {}; c.fatigue = 10; c.injury = null
  const queued = window.__V90.queueStage(pl, 0)
  const before = (pl.storyDecisionQueueV11 || []).length
  window.simRemainingWeeks()
  await new Promise(r => setTimeout(r, 1500))
  const reg = pl.weekResults.filter(w => !w.playoff)
  return { queued: !!queued, before, after: (pl.storyDecisionQueueV11 || []).length, played: reg.filter(w => w.played).length, total: reg.length,
    rolls: window.__V90.last, onWeeks: reg.flatMap(w => w.autoRollsV90 || []).length, overlay: !!document.querySelector('.story-overlay-v11'), decisionCount: pl.decisionCount || 0, view: window.S.view,
    silentError: (window.__V85 && window.__V85.lastSilentError) || null }
})
console.log('sim:', JSON.stringify(sim).slice(0, 600))
ok(sim.queued && sim.before >= 1, 'a real story stage was queued before the sim', `queued=${sim.before}`)
ok(sim.played === sim.total, 'sim-the-rest played every regular-season week with a stage in the queue', `${sim.played}/${sim.total}${sim.silentError ? ' silent error: ' + sim.silentError.slice(0, 120) : ''}`)
ok(sim.after === 0 && sim.rolls.length >= 1 && sim.onWeeks >= 1, 'the stage was answered and rolled in the background, recorded on the week', `rolls=${sim.rolls.length} onWeeks=${sim.onWeeks} left=${sim.after}`)
ok(!sim.overlay && sim.view === 'season' && sim.decisionCount >= 1, 'no story card on screen afterwards, and the arc advanced through the game\'s own resolver', `overlay=${sim.overlay} view=${sim.view} decisions=${sim.decisionCount}`)
ok(sim.rolls.every(r => typeof r.success === 'boolean' && r.choice), 'every background roll names its choice and its outcome', JSON.stringify(sim.rolls[0] || {}))

// ---- 1b. an DFL life event (they queue every third week at the DFL) is answered by the same drain
const life = await page.evaluate(() => {
  const pl = window.S.player; const keep = pl.level
  const ev = window.__V90.queueLife(pl, 3)
  const a = pl.lifeV12; const cashBefore = a && a.cash; const resolvedBefore = a ? a.resolvedEvents.length : 0
  const out = window.__V90.drainLife(pl, null)
  const res = { queued: !!ev, choices: ev ? ev.choices.length : 0, drained: out.length, left: a ? a.eventQueue.length : -1, kind: out[0] && out[0].kind, choice: out[0] && out[0].choice,
    cashMoved: a && a.cash !== cashBefore, resolvedGrew: a && a.resolvedEvents.length > resolvedBefore, overlay: !!document.querySelector('.life-event-overlay-v12') }
  pl.level = keep
  return res
})
console.log('life:', JSON.stringify(life))
ok(life.queued && life.choices >= 2 && life.drained === 1 && life.left === 0, 'a queued DFL life event is answered in the background through the game\'s own resolver', JSON.stringify(life))
ok(life.kind === 'life' && !!life.choice && (life.cashMoved || life.resolvedGrew) && !life.overlay, 'the answer is recorded, its effect applied, and no card is left on screen', `choice="${life.choice}"`)

// ---- 2. the choice rule: safest by default, boldest at 1
const rule = await page.evaluate(() => {
  const stage = { choices: [{ id: 'a', label: 'A', baseChance: .5 }, { id: 'b', label: 'B', baseChance: .9 }, { id: 'c', label: 'C', baseChance: .3 }] }
  return { safe: window.__V90.pick(stage, 0).id, bold: window.__V90.pick(stage, 1).id, mid: window.__V90.pick(stage, .5).id }
})
ok(rule.safe === 'b' && rule.bold === 'c' && rule.mid === 'a', 'the rule picks the safest at 0, the boldest at 1, the middle between', JSON.stringify(rule))

// ---- 3. the upgrade sheet shows whole numbers, and spending a point lands on a whole number
const up = await page.evaluate(() => {
  const pl = window.S.player; const k = Object.keys(pl.attrs)[0]; pl.attrs[k] = 41.37; pl.points = Math.max(pl.points || 0, 3)
  window.go('upgrade')
  const shown = [...document.querySelectorAll('.uv')].map(e => e.textContent.trim())
  const el = document.getElementById('uv-' + k); const beforeText = el && el.textContent.trim()
  window.alloc(k, 1)
  return { shown, allInts: shown.every(v => /^-?\d+$/.test(v)), beforeText, afterText: el && el.textContent.trim(), stored: pl.attrs[k] }
})
console.log('upgrade:', JSON.stringify(up).slice(0, 300))
ok(up.allInts, 'every attribute on the upgrade sheet is a whole number', up.shown.slice(0, 6).join(' '))
ok(up.beforeText === '41' && up.afterText === '42' && up.stored === 42, 'a fractional 41.37 shows as 41 and one point makes it exactly 42', `${up.beforeText} → ${up.afterText} (stored ${up.stored})`)

// ---- 4. the menu ring
/* v150 B: since v134 the ring is drawn against the player's SOFT MAX (the feed's `softMaxOvr`), not a flat 250 — a
 * young player's arc used to be an unreadable sliver of a 250-point circle — and since v147 B `ringArcV147B` is the
 * ONE place the arc is decided (k = max(.055, ovr/softMax), a gold lap `--rib-ovr2` past it). So the ring must carry
 * exactly the k that function gives for the feed's own OVR and soft max, and that k must be ovr/softMax (not /250). */
await page.evaluate(() => window.go('menu')); await page.waitForSelector('#rib-main-menu-v2 .rib9-ring')
await page.waitForFunction(() => { const g = document.querySelector('.rib9-ring'); return g && parseFloat(g.style.getPropertyValue('--rib-ovr')) > 0 }, null, { timeout: 15000 }).catch(() => {})
const ring = await page.evaluate(() => { const r = document.querySelector('.rib9-ring'); const P = (window.__RIB_MENU_DATA_V89() || {}).player || {}
  const ovr = Number(P.ovr) || 0, sm = Number(P.softMaxOvr) || 0, want = window.__V147B.ringArc(null, ovr, sm > 0 ? sm : 250, false)
  return { ovr, softMax: sm, arc: parseFloat(r.style.getPropertyValue('--rib-ovr')), arc2: parseFloat(r.style.getPropertyValue('--rib-ovr2')) || 0, k: want.k, k2: want.k2 } })
ok(ring.softMax > 0 && Math.abs(ring.arc - ring.k) < 0.002 && Math.abs(ring.arc2 - ring.k2) < 0.002 && Math.abs(ring.k - Math.max(0.055, Math.min(1, ring.ovr / ring.softMax))) < 0.002,
  'the OVR ring fills ovr/softMaxOvr of the circle (v134), exactly as ringArcV147B says', `ovr=${ring.ovr} softMax=${ring.softMax} arc=${ring.arc.toFixed(3)} gold=${ring.arc2.toFixed(3)}`)

console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errs.length ? errs : 'none')
if (fail || errs.length) process.exit(1)
