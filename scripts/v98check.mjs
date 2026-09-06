// Dev check: v98 UNDER THE LIGHTS — the masts stay put (two sway), the lamps glow, beam and
// pool on the field, the turf carries the lamps' light and a darker sky; the scorebug wears
// the two teams' palettes; the legend and the pulse bars are gone from the live screen; the
// stands throw emoji; the camera cuts to the new carrier on a handover; the post-game card
// quotes the coach-trust swing that then actually lands; the depth slider steps by 1%.
//   node scripts/v98check.mjs        (READ_POS=RB, V98_SHOTS=1 saves scripts/_v98_*.png)
import { chromium } from 'playwright'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function newPage() {
  const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)   // warm: vite's one-time reload after an edit
  return page
}
async function step(page, t) { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e))) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }); console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
const SHOTS = !!process.env.V98_SHOTS
const snap = async (page, path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } })); if (src) fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) }

// ================= Part 1: the live field =================
const page = await newPage()
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(page, t)
await page.waitForFunction(() => window.__V92 && window.__V92.loaded && window.__V92.on, null, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(600)
const coachBefore = await page.evaluate(() => { const st = window.__getGridironState ? window.__getGridironState() : window.o; return Math.round((st.experience95 || {}).coach || 50) })

// the live screen: no legend, no pulse bars, a scorebug in the kits' colours
const dom = await page.evaluate(() => {
  const cs = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).color : null }
  const bg = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundImage : null }
  return { legend: !!document.querySelector('.field-legend'), pulse: !!document.querySelector('.live-pulse'), usSc: cs('.sb-side.us .sc'), themSc: cs('.sb-side.them .sc'),
    usBg: bg('.sb-side.us'), themBg: bg('.sb-side.them'), bug: window.__SCOREBUG_V98 || null,
    vars: ['--sbUs1', '--sbUs2', '--sbUsSc', '--sbThem1', '--sbThem2', '--sbThemSc'].map(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim()) } })
