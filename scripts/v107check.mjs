// Dev check: v107 — THE ARM, THE DROP, THE STANCE. Drives a real career onto the live field and
// watches the renderer's own counters (window.__V107) plus the markers' texture keys:
//   * THE THROW WEARS ITS FACING — spr_<kit>_<dd>_throw* is cut from the v91 sheet's own
//     throw_up / throw_dn / throw_ur cycles (up, dn and ur differ from each other and frame 4
//     differs from frame 0), with sd borrowing the quarter and dr the front.
//   * THE RELEASE IS ON TIME — a throw was drawn 0→5 in order under a real facing and the
//     release frame landed within one frame of the flight starting.
//   * THE DROPBACK IS A BACKPEDAL — backpedal cells were drawn while the QB dropped, and the
//     cycle advanced (more than one frame key seen).
//   * THE STANCES — the center is over the ball pre-snap, the rest of the offensive line is in
//     a three-point, the skill men wait ready and a standing ball carrier has it tucked.
//   node scripts/v107check.mjs        (READ_POS=QB, V107_MS=150000)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const POS = process.env.READ_POS || 'QB'
async function step(t) { let r = null; try { r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
  let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
  if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }) } catch (e) { r = 'ERR ' + e.message }
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900) }
await page.evaluate(p => { window.__readPos = p }, POS)
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 40; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
console.log('scene:', scene)

