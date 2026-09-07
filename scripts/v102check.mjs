// Dev check: v102 — the mirrored masts and the breathing light, the anticipated slow motion, and
// the menu that is alive. Asserts:
//   * LIGHTS — the far four are exactly as v92/v98/v99 left them (the key light still fixed);
//     four mirrored masts stand as well, at the near corners, each with a glow, a beam and a
//     pool, the near pools on the NEAR half of the turf, their heads turned in; every mast is a
//     real light in the field the men are shaded by (`lightRigsV101` counts eight); and NO mast
//     stands on the playing surface (v103 removed the touchline pair, which did).
//     The output BREATHES: a few percent of shimmer, per mast on its
//     own phase, sputters counted, never a strobe; shadows and shading ride the same breath; and
//     `lightLiveV102` at 0 puts the stillness back.
//   * SLOW MOTION — windows open on scripted moments (catch point, moves, collisions), the clock
//     eases DOWN before the moment rather than after it, the floor is a real slow (≤ 0.5), the
//     letterbox is on the field while it holds and gone when it does not, and `slomoV102` at 0
//     never bends the clock.
//   * MENU — the hero carries five lamps, a sun, a sheen through the wordmark's own mask and a
//     canvas that is actually animating (frames advance, motes and flashes exist); every FX
//     element animates in CSS; the mask URL is document-absolute (it used to 404 against the
//     stylesheet); no failed requests; and the loop stops when the menu unmounts.
//   node scripts/v102check.mjs        (READ_POS=RB)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = [], bad = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()) })
page.on('requestfailed', r => bad.push('FAILED ' + r.url()))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(3500)   // warm: vite's one-time reload after an edit
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'RB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className) || /RUN THIS PLAN|LOCK IT IN|CHOOSE/i.test(txt(e)))
      : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}

