// Dev check: v101 — the asset root, the playbook, the throw, the second shadow, the crowd's
// vocabulary, whole numbers on the sheet, and the loader that builds the play behind itself.
// Asserts, in one pass:
//   * ASSETS — every sheet URL resolves against the document, and the game reports the v91
//     field art / v92 stadium art actually active (a 404 here is a field of blank players).
//   * PLAYBOOK — forty-plus named calls, runs and passes, every one reachable, and the mix
//     genuinely moves with the situation (goal line pulls Iso/Sneak, third-and-long pulls the
//     draw and the screens) rather than being one weighted bag.
//   * THE THROW — the accuracy cone widens with a broken pocket and with panic and narrows to
//     green when protection holds and the receiver has won; the lead grows from bullet to
//     touch to lob; a lob is never thrown to a spot the receiver is already standing on.
//   * SHADOWS — the fill cast exists under every man, points away from a DIFFERENT mast than
//     the key light, and is fainter than the key shadow; the shading tint tracks the lamps.
//   * CROWD — a moment has its own emoji rather than one flat good/bad pool.
//   * SHEET — no attribute row prints a fraction of a point.
//   node scripts/v101check.mjs        (READ_POS=RB)
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
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)   // warm: vite's one-time reload after an edit
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
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

// ================= 1. one asset root =================
const assets = await page.evaluate(() => {
  const R = window.__RIB_ASSET
  if (typeof R !== 'function') return null
  const here = new URL('.', document.baseURI).href
  const names = ['rib_field_v91.png', 'rib_field_v91.json', 'rib_lights_v92.png', 'rib_atlas_v22.png',
    'rib_refs_v49.png', 'rib_crowd_v57.png', 'rib_side_v78.png', 'rib_skill_v64.png', 'badges/sack.webp']
  return { here, urls: names.map(n => R(n)), passthrough: R('data:image/png;base64,AA'), abs: R('https://x/y.png') }
})
ok(!!assets, 'the asset resolver is installed', assets ? 'window.__RIB_ASSET' : 'missing')
if (assets) {
  ok(assets.urls.every(u => u.startsWith(assets.here + 'public/')), 'every sheet resolves against the document, under public/', assets.urls[0])
  ok(assets.passthrough.startsWith('data:') && assets.abs.startsWith('https://'), 'a baked data URL or an absolute URL passes straight through')
}
const fetched = await page.evaluate(async () => {
  const R = window.__RIB_ASSET, out = {}
  for (const n of ['rib_field_v91.png', 'rib_field_v91.json', 'rib_lights_v92.png', 'badges/sack.webp']) {
    try { const r = await fetch(R(n), { method: 'GET' }); out[n] = r.status + ' ' + (r.headers.get('content-type') || '?') } catch (e) { out[n] = 'ERR' }
  }
  return out
})
ok(Object.values(fetched).every(v => v.startsWith('200') && !/text\/html/.test(v)),
  'and every one of them is really served as its own file, not an index.html fallback', JSON.stringify(fetched))
const art = await page.evaluate(() => ({ v91: !!(window.__V91 && window.__V91.loaded), cells: window.__V91 && window.__V91.cells }))
ok(art.v91 && art.cells > 100, 'the drawn player sheet decoded and registered', `${art.cells} cells`)