console.log('scorebug:', JSON.stringify(dom))
ok(!dom.legend, 'the colour legend is gone from the live screen')
ok(!dom.pulse, 'the COACH TRUST / FAN HYPE bars are gone from the live screen')
ok(dom.bug && dom.vars.every(Boolean), 'the scorebug palette variables are set from the two kits', JSON.stringify(dom.vars))
ok(dom.usSc && dom.usSc !== 'rgb(87, 224, 122)' && dom.usSc === dom.bug.usSc.replace(/,/g, ', '), 'our score glows in our palette, not the old green', dom.usSc)
ok(dom.themSc && dom.themSc !== 'rgb(255, 90, 90)' && dom.themSc === dom.bug.themSc.replace(/,/g, ', '), 'their score glows in their palette, not the old red', dom.themSc)
ok(dom.bug && dom.bug.us[0].toLowerCase() !== dom.bug.them[0].toLowerCase(), 'the two sides carry different primaries', dom.bug && dom.bug.us[0] + ' vs ' + dom.bug.them[0])
ok(dom.usBg && !/rgba\(28, 90, 48/.test(dom.usBg) && dom.themBg && !/rgba\(112, 32, 36/.test(dom.themBg), 'the side backgrounds are mixed from the palettes, not the fixed green and red')

// the stadium: sample across plays
const samples = []
for (let i = 0; i < 26; i++) {
  await page.waitForTimeout(600)
  samples.push(await page.evaluate(() => { const V = window.__V92 || {}; return { t: V.towerBoxes ? V.towerBoxes() : [], L: V.lights ? V.lights() : [], bowl: V.bowl, emoji: window.__EMOJI_V98 || null, cuts: (window.__CAMCUT_V98 || {}).cuts || 0, los: window.__gridironScene && window.__gridironScene._lastField && window.__gridironScene._lastField[0] } }))
}
const towersY = samples.map(s => s.t.map(t => t.y).join(',')), losSeen = new Set(samples.map(s => s.los)), botSeen = new Set(samples.map(s => s.bowl && s.bowl.bot))
console.log('towers y over time:', [...new Set(towersY)].join(' | '), ' LOS seen:', [...losSeen].join(','), ' bowl bottoms:', [...botSeen].join(','))
ok(samples[0].t.length === 4 && new Set(towersY).size === 1, 'the four masts keep one row across every snap', `rows=${[...new Set(towersY)].length} snaps=${losSeen.size}`)
const S0 = samples[0]
ok(S0.t.every(t => t.y <= (S0.bowl.bot + 8) && t.y >= S0.bowl.top), 'the fixed row is still inside the bowl band, so the stand hides the feet', `y=${S0.t[0].y} band=${S0.bowl.top}..${S0.bowl.bot}`)
const swayers = S0.t.map((t, i) => ({ i, sway: t.sway, xs: new Set(samples.map(s => s.t[i] && s.t[i].x)) }))
ok(swayers.filter(w => w.sway > 0).length === 2 && swayers.filter(w => !w.sway).length === 2, 'two masts sway and two stand still', JSON.stringify(swayers.map(w => [w.i, w.sway])))
ok(swayers.filter(w => w.sway > 0).every(w => w.xs.size > 1 && Math.max(...w.xs) - Math.min(...w.xs) <= 8), 'the swaying masts drift a few pixels and no more', JSON.stringify(swayers.filter(w => w.sway).map(w => [...w.xs])))
ok(swayers.filter(w => !w.sway).every(w => w.xs.size === 1), 'the still masts do not move at all')
const L0 = S0.L
ok(L0.length === 4 && L0.every(l => l.glow && l.beam && l.pool), 'every mast carries a glow, a beam and a pool', `rigs=${L0.length}`)
ok(L0.every(l => l.glow.y < S0.t[0].y - 100 && l.glow.a > 0.3), 'the glows sit up at the lamp heads and are lit', JSON.stringify(L0.map(l => [l.glow.y, l.glow.a])))
ok(L0.every(l => l.beam.len > 200 && l.beam.a > 0.1 && l.beam.depth > 3.45), 'the beams reach down from the heads over the bowl toward the field', JSON.stringify(L0.map(l => [l.beam.len, l.beam.rot, l.beam.a])))
ok(L0.every(l => l.pool.y > 340 && l.pool.depth > 0.6 && l.pool.depth < 0.8 && l.pool.a > 0.05), 'the pools lie on the turf between the grass and the paint', JSON.stringify(L0.map(l => [l.pool.x, l.pool.y, l.pool.depth])))
const glowA = samples.map(s => s.L[1] && s.L[1].glow.a)
ok(new Set(glowA).size > 3 && Math.max(...glowA) - Math.min(...glowA) > 0.05 && Math.max(...glowA) - Math.min(...glowA) < 0.3, 'the light breathes: the glow alpha moves, but never flashes', `range=${Math.min(...glowA)}..${Math.max(...glowA)}`)
ok(samples[samples.length - 1].emoji && samples[samples.length - 1].emoji.spawned > 0, "the stands threw emoji at the play", JSON.stringify(samples[samples.length - 1].emoji))
ok(samples[samples.length - 1].cuts > 0, 'the camera cut to a new carrier at least once', `cuts=${samples[samples.length - 1].cuts}`)

// the sky and the turf, read off the warped canvas
const px = await page.evaluate(() => {
  const sc = window.__gridironScene, cv = sc._warpCv, c = cv.getContext('2d')
  const rd = (x, y) => { const d = c.getImageData(x, y, 1, 1).data; return (d[0] + d[1] + d[2]) / 3 }
  const rowAvg = (y, x0, x1) => { let s = 0, n = 0; for (let x = x0; x < x1; x += 8) { s += rd(x, y); n++ } return s / n }
  const on = { sky: rd(600, 4), far: rowAvg(440, 420, 780), nearCorner: rowAvg(cv.height - 60, 60, 220), mid: rowAvg(1200, 420, 780) }
  window.RIB_TUNE.fieldLightV98 = 0; sc.warpField()
  const off = { sky: rd(600, 4), far: rowAvg(440, 420, 780), nearCorner: rowAvg(cv.height - 60, 60, 220), mid: rowAvg(1200, 420, 780) }
  delete window.RIB_TUNE.fieldLightV98; sc.warpField()
  return { on, off, h: cv.height } })
console.log('pixels:', JSON.stringify(px))
ok(px.on.sky < 6, 'the sky above the far end line is near black', `sky=${px.on.sky.toFixed(1)}`)
ok(px.on.far > px.off.far + 4, 'the far end of the turf is lit warmer under the lamps', `far on=${px.on.far.toFixed(1)} off=${px.off.far.toFixed(1)}`)
ok(px.on.nearCorner < px.off.nearCorner - 4, 'the near corners fall off into shadow', `corner on=${px.on.nearCorner.toFixed(1)} off=${px.off.nearCorner.toFixed(1)}`)
ok(Math.abs(px.on.mid - px.off.mid) < 18, 'mid-field keeps its reading brightness', `mid on=${px.on.mid.toFixed(1)} off=${px.off.mid.toFixed(1)}`)
if (SHOTS) {
  await page.evaluate(async () => { const sc = window.__gridironScene, c = sc.cameras.main; sc.scene.pause(); c.setZoom(0.9); c.centerOn(360, 330); await new Promise(r => setTimeout(r, 300)) })
  await snap(page, 'scripts/_v98_farend.png')
  await page.evaluate(async () => { const sc = window.__gridironScene; sc.scene.resume() })
  await page.screenshot({ path: 'scripts/_v98_live.png' })
}

// the whistle: the post-game card quotes the coach-trust swing, then it lands
let card = false
for (let i = 0; i < 160 && !card; i++) {
  card = await page.evaluate(() => !!document.getElementById('pgOverlayV13'))
  if (!card) {
    // whatever is in front of the field goes first: the training roll's CONTINUE, the growth wheel, the players-to-watch panel
    const cleared = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return 'wheel' }
      if (document.getElementById('pregameV1513') && window.continuePregameV1513) { window.continuePregameV1513(); return 'pregame' }
      const b = [...document.querySelectorAll('button')].find(e => /^CONTINUE$/i.test((e.innerText || '').trim()) && e.getBoundingClientRect().height > 0); if (b) { b.click(); return 'continue' } return null })
    if (!cleared) { try { await page.locator('button', { hasText: 'SKIP' }).first().click({ timeout: 500 }) } catch (e) {} }
    await page.waitForTimeout(500) }
}
const cd = await page.evaluate(() => { const el = document.getElementById('pgCoachV98'); if (!el) return null; const b = el.querySelector('b'); const st = window.__getGridironState ? window.__getGridironState() : window.o
  return { text: (el.innerText || '').replace(/\s+/g, ' ').trim(), delta: parseInt(b.textContent, 10), coach: Math.round((st.experience95 || {}).coach || 50), score: (document.getElementById('pgScore') || {}).textContent, title: (document.querySelector('#pgOverlayV13 .decision-title') || {}).textContent } })
