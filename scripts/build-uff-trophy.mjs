import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { CHROME } from './lib/env.mjs'
/* ===== v147 B THE UFF TROPHY =====
 * The milestones card's trophy (public/menu/card_trophy_uff.webp) is ORIGINAL art, drawn here as an
 * SVG and rasterised through Chromium — it replaces card_trophy.webp, which was a Lombardi look-alike.
 * The UFF's cup is a FEDERATION SHIELD: a heater shield with a raised football and laurel on it, three
 * faceted stars for a crown, a gold UFF ribbon plate across the shield, laurel wrapped round the
 * outside, a chalice stem and a two-tier black plinth. Same frame as the old picture (900x560 aspect, the trophy at
 * ~74% across so `object-position:88% 50%` still finds it, the plinth's lower tier left clear for
 * the card's own "A HIGHER STANDARD" plate).
 *   node scripts/build-uff-trophy.mjs            -> public/menu/card_trophy_uff.webp
 *   PNG=1 node scripts/build-uff-trophy.mjs      -> also art/menu-proof/card_trophy_uff.png to LOOK at
 */
const W = 1350, H = 840, CX = 1000
const root = process.cwd()
const fontsCss = 'file://' + path.resolve(root, 'public/fonts/fonts.css')

// ---- seeded noise, so a rerun is byte-stable ---------------------------------------------------
let seed = 147
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
const f = (n) => Number(n.toFixed(2))

// the stadium's lights: a few tiers of bokeh sloping across the upper deck, thicker to the right
function bokeh() {
  let sharp = '', soft = ''
  for (let tier = 0; tier < 4; tier++) {
    for (let i = 0; i < 70; i++) {
      const x = rnd() * W
      const y = 250 + tier * 42 - (x - 600) * 0.07 + (rnd() - 0.5) * 26
      const near = Math.max(0, 1 - Math.abs(x - 1200) / 700)
      const r = 1.2 + rnd() * 2.6 + near * 2
      const a = 0.12 + rnd() * 0.35 + near * 0.35
      sharp += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#ffe3a8" opacity="${f(a)}"/>`
    }
  }
  for (let i = 0; i < 46; i++) {
    const x = rnd() * W, y = 120 + rnd() * 460
    soft += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(6 + rnd() * 16)}" fill="#ffd98a" opacity="${f(0.04 + rnd() * 0.12)}"/>`
  }
  // the rig on the right, where the old picture had its lights
  for (let i = 0; i < 9; i++) {
    const x = 1140 + i * 24, y = 262 - i * 6
    sharp += `<circle cx="${x}" cy="${y}" r="3.4" fill="#fff4d6" opacity=".9"/><circle cx="${x}" cy="${y}" r="9" fill="#ffd98a" opacity=".16"/>`
  }
  // dust in the beam
  let dust = ''
  for (let i = 0; i < 90; i++) {
    const t = rnd(), y = 40 + t * 640, half = 30 + t * 190
    const x = CX + 30 + (rnd() - 0.5) * 2 * half
    dust += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.6 + rnd() * 1.4)}" fill="#fff2cc" opacity="${f(0.15 + rnd() * 0.45)}"/>`
  }
  return { sharp, soft, dust }
}

// a laurel branch: leaves in pairs along a quadratic curve, each turned to the tangent
function laurel(p0, p1, p2, n, len, wid, flip, grad) {
  let out = ''
  const at = (t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]]
  // the stem
  out += `<path d="M${p0} Q${p1} ${p2}" fill="none" stroke="url(#${grad})" stroke-width="${f(wid * 0.35)}" stroke-linecap="round"/>`
  for (let i = 0; i < n; i++) {
    const t = 0.08 + (i / n) * 0.9
    const [x, y] = at(t), [x2, y2] = at(Math.min(1, t + 0.01))
    const ang = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI
    const s = (1 - t * 0.45)
    for (const side of [-1, 1]) {
      const a = ang + side * 38 * flip
      const L = len * s, Wd = wid * s
      out += `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" d="M0,0 C${f(L * 0.3)},${f(-Wd)} ${f(L * 0.75)},${f(-Wd)} ${f(L)},0 C${f(L * 0.75)},${f(Wd)} ${f(L * 0.3)},${f(Wd)} 0,0 Z" fill="url(#${grad})" stroke="#3a2606" stroke-width=".8"/>`
      out += `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})" d="M${f(L * 0.08)},0 L${f(L * 0.85)},0" stroke="#fff1c4" stroke-opacity=".55" stroke-width=".9"/>`
    }
  }
  // the tip leaf
  const [tx, ty] = at(1), [bx, by] = at(0.97)
  const ang = Math.atan2(ty - by, tx - bx) * 180 / Math.PI, L = len * 0.6, Wd = wid * 0.6
  out += `<path transform="translate(${f(tx)} ${f(ty)}) rotate(${f(ang)})" d="M0,0 C${f(L * 0.3)},${f(-Wd)} ${f(L * 0.75)},${f(-Wd)} ${f(L)},0 C${f(L * 0.75)},${f(Wd)} ${f(L * 0.3)},${f(Wd)} 0,0 Z" fill="url(#${grad})" stroke="#3a2606" stroke-width=".8"/>`
  return out
}