// ================= 2. the playbook =================
const pb = await page.evaluate(() => {
  const PB = window.__PLAYBOOK_V101, pick = window.__pickPlayV101
  if (!PB || !pick) return null
  const sit = (o) => Object.assign({ down: 1, toGo: 10, pos: 25, quarter: 1, margin: 0, hurry: false }, o)
  const roll = (fam, bias, c, n) => { const t = {}; for (let i = 0; i < n; i++) { const p = pick(fam, bias, c); if (p) t[p.id] = (t[p.id] || 0) + 1 } return t }
  const seen = {}
  for (const c of [sit({}), sit({ down: 3, toGo: 12 }), sit({ toGo: 1, pos: 98 }), sit({ down: 2, toGo: 14, quarter: 4, margin: -14, hurry: true }), sit({ pos: 93 })])
    for (const f of ['run', 'pass']) Object.assign(seen, roll(f, f === 'run' ? 'inside' : 'dropback', c, 900))
  const goal = roll('run', 'power', sit({ toGo: 1, pos: 98 }), 3000)
  const open = roll('run', 'inside', sit({ down: 1, toGo: 10, pos: 25 }), 3000)
  const long = roll('pass', 'dropback', sit({ down: 3, toGo: 12 }), 3000)
  const short = roll('pass', 'quick', sit({ down: 1, toGo: 3, pos: 40 }), 3000)
  const badGaps = PB.filter(p => p.fam === 'run' && !['A', 'B', 'C', 'D'].includes(p.gap)).map(p => p.id)
  const bases = [...new Set(PB.map(p => p.base))]
  return { n: PB.length, runs: PB.filter(p => p.fam === 'run').length, passes: PB.filter(p => p.fam === 'pass').length,
    reached: Object.keys(seen).length, badGaps, bases,
    goalIso: (goal.iso || 0) + (goal.dive || 0), openIso: (open.iso || 0) + (open.dive || 0),
    longDraw: (long.bub || 0) + (long.tun || 0) + (long.rbsc || 0) + (long.dag || 0),
    shortDraw: (short.bub || 0) + (short.tun || 0) + (short.rbsc || 0) + (short.dag || 0),
    names: PB.map(p => p.name).slice(0, 6) }
})
ok(!!pb, 'the playbook is loaded', pb ? `${pb.n} plays` : 'missing')
if (pb) {
  ok(pb.n >= 39 && pb.runs >= 12 && pb.passes >= 18, 'thirty-plus new calls on top of the original nine families', `${pb.n} plays · ${pb.runs} run / ${pb.passes} pass`)
  ok(pb.reached === pb.n, 'every play in the book actually gets called somewhere', `${pb.reached} of ${pb.n}`)
  ok(pb.badGaps.length === 0, 'every run names a real gap', pb.badGaps.join(',') || 'A-D only')
  ok(pb.bases.every(b => ['inside', 'power', 'sweep', 'draw', 'quick', 'dropback', 'shot', 'fade', 'screen'].includes(b)),
    'and every play still belongs to one of the nine original families', pb.bases.join(' '))
  ok(pb.goalIso > pb.openIso * 2, 'short yardage on the goal line pulls the sneak and the iso to the front', `goal=${pb.goalIso} open=${pb.openIso}`)
  ok(pb.longDraw > pb.shortDraw * 1.5, 'third-and-long pulls the screens and the dagger', `long=${pb.longDraw} short=${pb.shortDraw}`)
}

// ================= 3. the throw: lead, style, cone =================
const th = await page.evaluate(() => {
  const FS = window.__FieldSim, rows = [], orig = FS.pass.bind(FS)
  FS.pass = function (...a) { const r = orig(...a); try { const L = window.__V101 && window.__V101.last; if (L) rows.push(Object.assign({}, L)) } catch (e) {} return r }
  for (let i = 0; i < 12; i++) window.__simGameV2(60 + (i % 9), 'QB')
  FS.pass = orig
  const by = (f) => { const g = rows.filter(f); return g.length ? { n: g.length,
    cone: +(g.reduce((s, r) => s + r.cone, 0) / g.length).toFixed(2),
    lead: +(g.reduce((s, r) => s + r.leadYd, 0) / g.length).toFixed(2),
    hang: Math.round(g.reduce((s, r) => s + r.hang, 0) / g.length) } : { n: 0 } }
  const green = rows.filter(r => r.prot >= .85 && r.sep > 0)
  const brokenP = rows.filter(r => r.prot < .5)
  return { n: rows.length,
    clean: by(r => r.prot >= .85), broken: by(r => r.prot < .5),
    calm: by(r => r.panic < .1), panicked: by(r => r.panic > .35),
    bullet: by(r => r.style === 'bullet'), touch: by(r => r.style === 'touch'), lob: by(r => r.style === 'lob'),
    greenWhenCleanAndOpen: [green.length, green.filter(r => r.window === 'green').length],
    redWhenBroken: [brokenP.length, brokenP.filter(r => r.window === 'red').length],
    styles: [...new Set(rows.map(r => r.style))], windows: [...new Set(rows.map(r => r.window))],
    zeroLead: rows.filter(r => r.leadYd <= 0.01).length,
    meanLead: +(rows.reduce((s, r) => s + r.leadYd, 0) / Math.max(1, rows.length)).toFixed(2) }
})
ok(th.n > 120, 'sampled a real body of throws', `${th.n} throws`)
ok(th.styles.length === 3 && th.windows.length === 3, 'all three ball types and all three windows occur', th.styles.join('/') + ' · ' + th.windows.join('/'))
ok(th.broken.cone > th.clean.cone * 1.6, 'the cone opens when the pocket breaks', `clean=${th.clean.cone}yd (${th.clean.n}) broken=${th.broken.cone}yd (${th.broken.n})`)
ok(th.panicked.cone > th.calm.cone * 1.6, 'and it opens with panic', `calm=${th.calm.cone}yd panicked=${th.panicked.cone}yd`)
ok(th.greenWhenCleanAndOpen[0] > 5 && th.greenWhenCleanAndOpen[1] / th.greenWhenCleanAndOpen[0] > 0.8,
  'clean protection with the receiver open reads GREEN', `${th.greenWhenCleanAndOpen[1]}/${th.greenWhenCleanAndOpen[0]}`)
