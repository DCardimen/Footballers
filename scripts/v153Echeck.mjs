// Dev check: v153 E — THE KIT READS, THE SHEET FITS, THE THUMB FITS, THE UNKNOWN IS BLACK. At a 400x860 phone:
//   1. the profile figure (src/28-cosmetics.js drawCharacter): for a red, a black-and-teal and a white kit the
//      jersey colour and the pants colour each cover a real area of the drawn man (pixel samples), and the source
//      art's navy is gone (it used to survive on the torso and the socks whatever he wore); an equipped helmet
//      shell colours the helmet and NOT the shoulders; the profile screen's own card draws his kit (team or
//      equipped), on the lit backdrop, and draws the same pixels twice (no Math.random)
//   2. the attribute sheet (07 screenUpgrade, v153 E THE SKILL SHEET ON ONE PAGE): each of the three groups is a
//      tab of a segmented control and fits the panel with no page scroll and no inner scroll box; every row of the
//      open group is on screen; the +/- steppers and the tabs are >= 36px; KEY badges match the position; every
//      stat keeps its v67 cap readout and a soft-cap bar that moves when a point is spent; HOW PRICES WORK opens
//   3. the thumb floor (25-shell v153 E THE THUMB): on the hub (5 tabs), the sheet, the season, the locker (gear,
//      style), the tree, settings, the profile (card, case, book), the Hall, the stats (both tabs), the boards and
//      goals: no visible text under 11px and no visible tap target under 36px (the collection book's medal grid,
//      ten to a row, is held to 36px tall and 30px wide); the screen's name rides the ticker
//   4. the Legacy book: a locked medal is a solid black silhouette (screenshot pixels, full opacity), in the grid,
//      in the detail panel, and on the trophy case's NEXT MILESTONE preview
//   5. no page errors
//   node scripts/v153Echeck.mjs        (GAME_URL=http://localhost:5173/)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, GAME_URL } from './lib/env.mjs'
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots/'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')))
await page.addInitScript(() => { setInterval(() => { document.querySelector('.onboard')?.remove(); document.getElementById('splash')?.remove() }, 60) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const E = (fn, arg) => page.evaluate(fn, arg)
const wait = ms => page.waitForTimeout(ms)
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'v153E-' + name + '.png' }) } catch {} }

await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 60000 }); await wait(1200)
await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 60000 }); await wait(1200)   // past vite's one-time reload
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && window.RIB_COSMETICS && window.__V153E, null, { timeout: 60000 })
// the career: through the new-career wizard by its own buttons
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
await E(({ visSrc }) => { const v = eval(visSrc); const b = [...document.querySelectorAll('button,[onclick],a')].filter(v).find(e => /START NEW CAREER/.test(e.innerText || '')); b && b.click() }, { visSrc: vis }); await wait(700)
for (let i = 0; i < 8; i++) {
  const done = await E(({ visSrc }) => {
    const v = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(v); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false } }
    const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (card) { card.click(); return false } return true
  }, { visSrc: vis })
  await wait(450); if (done) break
}
const pos = await E(() => { const s = window.__getGridironState(); return s.player && s.player.pos })
ok(!!pos, 'a career is running', pos)
await page.waitForFunction(() => window.__V153E.fig.img, null, { timeout: 20000 }).catch(() => {})

