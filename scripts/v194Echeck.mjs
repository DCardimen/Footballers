// v194 E THE BUILD SETS THE CEILING — the build (the projected frame against the position's ideal) moves every
// stat's max (the soft cap `drSoftCap` and the growth ceiling), within a range, through one multiplier.
//
//   1. the maxes rise monotonically with the build fit, at every position
//   2. a frame built for the position beats a miscast one on every KEY stat, and key stats swing harder
//   3. the kill switch (TU v194E 0) is the old max exactly
//   4. the position screen shows it: a grade on every card, the preview card's chips, grade, why and "max N" bars,
//      and flipping a chip redraws it live
//   5. the skill sheet: the grade strip, a 🧬 tag per row, the "hit its max" toast
//   6. "📈 Ceiling raised!" when a max rises (a better frame), silent on a first look
//   7. an existing save (no snapshot) reloads with every attribute exactly where it was, no page errors
import { launch, gameUrl } from './lib/env.mjs'

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push(String(e)))
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }

await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1200)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click (t) {
  await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const el = [...document.querySelectorAll('button,[onclick],a')].filter(vis).find(e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))
    if (el) el.click()
  }, { t, visSrc: vis })
  await page.waitForTimeout(600)
}
for (const t of ['NEXT', 'NEXT', 'NEXT', 'NEW CAREER']) await click(t)
for (let i = 0; i < 6; i++) {
  const v = await page.evaluate(() => window.__GRIDIRON_AUDIT__.getState().view)
  const shown = await page.evaluate(() => !!document.getElementById('bfCardV194E'))
  if (v === 'choosePos' && shown && i > 1) break
  await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || '').replace(/\s+/g, ' ').trim()
    for (const w of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(w)); if (b) { b.click(); return } }
  }, { visSrc: vis })
  await page.waitForTimeout(600)
}

// ---------- 1-3. the numbers ----------
const num = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, V = window.__V194E, P = A.POSITIONS, e = A.getState().player
  const IDEAL = { QB: [75, 225], RB: [70, 215], WR: [73, 195], TE: [77, 250], OL: [77, 315], DL: [75, 290], LB: [74, 245], CB: [71, 190], S: [72, 205] }
  const out = { mono: [], beat: [], swing: [], range: [] }
  for (const pos in IDEAL) {
    const [h, w] = IDEAL[pos], far = [h + 9, w + 110, 20], near = [h, w, 95]
    let prevB = -1, prevCaps = null, monoOk = true, fitOk = true
    for (let i = 0; i <= 10; i++) {
      const f = i / 10, body = { height: Math.round(far[0] + (near[0] - far[0]) * f), weight: Math.round(far[1] + (near[1] - far[1]) * f), muscle: Math.round(far[2] + (near[2] - far[2]) * f) }
      const fit = V.fit(body, pos)
      if (fit.b < prevB - 1e-9) fitOk = false
      prevB = fit.b
      const caps = A.ATTRS.map(k => V.capAt(body, pos, k, e))
      if (prevCaps && caps.some((c, j) => c < prevCaps[j])) monoOk = false
      prevCaps = caps
    }
    out.mono.push({ pos, monoOk, fitOk })
    const good = { height: near[0], weight: near[1], muscle: near[2] }, bad = { height: far[0], weight: far[1], muscle: far[2] }
    const keys = Object.keys(P[pos].w)
    const beat = keys.filter(k => V.capAt(good, pos, k, e) > V.capAt(bad, pos, k, e))
    out.beat.push({ pos, n: beat.length, of: keys.length })
    const topKey = keys.sort((a, b) => P[pos].w[b] - P[pos].w[a])[0], other = A.ATTRS.find(k => !P[pos].w[k])
    const tmp = Object.assign({}, e, { pos, body: good })
    out.swing.push({ pos, key: V.mul(topKey, tmp), other: other ? V.mul(other, tmp) : 0 })
    const tb = Object.assign({}, e, { pos, body: bad })
    out.range.push({ pos, hi: V.mul(topKey, tmp), lo: V.mul(topKey, tb), gGood: V.fit(good, pos).grade, gBad: V.fit(bad, pos).grade })
  }
  // the kill switch: the old max exactly (statCeilV17 alone)
  const body = { height: 70, weight: 215, muscle: 95 }, tmp = Object.assign({}, e, { pos: 'RB', body })
  const on = V.cap('speed', tmp)
  window.RIB_TUNE.v194E = 0
  const off = V.cap('speed', tmp), mOff = A.ATTRS.every(k => V.mul(k, tmp) === 1)
  delete window.RIB_TUNE.v194E
  return { ...out, on, off, mOff }
})
ok(num.mono.every(r => r.fitOk), 'the fit climbs as the frame walks toward the ideal', num.mono.filter(r => !r.fitOk).map(r => r.pos).join(',') || 'all 9 positions')
ok(num.mono.every(r => r.monoOk), 'every max rises monotonically with the build fit', num.mono.filter(r => !r.monoOk).map(r => r.pos).join(',') || 'all 9 positions, 18 stats')
ok(num.beat.every(r => r.n === r.of), 'a frame built for the position beats a miscast one on every key stat', num.beat.map(r => r.pos + ' ' + r.n + '/' + r.of).join(' '))
ok(num.swing.every(r => r.key > r.other && r.other > 1), 'key stats swing harder than the rest, and a great build lifts the rest too', num.swing.map(r => r.pos + ' ' + r.key.toFixed(3) + '/' + r.other.toFixed(3)).join(' '))
ok(num.range.every(r => r.hi >= 1.15 && r.hi <= 1.25 && r.lo <= 0.92 && r.lo >= 0.85), 'the range is sensible (about ×0.87 … ×1.22 on the heaviest stat)', num.range.map(r => r.pos + ' ' + r.lo.toFixed(2) + '…' + r.hi.toFixed(2) + ' ' + r.gBad + '→' + r.gGood).join(' '))
ok(num.mOff && num.on > num.off, 'TU v194E 0 is the old max exactly (multiplier 1)', 'RB speed max ' + num.off + ' → ' + num.on + ' with an ideal frame')