console.log('card:', JSON.stringify(cd))
ok(card && cd, 'the post-game card carries a COACH TRUST row', cd && cd.text)
ok(cd && Number.isFinite(cd.delta) && /^[+-]?\d+$/.test(String(cd.delta)) && (cd.delta === 0 || /\+|−|-/.test(cd.text)), 'the row states a signed swing', cd && cd.delta)
ok(cd && cd.coach === coachBefore, 'the swing is a preview: trust has not moved while the card is up', cd && `${cd.coach} vs ${coachBefore}`)
if (SHOTS) await page.screenshot({ path: 'scripts/_v98_card.png', fullPage: true })
await page.evaluate(() => window.__pgContinueV13 && window.__pgContinueV13()); await page.waitForTimeout(1200)
const after = await page.evaluate(() => { const st = window.__getGridironState ? window.__getGridironState() : window.o; const wr = (st.player.weekResults || []).find(w => w && w.played); return { coach: Math.round((st.experience95 || {}).coach || 50), rec: wr && wr.coachDelta98, won: wr && wr.won, perf: wr && wr.perf } })
console.log('after:', JSON.stringify(after), 'before:', coachBefore)
ok(cd && after.coach === Math.max(0, Math.min(100, coachBefore + cd.delta)), 'the swing the card quoted is the swing that landed', `${coachBefore} ${cd && (cd.delta >= 0 ? '+' : '')}${cd && cd.delta} -> ${after.coach}`)
ok(after.rec === (cd && cd.delta), 'the week records the swing it applied', `rec=${after.rec}`)

// ================= Part 2: the depth slider =================
const st2 = await page.evaluate(() => { try { window.go('settings') } catch (e) {} const el = document.querySelector('input.fx-slider[oninput*="fxDepth"]'); return el ? { step: el.step, min: el.min, max: el.max } : null })
console.log('depth slider:', JSON.stringify(st2))
ok(st2 && st2.step === '0.01' && st2.max === '0.9', 'the depth slider steps by one percent up to 90', st2 && `step=${st2.step} max=${st2.max}`)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