ok(th.redWhenBroken[0] > 5 && th.redWhenBroken[1] / th.redWhenBroken[0] > 0.5,
  'a collapsing pocket reads RED', `${th.redWhenBroken[1]}/${th.redWhenBroken[0]}`)
ok(th.lob.hang > th.touch.hang && th.touch.hang > th.bullet.hang,
  'a lob hangs longer than a touch pass and a touch pass longer than a bullet — which is what the lead is solved against',
  `bullet=${th.bullet.hang} touch=${th.touch.hang} lob=${th.lob.hang} ms`)
ok(th.zeroLead / th.n < 0.15, 'the ball is almost never thrown at the spot he is already standing on', `${th.zeroLead}/${th.n} with no lead`)
ok(th.meanLead > 0.8, 'and it is laid out a real distance in front of him', `${th.meanLead} yd on average`)
// the v55 route tree only publishes itself once a pass has been simulated, so this check
// belongs here rather than up with the rest of the playbook
const routesOK = await page.evaluate(() => {
  const tree = (window.__ROUTE_TREE_V55 && window.__ROUTE_TREE_V55.names) || []
  const bad = (window.__PLAYBOOK_V101 || []).filter(p => p.routes).flatMap(p => p.routes.filter(r => !tree.includes(r)))
  return { tree: tree.length, bad: [...new Set(bad)] }
})
ok(routesOK.tree > 20 && routesOK.bad.length === 0, 'every route a play names is a real shape in the v55 tree',
  routesOK.bad.join(',') || `all inside a ${routesOK.tree}-shape tree`)

// ================= 4. the sheet prints whole points =================
await step('START NEW CAREER'); await step('Lock In Personality'); await step('POS')
const sheet = await page.evaluate(() => {
  const seen = {}
  for (const v of ['hub', 'upgrade']) { try { window.go(v) } catch (e) {} }
  try { window.go('hub') } catch (e) {}
  const t = document.body.innerText
  const dec = [...t.matchAll(/[^\n]*\b\d+\.\d+\b[^\n]*/g)].map(m => m[0].trim())
  return { dec: [...new Set(dec)].slice(0, 8), w1: typeof window.__W1_V101 }
})
ok(sheet.w1 === 'function', 'the whole-number formatter is installed', sheet.w1)
ok(sheet.dec.length === 0, 'no fraction of a point is printed on the player sheet', JSON.stringify(sheet.dec))

// ================= 5. the crowd has a vocabulary =================
// (pure lookup — no live field needed, and it is the part that regressed silently before)
await step('PLAY 8-GAME SEASON'); await step('Balanced Program'); await step('PLAY WEEK 1 LIVE'); await step('PLAN')
// the pregame can land on one of a couple of buttons depending on the week — keep knocking
// until the broadcast is actually up rather than measuring an empty scene
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
await page.waitForTimeout(1500)
ok(live, 'the broadcast came up for the live-field half of this check')
const crowd = await page.evaluate(() => {
  const sc = window.__gridironScene; if (!sc || !sc.emoBookV101) return null
  const td = sc.emoBookV101('td', true), sack = sc.emoBookV101('sack', false), flag = sc.emoBookV101('flag', false)
  const unknown = sc.emoBookV101('somethingNobodyNamed', true)
  const kinds = ['td', 'sack', 'pick', 'flag', 'juke', 'pancake', 'incomplete', 'firstdown']
  const sets = kinds.map(k => sc.emoBookV101(k, true).join(''))
  return { td, sack, flag, unknown: unknown.length, distinct: new Set(sets).size, kinds: kinds.length }
})
ok(!!crowd, 'the stands carry an emoji book', crowd ? `${crowd.kinds} kinds sampled` : 'missing')
if (crowd) {
  ok(crowd.distinct === crowd.kinds, 'every moment the crowd can see reacts with its own faces', `${crowd.distinct} distinct of ${crowd.kinds}`)
  ok(crowd.unknown > 0, 'and an unnamed moment still falls back to a pool rather than to silence', crowd.unknown + ' fallback faces')
  ok(crowd.td.join('') !== crowd.sack.join('') && crowd.sack.join('') !== crowd.flag.join(''), 'a touchdown, a sack and a flag do not look the same', crowd.td[0] + ' ' + crowd.sack[0] + ' ' + crowd.flag[0])
}

