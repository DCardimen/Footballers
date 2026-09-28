// Dev check: v164 A — THE LIGHTS STAND WHERE THEY STAND / THE SHADOW IS THE MAN (src/05-field-renderer.js).
// On a live game:
//   1. the eight masts are FIELD objects: re-projected at three lines of scrimmage, the far four stay at the
//      bowl's corners (their x within the bowl's span, at a fixed fraction of it) and their feet stay tucked
//      above the bowl's foot — never on the grass; their size follows the bowl (bigger near the attacked goal)
//   2. the key light is a PHYSICAL mast (phys index 2 — the east end's inner mast on the bottom touchline) on
//      both possessions: drawn and far on our drives, behind the camera (i = -1) on theirs; the shadow vector
//      from the same field spot points DOWN the screen on one and UP the screen on the other — the same mast
//   3. every man's shadow is his own silhouette: a `sil164_*` canvas texture of the frame his body shows,
//      flipped over his feet, laid away from the key light (rotation = the shadow vector), black, translucent;
//      the second lamp throws a fainter one; a man on the ground throws none (his contact blob widens)
//   4. the baked pools lie at the masts' projected pool points, not at screen constants; kill switches
//      (v164Alights 0 / v164Asil 0, a fresh page) restore the screen-planted masts and the ellipses; no errors
//   node scripts/v164Acheck.mjs        (GAME_URL=http://localhost:5173/)
import { chromium } from 'playwright'
import { CHROME, GAME_URL } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function onto (tune) {
  const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
  await page.addInitScript((t) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { dayNightV144: 0, wxV144: 0, liveAgeV144: 0 }, t) }, tune)
  await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
  await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
  await page.evaluate(() => { window.__readPos = 'RB' })
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) {
    await page.evaluate(({ t, visSrc }) => {
      const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
      const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      const el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
        : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className)) : els.find(e => txt(e).includes(t))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click() }
    }, { t, visSrc: vis }).catch(() => {})
    await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
  }
  const live = await waitLive(page, 90000)
  if (live) await page.waitForFunction(() => window.__V164A && window.__V92 && window.__V92.on && window.__gridironScene.markers.length >= 20, null, { timeout: 60000 }).catch(() => {})
  return { page, errs, live }
}

