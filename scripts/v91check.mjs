// Dev check: v91 THE FIELD SHEETS — the eight uploaded sheets on the live field.
// Drives a real career onto the field and asserts: the atlas decoded and registered
// (run, cut, get-up, celebration, ball frames exist per team), the team recolour took
// the new art (jersey pixels near the primary colour), and across a run of plays the
// renderer actually used the new states (run frames from the v91 cells, drawn get-ups
// after tackles, spinning ball frames in flight), with no page errors.
//   node scripts/v91check.mjs        (READ_POS=QB|RB|WR|LB..., V91_MS=70000, V91_SHOTS=1)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const POS = process.env.READ_POS || 'RB'
async function step(t) { let ok = null; try { ok = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e))) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }) } catch (e) { ok = 'ERR ' + e.message }
  console.log('>>', t, '->', ok); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(500) }
console.log('scene:', scene)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

// ---- 1. the sheet decoded and every team has the new states
await page.waitForFunction(() => window.__V91 && window.__V91.loaded, null, { timeout: 15000 }).catch(() => {})
const reg = await page.evaluate(() => {
  const sc = window.__gridironScene, T = sc.textures, teams = ['off', 'def', 'you']
  const has = (k) => T.exists(k)
  const per = {}
  for (const tm of teams) per[tm] = { run: [0,1,2,3,4,5,6,7].every(i => ['dn','dr','sd','ur','up'].every(d => has(`spr_${tm}_${d}_run${i}`))), cut: ['dn','dr','sd','ur','up'].every(d => has(`spr_${tm}_${d}_cut`)),
    getup: [0,1,2,3,4,5,6,7].every(i => has(`spr_${tm}_dn_getup${i}`) && has(`spr_${tm}_up_getup${i}`)), celebrate: [0,1,2,3].every(i => has(`spr_${tm}_dr_celebrate${i}`)), plant: has(`spr_${tm}_sd_plant`), hurt: has(`spr_${tm}_dn_hurt1`) }
  const ball = [...Array(12).keys()].every(i => has('spr_ball_spin' + i) && has('spr_ball_tumble' + i))
  return { loaded: !!(window.__V91 && window.__V91.loaded), cells: window.__V91 && window.__V91.cells, per, ball, angles: (window.RIB_META_V91_ANGLES || null) }
})
console.log('registered:', JSON.stringify(reg))
ok(reg.loaded && reg.cells >= 200, 'the v91 field sheet decoded with its cell map', `cells=${reg.cells}`)
ok(Object.values(reg.per).every(p => p.run && p.cut && p.getup && p.celebrate && p.plant && p.hurt), 'every team has run x5 facings, cut, 8-frame get-up, celebration, plant and hurt textures', JSON.stringify(reg.per.you))
ok(reg.ball, 'the ball has twelve spiral frames and twelve tumble frames')

// ---- 2. the recolour took the new art: a run frame's jersey carries the team primary
const rec = await page.evaluate(() => {
  const sc = window.__gridironScene, T = sc.textures
  const src = T.get('spr_you_dn_run0').getSourceImage(); const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0); const d = c.getImageData(0, 0, 48, 48).data
  const hx = '#f0bb45', P = [parseInt(hx.slice(1,3),16), parseInt(hx.slice(3,5),16), parseInt(hx.slice(5,7),16)]   // the "you" primary registered by ribActivate
  let n = 0, near = 0, navy = 0
  for (let i = 0; i < d.length; i += 4) { if (d[i+3] < 40) continue; n++
    const r = d[i], g = d[i+1], b = d[i+2]; const mx = Math.max(r,g,b), mn = Math.min(r,g,b)
    let hue = 0; if (mx !== mn) { if (mx === r) hue = (60*((g-b)/(mx-mn))+360)%360; else if (mx === g) hue = 60*((b-r)/(mx-mn))+120; else hue = 60*((r-g)/(mx-mn))+240 }
    if (hue >= 190 && hue <= 265 && (mx-mn)/Math.max(1,mx) > 0.15 && (mx+mn)/2 >= 38) navy++
    // gold-ish primary present: hue 35..55 and bright
    if (hue >= 30 && hue <= 60 && mx > 150) near++ }
  return { n, near, navy, usedV91: ((window.__V91 && window.__V91.cacheKeys) ? window.__V91.cacheKeys() : []).filter(k => /^run_/.test(k)).length }
})
console.log('recolour:', JSON.stringify(rec))
// the "you" kit is gold over navy, so navy pixels are the pants doing their job; the jersey is the primary
ok(rec.near >= rec.n * 0.08 && rec.navy >= rec.n * 0.02, 'the recolour reached the new art: the jersey wears the primary and the pants the secondary', `primary=${rec.near}/${rec.n} secondary=${rec.navy}`)
ok(rec.usedV91 >= 40, 'the run frames came from the v91 cells, not the older atlases', `v91 run cells cut=${rec.usedV91}`)