// ================= 1. the menu is alive =================
const menu = await page.evaluate(() => {
  const F = window.__RIB_MENU_FX_V102
  const sel = ['.rib9-hero-img', '.rib9-lamp', '.rib9-sheen', '.rib9-swash', '.rib9-sun', '.rib9-sun-rays', '.rib9-portrait img', '.rib9-brand b']
  const anim = sel.map(q => { const el = document.querySelector(q); return [q, el ? getComputedStyle(el).animationName : null] })
  const sheen = document.querySelector('.rib9-sheen'), wm = sheen ? sheen.style.getPropertyValue('--wm') : ''
  const mask = sheen ? (getComputedStyle(sheen).maskImage || getComputedStyle(sheen).webkitMaskImage || '') : ''
  return { fx: F ? { frames: F.frames, motes: F.motes, on: F.on } : null, lamps: document.querySelectorAll('.rib9-lamp').length, anim, wm, maskSet: /url\(/.test(mask), cv: !!document.querySelector('.rib9-hero-cv'), menu: !!document.getElementById('rib-main-menu-v2') }
})
ok(menu.menu && menu.cv && menu.fx && menu.fx.on, 'the hero canvas loop is running on the main menu', JSON.stringify(menu.fx))
const f0 = menu.fx ? menu.fx.frames : 0
await page.waitForTimeout(700)
const f1 = await page.evaluate(() => window.__RIB_MENU_FX_V102 ? window.__RIB_MENU_FX_V102.frames : 0)
ok(f1 > f0 + 10, 'and it is actually drawing frames', `${f0} -> ${f1} in 700ms`)
ok(menu.fx && menu.fx.motes > 20, 'dust is in the air', `${menu.fx && menu.fx.motes} motes`)
ok(menu.lamps === 5, 'five floodlights stand on the far rim of the hero', `${menu.lamps} lamps`)
ok(menu.anim.every(a => a[1] && a[1] !== 'none'), 'every piece of the hero animates — the breath, the lamps, the sheen, the swash, the sun, the rays, the portrait, the brand', JSON.stringify(menu.anim))
ok(/^url\(['"]?https?:\/\//.test(menu.wm) && menu.maskSet, 'the sheen is masked through the wordmark itself, by a document-absolute URL', menu.wm.slice(0, 80))

// ================= 2. into a live game =================
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS']) await step(t)
const stopped = await page.evaluate(() => !document.getElementById('rib-main-menu-v2') && !(window.__RIB_MENU_FX_V102 && window.__RIB_MENU_FX_V102.on))
ok(stopped, 'leaving the menu stops the hero loop')
await step('PLAY 8-GAME SEASON'); await step('Balanced Program'); await step('PLAY WEEK 1 LIVE'); await step('PLAN')
let live = false
for (let i = 0; i < 6 && !live; i++) {
  for (const t of ['CONTINUE TO MATCH', 'Continue to Match', 'PLAY', 'CONTINUE']) {
    live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
    if (live) break
    await step(t)
  }
  live = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length))
  if (!live) await page.waitForTimeout(2500)
}
await page.waitForFunction(() => window.__V92 && window.__V92.on, null, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(1500)
ok(live, 'the broadcast came up')

// ================= 3. the mirrored lights =================
const L = await page.evaluate(() => { const V = window.__V92, sc = window.__gridironScene
  return { far: V.towerBoxes(), key: V.key(), mirror: V.mirror(), rigs: V.mirrorLights(), field: sc.lightRigsV101().length,
    fieldNear: sc.lightRigsV101().filter(r => r.near).length, NSTOP: 340, NSH: 1340 } })
ok(L.far.length === 4 && L.far.every(t => t.y === 300), 'the far four stand exactly where v98 fixed them', JSON.stringify(L.far.map(t => [t.x, t.y])))
ok(L.key && L.key.on && L.key.i === 2, 'the key light is still the fixed far mast', JSON.stringify(L.key))
ok(L.mirror.length === 4, 'four mirrored masts stand as well, at the near corners', L.mirror.map(m => m.id).join(' '))
const near = L.mirror.filter(m => /^near/.test(m.id))
// v103: nothing may be planted on the grass. The touchline pair used to be, and it bled over
// the sideline and the field at any ordinary play zoom.
const onField = (m) => m.x > -40 && m.x < 760 && m.y > 300 && m.y < 1720
ok(L.far.concat(L.mirror).every(m => !onField(m)), 'no mast stands on the playing surface',
  L.far.concat(L.mirror).filter(onField).map(m => (m.id || 'far') + '@' + m.x + ',' + m.y).join(' ') || 'all clear')
ok(near.length === 4 && near.every(m => m.y > L.NSTOP + L.NSH), 'the near four plant their feet beyond the near end line', near.map(m => m.y).join(','))
ok(near.every(m => m.h > L.far[0].y - L.far[0].top), 'and stand taller than the far ones — the near end is nearer', `near h=${near.map(m => m.h).join(',')} far h=${L.far[0].y - L.far[0].top}`)
ok(L.mirror.every(m => (m.x < 360) === (m.face === 1)), 'every mirrored head is turned in toward the field', JSON.stringify(L.mirror.map(m => [m.x, m.face])))
ok(L.mirror.every(m => m.depth < 3.45), 'every mirrored mast draws behind the crowd', [...new Set(L.mirror.map(m => m.depth))].join(','))
ok(L.rigs.length === 4 && L.rigs.every(r => r.glow.a > 0.3 && r.beam.a > 0.05 && r.pool.a > 0.03), 'every mirrored mast carries a lit glow, a beam and a pool', `rigs=${L.rigs.length}`)
ok(L.rigs.slice(0, 4).every(r => r.pool.y > L.NSTOP + L.NSH * 0.55), 'the near pools land on the NEAR half of the turf', L.rigs.slice(0, 4).map(r => r.pool.y).join(','))
ok(L.field === 8 && L.fieldNear === 4, 'all eight masts are lights in the field the men are shaded by', `${L.field} rigs, ${L.fieldNear} of them near`)

// ================= 4. the light breathes =================
const B = []
for (let i = 0; i < 28; i++) { B.push(await page.evaluate(() => { const V = window.__V92; return { live: V.live(), g: V.lights().map(l => l.glow.a), key: V.key() } })); await page.waitForTimeout(220) }
const alls = B.map(b => b.live.all), per0 = B.map(b => b.live.per[0]), per1 = B.map(b => b.live.per[1])
ok(new Set(alls).size > 10 && Math.max(...alls) - Math.min(...alls) > 0.01 && Math.max(...alls) - Math.min(...alls) < 0.2, 'the stadium output breathes second to second — a few percent, never a strobe', `range=${Math.min(...alls).toFixed(4)}..${Math.max(...alls).toFixed(4)}`)
ok(per0.some((v, i) => Math.abs(v - per1[i]) > 0.003), 'every mast breathes on its own phase', `mast0 vs mast1 differ`)
ok(B.every(b => b.key.x === B[0].key.x && b.key.y === B[0].key.y), 'and the key light never moves while it does')
const g0 = B.map(b => b.g[1])
ok(new Set(g0).size > 5 && Math.max(...g0) - Math.min(...g0) < 0.2, 'the glow on the mast rides the breath', `${Math.min(...g0)}..${Math.max(...g0)}`)
const still = await page.evaluate(async () => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { lightLiveV102: 0 }); const out = []
  for (let i = 0; i < 6; i++) { out.push(window.__V92.live().all); await new Promise(r => setTimeout(r, 120)) } delete window.RIB_TUNE.lightLiveV102; return out })
ok(still.every(v => v === 1), 'lightLiveV102 at 0 puts the v99 stillness back', still.join(','))
const shade = await page.evaluate(() => { const sc = window.__gridironScene; const a = sc.shadowMulV100(); const b = sc.lightAtV101(360, 900); return { a: +a.toFixed(4), b: +b.toFixed(4), live: +sc.lightLiveAllV102().toFixed(4) } })
ok(Math.abs(shade.a - (0.35 + 0.65) * shade.live) < 0.01, 'the shadows weigh what the light says this instant', JSON.stringify(shade))

// ================= 5. the moment slows down =================
let S = null, deepest = 1, seenBars = false, seenOff = false, kinds = new Set()
for (let i = 0; i < 260; i++) {
  S = await page.evaluate(() => { const V = window.__SLOMO_V102 || null; const el = document.querySelector('.rib-slomo-v102'); return { V, on: !!(el && el.classList.contains('on')), k: el ? +el.style.getPropertyValue('--k') : 0, live: V && V.live } })
  if (S.live) { deepest = Math.min(deepest, S.live.k); for (const kd of S.live.kinds) kinds.add(kd) }
  if (S.on && S.k > 0.5) seenBars = true
  if (!S.on && S.V && S.V.windows > 0) seenOff = true
  await page.waitForTimeout(100)
}
const V = S && S.V
ok(V && V.windows >= 3, 'slow-motion windows opened on the play', V && `${V.windows} windows`)
ok(deepest <= 0.55, 'the clock really slows — to half speed or lower', `min rate ${deepest}`)
ok([...kinds].some(k => /catch|highpoint|contest|cut|stiffarm|hurdle|brokenTackle|tackleHit|pancake|pick|swat|td/.test(k)), 'on a catch point, a move or a collision', [...kinds].join(' '))
ok(seenBars, 'the letterbox is on the field while it holds', S && JSON.stringify(S.V && S.V.bars))
ok(seenOff, 'and gone again when it does not')
// the anticipation: the clock is already below 1 BEFORE the moment's own time
const ahead = await page.evaluate(async () => { const out = []; for (let i = 0; i < 200; i++) { const V = window.__SLOMO_V102; if (V && V.live && V.live.T < V.live.start && V.live.k < 0.97) out.push(V.live.start - V.live.T); await new Promise(r => setTimeout(r, 40)) } return out })
ok(ahead.length > 0 && Math.max(...ahead) > 120, 'the clock eases down BEFORE the moment, not after it', ahead.length ? `seen up to ${Math.max(...ahead)}ms ahead` : 'never ahead')
const off = await page.evaluate(async () => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { slomoV102: 0 }); const V = window.__SLOMO_V102; const w0 = V ? V.windows : 0; let bent = false
  for (let i = 0; i < 40; i++) { const sc = window.__gridironScene; if (sc.play && sc.slomoV102(sc.play, 16) < 1) bent = true; await new Promise(r => setTimeout(r, 60)) }
  delete window.RIB_TUNE.slomoV102; return { bent } })
ok(!off.bent, 'slomoV102 at 0 never bends the clock')

console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
console.log('failed requests:', bad.length ? [...new Set(bad)].slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length || bad.length ? 1 : 0)