// a faceted five-point star: ten triangles, lit from the upper right
function star(cx, cy, R, r, rot = -90) {
  const pts = []
  for (let i = 0; i < 10; i++) { const a = (rot + i * 36) * Math.PI / 180, rr = i % 2 ? r : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]) }
  let out = `<path d="M${pts.map(p => p.map(f).join(',')).join(' L')} Z" fill="#3a2606" transform="translate(0 2)" opacity=".7"/>`
  const light = [0.55, -0.8]
  for (let i = 0; i < 10; i++) {
    const a = pts[i], b = pts[(i + 1) % 10]
    const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, m = Math.hypot(mx, my) || 1
    const d = (mx / m) * light[0] + (my / m) * light[1]
    const side = i % 2 ? 0.18 : -0.18
    const k = Math.max(0, Math.min(1, 0.5 + d * 0.42 + side))
    const c0 = [58, 38, 6], c1 = [255, 236, 170]
    const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k))
    out += `<path d="M${f(cx)},${f(cy)} L${f(a[0])},${f(a[1])} L${f(b[0])},${f(b[1])} Z" fill="rgb(${c})" stroke="rgb(${c})" stroke-width=".6"/>`
  }
  out += `<path d="M${pts.map(p => p.map(f).join(',')).join(' L')} Z" fill="none" stroke="#fff3c8" stroke-opacity=".5" stroke-width="1"/>`
  return out
}

function glint(x, y, s, a = 1) {
  return `<g transform="translate(${x} ${y})" opacity="${a}"><circle r="${s * 0.55}" fill="#fff6dc" opacity=".35" filter="url(#b6)"/>
    <path d="M0,${-s} L${s * 0.09},${-s * 0.09} L${s},0 L${s * 0.09},${s * 0.09} L0,${s} L${-s * 0.09},${s * 0.09} L${-s},0 L${-s * 0.09},${-s * 0.09} Z" fill="#fffaf0"/></g>`
}

// ---- the trophy -------------------------------------------------------------------------------
const cyl = (rx, yTop, yBot, ry) => `M${CX - rx},${yTop} L${CX - rx},${yBot} A${rx},${ry} 0 0 0 ${CX + rx},${yBot} L${CX + rx},${yTop} A${rx},${ry} 0 0 1 ${CX - rx},${yTop} Z`
// a revolved profile: [y, halfWidth] top to bottom
const lathe = (prof) => {
  const L = prof.map(([y, w]) => `${f(CX - w)},${y}`), R = prof.slice().reverse().map(([y, w]) => `${f(CX + w)},${y}`)
  return `M${L.join(' L')} L${R.join(' L')} Z`
}
const SHIELD = `M862,262 C930,250 972,238 1000,222 C1028,238 1070,250 1138,262 L1138,372 C1138,448 1082,490 1000,526 C918,490 862,448 862,372 Z`