// ================= 6. the second shadow, and the light on the man =================
const sh = await page.evaluate(() => {
  const sc = window.__gridironScene; if (!sc || !sc.markers || !sc.markers.length) return null
  const key = sc.keyLightV99()
  const men = sc.markers.filter(m => m && m.shadow && m.fill && m.fill.visible)
  const rows = men.slice(0, 22).map(m => ({
    keyRot: +m.shadow.rotation.toFixed(3), fillRot: +m.fill.rotation.toFixed(3),
    keyA: +m.shadow.alpha.toFixed(3), fillA: +m.fill.alpha.toFixed(3),
    keySx: +m.shadow.scaleX.toFixed(3), fillSx: +m.fill.scaleX.toFixed(3),
  }))
  // the light landing on the grass has to actually vary across the field
  const probe = [[60, 600], [360, 600], [660, 600], [360, 1800], [360, 300]].map(([x, y]) => +sc.lightAtV101(x, y).toFixed(3))
  const tints = [[60, 600], [360, 1400]].map(([x, y]) => sc.shadeTintV101(x, y, 1))
  const fillLight = sc.fillLightV101(360, 900)
  return { key: { x: Math.round(key.x), i: key.i }, rows, probe, tints, fillIdx: fillLight ? fillLight.i : null, men: men.length }
})
ok(!!sh && sh.men >= 20, 'every man on the grass carries a second, softer cast', sh ? `${sh.men} fill shadows` : 'none')
if (sh && sh.men) {
  ok(sh.fillIdx != null && sh.fillIdx !== sh.key.i, 'the fill comes from a different mast than the key light', `key=${sh.key.i} fill=${sh.fillIdx}`)
  ok(sh.rows.every(r => r.fillA < r.keyA), 'and it is fainter than the key shadow on every man', `${sh.rows[0].fillA} vs ${sh.rows[0].keyA}`)
  ok(sh.rows.some(r => Math.abs(r.fillRot - r.keyRot) > 0.05), 'the two casts fan apart rather than lying on top of each other',
    `max spread=${Math.max(...sh.rows.map(r => Math.abs(r.fillRot - r.keyRot))).toFixed(3)} rad`)
  ok(new Set(sh.probe).size > 2 && Math.max(...sh.probe) > Math.min(...sh.probe) * 1.15,
    'the light landing on the grass changes as you cross the field', JSON.stringify(sh.probe))
  ok(sh.tints[0] !== sh.tints[1], 'so two men in different places are not shaded identically', sh.tints.map(t => '#' + t.toString(16)).join(' '))
}

// ================= 7. the loader built the play behind itself =================
// the counters only close once the first play has actually run — wait for it rather than
// sampling in the gap between the build and the snap
let warm = null
for (let i = 0; i < 40; i++) {
  warm = await page.evaluate(() => window.__PREWARM_V101 || null)
  if (warm && (warm.hits || warm.misses)) break
  await page.waitForTimeout(500)
}
ok(!!warm && warm.built > 0, 'the first play was choreographed while the loading chase was still running', JSON.stringify(warm))
ok(!!warm && warm.hits > 0, 'and the door opened onto that already-built play', JSON.stringify(warm))

console.log(JSON.stringify({ pass, fail, errors: errs.length, badRequests: bad.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
console.log('failed requests:', bad.length ? [...new Set(bad)].slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length || bad.length ? 1 : 0)
