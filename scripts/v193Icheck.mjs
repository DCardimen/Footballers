// Dev check: v193 I EVERY SHEET, EVERY PHONE — the skin half (src/05-field-renderer.js, src/28-cosmetics.js, src/03-splash.js).
//   v193 C stopped skin pixels coming out in the kit's SECOND colour, measured on a dozen main-sheet cells. This walks
//   EVERY player cell the game recolours, in two kits whose second colour is skin-like (an orange, then a brown):
//     - the field: everything `ribRegisterTeam` builds (window.__V193I.register runs it against a throwaway texture
//       store) — the v91 sheets in every facing (run, idle, cut, plant, fall, dive, get-up, hurt, walk, catch-hold),
//       the QB sheets (throws per facing, the backpedal, the handoffs, the toss, the stances), the catch sequences,
//       the field celebrations, the v22 moments (jukes, stiff-arms, hurdles, blocks, the tackle fall, the pancake)
//       and the baked atlas. The sideline backups draw these same idle textures; the age scale (v144 A) is a sprite
//       scale, not a cell — both are asserted below rather than measured twice;
//     - the celebration bodies (src/28 v161 A `frameCanvasV161A` and v177 I `frameCanvasV177I`, every frame at 1x and
//       2x), skin read off the generator's own skin masks (public/celebrations/*_skin_*x.png);
//     - the loading chase / growth screen's boy (src/03 `__CHASE_V94.cell`, which the growth screen dresses in the
//       team's palette).
//   For each cell it counts pixels whose DRAWN colour is skin — by the mask (the runtime mask on the field, the
//   generator's on the bodies) and by this check's own looser read (warm, mid-saturation, mid-lightness, on the skin
//   side of its neighbours, so the mask's own misses are caught) — that came out exactly the kit's p2 (ribRecolor's
//   gold band: p2 times the pixel's lightness). FAIL when any cell has more than SKIN_P2_MAX (2).
//   Also: the v193I grow pass is what closes it (with TU skinGrowV193I 0 the field cells leak again).
// Writes scripts/_v193I_worst.png (the worst cells: drawn, kit, flagged) — gitignored.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Icheck.mjs
import fs from 'node:fs'
import { gameUrl, launch } from './lib/env.mjs'
const SKIN_P2_MAX = 2
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate']) document.querySelector(s)?.remove() }, 80) })
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__V193C && !!window.__V193I && !!window.__V91 && window.__V91.loaded && !!window.__V161A && !!window.__V177I && !!window.__CHASE_V94, null, { timeout: 60000 })
await page.evaluate(() => { window.__V161A.load(); window.__V177I.load(); window.__CHASE_V94.load && window.__CHASE_V94.load() })
await page.waitForFunction(() => window.__V161A.ready() && window.__V177I.ready() && window.__CHASE_V94.ready, null, { timeout: 30000 })