const { page, errs, live } = await onto({})
ok(live, 'the live field is up')
// ---- 1. the masts are field objects
const geo = await page.evaluate(() => {
  const sc = window.__gridironScene, out = []
  for (const los of [10, 50, 90]) {
    sc.drawField(los, los + 10)
    const C = sc.crowd, secs = C.secs.slice(0, C.built).filter(s => s.sgn === 0 && s.bh > 0)
    const xs = secs.map(s => s.bx).concat(secs.map(s => s.bx + s.bw)), bot = Math.max(...secs.map(s => s.by + s.bh))
    const M = window.__V164A.masts().filter(m => m.far).sort((a, b) => a.ti - b.ti)
    const half = sc.crowdProject(728, 426).x - 360   // the end line's projected half-width just behind the goal line: what the bowl's back is built on
    out.push({ los, bowl: { x0: Math.round(Math.min(...xs)), x1: Math.round(Math.max(...xs)), bot: Math.round(bot) }, half: +half.toFixed(1), masts: M.map(m => ({ x: m.x, y: m.y, sk: m.sk, pool: m.pool })), key: window.__V164A.key() })
  }
  return out
})
console.log('geometry:', JSON.stringify(geo))
ok(geo.every(g => g.masts.length === 4), 'four masts are drawn at the far end at every line of scrimmage', geo.map(g => g.masts.length).join(','))
const frac = geo.map(g => g.masts.map(m => +((m.x - 360) / g.half).toFixed(2)))
ok(frac.every(f => f.every((v, i) => Math.abs(v - frac[0][i]) < 0.06)), 'each mast stands at the same lateral fraction of the far end line from every line of scrimmage — it is part of the stadium, not the screen', JSON.stringify(frac))
ok(geo.every(g => g.masts[0].x < g.bowl.x0 + (g.bowl.x1 - g.bowl.x0) * 0.25 && g.masts[3].x > g.bowl.x1 - (g.bowl.x1 - g.bowl.x0) * 0.25), 'the wide masts stand in the bowl\'s outer quarters, the way the corner masts of a stadium do', geo.map(g => [g.masts[0].x, g.masts[3].x, g.bowl.x0, g.bowl.x1].join('/')).join(' | '))
ok(geo.every(g => g.masts.every(m => m.y <= g.bowl.bot)), 'every mast\'s foot is tucked above the bowl\'s foot — none stands on the grass', geo.map(g => g.masts.map(m => m.y + '<=' + g.bowl.bot).join(' ')).join(' | '))
ok(geo[2].masts[0].sk > geo[0].masts[0].sk * 1.5, 'the masts grow with the bowl as the attacked goal nears', `own 10: ${geo[0].masts[0].sk}  their 10: ${geo[2].masts[0].sk}`)
ok(geo.every(g => g.masts.every(m => Math.abs(m.pool.y - g.masts[0].pool.y) < 2 && m.pool.y > 340)), 'every pool lies on the field, on its mast\'s own row', geo.map(g => g.masts.map(m => m.pool.y).join(',')).join(' | '))
// ---- 2. the key light is one physical mast on both possessions
const flip = await page.evaluate(() => {
  const sc = window.__gridironScene, A = window.__V164A, out = {}
  // the field seen from each end: the same raw field spot, and the shadow it throws
  const probe = () => { const K = A.key(); const V = sc.shadowVecV99(360, 900); return { key: K, vec: { ux: +V.ux.toFixed(3), uy: +V.uy.toFixed(3), slope: +V.slope.toFixed(3) }, vdir: A.vdir() } }
  out.now = probe()
  return out
})
console.log('possession now:', JSON.stringify(flip.now))
ok(flip.now.key.phys === 2 && flip.now.key.on, 'the key light is the physical mast 2 — the east end\'s inner mast on the bottom touchline', flip.now.key)
ok(flip.now.vdir > 0 ? (flip.now.key.far && flip.now.key.i === 2 && flip.now.vec.uy > 0) : (!flip.now.key.far && flip.now.key.i === -1 && flip.now.vec.uy < 0), 'on our drive it is drawn far-right and shadows fall down the screen; on theirs it stands behind the camera and shadows fall up the screen', flip.now)
// wait for the other possession (a change of possession re-bakes the field) — at 4x, up to 150 s
await page.evaluate(() => { try { const st = window.__getGridironState(); st.settings.onlyInvolved = false; st.settings.skipOpp = false; st.settings.myPlaysV156D = false; window.RIB_TUNE.speedGateV151A = 0; window.setSpeed(4) } catch (e) {} })
const other = await (async () => { const t0 = Date.now(); const want = -flip.now.vdir
  while (Date.now() - t0 < 150000) { await page.waitForTimeout(500)
    const r = await page.evaluate(() => { const A = window.__V164A, sc = window.__gridironScene; const K = A.key(); const V = sc.shadowVecV99(360, 900); return { key: K, vec: { ux: +V.ux.toFixed(3), uy: +V.uy.toFixed(3) }, vdir: A.vdir(), men: sc.markers.filter(m => m && m.sil && m.sil.visible).length } }).catch(() => null)
    if (r && r.vdir === want && r.men >= 15) return r }
  return null })()
console.log('other possession:', JSON.stringify(other))
ok(other && other.key.phys === 2, 'after the change of possession the key light is STILL physical mast 2', other && other.key)
ok(other && (other.vdir > 0 ? (other.key.far && other.vec.uy > 0) : (!other.key.far && other.vec.uy < 0)), 'and the same field spot\'s shadow now falls the other way up the screen — the light did not move, the camera did', other && other.vec)
// ---- 3. the silhouettes
const sil = await page.evaluate(() => {
  const sc = window.__gridironScene, A = window.__V164A, men = sc.markers.filter(m => m && m.sil), S = A.sil()
  const rows = men.map(m => ({ vis: m.sil.visible, tex: m.sil._texV164 || '', fromBody: m.sil._texV164 === 'sil164_' + (m.tex || m.body.texture.key), rot: +m.sil.rotation.toFixed(3), want: +Math.atan2(-(m._silV164 || {}).ux, (m._silV164 || {}).uy).toFixed(3), sy: +m.sil.scaleY.toFixed(3), a: +m.sil.alpha.toFixed(3), y: +m.sil.y.toFixed(1), blob: { rot: +m.shadow.rotation.toFixed(3), a: +m.shadow.alpha.toFixed(3), sx: +m.shadow.scaleX.toFixed(3) }, fill: m.fill ? m.fill.visible : null, sil2: m.sil2 ? { vis: m.sil2.visible, a: +m.sil2.alpha.toFixed(3) } : null, down: /^(down|dive|tackleSeq|pancakeSeq|getup)/.test(String(m.forceState || '')) }))
  // the texture is a black silhouette of the body's frame
  let black = null
  try { const m = men.find(x => x.sil.visible); const t = sc.textures.get(m.sil._texV164).getSourceImage(); const cx = t.getContext('2d'), d = cx.getImageData(0, 0, t.width, t.height).data
    let ink = 0, col = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 40) { ink++; if (d[i] + d[i + 1] + d[i + 2] > 30) col++ } } black = { ink, col, w: t.width, h: t.height } } catch (e) { black = { err: String(e) } }
  const refs = (sc.refs || []).filter(r => r && r.sil && r.root), ref = refs.find(r => r.sil.visible) || refs[0]
  return { S, rows, black, ref: ref ? { vis: ref.sil.visible, tex: ref.sil._texV164 || '', n: refs.length } : null }
})
console.log('silhouettes:', JSON.stringify(sil.S), 'texture:', JSON.stringify(sil.black), 'ref:', JSON.stringify(sil.ref))
ok(sil.S.on && sil.S.made > 10 && sil.rows.length >= 20, 'silhouette textures are made and cached, one per body frame', sil.S)
const up = sil.rows.filter(r => !r.down)
/* the body's frame can advance in the same frame after the bind (a pose set by an event, a kit re-registration), so
 * one man in a sample may be a frame behind for one draw — nine in ten is the bar, every one visible */