// ---- 2b. the defence too: its jersey carries the defence primary, whatever palette the opponent drew
const defRec = await page.evaluate(() => {
  const sc = window.__gridironScene, T = sc.textures, cols = window.__V91.teamCols ? window.__V91.teamCols() : null
  const hex = cols && cols.def && cols.def[0]; if (!hex || !T.exists('spr_def_dn_idle')) return null
  const P = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
  const src = T.get('spr_def_dn_idle').getSourceImage(); const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0); const d = c.getImageData(0, 0, 48, 48).data
  const hueOf = (r, g, b) => { const mx = Math.max(r,g,b), mn = Math.min(r,g,b); if (mx === mn) return 0; if (mx === r) return (60*((g-b)/(mx-mn))+360)%360; if (mx === g) return 60*((b-r)/(mx-mn))+120; return 60*((r-g)/(mx-mn))+240 }
  const ph = hueOf(...P), neutralP = (Math.max(...P) - Math.min(...P)) < 40
  // the jersey rows of the standing idle (the helmet sits above 12, the pants start at 27); only the pixels the
  // recolour is meant to touch count — outlines (dark) and skin/whites (neutral) are neither team colour
  let n = 0, near = 0, navy = 0
  for (let y = 13; y < 27; y++) for (let x = 12; x < 36; x++) { const i = (y * 48 + x) * 4; if (d[i+3] < 40) continue
    const r = d[i], g = d[i+1], b = d[i+2], mx = Math.max(r,g,b), mn = Math.min(r,g,b), hue = hueOf(r, g, b)
    if ((mx + mn) / 2 < 38 || (!neutralP && (mx - mn) / Math.max(1, mx) < 0.15)) continue; n++
    if (hue >= 190 && hue <= 265 && (mx-mn)/Math.max(1,mx) > 0.15 && (mx+mn)/2 >= 38) navy++
    const dh = Math.min(Math.abs(hue - ph), 360 - Math.abs(hue - ph)); const neutralPx = (mx - mn) < 40
    if ((neutralP && neutralPx) || (!neutralP && dh < 28)) near++ }
  return { primary: hex, n, near, navy, primaryIsNavy: !neutralP && ph >= 190 && ph <= 265 }
})
console.log('defence recolour:', JSON.stringify(defRec))
ok(defRec && defRec.n > 40 && defRec.near >= defRec.n * 0.5 && (defRec.primaryIsNavy || defRec.navy < defRec.n * 0.15), 'the defence jersey wears the defence primary (torso pixels match its hue family)', defRec && `primary=${defRec.primary} near=${defRec.near}/${defRec.n} navy=${defRec.navy}`)