// ================= 1. the profile figure =================
const FIGJS = `(() => {
  const D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // share of the drawn man's opaque pixels within 42 of a colour; the rows are fractions of his ink box
  window.__figShare = (cv, hex, y0 = 0, y1 = 1, x0 = 0, x1 = 1) => {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height, d = x.getImageData(0, 0, W, H).data;
    let t = -1, b = -1, l = W, r = -1;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (d[(y * W + xx) * 4 + 3] > 200) { if (t < 0) t = y; b = y; if (xx < l) l = xx; if (xx > r) r = xx }
    const want = window.__V153E.shadeKit(hx(hex), 1); let n = 0, hit = 0;
    for (let y = Math.round(t + (b - t) * y0); y < Math.round(t + (b - t) * y1); y++) for (let xx = Math.round(l + (r - l) * x0); xx < Math.round(l + (r - l) * x1); xx++) {
      const i = (y * W + xx) * 4; if (d[i + 3] < 200) continue; n++; if (D([d[i], d[i + 1], d[i + 2]], want) < 42) hit++ }
    return n ? +(hit / n).toFixed(3) : 0 };
  // the source art's navy: hue 200-250, saturated, dark
  window.__navyShare = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, nv = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; n++; const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx < 30 || mx !== b || mx === mn) continue; const hue = 60 * ((r - g) / (mx - mn)) + 240; if (hue >= 205 && hue <= 235 && (mx - mn) / mx > 0.45) nv++ }
    return n ? +(nv / n).toFixed(3) : 0 };
})()`
await E(FIGJS)
const kits = [
  { name: 'red/white', k: { j: '#c8102e', p: '#ffffff' } },
  { name: 'black/teal', k: { j: '#101418', p: '#1fb5b0' } },
  { name: 'white/navy', k: { j: '#f4f4f4', p: '#0b2a5a' } },
  { name: 'orange/purple', k: { j: '#ff7a00', p: '#5a2a8a' } },
]
for (const { name, k } of kits) {
  const r = await E((k) => { const cv = document.createElement('canvas'); document.body.appendChild(cv); const res = window.RIB_COSMETICS.drawCharacter(cv, k, 22)
    const out = { mode: res && res.mode, v153: !!(res && res.v153), torso: window.__figShare(cv, k.j, 0.4, 0.6, 0.3, 0.7), pants: window.__figShare(cv, k.p, 0.66, 0.8, 0.25, 0.75), navy: window.__navyShare(cv) }; cv.remove(); return out }, k)
  ok(r.v153 && r.torso > 0.35 && r.pants > 0.3, `profile figure, ${name} kit: the jersey and the pants wear the kit's colours (share of the torso / pants boxes)`, r)
  if (!/navy/.test(name)) ok(r.navy < 0.03, `profile figure, ${name} kit: none of the source art's navy survives (it stayed on the torso and socks)`, r.navy)
}
// an equipped helmet: the shell colour is on the helmet, not on the shoulders
const hel = await E(() => { const cv = document.createElement('canvas'); document.body.appendChild(cv)
  window.RIB_COSMETICS.drawCharacter(cv, { j: '#c8102e', p: '#ffffff', hs: '#1e8a3a', hst: '#ffd76f', hf: 'matte' }, 22)
  const out = { helmet: window.__figShare(cv, '#1e8a3a', 0.02, 0.2, 0.3, 0.7), shoulders: window.__figShare(cv, '#1e8a3a', 0.3, 0.42, 0, 0.22) + window.__figShare(cv, '#1e8a3a', 0.3, 0.42, 0.78, 1) }; cv.remove(); return out })
ok(hel.helmet > 0.15 && hel.shoulders < 0.05, 'an equipped helmet shell colours the helmet, never the shoulder pads', hel)
// the same kit twice draws the same pixels (no randomness in the recolour)
const same = await E(() => { const a = document.createElement('canvas'), b = document.createElement('canvas'); const k = { j: '#0c5a2a', p: '#f0bb45', t: '#f0bb45', pat: 'camo' }
  window.RIB_COSMETICS.drawCharacter(a, k, 16); window.RIB_COSMETICS.drawCharacter(b, k, 16); const x = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, y = b.getContext('2d').getImageData(0, 0, b.width, b.height).data
  let diff = 0; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diff++; return diff })
ok(same === 0, 'the recolour is deterministic (the same kit draws the same pixels)', same)
// the profile screen itself: his card draws his kit on the lit backdrop
await E(() => { window.__HUB_V75.tabs.profile = 'card'; window.go('profile') }); await wait(1600)
const prof = await E(() => { const cv = document.querySelector('#screen .pc-cv-v151b'), kit = window.RIB_COSMETICS.profile().cosmetics.kit, fig = document.querySelector('#screen .pc-fig-v151b')
  const bg = fig ? getComputedStyle(fig).backgroundImage : ''
  return { kit: { j: kit.j, p: kit.p }, hi: cv && cv.classList.contains('hi'), jersey: cv ? window.__figShare(cv, kit.j) : 0, pants: cv ? window.__figShare(cv, kit.p) : 0, navy: cv ? window.__navyShare(cv) : 1, lit: /radial-gradient/.test(bg) && /109, 124, 147|6d7c93/i.test(bg), rim: cv ? /drop-shadow/.test(getComputedStyle(cv).filter) : false } })