// the measuring kit, shared by every part: installed once on window
await page.evaluate(() => {
  const hsl = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, sat = mx ? (mx - mn) / mx : 0; let h = 0; if (mx !== mn) { if (mx === r) h = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) h = 60 * ((b - r) / (mx - mn)) + 120; else h = 60 * ((r - g) / (mx - mn)) + 240 } return { h, sat, L, flat: mx === mn } }
  const px = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  // this check's own read of the drawn skin — no neighbour vote, no code shared with skinMaskV151D:
  //   core: the drawn skin's saturated orange-brown (hue 8-31), never the football's brown (g under .47 r), and the
  //         colour of most of the warm pixels around it (a pants or stripe shadow is a minority among the gold)
  //   loose: warm (hue 8-46), mid-saturation (.2-.75), mid-lightness (50-215), touching skin (the core; plus the mask
  //          when it is the generator's — the runtime mask is what is under test, so it is never evidence) and with at
  //          least as much skin around it as saturated kit gold (sat .75+ or hue 46+) — a highlight on an arm, not a
  //          pants highlight
  function skinRead (raw, w, h, mask, trust) {
    const N = w * h, coreC = new Uint8Array(N), warm = new Uint8Array(N), core = new Uint8Array(N), cand = new Uint8Array(N), kit = new Uint8Array(N), out = new Uint8Array(N)
    for (let i = 0; i < N; i++) {
      if (raw[i * 4 + 3] < 25) continue
      const r = raw[i * 4], g = raw[i * 4 + 1], b = raw[i * 4 + 2], c = hsl(r, g, b); if (c.flat || g < r * 0.47) continue
      if (c.h >= 8 && c.h < 62 && c.sat > 0.3) warm[i] = 1
      if (c.h >= 8 && c.h < 31 && c.sat > 0.45 && c.L >= 25 && c.L <= 215) coreC[i] = 1
      else if (c.h >= 8 && c.h < 46 && c.sat >= 0.2 && c.sat < 0.75 && c.L >= 50 && c.L <= 215) cand[i] = 1
      else if (c.h >= 33 && c.h <= 62 && c.sat > 0.3 && c.L > 60) kit[i] = 1
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!coreC[i]) continue
      let f = 0, n = 0
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { const j = yy * w + xx; f += coreC[j]; n += warm[j] }
      if (f * 2 > n) core[i] = 1
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (core[i] || (mask && mask[i])) { out[i] = 1; continue }
      if (!cand[i]) continue
      let s = 0, k = 0
      for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { const j = yy * w + xx; if (j === i) continue; if (core[j] || (trust && mask && mask[j])) s++; else if (kit[j]) k++ }
      if (s > 0 && s >= k) out[i] = 2
    }
    return out
  }
  // a pixel the recolour painted p2: changed from the drawing, and exactly p2 times the drawn pixel's lightness (ribRecolor's gold band)
  function p2At (raw, o, i, S) {
    const d = Math.abs(o[i * 4] - raw[i * 4]) + Math.abs(o[i * 4 + 1] - raw[i * 4 + 1]) + Math.abs(o[i * 4 + 2] - raw[i * 4 + 2])
    if (d <= 3) return false
    const c = hsl(raw[i * 4], raw[i * 4 + 1], raw[i * 4 + 2]), sc = Math.min(1.75, Math.max(0.25, c.L / 165))
    if (!(c.h >= 33 && c.h <= 62 && c.sat > 0.3 && c.L > 60)) return false   // only the gold band is ever painted p2 (a near-miss elsewhere is a coincidence)
    return [0, 1, 2].every((k) => Math.abs(o[i * 4 + k] - Math.min(255, S[k] * sc)) <= 3)
  }
  // one cell: { skin, mask, bad (mask skin in p2), loose (loose skin in p2), flagged indexes }
  function audit (rawCv, outCv, mask, P2, trust) {
    const S = [1, 3, 5].map((i) => parseInt(P2.slice(i, i + 2), 16)), w = rawCv.width, h = rawCv.height
    const raw = px(rawCv), o = px(outCv), read = skinRead(raw, w, h, mask, trust), R = { skin: 0, bad: 0, loose: 0, flag: [] }
    for (let i = 0; i < w * h; i++) {
      if (!read[i] || raw[i * 4 + 3] < 25) continue
      R.skin++
      if (!p2At(raw, o, i, S)) continue
      if (mask && mask[i]) R.bad++; else R.loose++
      R.flag.push(i)
    }
    return R
  }
  window.__V193I_CHK = { audit, hsl, px, skinRead }
})

const P1 = '#1a2a5a'
const KITS = [{ name: 'orange', p2: '#e0a070' }, { name: 'brown', p2: '#8a5a3a' }]
const worst = []   // for the picture
const report = {}