ok(up.every(r => r.vis && /^sil164_/.test(r.tex)) && up.filter(r => r.fromBody).length >= up.length * 0.9, 'every man on his feet wears a silhouette, and (nine in ten at least) of the very frame his body shows', up.filter(r => !r.fromBody).length + ' of ' + up.length + ' a frame behind')
ok(up.every(r => Math.abs(r.rot - r.want) < 0.01), 'each silhouette is laid along its shadow vector, away from the key light', up.slice(0, 3).map(r => r.rot + '/' + r.want))
ok(up.every(r => r.sy < 0 && r.a > 0.05 && r.a < 0.6), 'flipped over his feet (a negative y scale), black and translucent', up.slice(0, 3).map(r => r.sy + '@' + r.a))
ok(sil.black && sil.black.ink > 100 && sil.black.col === 0, 'the silhouette texture is pure black ink where the body was', sil.black)
ok(up.every(r => r.blob.rot === 0 && r.blob.a > 0 && r.blob.a < 0.4 && r.fill === false), 'the old ellipse is now a soft contact blob under the feet and the v101 fill ellipse is gone', up.slice(0, 2).map(r => r.blob))
ok(up.every(r => r.sil2 && r.sil2.vis && r.sil2.a < r.a), 'the second lamp throws a fainter silhouette', up.slice(0, 2).map(r => r.sil2))
ok(sil.rows.filter(r => r.down).every(r => !r.vis && r.blob.sx > up[0].blob.sx), 'a man on the ground throws no silhouette — his blob widens over him', sil.rows.filter(r => r.down).length + ' down')
ok(!sil.ref || (sil.ref.vis && /^sil164_/.test(sil.ref.tex)), 'the officials cast the same way (when a crew is on the field)', sil.ref)
// ---- 4. the kill switches
await page.close()
const off = await onto({ v164Alights: 0, v164Asil: 0 })
ok(off.live, 'kill switches: the live field is up')
const old = await off.page.evaluate(() => { const sc = window.__gridironScene, T = window.__V92.towerBoxes(); const m = sc.markers.find(m => m && m.shadow)
  return { xs: T.map(t => t.bx), key: window.__V99.key(), sil: m && m.sil ? m.sil.visible : null, ellipse: m ? { rot: +m.shadow.rotation.toFixed(3), sx: +m.shadow.scaleX.toFixed(3) } : null, masts: window.__V164A && window.__V164A.masts ? window.__V164A.masts().length : 0 } })
console.log('kill switches:', JSON.stringify(old))
ok(old.xs.length === 4 && Math.abs(old.xs[0] - 14.4) < 1 && Math.abs(old.xs[3] - 705.6) < 1, 'v164Alights 0: the masts are planted on the screen again', old.xs)
ok(old.key.i === 2 && old.sil === false && old.ellipse && old.ellipse.sx > 1, 'v164Asil 0: the ellipse casts again and no silhouette shows', old)
const allErrs = errs.concat(off.errs)
ok(!allErrs.length, 'no page errors', allErrs.slice(0, 4))
console.log(JSON.stringify({ pass, fail, pageErrors: allErrs.length }))
await browser.close()
process.exit(fail || allErrs.length ? 1 : 0)