ok(prof.hi && prof.jersey > 0.12 && prof.pants > 0.1, "the profile card draws HIM in his kit's colours (the team's, or what he has equipped)", prof)
ok(prof.lit && prof.rim, 'the figure stands on a lit backdrop with a rim light, not the old near-black box', { lit: prof.lit, rim: prof.rim })
await shot('profile')

// ================= 2. the attribute sheet =================
await E(() => { const s = window.__getGridironState(); s.player.points = 20; window.__upGroupV97 = null; window.go('upgrade') }); await wait(1200)
const groups = await E(() => [...document.querySelectorAll('.up-seg-v153 button')].map(b => b.dataset.g))
ok(groups.length >= 3 && groups.includes('PHYSICAL') && groups.includes('BALL SKILLS') && groups.includes('MENTAL'), 'the three groups are a segmented control', groups)
const measureSheet = () => E(() => {
  const sc = document.getElementById('screen'), se = document.scrollingElement, sr = sc.getBoundingClientRect()
  const grp = document.querySelector('.up-group-v97.on'), rows = grp ? [...grp.querySelectorAll('.up-attr')] : []
  const inView = rows.filter(r => { const b = r.getBoundingClientRect(); return b.top >= sr.top - 1 && b.bottom <= sr.bottom + 1 }).length
  const steps = [...grp.querySelectorAll('.step')].map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) })
  const seg = [...document.querySelectorAll('.up-seg-v153 button')].map(b => b.getBoundingClientRect().height)
  const P = window.__getGridironState().player, W = window.__GRIDIRON_AUDIT__ && window.__GRIDIRON_AUDIT__.POSITIONS
  return { g: grp && grp.dataset.g, rows: rows.length, inView, page: se.scrollHeight <= innerHeight + 2, panelOver: sc.scrollHeight - sc.clientHeight,
    fills: [...sc.querySelectorAll('.fill-v146')].filter(e => e.getClientRects().length).length, minStep: Math.min(...steps), minSeg: Math.min(...seg),
    keys: [...grp.querySelectorAll('.up-attr.key')].length, keyTags: [...grp.querySelectorAll('.up-attr .weight-tag')].length,
    bars: [...grp.querySelectorAll('.up-bar-v153 i')].filter(i => parseFloat(i.style.width) > 0).length }
})
for (const g of groups) {
  await E((g) => window.upSegV153(g), g); await wait(350)
  const m = await measureSheet()
  ok(m.g === g && m.rows > 0 && m.inView === m.rows && m.page && m.panelOver <= 2 && m.fills === 0, `SKILLS · ${g}: every row on one page (no page scroll, no inner scroll box)`, m)
  ok(m.minStep >= 36 && m.minSeg >= 36, `SKILLS · ${g}: the +/- steppers and the tabs are at least 36px`, { step: m.minStep, seg: m.minSeg })
  ok(m.keyTags === m.keys && m.bars === m.rows, `SKILLS · ${g}: a KEY badge on each key stat, a soft-cap bar on every row`, { keys: m.keys, tags: m.keyTags, bars: m.bars })
  if (g === 'PHYSICAL') await shot('skills')
}
const all = await E(() => { const W = window.__CAPV67, P = window.__getGridironState().player
  const caps = [...document.querySelectorAll('.up-cap')]; const k = caps.map(e => e.id.slice(4)).find(k => W.cost(P, k) === 1 && W.cap(P, k) - P.attrs[k] > 2) || 'speed'
  window.upSegV153([...document.querySelectorAll('.up-group-v97')].find(g => g.querySelector('#cap-' + k)).dataset.g)
  const bar = document.querySelector('#bar-' + k + ' i'), w0 = parseFloat(bar.style.width), p0 = P.points
  document.getElementById('plus-' + k).click()
  return { caps: caps.length, filled: caps.filter(e => /soft cap|MAXED/i.test(e.textContent)).length, k, w0, w1: parseFloat(document.querySelector('#bar-' + k + ' i').style.width), spent: p0 - P.points, uv: document.getElementById('uv-' + k).textContent, attr: Math.round(P.attrs[k]) } })
