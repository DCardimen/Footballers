// Dev check: v100 THE LIGHTING DIAL — one slider in Settings › FIELD VIEW for how hard the
// stadium is lit. Asserts the row exists with the right range and reads as a whole percent,
// that moving it lands on window.__FIELD_FX.light and persists in the save, that Reset puts it
// back, and — on the live field — that the dial actually moves the light: the masts' glow,
// beams and pools scale with it (and switch off at 0), the turf's baked wash brightens with it
// while the corners go deeper as it comes down, and every shadow deepens with it while keeping
// a floor of ambient weight at 0.
//   node scripts/v100check.mjs        (READ_POS=RB, V100_SHOTS=1 saves scripts/_v100_*.png)
import { chromium } from 'playwright'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)   // warm: vite's one-time reload after an edit
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e))) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }); console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }

// ================= Part 1: the row in Settings =================
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS']) await step(t)
const row = await page.evaluate(() => { try { window.go('settings') } catch (e) {}
  const el = document.querySelector('input.fx-slider[oninput*="fxLight"]'); if (!el) return null
  const wrap = el.closest('.fx-row')
  return { min: el.min, max: el.max, step: el.step, value: el.value, label: wrap.querySelector('.fx-label').textContent.trim(),
    val: wrap.querySelector('.fx-val').textContent.trim(), desc: wrap.querySelector('.fx-desc').textContent.trim().slice(0, 60),
    section: (el.closest('.card').querySelector('.l') || {}).textContent } })
console.log('row:', JSON.stringify(row))
ok(row, 'a lighting slider is on the settings screen')
ok(row && /FIELD VIEW/.test(row.section || ''), 'it sits in the FIELD VIEW card with the other field dials', row && row.section)
ok(row && /light/i.test(row.label), 'it is labelled for what it does', row && row.label)
ok(row && row.min === '0' && row.max === '2' && row.step === '0.05', 'it runs from off to double, in 5% steps', row && `${row.min}..${row.max} step ${row.step}`)
ok(row && row.val === '100%' && !/\./.test(row.val), 'it starts at 100% and reads as a whole percent', row && row.val)

// moving it lands on the live dial, persists, and resets
const moved = await page.evaluate(() => { window.fieldFxSet('fxLight', '1.6', 1)
  const st = window.__getGridironState ? window.__getGridironState() : window.o
  return { fx: window.__FIELD_FX.light, saved: st.settings.fxLight, label: document.getElementById('fxLight_val').textContent.trim() } })
console.log('moved:', JSON.stringify(moved))
ok(moved.fx === 1.6 && moved.saved === 1.6, 'moving it drives __FIELD_FX.light and is written to the save', JSON.stringify(moved))
ok(moved.label === '160%', 'and the row reads it back', moved.label)
const reloaded = await page.evaluate(async () => { const st = window.__getGridironState ? window.__getGridironState() : window.o; return st.settings.fxLight })
ok(reloaded === 1.6, 'the setting survives in state for the next game', String(reloaded))
const reset = await page.evaluate(() => { window.fieldFxReset(); const st = window.__getGridironState ? window.__getGridironState() : window.o
  return { fx: window.__FIELD_FX.light, saved: st.settings.fxLight, label: (document.getElementById('fxLight_val') || {}).textContent } })
ok(reset.fx === 1 && reset.saved == null, 'Reset to defaults puts the lights back to 100%', JSON.stringify(reset))

// ================= Part 2: the dial on the live field =================
await page.evaluate(() => { try { window.go('hub') } catch (e) {} }); await page.waitForTimeout(900)
for (const t of ['PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
await page.waitForFunction(() => window.__V99 && window.__V92 && window.__V92.on, null, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(700)
const read = async (v) => page.evaluate(async (v) => {
  window.fieldFxSet('fxLight', String(v), 0)
  await new Promise(r => setTimeout(r, 260))
  const sc = window.__gridironScene, V = window.__V92, W = window.__V99
  sc.updateStadiumV92(16)
  const cv = sc._warpCv, c = cv.getContext('2d')
  const rowAvg = (y, x0, x1) => { let s = 0, n = 0; for (let x = x0; x < x1; x += 8) { const d = c.getImageData(x, y, 1, 1).data; s += (d[0] + d[1] + d[2]) / 3; n++ } return +(s / n).toFixed(1) }
  const m = sc.markers.find(m => m && m.shadow); const sh = m.shadow
  sc.castShadowV99(sh, m.root.x, m.root.y, 21, {})
  return { dial: W.dial(), lights: V.lights().map(l => ({ g: l.glow.a, b: l.beam.a, p: l.pool.a })), mast: V.towerBoxes()[0].tint,
    far: rowAvg(440, 420, 780), corner: rowAvg(cv.height - 60, 60, 220), shadow: +sh.alpha.toFixed(3) }
}, v)
const off = await read(0), one = await read(1), full = await read(2)
console.log('0%:  ', JSON.stringify(off)); console.log('100%:', JSON.stringify(one)); console.log('200%:', JSON.stringify(full))
ok(one.dial.light === 1 && full.dial.light === 2 && off.dial.light === 0, 'the scene reads the dial', JSON.stringify([off.dial.light, one.dial.light, full.dial.light]))
ok(off.lights.every(l => l.g === 0 && l.b === 0 && l.p === 0), 'at 0 the masts put their lights out', JSON.stringify(off.lights[0]))
ok(full.lights.every((l, i) => l.g > one.lights[i].g && l.b > one.lights[i].b && l.p > one.lights[i].p), 'at 200% every lamp burns harder than at 100%', JSON.stringify([one.lights[0], full.lights[0]]))
ok(full.far > one.far && one.far > off.far, 'the turf under the lamps brightens with the dial', `${off.far} < ${one.far} < ${full.far}`)
ok(off.corner < one.corner && one.corner < full.corner, 'and the far corners go deeper as the lights come down', `${off.corner} < ${one.corner} < ${full.corner}`)
ok(full.shadow > one.shadow && one.shadow > off.shadow, 'shadows deepen with the light that casts them', `${off.shadow} < ${one.shadow} < ${full.shadow}`)
ok(off.shadow > 0.05, 'but a shadow keeps its ambient weight with the floodlights out — nobody floats', String(off.shadow))
ok(off.mast < one.mast && one.mast === 0xffffff, 'the masts themselves go dark with their lamps, instead of glowing over a dead field', `off=${(off.mast || 0).toString(16)} on=${(one.mast || 0).toString(16)}`)
if (process.env.V100_SHOTS) { const snap = async (path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } })); if (src) fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) }
  await page.evaluate(async () => { const sc = window.__gridironScene, c = sc.cameras.main; sc.scene.pause(); c.setZoom(0.8); c.centerOn(360, 520); await new Promise(r => setTimeout(r, 300)) })
  for (const v of [0, 1, 2]) { await page.evaluate(async (v) => { window.fieldFxSet('fxLight', String(v), 0); const sc = window.__gridironScene; sc.updateStadiumV92(16); await new Promise(r => setTimeout(r, 400)) }, v); await snap(`scripts/_v100_${Math.round(v * 100)}.png`) }
  await page.evaluate(() => { window.fieldFxSet('fxLight', '1', 1); window.__gridironScene.scene.resume() }) }
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