// ================= the field: everything ribRegisterTeam builds =================
for (const K of KITS) {
  const F = await page.evaluate(({ P1, P2 }) => {
    const C = window.__V193I_CHK, R = window.__V193I.register(P1, P2), seen = {}, groups = {}, cells = []
    const groupOf = (x) => x.sheet === 'v22' ? 'v22 moments' : x.sheet === 'base' ? 'baked atlas'
      : /^catchseq_/.test(x.src) ? 'catch sequence' : /^celebrate_/.test(x.src) ? 'field celebrate'
        : /^(throw|backpedal|handoff|toss|stance3|ready|carry)/.test(x.src) ? 'QB sheets' : 'field v91'
    for (const x of R) {
      if (!x.raw || seen[x.src]) continue
      seen[x.src] = 1
      const m = window.__V193C.mask(x.raw), a = C.audit(x.raw, x.cv, m && m.mask, P2), g = groupOf(x)
      const G = groups[g] || (groups[g] = { cells: 0, textures: 0, skin: 0, bad: 0, loose: 0, over: 0, worst: null, worstN: 0 })
      G.cells++; G.skin += a.skin; G.bad += a.bad; G.loose += a.loose
      const n = a.bad + a.loose; if (n > G.worstN) { G.worstN = n; G.worst = x.src }
      if (n > 2) G.over++
      if (n) cells.push({ src: x.src, n, flag: a.flag, raw: x.raw.toDataURL(), out: x.cv.toDataURL() })
    }
    for (const x of R) { const g = groupOf(x); if (groups[g]) groups[g].textures++ }
    cells.sort((a, b) => b.n - a.n)
    return { textures: R.length, cells: Object.keys(seen).length, groups, top: cells.slice(0, 4) }
  }, { P1, P2: K.p2 })
  report['field/' + K.name] = F
  worst.push(...F.top.map((c) => ({ ...c, tag: 'field/' + K.name })))
  console.log(`field (${K.name} p2 ${K.p2}): ${F.textures} textures from ${F.cells} drawn cells`)
  for (const [g, G] of Object.entries(F.groups)) console.log(`   ${g.padEnd(16)} ${String(G.cells).padStart(3)} cells (${G.textures} textures)  skin px ${G.skin}  in p2: mask ${G.bad}, loose ${G.loose}  cells over ${SKIN_P2_MAX}: ${G.over}${G.worst ? '  worst ' + G.worst + ' (' + G.worstN + ')' : ''}`)
}
{
  const names = ['field v91', 'QB sheets', 'catch sequence', 'field celebrate', 'v22 moments', 'baked atlas']
  const F = report['field/orange']
  ok(F.textures >= 400 && names.every((n) => F.groups[n] && F.groups[n].cells > 0), 'enumerated every sheet ribRegisterTeam builds: the v91 field poses, the QB sheets, the catch sequences, the field celebrations, the v22 moments, the baked atlas', names.map((n) => n + ' ' + (F.groups[n] ? F.groups[n].cells : 0)).join(', '))
  for (const K of KITS) {
    const R = report['field/' + K.name], over = Object.entries(R.groups).filter(([, G]) => G.over).map(([g, G]) => `${g}: ${G.over} (worst ${G.worst} ${G.worstN})`)
    const tot = Object.values(R.groups).reduce((s, G) => s + G.bad + G.loose, 0)
    ok(!over.length, `field, ${K.name} p2: no cell has more than ${SKIN_P2_MAX} skin pixels in the kit's second colour`, over.length ? over.join('; ') : `${tot} px over ${R.cells} cells`)
  }
}