ok(all.caps >= 17 && all.filled === all.caps, 'all seventeen stats keep their v67 soft-cap readout (hidden groups included)', all)
ok(all.spent === 1 && all.w1 > all.w0 && +all.uv === all.attr, 'a tap on + spends a point, moves the number and fills the soft-cap bar', all)
const how = await E(() => { const b = document.querySelector('.up-how-b-v153'), r = b.getBoundingClientRect(); b.click(); const n = document.querySelector('.up-how-note-v153'); const open = getComputedStyle(n).display !== 'none'; const txt = n.textContent; b.click(); return { h: r.height, open, closed: getComputedStyle(n).display === 'none', soft: /soft cap/.test(txt) && /KEY/.test(txt) } })
ok(how.open && how.closed && how.soft && how.h >= 36, 'HOW PRICES WORK opens the full pricing note (and the KEY line) and closes again', how)

// ================= 3. the thumb floor =================
const FLOOR = 11, TAP = 36
const audit = () => E(({ FLOOR, TAP }) => {
  const small = [], taps = []
  const on = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth }
  // clipped by a scroller (a list's rows below its fold): not on screen
  const clipped = el => { const r = el.getBoundingClientRect(); for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/auto|scroll|hidden/.test(cs.overflowY + cs.overflowX)) { const q = p.getBoundingClientRect(); if (r.bottom <= q.top + 1 || r.top >= q.bottom - 1 || r.right <= q.left + 1 || r.left >= q.right - 1) return true } } return false }
  for (const el of document.querySelectorAll('#app *, #dock *, #navV139 *')) {
    if (!on(el) || clipped(el)) continue
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (own) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < FLOOR - 0.01) small.push(fs + 'px ' + String(el.className || el.tagName).slice(0, 28) + ' "' + el.textContent.trim().slice(0, 16) + '"') }
    if (el.matches('button,[onclick],a[href],input:not([type=hidden]),select,.hubv75-tab')) {
      const r = el.getBoundingClientRect()
      if (el.matches('.lgb-cell')) { if (r.height < TAP - 0.5 || r.width < 30) taps.push(Math.round(r.width) + 'x' + Math.round(r.height) + ' lgb-cell') }   // ten medals to a row
      else if (r.height < TAP - 0.5 || r.width < TAP - 0.5) taps.push(Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + String(el.className || el.tagName).slice(0, 28) + ' "' + (el.textContent || '').trim().slice(0, 14) + '"')
    }
  }
  const se = document.scrollingElement
  return { view: window.__getGridironState().view, small: [...new Set(small)], taps: [...new Set(taps)], page: se.scrollHeight <= innerHeight + 2, tick: (document.getElementById('tickTitleV153') || {}).textContent || '' }
}, { FLOOR, TAP })
const SCREENS = [['hub', 'now'], ['hub', 'body'], ['hub', 'skills'], ['hub', 'team'], ['hub', 'story'], ['upgrade'], ['season', 'sched'], ['season', 'body'], ['locker', 'gear'], ['locker', 'style'],
  ['shop', 'nodes'], ['shop', 'perks'], ['settings', 'game'], ['settings', 'sound'], ['settings', 'save'], ['profile', 'card'], ['profile', 'case'], ['profile', 'book'], ['hof'], ['stats', 'lead'], ['stats', 'odds'], ['leaderboard'], ['challenges']]
for (const [v, sec] of SCREENS) {
  await E(([v, sec]) => { if (sec && window.__HUB_V75) window.__HUB_V75.tabs[v] = sec; try { window.go(v) } catch (e) {} }, [v, sec]); await wait(1300)
  const a = await audit()
  const tag = v + (sec ? ':' + sec : '')
  ok(a.view === v && a.small.length === 0, `${tag}: no text under ${FLOOR}px`, a.small.slice(0, 6))
  ok(a.taps.length === 0, `${tag}: no tap target under ${TAP}px`, a.taps.slice(0, 6))
  ok(a.page && a.tick.length > 2, `${tag}: no page scroll; the screen's name rides the ticker`, a.tick)
  if (['hub', 'stats', 'settings'].includes(v) && sec && ['now', 'lead', 'game'].includes(sec)) await shot(v)
}
// the stats screen's table has the panel to itself now (it was squeezed to three rows beside the odds card)
await E(() => { window.__HUB_V75.tabs.stats = 'lead'; window.go('stats') }); await wait(1300)
const st = await E(() => { const t = [...document.querySelectorAll('#screen .hubv75-sec.on .card')].find(c => c.querySelector('.lb-hdr')); return { tabs: [...document.querySelectorAll('#screen .hubv75-tab')].map(t => t.dataset.sec), h: t ? Math.round(t.getBoundingClientRect().height) : 0 } })
ok(st.tabs.join() === 'lead,odds' && st.h >= 300, 'stats: LEADERS and PROMOTION are tabs; the leaders table gets the panel (>= 300px)', st)