// ---------- 4. the position screen ----------
const pos = await page.evaluate(() => {
  const card = document.getElementById('bfCardV194E')
  const posCards = [...document.querySelectorAll('.pos-card:not(.trait-card-v112)')]
  const r = {
    card: !!card,
    chips: card ? card.querySelectorAll('[data-bfpos]').length : 0,
    rows: card ? card.querySelectorAll('.bf-row-v194e').length : 0,
    maxes: card ? [...card.querySelectorAll('.bf-max-v194e')].every(m => /max \d+/.test(m.textContent)) : false,
    markers: card ? card.querySelectorAll('.bf-bar-v194e > b').length : 0,
    why: card ? card.querySelectorAll('.bf-why-v194e li').length : 0,
    grade: card ? card.querySelector('.bf-head-v194e .bf-grade-v194e').textContent : '',
    cardGrades: posCards.filter(c => c.querySelector('.bf-grade-v194e')).length,
    posCards: posCards.length
  }
  return r
})
ok(pos.card && pos.chips === 9 && pos.rows >= 6 && pos.maxes && pos.markers === pos.rows && pos.why === 3, 'the position screen previews the maxes: 9 chips, a grade, three reasons, a "max N" marker per key stat', JSON.stringify(pos))
ok(pos.posCards === 9 && pos.cardGrades === 9, 'every position card carries its build grade', pos.cardGrades + '/' + pos.posCards)
const flip = await page.evaluate(() => {
  const card = document.getElementById('bfCardV194E'), chips = [...card.querySelectorAll('[data-bfpos]')]
  const before = card.querySelector('#bfBodyV194E').innerHTML, view = window.__GRIDIRON_AUDIT__.getState().view
  chips[chips.length - 1].click()
  const after = card.querySelector('#bfBodyV194E').innerHTML
  return { changed: before !== after, on: chips[chips.length - 1].classList.contains('on'), stay: window.__GRIDIRON_AUDIT__.getState().view === view, sel: window.__bfSelV194E, posSet: !!window.__GRIDIRON_AUDIT__.getState().player.pos }
})
ok(flip.changed && flip.on && flip.stay && !flip.posSet, 'flipping a chip redraws the preview live (and never picks the position)', JSON.stringify(flip))
await page.evaluate(() => document.getElementById('bfCardV194E').scrollIntoView({ block: 'start' }))
await page.waitForTimeout(400)
await page.screenshot({ path: 'scripts/_v194E_pos.png' })