// ================= the celebration bodies (src/28) =================
const CEL = await page.evaluate(async ({ P1, KITS }) => {
  const C = window.__V193I_CHK, asset = (p) => window.__RIB_ASSET ? window.__RIB_ASSET(p) : './public/' + p
  const loadMask = (p) => new Promise((res) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data, m = new Uint8Array(im.width * im.height); for (let i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0; res({ m, w: im.width }) }; im.onerror = () => res(null); im.src = asset(p) })
  const out = {}, top = []
  for (const [tag, API, base] of [['v161A bodies', window.__V161A, 'celebrations/cel_v161a_skin_'], ['v177I bodies', window.__V177I, 'celebrations/cel_v177i_skin_']]) {
    const M = API.manifest(), masks = { 1: await loadMask(base + '1x.png'), 2: await loadMask(base + '2x.png') }
    for (const K of KITS) {
      const G = out[tag + '/' + K.name] = { cells: 0, skin: 0, bad: 0, loose: 0, over: 0, worst: null, worstN: 0, masks: !!(masks[1] && masks[2]) }
      for (const name of Object.keys(M.anims)) {
        const frames = M.anims[name].frames
        for (let k = 0; k < frames.length; k++) for (const s of [1, 2]) {
          const raw = API.frameCanvas(name, k, s, null), kit = API.frameCanvas(name, k, s, { p1: P1, p2: K.p2, tone: '#4f3121' })
          const r = s === 2 ? frames[k].r2 : frames[k].r, MS = masks[s], w = raw.width, h = raw.height, mask = new Uint8Array(w * h)
          if (MS) for (let j = 0; j < w * h; j++) mask[j] = MS.m[(r[1] + ((j / w) | 0)) * MS.w + r[0] + (j % w)]
          const a = C.audit(raw, kit, mask, K.p2, true), n = a.bad + a.loose
          G.cells++; G.skin += a.skin; G.bad += a.bad; G.loose += a.loose; if (n > 2) G.over++
          if (n > G.worstN) { G.worstN = n; G.worst = name + '#' + k + '@' + s + 'x' }
          if (n > 2 && s === 1) top.push({ tag: tag + '/' + K.name, src: name + '#' + k, n, flag: a.flag, raw: raw.toDataURL(), out: kit.toDataURL() })
        }
      }
    }
  }
  top.sort((a, b) => b.n - a.n)
  return { out, top: top.slice(0, 4) }
}, { P1, KITS })
worst.push(...CEL.top)
for (const [g, G] of Object.entries(CEL.out)) console.log(`   ${g.padEnd(22)} ${String(G.cells).padStart(3)} frames  skin px ${G.skin}  in p2: mask ${G.bad}, loose ${G.loose}  frames over ${SKIN_P2_MAX}: ${G.over}${G.worst ? '  worst ' + G.worst + ' (' + G.worstN + ')' : ''}`)
{
  const all = Object.values(CEL.out)
  ok(all.length === 4 && all.every((G) => G.cells >= 50 && G.masks && G.skin > 1000), 'enumerated every celebration body frame (v161 A, v177 I) at 1x and 2x, with the generator\'s skin masks', Object.entries(CEL.out).map(([g, G]) => g + ' ' + G.cells).join(', '))
  const over = Object.entries(CEL.out).filter(([, G]) => G.over).map(([g, G]) => `${g}: ${G.over} (worst ${G.worst} ${G.worstN})`)
  ok(!over.length, `celebration bodies: no frame has more than ${SKIN_P2_MAX} skin pixels in the kit's second colour`, over.length ? over.join('; ') : 'clean')
}

// ================= the loading chase / the growth screen's boy (src/03) =================
const CH = await page.evaluate(({ P1, KITS }) => {
  const C = window.__V193I_CHK, out = {}, top = []
  const names = ['idle_dn', 'idle_sd', 'idle_up', 'run_sd0', 'run_sd3', 'run_dr2', 'run_dn5', 'run_up1', 'plant_sd', 'cut_sd', 'dive_sd', 'fall_sd', 'getup_dr3', 'getup_dr6', 'celebrate_dn1', 'celebrate_dr2', 'walk_dn0', 'hurt_dr1']
  for (const K of KITS) {
    const G = out[K.name] = { cells: 0, skin: 0, bad: 0, loose: 0, over: 0, worst: null, worstN: 0 }
    for (const n of names) {
      const raw = window.__CHASE_V94.cell(n, 'raw'), kit = window.__CHASE_V94.cell(n, [P1, K.p2]); if (!raw || !kit) continue
      const m = window.__V193C.mask(raw), a = C.audit(raw, kit, m && m.mask, K.p2), c = a.bad + a.loose
      G.cells++; G.skin += a.skin; G.bad += a.bad; G.loose += a.loose; if (c > 2) G.over++
      if (c > G.worstN) { G.worstN = c; G.worst = n }
      if (c > 2) top.push({ tag: 'chase/' + K.name, src: n, n: c, flag: a.flag, raw: raw.toDataURL(), out: kit.toDataURL() })
    }
  }
  top.sort((a, b) => b.n - a.n)
  return { out, top: top.slice(0, 2) }
}, { P1, KITS })
worst.push(...CH.top)
for (const [g, G] of Object.entries(CH.out)) console.log(`   chase/${g.padEnd(16)} ${String(G.cells).padStart(3)} cells  skin px ${G.skin}  in p2: mask ${G.bad}, loose ${G.loose}  cells over ${SKIN_P2_MAX}: ${G.over}${G.worst ? '  worst ' + G.worst + ' (' + G.worstN + ')' : ''}`)
{
  const over = Object.entries(CH.out).filter(([, G]) => G.over).map(([g, G]) => `${g}: ${G.over} (worst ${G.worst} ${G.worstN})`)
  ok(Object.values(CH.out).every((G) => G.cells >= 15) && !over.length, `the loading chase / growth screen's boy in a team kit: no cell has more than ${SKIN_P2_MAX} skin pixels in p2`, over.length ? over.join('; ') : 'clean')
}

