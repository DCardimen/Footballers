// Dev check: the dynamic kit on the main menu — THE COLOUR STAYS ON THE UNIFORM.
// The hero and the continue card are photographs; the team's colours are laid over them through
// alpha masks cut from the pictures (scripts/build-menu-art.py). This proves, on probe points
// chosen off a 1% grid of each picture:
//   * THE MASKS — every garment point (jersey, both sleeve hems, the helmet's lit rim, the pants
//     out to both hips, the belt) is inside its mask, and every non-garment point (the crowd beside
//     the hips, the gap between the legs, the lamps beside the helmet, the arms, the neck, the
//     gloves) is outside both. Read straight off the shipped .webp alpha.
//   * THE LIVE RENDER — with a real career mounted (so the tints are on), at a phone and a desktop
//     size, the rendered pixel at every garment point has CHANGED against the same screen with the
//     tint layers hidden, and carries the team's hue (primary on the jersey, secondary on helmet and
//     pants); every non-garment point is the SAME pixel with or without the tints. This is the
//     end-to-end: the mask, the CSS mask-size/position maths (layoutArt), the recolour filter.
//   node scripts/menu-mask-check.mjs           (dev server on :5173)
import { chromium } from 'playwright'
import fs from 'node:fs'
const URL = process.env.MENU_INTEGRATION_URL || 'http://127.0.0.1:5173/index.html'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

// probe points, in PERCENT of the source picture. `on` = must be kit, `off` = must never be.
const PROBES = {
  card_continue: { nat: [1000, 640], p: 'card_continue_mask_p', s: 'card_continue_mask_s',
    on: { p: { chest: [77, 55], leftSleeve: [65, 46], rightSleeve: [89.8, 46], leftHem: [64.3, 49], rightHem: [90.6, 49.5], leftShoulder: [70, 42], rightShoulder: [86, 42], torsoLeft: [69.6, 70], torsoRight: [86.2, 70] },
          s: { helmet: [77, 24], helmetRimRight: [85, 27], helmetLowerRim: [84.4, 33], helmetRear: [77, 36], helmetCage: [71, 30], seat: [77, 84], hipLeft: [68.4, 84], hipRight: [87.4, 84], belt: [77, 76.5], legLeft: [70, 97], legRight: [85, 97] } },
    off: { crowdLeftOfHip: [65, 82], crowdRightOfHip: [90.2, 82], betweenLegs: [77.3, 98], leftOfSleeve: [58, 48], rightOfSleeve: [94, 46], lampsByHelmet: [88, 21], leftArm: [65, 62], rightArm: [89.6, 62], neck: [77, 38.4], leftGlove: [63.5, 94], rightGlove: [91.4, 94], sky: [77, 12] } },
  hero_tunnel: { nat: [1600, 914], p: 'hero_mask_p', s: 'hero_mask_s',
    on: { p: { chest: [50, 45], leftSleeve: [36.6, 44], rightSleeve: [63.2, 44], leftHem: [37.4, 49.5], rightHem: [62.2, 49] },
          s: { helmet: [50, 25], helmetRimRight: [54.8, 28], helmetRimLeft: [45.8, 28], seat: [50, 85], hipLeft: [41.6, 84], hipRight: [58.4, 84] } },
    off: { leftOfSleeve: [33.4, 44], rightOfSleeve: [66.6, 44], leftArm: [35, 82], rightArm: [65, 82], aboveHelmet: [50, 15], wall: [27, 60], slogan: [86, 30] } },
}