function trophy() {
  const B = bokeh()
  const leftL = laurel([985, 520], [830, 470], [846, 268], 11, 42, 12, 1, 'leafL')
  const rightL = laurel([1015, 520], [1170, 470], [1154, 268], 11, 42, 12, -1, 'leafR')
  const innerL = laurel([992, 484], [930, 470], [920, 404], 6, 22, 7, 1, 'leafI')
  const innerR = laurel([1008, 484], [1070, 470], [1080, 404], 6, 22, 7, -1, 'leafI')
  const stem = lathe([[506, 60], [512, 52], [520, 40], [532, 24], [542, 19], [546, 30], [552, 34], [558, 30], [562, 19], [578, 22], [590, 38], [598, 58], [602, 66]])
  return { B, body: `
  <!-- plinth, lower tier -->
  <g>
    <path d="${cyl(212, 690, 772, 24)}" fill="url(#marble)"/>
    <path d="${cyl(212, 690, 772, 24)}" fill="url(#veins)" opacity=".4" filter="url(#veinF)" clip-path="url(#clipLow)"/>
    <path d="${cyl(212, 690, 772, 24)}" fill="url(#marbleSheen)"/>
    <path d="${cyl(213, 764, 772, 24)}" fill="url(#goldH)"/>
    <path d="${cyl(213, 690, 698, 24)}" fill="url(#goldH)"/>
    <ellipse cx="${CX}" cy="690" rx="213" ry="24" fill="url(#marbleTop)" stroke="url(#goldH)" stroke-width="2"/>
  </g>
  <!-- plinth, upper tier (the card lays its own "A HIGHER STANDARD" plate over the lower one) -->
  <g>
    <ellipse cx="${CX}" cy="692" rx="160" ry="19" fill="#000" opacity=".55" filter="url(#b6)"/>
    <path d="${cyl(152, 620, 690, 18)}" fill="url(#marble)"/>
    <path d="${cyl(152, 620, 690, 18)}" fill="url(#veins)" opacity=".4" filter="url(#veinF)"/>
    <path d="${cyl(152, 620, 690, 18)}" fill="url(#marbleSheen)"/>
    <path d="${cyl(153, 684, 690, 18)}" fill="url(#goldH)"/>
    <path d="${cyl(153, 620, 626, 18)}" fill="url(#goldH)"/>
    <ellipse cx="${CX}" cy="620" rx="153" ry="18" fill="url(#marbleTop)" stroke="url(#goldH)" stroke-width="2"/>
    <path d="${cyl(153, 650, 654, 18)}" fill="url(#goldH)" opacity=".85"/>
  </g>
  <!-- the outer laurel, behind the shield -->
  <g filter="url(#bevelSoft)">${leftL}${rightL}</g>
  <!-- stem, knop and cup -->
  <ellipse cx="${CX}" cy="614" rx="80" ry="10" fill="#000" opacity=".6" filter="url(#b3)"/>
  <path d="${cyl(76, 600, 614, 9)}" fill="url(#goldH)"/>
  <ellipse cx="${CX}" cy="600" rx="76" ry="9" fill="url(#goldTop)"/>
  <path d="${stem}" fill="url(#goldH)" filter="url(#bevelSoft)"/>
  <ellipse cx="${CX}" cy="506" rx="60" ry="9" fill="url(#cupIn)"/>
  <!-- the shield -->
  <g filter="url(#shadowSoft)">
    <g filter="url(#bevel)">
      <path d="${SHIELD}" fill="url(#goldShield)"/>
    </g>
    <path d="${SHIELD}" transform="translate(1000 374) scale(.885 .89) translate(-1000 -374)" fill="url(#field)"/>
    <path d="${SHIELD}" transform="translate(1000 374) scale(.885 .89) translate(-1000 -374)" fill="url(#brush)" opacity=".2"/>
    <path d="${SHIELD}" transform="translate(1000 374) scale(.885 .89) translate(-1000 -374)" fill="none" stroke="#2c1d04" stroke-opacity=".75" stroke-width="2.5"/>
    <path d="${SHIELD}" transform="translate(1000 376) scale(.86 .865) translate(-1000 -376)" fill="none" stroke="#fff0bd" stroke-opacity=".35" stroke-width="1.2"/>
    <!-- the words round the top of the field -->
    <path id="arcTop" d="M884,308 Q1000,256 1116,308" fill="none"/>
    <text font-family="Oswald" font-weight="600" font-size="10.5" letter-spacing="2.2" fill="#2c1d04" opacity=".85"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">UNITED FOOTBALL FEDERATION</textPath></text>
    <text font-family="Oswald" font-weight="600" font-size="10.5" letter-spacing="2.2" fill="#fff0bd" opacity=".35" transform="translate(0 1)"><textPath href="#arcTop" startOffset="50%" text-anchor="middle">UNITED FOOTBALL FEDERATION</textPath></text>
    <!-- the raised emblem: laurel under a football -->
    <g filter="url(#bevel)">
      ${innerL}${innerR}
      <path d="M912,366 C940,322 1060,322 1088,366 C1060,410 940,410 912,366 Z" fill="url(#ball)" stroke="#2c1d04" stroke-width="1.6"/>
    </g>
    <g fill="none" stroke-linecap="round">
      <path d="M944,337 C936,352 936,380 944,395" stroke="#3a2606" stroke-width="3.2" opacity=".75"/>
      <path d="M1056,337 C1064,352 1064,380 1056,395" stroke="#3a2606" stroke-width="3.2" opacity=".75"/>
      <path d="M953,334 C946,350 946,382 953,398" stroke="#fff0bd" stroke-width="1.6" opacity=".6"/>
      <path d="M1047,334 C1054,350 1054,382 1047,398" stroke="#fff0bd" stroke-width="1.6" opacity=".6"/>
      <path d="M968,351 C988,346 1012,346 1032,351" stroke="#fff6d8" stroke-width="3" opacity=".95"/>
      ${[0, 1, 2, 3, 4, 5].map(i => { const x = 973 + i * 10.8; return `<path d="M${f(x)},${f(343)} L${f(x)},${f(356)}" stroke="#fff6d8" stroke-width="2.4" opacity=".95"/>` }).join('')}
    </g>
    <!-- the UFF plate: a gold ribbon across the shield, its tails folded behind -->
    <path d="M936,424 L904,430 L916,446 L904,462 L940,458 Z" fill="url(#leafL)" stroke="#2c1d04" stroke-width="1.2"/>
    <path d="M1064,424 L1096,430 L1084,446 L1096,462 L1060,458 Z" fill="url(#leafR)" stroke="#2c1d04" stroke-width="1.2"/>
    <path d="M936,424 L940,458 L950,452 Z M1064,424 L1060,458 L1050,452 Z" fill="#2c1d04" opacity=".6"/>
    <g filter="url(#bevel)"><path d="M934,418 Q1000,408 1066,418 L1066,452 Q1000,442 934,452 Z" fill="url(#plate)" stroke="#3a2606" stroke-width="1.4"/></g>
    <text x="${CX}" y="446" text-anchor="middle" font-family="Oswald" font-weight="700" font-size="30" letter-spacing="8" fill="#fff4cf" opacity=".6" dx="4" dy="1.2">UFF</text>
    <text x="${CX}" y="446" text-anchor="middle" font-family="Oswald" font-weight="700" font-size="30" letter-spacing="8" fill="#2e1e03" dx="4">UFF</text>
    <!-- the crown: three faceted stars on the shoulders and the peak -->
    <path d="M992,226 L996,198 L1004,198 L1008,226 Z" fill="url(#goldH)"/>
    ${star(1000, 170, 40, 17)}
    ${star(896, 244, 22, 9.5, -96)}
    ${star(1104, 244, 22, 9.5, -84)}
  </g>
  <!-- the cup's front lip over the shield's point -->
  <path d="M940,506 A60,9 0 0 0 1060,506 L1060,512 A60,11 0 0 1 940,512 Z" fill="url(#goldH)"/>
  <path d="M940,506 A60,9 0 0 0 1060,506" fill="none" stroke="#fff4cf" stroke-width="1.4" opacity=".8"/>
  ` }
}

