// Look (v151 D): short frame sequences of the moments, grabbed off the GAME's own frame buffer
// (renderer.snapshotArea — the DOM overlays never cover it), each blown up 3x round the man.
//   GAME_URL=http://localhost:5660/ TAG=after OUT=/tmp/claude-0/shots node scripts/v151Dshot.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, GAME_URL } from './lib/env.mjs'
const OUT = process.env.OUT || '/tmp/claude-0/shots', TAG = process.env.TAG || 'after'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function step(t) {
  await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis), txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e))) : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis })
  await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'CONFIRM TRAINING', 'PLAY WEEK 1 LIVE', 'PLAN']) await step(t)
for (let i = 0; i < 8; i++) { if (await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))) break
  for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'NEXT', 'KICK OFF', 'PLAY', 'CONTINUE']) await step(t) }
await page.evaluate(() => { window.__getGridironLiveSpeed = () => 1 })
const grab = (x, y, name) => page.evaluate(({ x, y }) => new Promise(res => {
  const sc = window.__gridironScene, R = 44
  sc.game.renderer.snapshotArea(Math.max(0, Math.round(x - R)), Math.max(0, Math.round(y - R)), R * 2, R * 2, img => {
    const c = document.createElement('canvas'); c.width = R * 6; c.height = R * 6; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, R * 6, R * 6); res(c.toDataURL('image/png')) })
}), { x, y }).then(d => fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(d.split(',')[1], 'base64')))
const at = (idx) => page.evaluate(i => { const sc = window.__gridironScene, m = sc.markers[i], cam = sc.cameras.main
  return m && m.root ? { x: (m.root.x - cam.worldView.x) * cam.zoom, y: (m.root.y - cam.worldView.y) * cam.zoom } : null }, idx)
const INJ = [['spin', { type: 'cut', kind: 'spin', elus: 70, direction: 1 }], ['juke', { type: 'cut', kind: 'juke', elus: 70, direction: -1 }], ['sidestep', { type: 'cut', kind: 'sidestep', elus: 70, direction: 1 }],
  ['stumble', { type: 'stagger', side: 1 }], ['pushback', { type: 'pushV151D', dir: -1, edge: 2.6, ms: 260 }],
  ['whiff_badangle', { type: 'tackleWhiff', angQ: -.8 }], ['whiff_goodangle', { type: 'tackleWhiff', angQ: .8 }], ['skin', null]]
for (const [name, ev] of (process.env.SKIN_ONLY ? [] : INJ)) {
  let who = null
  for (let i = 0; i < 500 && who == null; i++) {
    who = await page.evaluate((ev) => {
      const sc = window.__gridironScene, P = sc && sc.play
      if (!P || !P.script || !P.snapped || P.done || !(P.carrierId >= 0) || P.carrierId > 21) return null
      const cm = sc.markers[P.carrierId]; if (!cm || !cm.root || cm.forceState || (cm._spdPx || 0) < 40) return null
      if (!ev) return P.carrierId
      let best = -1, bd = 1e9; sc.markers.forEach((m, j) => { if (!m || !m.root || j === P.carrierId || (j < 11) === (P.carrierId < 11)) return; const d = Math.hypot(m.sx - cm.sx, m.sy - cm.sy); if (d < bd) { bd = d; best = j } })
      if (best < 0) return null
      const tk = sc.markers[best], cid = P.script.actors[P.carrierId].id, tid = P.script.actors[best].id
      if (ev.type === 'tackleWhiff' || ev.type === 'pushV151D') { tk.sx = cm.sx + 9; tk.sy = cm.sy + 3 }
      sc.fireEvent(Object.assign({ t: P.t, x: cm.sx, y: cm.sy, carrier: cid, who: tid, on: cid }, ev), P)
      return ev.type === 'tackleWhiff' ? best : P.carrierId
    }, ev)
    if (who == null) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(q => /^(CONTINUE|NEXT PLAY|NEXT)$/i.test((q.innerText || '').trim()) && q.offsetParent); if (b) b.click() }); await page.waitForTimeout(50) }
  }
  if (who == null) { console.log('no moment for', name); continue }
  for (let f = 0; f < 6; f++) { const p = await at(who); if (p) await grab(p.x, p.y, `v151D_${TAG}_${name}_${f}`); await page.waitForTimeout(name === 'skin' ? 400 : 80) }
  await page.waitForTimeout(600)
}
// the skin close-up: each kit texture with its skin layer tinted in every tone, 6x, both kits
const sheet = await page.evaluate(() => {
  const sc = window.__gridironScene, T = window.__V151D_SKIN_API ? window.__V151D_SKIN_API.tones : null
  const poses = ['dn_run0', 'dn_idle', 'sd_run3', 'dr_run5', 'up_run1'], kits = ['off', 'def'], Z = 5
  const c = document.createElement('canvas'); c.width = 48 * Z * 8; c.height = 48 * Z * poses.length * kits.length; const g = c.getContext('2d'); g.imageSmoothingEnabled = false
  g.fillStyle = '#3a7a3a'; g.fillRect(0, 0, c.width, c.height)
  const tint = (img, hex) => { const t = document.createElement('canvas'); t.width = 48; t.height = 48; const x = t.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = hex; x.fillRect(0, 0, 48, 48); x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0); return t }
  let row = 0
  for (const k of kits) for (const p of poses) { const key = 'spr_' + k + '_' + p; if (!sc.textures.exists(key)) { row++; continue }
    const body = sc.textures.get(key).getSourceImage(), sk = window.__V151D_SKIN_API && window.__V151D_SKIN_API.texSkin(key)
    for (let i = 0; i < 8; i++) { g.drawImage(body, i * 48 * Z, row * 48 * Z, 48 * Z, 48 * Z); if (T && sk && sc.textures.exists(sk)) g.drawImage(tint(sc.textures.get(sk).getSourceImage(), T[i]), i * 48 * Z, row * 48 * Z, 48 * Z, 48 * Z) }
    row++ }
  return c.toDataURL('image/png')
})
fs.writeFileSync(`${OUT}/v151D_${TAG}_skin_closeup.png`, Buffer.from(sheet.split(',')[1], 'base64'))
console.log('shots in', OUT, 'errors', errs.length)
await browser.close()