// ---------- 5. pick, then the skill sheet ----------
await page.evaluate(() => document.querySelector('.pos-card:not(.trait-card-v112)').click())
await page.waitForTimeout(1200)
await page.evaluate(() => { const e = window.__GRIDIRON_AUDIT__.getState().player; e.points = 60; window.go('upgrade') })
await page.waitForTimeout(800)
const up = await page.evaluate(() => {
  const e = window.__GRIDIRON_AUDIT__.getState().player
  const strip = document.getElementById('bfUpV194E')
  const tags = document.querySelectorAll('.up-cap .bf-tag-v194e').length
  // a stat one below its max: the +1 that reaches it says so
  const k = window.__GRIDIRON_AUDIT__.ATTRS.find(k => window.__V194E.cap(k) - Math.round(e.attrs[k]) > 1) || 'speed'
  e.attrs[k] = window.__V194E.cap(k) - 1
  window.alloc(k, 1)
  const toast = (document.getElementById('toast') || {}).textContent || ''
  const capTxt = (document.getElementById('cap-' + k) || {}).textContent || ''
  return { strip: strip ? strip.textContent.replace(/\s+/g, ' ').trim() : '', tags, k, toast, capTxt }
})
ok(/Build fit/.test(up.strip), 'the skill sheet names the build grade and what it does to the maxes', up.strip)
ok(up.tags >= 1, 'the rows carry the build\'s 🧬 push on each max', up.tags + ' tagged rows')
ok(/hit its max/.test(up.toast) && /AT MAX/.test(up.capTxt), 'a +1 that reaches a max says so (toast + 🎯 AT MAX on the row)', up.k + ': ' + up.toast + ' | ' + up.capTxt)
await page.screenshot({ path: 'scripts/_v194E_upgrade.png' })

// ---------- 6. Ceiling raised! ----------
const raise = await page.evaluate(async () => {
  const A = window.__GRIDIRON_AUDIT__, s = A.getState(), e = s.player
  window.go('hub')
  await new Promise(r => setTimeout(r, 200))
  const n0 = window.__V194E.toasts()
  window.go('hub') // a second look with nothing changed: silent
  await new Promise(r => setTimeout(r, 200))
  const n1 = window.__V194E.toasts()
  // a better frame: the position's ideal
  const IDEAL = { QB: [75, 225], RB: [70, 215], WR: [73, 195], TE: [77, 250], OL: [77, 315], DL: [75, 290], LB: [74, 245], CB: [71, 190], S: [72, 205] }
  const bodyBefore = Object.assign({}, e.body)
  e.body.height = IDEAL[e.pos][0]; e.body.weight = IDEAL[e.pos][1]; e.body.muscle = 95
  window.go('hub')
  await new Promise(r => setTimeout(r, 1800))
  const out = { n0, n1, n2: window.__V194E.toasts(), last: window.__V194E.last(), toast: (document.getElementById('toast') || {}).textContent || '', bodyBefore }
  e.body = bodyBefore
  return out
})
ok(raise.n1 === raise.n0, 'a look with nothing changed is silent', raise.n0 + ' → ' + raise.n1)
ok(raise.n2 === raise.n1 + 1 && /Ceiling raised! \+\d+ max/.test(raise.last) && /Ceiling raised/.test(raise.toast), 'a better frame raises the maxes, and the toast says so', raise.last)

// ---------- 7. an existing save reloads with every attribute where it was ----------
const saved = await page.evaluate(() => {
  const s = window.__GRIDIRON_AUDIT__.getState(), e = s.player
  window.__GRIDIRON_AUDIT__.ATTRS.forEach((k, i) => (e.attrs[k] = 40 + i * 7))
  delete e.capSnapV194E
  s.view = 'hub'
  window.GridironStorage.save(s)
  return { attrs: Object.assign({}, e.attrs) }
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
const back = await page.evaluate(() => {
  const s = window.__GRIDIRON_AUDIT__.getState(), e = s && s.player
  return { view: s && s.view, attrs: e ? Object.assign({}, e.attrs) : null, screen: (document.getElementById('screen') || {}).innerHTML ? 1 : 0 }
})
const same = back.attrs && Object.keys(saved.attrs).every(k => back.attrs[k] === saved.attrs[k])
ok(same && back.screen, 'an old save (no snapshot) reloads with every attribute exactly where it was', 'view ' + back.view)

ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