function page() {
  const T = trophy()
  const gold = (id, x2, y2, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`
  const GOLD_H = [[0, '#2e1d03'], [0.1, '#6b4a10'], [0.26, '#d8ad50'], [0.36, '#fff2c4'], [0.44, '#f0cc70'], [0.6, '#b6852a'], [0.78, '#6e4c11'], [0.9, '#a9802e'], [0.96, '#e6c77a'], [1, '#3a2605']]
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${fontsCss}">
<style>html,body{margin:0;background:#000}svg{display:block}</style></head><body>
<svg id="art" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <radialGradient id="bg" cx="${CX / W}" cy=".3" r=".85"><stop offset="0" stop-color="#1b1710"/><stop offset=".45" stop-color="#0a0a0c"/><stop offset="1" stop-color="#030304"/></radialGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0d0f"/><stop offset="1" stop-color="#040405"/></linearGradient>
  <radialGradient id="pool" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".30"/><stop offset=".5" stop-color="#c8963a" stop-opacity=".10"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4d0" stop-opacity=".45"/><stop offset=".55" stop-color="#ffd98a" stop-opacity=".10"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></linearGradient>
  <radialGradient id="src" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffbe8" stop-opacity=".95"/><stop offset=".3" stop-color="#ffe7a8" stop-opacity=".45"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
  ${gold('goldH', 1, 0, GOLD_H)}
  ${gold('goldTop', 1, 0.3, [[0, '#6b4a10'], [0.35, '#fff2c4'], [0.6, '#d3a64a'], [1, '#5a3d0b']])}
  ${gold('goldShield', 0.9, 1, [[0, '#fff3c8'], [0.14, '#eac566'], [0.34, '#a8781b'], [0.52, '#f6d888'], [0.64, '#c89a3c'], [0.84, '#6e4c11'], [1, '#3e2906']])}
  <radialGradient id="field" cx=".62" cy=".22" r=".95"><stop offset="0" stop-color="#b98c38"/><stop offset=".3" stop-color="#7a5314"/><stop offset=".7" stop-color="#3f2a07"/><stop offset="1" stop-color="#1e1403"/></radialGradient>
  <radialGradient id="ball" cx=".62" cy=".25" r=".85"><stop offset="0" stop-color="#fff6d4"/><stop offset=".22" stop-color="#f3d27c"/><stop offset=".6" stop-color="#b98a2e"/><stop offset="1" stop-color="#5a3d0b"/></radialGradient>
  ${gold('leafL', 1, 1, [[0, '#f7d98a'], [0.5, '#b8882c'], [1, '#5a3d0b']])}
  ${gold('leafR', 0, 1, [[0, '#fff2c4'], [0.45, '#dcb057'], [1, '#6b4a10']])}
  ${gold('leafI', 1, 1, [[0, '#fbe3a0'], [0.6, '#c49434'], [1, '#6b4a10']])}
  ${gold('plate', 0, 1, [[0, '#fff0bd'], [0.35, '#e0b75c'], [0.7, '#b58527'], [1, '#6e4c11']])}
  <radialGradient id="cupIn" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#1a1003"/><stop offset=".8" stop-color="#4a3208"/><stop offset="1" stop-color="#d8ad50"/></radialGradient>
  ${gold('marble', 1, 0, [[0, '#050506'], [0.18, '#141418'], [0.42, '#2a2b31'], [0.58, '#1a1b1f'], [0.85, '#0b0b0d'], [1, '#040405']])}
  ${gold('marbleSheen', 0, 1, [[0, '#ffe7a8'], [0.08, '#ffe7a8'], [0.3, '#000'], [1, '#000']])}
  <linearGradient id="marbleTop" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0c0c0e"/><stop offset=".55" stop-color="#34342f"/><stop offset="1" stop-color="#0e0e10"/></linearGradient>
  <linearGradient id="veins" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9a9aa2"/><stop offset="1" stop-color="#55555c"/></linearGradient>
  <pattern id="brush" width="${W}" height="${H}" patternUnits="userSpaceOnUse"><rect width="${W}" height="${H}" filter="url(#brushF)"/></pattern>
  <filter id="brushF" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".004 .45" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 .9  0 0 0 0 .6  0 0 0 .9 -.25"/></filter>
  <filter id="veinF" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".006 .022" numOctaves="5" seed="3" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 .78  0 0 0 0 .76  0 0 0 0 .74  1 0 0 0 0" result="a"/>
    <feComponentTransfer in="a" result="v"><feFuncA type="table" tableValues="0 0 0 0 0 .05 .9 .05 0 0 0 0"/></feComponentTransfer>
    <feComposite in="v" in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="bevel" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="blur"/>
    <feSpecularLighting in="blur" surfaceScale="4" specularConstant=".6" specularExponent="34" lighting-color="#fff3d0" result="spec"><fePointLight x="1180" y="40" z="260"/></feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3=".55" k4="0"/>
  </filter>
  <filter id="bevelSoft" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="blur"/>
    <feSpecularLighting in="blur" surfaceScale="3" specularConstant=".55" specularExponent="28" lighting-color="#fff3d0" result="spec"><fePointLight x="1180" y="40" z="240"/></feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3=".45" k4="0"/>
  </filter>
  <filter id="shadowSoft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="-4" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".7"/></filter>
  <filter id="b3"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="b6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="b20" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
  <filter id="b40" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>
  <filter id="bloom" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/><feColorMatrix type="matrix" values="1 0 0 0 0  0 .9 0 0 0  0 0 .6 0 0  0 0 0 .26 0"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter>
  <filter id="floorF" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency=".004 .03" numOctaves="3" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 .7  0 0 0 0 .7  0 0 0 0 .72  -1.4 0 0 0 .55"/></filter>
  <clipPath id="clipLow"><path d="${cyl(212, 690, 772, 24)}"/></clipPath>
  <linearGradient id="reflFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="reflMask" maskUnits="userSpaceOnUse" x="0" y="772" width="${W}" height="${H - 772}"><rect x="0" y="772" width="${W}" height="${H - 772}" fill="url(#reflFade)"/></mask>
  <g id="trophy">${T.body}</g>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<g filter="url(#b3)">${T.B.soft}</g>
<g>${T.B.sharp}</g>
<ellipse cx="${CX + 90}" cy="270" rx="330" ry="80" fill="#ffd98a" opacity=".07" filter="url(#b40)"/>
<!-- the floor -->
<rect x="0" y="742" width="${W}" height="${H - 742}" fill="url(#floor)"/>
<rect x="0" y="742" width="${W}" height="${H - 742}" filter="url(#floorF)" opacity=".35"/>
<rect x="0" y="742" width="${W}" height="2" fill="#000" opacity=".6"/>
<ellipse cx="${CX + 10}" cy="784" rx="380" ry="62" fill="url(#pool)"/>
<!-- the reflection -->
<g mask="url(#reflMask)" opacity=".55"><use href="#trophy" transform="translate(0 ${772 * 2}) scale(1 -1)" filter="url(#b3)"/></g>
<ellipse cx="${CX}" cy="774" rx="230" ry="16" fill="#000" opacity=".75" filter="url(#b6)"/>
<!-- the beam from above -->
<path d="M${CX + 18},-30 L${CX + 88},-30 L${CX + 260},760 L${CX - 200},760 Z" fill="url(#beam)" filter="url(#b20)"/>
<ellipse cx="${CX + 52}" cy="-6" rx="120" ry="70" fill="url(#src)"/>
<g>${T.B.dust}</g>
<!-- the trophy, and its bloom -->
<use href="#trophy"/>
<use href="#trophy" filter="url(#bloom)" style="mix-blend-mode:screen"/>
${glint(1012, 132, 26)}${glint(1128, 268, 16, 0.9)}${glint(1052, 345, 13, 0.85)}${glint(1150, 693, 12, 0.8)}${glint(906, 226, 10, 0.7)}
<rect width="${W}" height="${H}" filter="url(#grain)"/>
<!-- a vignette -->
<radialGradient id="vig" cx=".62" cy=".45" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>
<rect width="${W}" height="${H}" fill="url(#vig)"/>
</svg></body></html>`
}

const tmp = path.resolve(root, 'scripts/.uff-trophy.html')
fs.writeFileSync(tmp, page())
const browser = await chromium.launch({ executablePath: CHROME })
const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await pg.goto('file://' + tmp)
await pg.evaluate(() => document.fonts.ready)
await pg.waitForTimeout(300)
const png = await pg.locator('#art').screenshot({ type: 'png' })
// encode webp in the browser: no image library needed
const webp = await pg.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0)
  return c.toDataURL('image/webp', 0.86).split(',')[1]
}, png.toString('base64'))
await browser.close()
fs.unlinkSync(tmp)
const out = path.resolve(root, 'public/menu/card_trophy_uff.webp')
fs.writeFileSync(out, Buffer.from(webp, 'base64'))
if (process.env.PNG) { fs.mkdirSync(path.resolve(root, 'art/menu-proof'), { recursive: true }); fs.writeFileSync(path.resolve(root, 'art/menu-proof/card_trophy_uff.png'), png) }
if (process.env.OUT) fs.writeFileSync(process.env.OUT, png)
console.log(JSON.stringify({ out: path.relative(root, out), bytes: fs.statSync(out).size, w: W, h: H }))