// ================= 1. the shipped masks =================
const page0 = await browser.newPage()
await page0.goto(URL, { waitUntil: 'domcontentloaded' })
const maskProbe = await page0.evaluate(async (PROBES) => {
  const load = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = '/menu/' + s + '.webp' })
  const out = {}
  for (const [pic, spec] of Object.entries(PROBES)) {
    const ms = { p: await load(spec.p), s: await load(spec.s) }
    const cv = document.createElement('canvas'), cx = cv.getContext('2d')
    const alpha = (img, [x, y]) => { cv.width = img.width; cv.height = img.height; cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0)
      const px = Math.round(x / 100 * img.width), py = Math.round(y / 100 * img.height); return cx.getImageData(px, py, 1, 1).data[3] / 255 }
    const r = { on: {}, off: {} }
    for (const which of ['p', 's']) for (const [name, pt] of Object.entries(spec.on[which])) r.on[name] = { which, a: alpha(ms[which], pt), other: alpha(ms[which === 'p' ? 's' : 'p'], pt) }
    for (const [name, pt] of Object.entries(spec.off)) r.off[name] = { p: alpha(ms.p, pt), s: alpha(ms.s, pt) }
    out[pic] = r
  }
  return out
}, PROBES)
await page0.close()
for (const [pic, r] of Object.entries(maskProbe)) {
  const missed = Object.entries(r.on).filter(([, v]) => v.a < 0.6), crossed = Object.entries(r.on).filter(([, v]) => v.other > 0.15)
  const bled = Object.entries(r.off).filter(([, v]) => Math.max(v.p, v.s) > 0.08)
  ok(missed.length === 0, `${pic}: every garment point is inside its mask (rims, hems, hips included)`,
    missed.length ? missed.map(([k, v]) => `${k}=${v.a.toFixed(2)}`).join(' ') : `${Object.keys(r.on).length} points`)
  ok(crossed.length === 0, `${pic}: no garment point is in the OTHER colour's mask`, crossed.map(([k, v]) => `${k}=${v.other.toFixed(2)}`).join(' ') || 'clean')
  ok(bled.length === 0, `${pic}: nothing off the kit is masked — crowd, lamps, skin, gloves, the gap between the legs`,
    bled.length ? bled.map(([k, v]) => `${k}=p${v.p.toFixed(2)}/s${v.s.toFixed(2)}`).join(' ') : `${Object.keys(r.off).length} points`)
}