// ================= 4. the Legacy book: unknown medals are black =================
await E(() => { window.__HUB_V75.tabs.profile = 'book'; window.go('profile') }); await wait(1600)
const blackness = async (sel) => {
  const el = await page.$(sel); if (!el) return null
  const b64 = (await el.screenshot()).toString('base64')
  return E(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0)
    const d = x.getImageData(Math.round(im.width * 0.25), Math.round(im.height * 0.25), Math.round(im.width * 0.5), Math.round(im.height * 0.5)).data; let n = 0, black = 0
    for (let i = 0; i < d.length; i += 4) { n++; if (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 38) black++ } return +(black / n).toFixed(3) }, b64)
}
const lk = await E(() => { const m = document.querySelector('.lgb-cell.locked .lg-medal-v152'), cs = m && getComputedStyle(m); return { n: document.querySelectorAll('.lgb-cell.locked .lg-locked').length, filter: cs && cs.filter, opacity: cs && +cs.opacity } })
ok(lk.n > 20 && /brightness\(0\)/.test(lk.filter) && lk.opacity === 1, 'every locked medal in the book is brightness(0) at full opacity', lk)
const gridBlack = await blackness('.lgb-cell.locked.ms .lg-medal-v152')
ok(gridBlack != null && gridBlack > 0.25, 'a locked medal in the grid is a solid black silhouette (screenshot pixels)', gridBlack)
const ownBlack = await blackness('.lgb-cell:not(.locked) .lg-medal-v152')
ok(ownBlack != null && ownBlack < 0.2, 'an earned medal is still drawn in its metal', ownBlack)
await E(() => { const c = [...document.querySelectorAll('.lgb-cell.locked')][5]; c && c.click() }); await wait(500)
const det = await E(() => { const m = document.querySelector('.lgb-detail .lg-medal-v152'); return { locked: !!(m && m.classList.contains('lg-locked')), op: m ? +getComputedStyle(m).opacity : 0 } })
const detBlack = await blackness('.lgb-detail .lg-medal-v152')
ok(det.locked && det.op === 1 && detBlack > 0.3, 'the detail panel shows a locked medal black too', { ...det, black: detBlack })
await shot('book')
await E(() => { window.__HUB_V75.tabs.profile = 'case'; window.go('profile') }); await wait(1500)
const nx = await E(() => { const m = document.querySelector('.lgk-next .lg-medal-v152'); return { locked: !!(m && m.classList.contains('lg-locked')) } })
const nxBlack = await blackness('.lgk-next .lg-medal-v152')
ok(nx.locked && nxBlack > 0.25, 'the trophy case\'s NEXT MILESTONE preview is a black silhouette', { ...nx, black: nxBlack })
const ovl = await E(() => { const R = window.__V152A_UI; return typeof (window.RIB_LEGACY && window.RIB_LEGACY.milestone) === 'function' })
if (ovl) {
  await E(() => window.RIB_LEGACY.milestone(10)); await wait(700)
  const mo = await E(() => { const m = document.querySelector('.lgm-next .lg-medal-v152'); return { locked: !!(m && m.classList.contains('lg-locked')) } })
  ok(mo.locked, 'the milestone card\'s NEXT medal is locked (black) too', mo)
  await E(() => document.querySelectorAll('.lgm-ok').forEach(b => b.click())); await wait(500)
}

// ================= 5. errors =================
ok(errs.length === 0, 'no page errors', errs.slice(0, 5))
console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