// ---- the atlas behind the keys: every registered throw frame, by its pixels ----
const tex = await page.evaluate(() => {
  const sc = window.__gridironScene, out = { map: (window.__V107 || {}).map || null, sig: {}, v91: !!(window.__V107 || {}).v91 }
  const url = (k) => { try { const im = sc.textures.get(k).getSourceImage(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL() } catch (e) { return null } }
  for (const dd of ['up', 'dn', 'sd', 'dr', 'ur']) for (const i of [0, 3, 4]) out.sig[dd + i] = url('spr_off_' + dd + '_throw' + i)
  for (const k of ['up_backpedal0', 'up_backpedal3', 'up_center', 'up_stance3', 'up_ready', 'up_carry', 'up_idle', 'up_stance'])
    out.sig[k] = url('spr_off_' + k)
  return out
})
const same = (a, b) => !!(tex.sig[a] && tex.sig[b] && tex.sig[a] === tex.sig[b])
const have = (a) => !!tex.sig[a]
console.log('throw map:', JSON.stringify(tex.map), 'v91 sheet:', tex.v91)
ok(tex.v91 && tex.map && tex.map.up === 'throw_up' && tex.map.dn === 'throw_dn' && tex.map.ur === 'throw_ur',
  'the drawn facings register from the v91 sheet\'s own throw cycles', JSON.stringify(tex.map))
ok(tex.map && tex.map.sd === 'throw_ur' && tex.map.dr === 'throw_dn',
  'the two facings nobody drew borrow the nearest real cycle (sd -> quarter, dr -> front)', JSON.stringify(tex.map))
ok(have('up0') && have('up4') && !same('up0', 'up4') && !same('up3', 'up4'),
  'the six frames are six different cells — the release is not the set', 'up0 vs up3 vs up4')
ok(!same('up0', 'dn0') && !same('up0', 'ur0') && !same('dn0', 'ur0'),
  'up, dn and ur are three different throws, not one baked cycle stamped five times')
ok(same('sd0', 'ur0') && same('dr0', 'dn0'), 'and the borrowed facings really carry the cell they borrowed')
ok(have('up_backpedal0') && !same('up_backpedal0', 'up_backpedal3') && !same('up_backpedal0', 'up_idle'),
  'the backpedal is its own six-frame cycle')
ok(have('up_center') && have('up_stance3') && have('up_ready') && have('up_carry')
  && !same('up_center', 'up_stance3') && !same('up_stance3', 'up_stance') && !same('up_ready', 'up_idle') && !same('up_carry', 'up_idle'),
  'the offense\'s own pre-snap poses registered — center, three-point, ready, carry')

// ---- the field: what actually got drawn ----
// an in-page collector on requestAnimationFrame: a dropback is a few hundred milliseconds long
// and a poll from node loses most of it, so count every rendered frame instead
await page.evaluate(() => { const R = window.__v107rec = { bp: {}, thr: {}, pre: 0, centerPre: 0, line3: 0, dropF: 0 }
  const tick = () => { try { const sc = window.__gridironScene, P = sc && sc.play, ms = (sc && sc.markers) || [], qb = ms[8]
    if (P && qb && qb.tex) {
      if (qb._dropback) R.dropF++
      let m2 = /_backpedal(\d)$/.exec(qb.tex); if (m2) R.bp[m2[1]] = (R.bp[m2[1]] || 0) + 1
      m2 = /_throw(\d)$/.exec(qb.tex); if (m2) R.thr[m2[1]] = (R.thr[m2[1]] || 0) + 1
      if (!P.snapped && P.t >= (P.delay || 0) && /^(run|pass|incomplete|sack|turnover)$/.test(String(P.payload && P.payload.event))) {
        R.pre++
        if (/_up_stance3$/.test(String(ms[5] && ms[5].tex))) R.centerPre++   // the centre is down with the line (the drawn centre pose is not used)
        if (ms.slice(0, 11).filter(m => m.isLine && /_up_stance3$/.test(String(m.tex || ''))).length >= 3) R.line3++ } } } catch (e) {}
    requestAnimationFrame(tick) }
  requestAnimationFrame(tick) })
const MS = +(process.env.V107_MS || 150000)
const t0 = Date.now()
let lastV = null, R = {}
while (Date.now() - t0 < MS) {
  const st = await page.evaluate(() => ({ V: window.__V107 || null, R: window.__v107rec || null }))
  if (st) { lastV = st.V; R = st.R || {}
    const V = st.V || {}
    if ((V.throws || []).filter(r => r.flightStartMs != null).length >= 3 && Object.keys(R.bp || {}).length >= 3
        && (R.centerPre || 0) > 300 && (R.line3 || 0) > 300 && (V.readyFrames || 0) > 5 && (V.carryFrames || 0) > 5) break }
  await page.waitForTimeout(200)
}
const bpFrames = Object.keys(R.bp || {})
const V = lastV || {}
const done = (V.throws || []).filter(r => r.flightStartMs != null)
const inOrder = (f) => { let p = -1; for (const x of f) { if (x < p) return false; p = x } return true }
const good = done.filter(r => r.src && inOrder(r.frames) && [0, 1, 2, 3, 4, 5].every(i => r.frames.includes(i)))
const onTime = good.filter(r => r.residualMs != null && Math.abs(r.residualMs) <= 85)
console.log('throws:', JSON.stringify(done.slice(-6)))
console.log('counters:', JSON.stringify({ backpedalFrames: V.backpedalFrames, readyFrames: V.readyFrames, stance3Frames: V.stance3Frames, carryFrames: V.carryFrames }))
console.log('drawn on the QB:', JSON.stringify(R))
ok(good.length >= 1, 'a throw was drawn 0 -> 5 in order under a real facing', good.length + '/' + done.length + ' throws · facings ' + [...new Set(done.map(r => r.facing + (r.flip ? '(flip)' : '')))].join(','))
ok(onTime.length >= 1 && onTime.length >= good.length - 1, 'and the release frame landed within one frame of the flight starting',
  'residuals ' + good.map(r => r.residualMs).join(',') + ' ms')
ok((R.dropF || 0) > 0 && (V.backpedalFrames || 0) > 0, 'the backpedal was drawn while the QB dropped back', `${V.backpedalFrames || 0} frames over ${R.dropF || 0} dropback frames`)
ok(bpFrames.length >= 2, 'and its cycle advanced through more than one frame', JSON.stringify(R.bp))
ok((R.pre || 0) > 60 && R.centerPre / R.pre > 0.8, 'the center is down in the three-point with the line before the snap (the drawn centre pose is not used: its arms read wrong)', `${R.centerPre}/${R.pre} pre-snap frames`)
ok((R.pre || 0) > 60 && R.line3 / R.pre > 0.8, 'and the rest of the offensive line is in a three-point stance', `${R.line3}/${R.pre} pre-snap frames`)
ok((V.readyFrames || 0) > 0 && (V.carryFrames || 0) > 0, 'the skill men wait ready and a standing carrier has the ball tucked',
  `${V.readyFrames || 0} ready · ${V.carryFrames || 0} carry frames`)
console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