// ================= the kill switch: the grow pass is what closes the field =================
const OFF = await page.evaluate(({ P1, P2 }) => {
  const C = window.__V193I_CHK, R = window.__V193I.register(P1, P2), seen = {}
  window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.skinGrowV193I = 0
  let n = 0, over = 0, cells = 0
  try {
    for (const x of R) {
      if (!x.raw || seen[x.src]) continue; seen[x.src] = 1
      const copy = document.createElement('canvas'); copy.width = 48; copy.height = 48; copy.getContext('2d').drawImage(x.raw, 0, 0)   // the mask cache is per canvas
      const m = window.__V193C.mask(copy), built = window.__V193C.kitCell(copy, P1, P2), a = C.audit(copy, built.cv, m && m.mask, P2)
      cells++; n += a.bad + a.loose; if (a.bad + a.loose > 2) over++
    }
  } finally { delete window.RIB_TUNE.skinGrowV193I }
  return { cells, n, over }
}, { P1, P2: KITS[0].p2 })
const onTot = Object.values(report['field/orange'].groups).reduce((s, G) => s + G.bad + G.loose, 0)
ok(OFF.n > onTot && OFF.over > 0, 'the grow pass is what closes it: with TU skinGrowV193I 0 the field cells leak skin into p2 again', `OFF ${OFF.n} px, ${OFF.over} cells over ${SKIN_P2_MAX}; ON ${onTot} px`)

// ================= what is not a separate cell =================
const src05 = fs.readFileSync(new URL('../src/05-field-renderer.js', import.meta.url), 'utf8')
ok(/sidePlayer\(team, u, vv, o\) \{[\s\S]{0,200}"spr_" \+ team \+ "_" \+ dir \+ "_idle"/.test(src05), 'the sideline backups draw the registered idle textures (measured above), not cells of their own')
ok(/_ageKV144/.test(src05) && !/addCanvas\([^)]*[aA]ge/.test(src05), 'the age scale (v144 A) is a sprite scale — no texture is built per age')

// ================= the picture =================
try {
  const shot = await page.evaluate((W) => {
    const Z = 5, rows = W.slice(0, 10), cv = document.createElement('canvas'), cell = 64
    cv.width = cell * Z * 3; cv.height = Math.max(1, rows.length) * cell * Z
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#20242c'; g.fillRect(0, 0, cv.width, cv.height)
    const load = (u) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = u })
    return Promise.all(rows.map(async (w, j) => {
      const a = await load(w.raw), b = await load(w.out), s = Math.min(cell / a.width, cell / a.height) * Z
      g.drawImage(a, 0, j * cell * Z, a.width * s, a.height * s); g.drawImage(b, cell * Z, j * cell * Z, b.width * s, b.height * s); g.drawImage(b, 2 * cell * Z, j * cell * Z, b.width * s, b.height * s)
      g.fillStyle = '#ff00ff'; for (const i of w.flag) g.fillRect(2 * cell * Z + (i % a.width) * s, j * cell * Z + ((i / a.width) | 0) * s, s, s)
      g.fillStyle = '#fff'; g.font = '14px monospace'; g.fillText(w.tag + ' ' + w.src + ' (' + w.n + ')', 4, j * cell * Z + 14)
    })).then(() => cv.toDataURL())
  }, worst.sort((a, b) => b.n - a.n))
  fs.writeFileSync(new URL('./_v193I_worst.png', import.meta.url), Buffer.from(shot.split(',')[1], 'base64'))
} catch (e) { console.log('INFO picture skipped: ' + e.message) }

ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