// ================= 2. the live render, with and without the tints =================
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn
  let h = 0, s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360 } return { h, s, l } }
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d }
for (const [w, h] of (process.env.SIZES || '430x932,900x1100').split(',').map(x => x.split('x').map(Number))) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 700, hasTouch: true })
  const page = await context.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
  const click = async (t) => { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis }); await page.waitForTimeout(700); return r }
  await page.waitForTimeout(800); await click('START NEW CAREER')
  for (let i = 0; i < 8; i++) {
    const done = await page.evaluate(({ visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false } }
      const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (card) { card.click(); return false } return true }, { visSrc: vis })
    await page.waitForTimeout(450); if (done) break
  }
  await click('PLAY 8-GAME SEASON'); await click('Balanced Program')
  // vivid colours, whatever team the career rolled: a navy-on-grey team would change a grey
  // shirt by four levels and prove nothing. The feed is wrapped, so the real menu path renders it.
  await page.evaluate(() => { document.getElementById('growthV42')?.remove()
    const feed = window.__RIB_MENU_DATA_V89; window.__RIB_MENU_DATA_V89 = () => { const d = feed(); d.team.colors = ['#e01818', '#18c8e0']; return d }
    window.go('menu') })
  await page.waitForSelector('#rib-main-menu-v2 .rib9-shell', { state: 'visible', timeout: 12000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
  // the hero breathes (v102) and the sheen moves: freeze every animation so both shots line up
  await page.addStyleTag({ content: '#rib-main-menu-v2 *, #rib-main-menu-v2 *::before, #rib-main-menu-v2 *::after { animation: none !important; transition: none !important; } .rib9-hero-fx { display: none !important }' })
  await page.waitForTimeout(900)
  const colors = await page.evaluate(() => { try { return window.__RIB_MENU_DATA_V89().team.colors } catch (e) { return null } })
  // where each picture sits on screen: the tint element's own --mx/--my/--mw/--mh (layoutArt's answer)
  const boxes = await page.evaluate(() => { const out = {}
    for (const [pic, sel] of [['hero_tunnel', '.rib9-hero'], ['card_continue', '.rib9-continue']]) {
      const holder = document.querySelector(sel); if (!holder) continue
      holder.scrollIntoView({ block: 'center' })
      const t = holder.querySelector('[data-mask]'); const hb = holder.getBoundingClientRect(); const cs = getComputedStyle(t)
      const v = k => parseFloat(t.style.getPropertyValue(k)) || 0
      out[pic] = { x: hb.left + v('--mx'), y: hb.top + v('--my'), w: v('--mw'), h: v('--mh'), tints: holder.querySelectorAll('.rib9-tint').length, maskImg: cs.webkitMaskImage || cs.maskImage } }
    return out })
  const shoot = async () => { const b = await page.screenshot({ fullPage: false }); return 'data:image/png;base64,' + b.toString('base64') }
  const sample = (shot, pts) => page.evaluate(async ({ shot, pts }) => { const img = new Image(); img.src = shot; await img.decode()
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0)
    const k = img.width / innerWidth
    return pts.map(([x, y]) => { const d = cx.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data; return [d[0], d[1], d[2]] }) }, { shot, pts })
  for (const [pic, spec] of Object.entries(PROBES)) {
    const box = boxes[pic]; if (!box || !box.w) { ok(false, `${w}x${h} ${pic}: the picture is on screen with its tints laid out`, JSON.stringify(box)); continue }
    // bring this holder into view for both shots
    await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), pic === 'hero_tunnel' ? '.rib9-hero' : '.rib9-continue'); await page.waitForTimeout(500)
    const box2 = await page.evaluate(sel => { const holder = document.querySelector(sel), t = holder.querySelector('[data-mask]'), hb = holder.getBoundingClientRect(); const v = k => parseFloat(t.style.getPropertyValue(k)) || 0
      return { x: hb.left + v('--mx'), y: hb.top + v('--my'), w: v('--mw'), h: v('--mh'), top: hb.top, bottom: hb.bottom } }, pic === 'hero_tunnel' ? '.rib9-hero' : '.rib9-continue')
    const toPx = ([px, py]) => [box2.x + px / 100 * box2.w, box2.y + py / 100 * box2.h]
    const names = [], pts = [], kinds = []
    for (const which of ['p', 's']) for (const [n, pt] of Object.entries(spec.on[which])) { names.push(n); pts.push(toPx(pt)); kinds.push(which) }
    for (const [n, pt] of Object.entries(spec.off)) { names.push(n); pts.push(toPx(pt)); kinds.push('off') }
    // only points actually inside the viewport AND inside the holder's visible box can be sampled
    const inView = pts.map(([x, y]) => x >= 0 && y >= Math.max(0, box2.top) && x < w && y < Math.min(h, box2.bottom))
    const withTint = await sample(await shoot(), pts)
    const hide = await page.addStyleTag({ content: '.rib9-tint { visibility: hidden !important }' }); await page.waitForTimeout(250)
    const noTint = await sample(await shoot(), pts)
    await hide.evaluate(el => el.remove()); await page.waitForTimeout(250)
    const diff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
    const unchanged = [], changedOff = [], wrongHue = [], sampled = { on: 0, off: 0 }
    names.forEach((n, i) => { if (!inView[i]) return
      const d = diff(withTint[i], noTint[i])
      // a masked-out point renders IDENTICALLY with the layers hidden (Δ0-1); a masked one moves,
      // though a luminance-preserving recolour can only move a near-black shadow by a few levels
      if (kinds[i] === 'off') { sampled.off++; if (d > 3) changedOff.push(`${n}Δ${d}`) }
      else { sampled.on++; if (d < 4) unchanged.push(`${n}Δ${d}`)
        const want = colors && colors[kinds[i] === 'p' ? 0 : 1]; const tc = want && hsl(...[1, 3, 5].map(o => parseInt(want.slice(o, o + 2), 16)))
        const got = hsl(...withTint[i])
        // a hue is only a claim where there is colour to carry it: the team's, and the pixel's — a
        // specular highlight comes out of the sepia stage faintly warm whatever the team wears
        if (tc && tc.s > 0.25 && tc.l > 0.14 && tc.l < 0.9 && got.s > 0.12 && got.l > 0.08 && got.l < 0.72 && hueGap(tc.h, got.h) > 28) wrongHue.push(`${n}:${got.h.toFixed(0)}°≠${tc.h.toFixed(0)}° (l ${got.l.toFixed(2)} s ${got.s.toFixed(2)})`) } })
    ok(sampled.on >= 8 && sampled.off >= 5, `${w}x${h} ${pic}: enough probe points fall inside the rendered crop`, `${sampled.on} on / ${sampled.off} off (of ${names.length}) · colours ${JSON.stringify(colors)}`)
    ok(unchanged.length === 0, `${w}x${h} ${pic}: the tint REACHES every garment point — rims, hems, both hips`, unchanged.join(' ') || `${sampled.on} points recoloured`)
    ok(changedOff.length === 0, `${w}x${h} ${pic}: and touches nothing beside the kit — the crowd, the lamps, the skin, the gloves`, changedOff.join(' ') || `${sampled.off} points untouched`)
    ok(wrongHue.length === 0, `${w}x${h} ${pic}: the jersey wears the primary and the helmet/pants the secondary`, wrongHue.join(' ') || 'hues match')
  }
  if (process.env.OUT) { await page.evaluate(() => document.querySelector('.rib9-continue').scrollIntoView({ block: 'center' })); await page.waitForTimeout(300); await page.screenshot({ path: `${process.env.OUT}_${w}x${h}.png` }) }
  ok(errors.length === 0, `${w}x${h}: no page errors`, errors.slice(0, 3).join(' | ') || 'none')
  await context.close()
}
console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