// ---- 3. watch the field: the renderer uses the new states
const MS = +(process.env.V91_MS || 70000), SHOTS = !!process.env.V91_SHOTS
const snap = async (path) => { const src = await page.evaluate(() => new Promise(res => { try { window.__gridironScene.game.renderer.snapshot(img => res(img.src || null)) } catch (e) { res(null) } })); if (src) { const fs = await import('node:fs'); fs.writeFileSync(path, Buffer.from(src.split(',')[1], 'base64')) } }
const t0 = Date.now(); const seen = { run: 0, cut: 0, getup: 0, celebrate: 0, ballSpin: 0, ballTumble: 0, frames: 0 }; let shots = 0
while (Date.now() - t0 < MS) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene; if (!sc || !sc.markers) return null
    const tex = sc.markers.map(m => m.tex || ''); const bk = sc.ballSpr && sc.ballSpr.texture ? sc.ballSpr.texture.key : ''
    return { run: tex.filter(t => /_run\d/.test(t)).length, cut: tex.filter(t => /_cut$/.test(t)).length, getup: tex.filter(t => /getup\d/.test(t)).length, celebrate: tex.filter(t => /celebrate\d/.test(t)).length,
      spin: /ball_spin/.test(bk), tumble: /ball_tumble/.test(bk), post: !!(sc.play && sc.play.post), ballName: sc.ballSpr && sc.ballSpr.name, mode: sc.play && sc.play.ballMode, V: window.__V91 || {} } })
  if (st) { seen.frames++; seen.ballNames = seen.ballNames || {}; seen.ballNames[st.ballName + ':' + st.mode] = (seen.ballNames[st.ballName + ':' + st.mode] || 0) + 1; seen.run += st.run > 0 ? 1 : 0; seen.cut += st.cut > 0 ? 1 : 0; seen.getup += st.getup > 0 ? 1 : 0; seen.celebrate += st.celebrate > 0 ? 1 : 0; seen.ballSpin += st.spin ? 1 : 0; seen.ballTumble += st.tumble ? 1 : 0; var last = st
    if (SHOTS && shots < 3 && (st.getup > 0 || st.celebrate > 0)) { shots++; await snap(`scripts/_v91_${st.celebrate ? 'celebrate' : 'getup'}${shots}.png`) } }
  await page.waitForTimeout(110)
}
const V = (last && last.V) || {}
console.log('seen:', JSON.stringify(seen), 'counters:', JSON.stringify({ getupFrames: V.getupFrames, celebrateFrames: V.celebrateFrames, ballFrames: V.ballFrames }))
ok(seen.run > seen.frames * 0.3, 'players run on the eight-frame cycle for most of the watch', `${seen.run}/${seen.frames} samples`)
ok((V.getupFrames || 0) > 20 && seen.getup > 0, 'downed players rise through the drawn get-up frames', `getupFrames=${V.getupFrames} samples=${seen.getup}`)
ok((V.ballFrames || 0) > 12 && (seen.ballSpin + seen.ballTumble) > 0, 'the ball cycles its spiral / tumble frames in flight', `ballFrames=${V.ballFrames} spin=${seen.ballSpin} tumble=${seen.ballTumble}`)
// ---- 4. a forced score: the carrier plays the drawn celebration, then stands
const cel = await page.evaluate(async () => { const sc = window.__gridironScene; const P = sc.play; if (!P) return null
  // a man on his feet, as a scorer is: the pile's own get-up must not be what we measure
  const up = sc.markers.findIndex((m, i) => i < 11 && m && !/getup|down|tackle|pancake|dive/.test(m.tex || '') && m.forceState == null)
  const id = up >= 0 ? up : (P.carrierId != null ? P.carrierId : 8); P.carrierId = id; const m = sc.markers[id]
  sc.celebrate(m ? m.sx : 200, m ? m.sy : 200)
  const seen = []; for (let i = 0; i < 14; i++) { await new Promise(r => setTimeout(r, 120)); seen.push(m && m.tex) }
  return { forced: m && m.forceState, seen: seen.filter(t => /celebrate\d/.test(t || '')).length, sample: seen.slice(0, 4) } })
console.log('celebration:', JSON.stringify(cel))
ok(cel && cel.seen >= 6, 'a scorer plays the drawn celebration frames after the touchdown call', cel && `${cel.seen}/14 samples · ${cel.sample.join(' ')}`)
if (SHOTS) await snap('scripts/_v91_field.png')
await browser.close()
console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errs.length ? errs : 'none')
if (fail || errs.length) process.exit(1)
