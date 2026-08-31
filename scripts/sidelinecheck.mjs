// Dev check: v78 sideline — the team area v57 reserved is actually a team area.
//   - the sheet decodes and every packed cell reaches a texture
//   - the apron is populated in CATEGORIES: coaches and trainers, backups in the
//     right kit, a bench row, an equipment row, and the field's own markers
//   - the three lanes run OUTWARD in order (edge, bench, kit) and all of them
//     stay inside the apron, in front of the stand
//   - nothing but the pylons stands on the playing surface
//   - every sprite draws above the stands and below the players
//   - the layout is SEEDED: rebuilding it at the next snap does not reshuffle the
//     bench. Only the chain crew moves, and it moves with the ball
//   - a blocked sheet leaves the bare apron v57 shipped, with no page errors
// node scripts/sidelinecheck.mjs   (needs `npm run dev` on :5173)
import { chromium } from 'playwright'

const fails = []
const ok = (c, label, detail) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${label}${detail ? '  ' + detail : ''}`); if (!c) fails.push(label) }
const URL = process.env.SIDE_URL || 'http://localhost:5173/'

async function drive(block) {
  const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' })
  const page = await b.newPage({ viewport: { width: 520, height: 900 } })
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await page.addInitScript(() => { setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  if (block) await page.route('**/rib_side_v78.png', r => r.abort())
  // the sheet is BAKED into index.html as a data URL, so blocking the file is not
  // enough — the assignment has to be defeated where it lands
  if (block) await page.addInitScript(() => {
    Object.defineProperty(window, '__RIB_SIDE_V78', { get: () => 'data:image/png;base64,AAAA', set: () => {} })
  })
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1000)
  const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
  const click = async (t) => {
    const hit = await page.evaluate(({ t, visSrc }) => {
      const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      let el
      if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
      else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').toUpperCase().includes(t.toUpperCase())))
      if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
    }, { t, visSrc: vis })
    await page.waitForTimeout(850)
    return hit
  }
  for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON',
    'Balanced Program', 'PLAY WEEK 1 LIVE']) await click(s)
  for (let i = 0; i < 45; i++) {
    const stage = await page.evaluate(() => {
      if (document.getElementById('growthV42')) { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return 'wheel' } return 'spin' }
      if (document.getElementById('pregameV1513')) { window.continuePregameV1513 && window.continuePregameV1513(); return 'ptw' }
      return null
    })
    if (!stage) await click('CONTINUE TO MATCH')
    if (await page.evaluate(() => !!window.__gridironScene && !!window.__gridironScene.play)) break
    await page.waitForTimeout(350)
  }
  await page.waitForTimeout(2500)
  return { b, page, errs }
}

// ---------------------------------------------------------------- the real run
const { b, page, errs } = await drive(false)

const art = await page.evaluate(() => window.__SIDE_ART_V78 || null)
ok(!!art && art.cells > 60, 'the sideline sheet decodes into cells', art ? art.cells + ' cells' : 'no sheet')
ok(!!art && art.registered === art.cells, 'every packed cell reaches a texture', art ? `${art.registered}/${art.cells}` : '')

const S = await page.evaluate(() => {
  const D = window.__SIDE_V78; if (!D) return null
  return { items: D.items, live: D.live, fx: D.fx, gap: D.gap, lanes: D.lanes, span: D.span, half: D.half, midy: D.midy, paint: D.paint, apron: D.apron, list: D.list(), _live: null }
})
ok(!!S, 'the team area is built', S ? S.items + ' sprites' : 'none')
if (!S) { console.log('page errors:', errs.join('\n')); await b.close(); process.exit(1) }

const S2 = () => S._live ? S._live() : S
const named = (re) => S.list.filter(i => re.test(i.name || ''))
const coaches = named(/^coach\d/), trainers = named(/^trainer\d/)
const backups = S.list.filter(i => i.kind === 'player')
const benchLane = S.list.filter(i => i.lane === 'bench'), kitLane = S.list.filter(i => i.lane === 'kit'), edgeLane = S.list.filter(i => i.lane === 'edge')
const markers = named(/^(pylon|down\d|yard\d+|chain_rod)$/)

ok(coaches.length >= 6, 'coaches work the boundary', coaches.length + '')
ok(trainers.length >= 4, 'trainers and athletic staff are on the sideline', trainers.length + '')
ok(backups.length >= 20, 'backups fill the team area on both sides', backups.length + '')
ok(named(/^bench_/).length >= 8, 'the bench row is a row of benches', named(/^bench_/).length + '')
ok(named(/^(cooler|cup_stand|bottles|cooler_table)/).length >= 8, 'hydration is stocked', named(/^(cooler|cup_stand|bottles|cooler_table)/).length + '')
ok(named(/^(med_cart|med_kit|med_bag|stretcher|towels)$/).length >= 6, 'the medical kit is on the sideline', named(/^(med_cart|med_kit|med_bag|stretcher|towels)$/).length + '')
ok(named(/^(helmet_rack|pad_rack|ball_rack|ball_bin|ponchos|tape_bin)$/).length >= 8, 'the equipment racks are set out', named(/^(helmet_rack|pad_rack|ball_rack|ball_bin|ponchos|tape_bin)$/).length + '')
ok(named(/^(trunk|trunk_b|trunk_c|case_up|case_up_b|duffel|duffel_b)$/).length >= 10, 'storage is stacked behind the bench', named(/^(trunk|trunk_b|trunk_c|case_up|case_up_b|duffel|duffel_b)$/).length + '')
ok(named(/^(play_board|whiteboard|comms|table|table_b|camera)$/).length >= 10, 'the coaching tech is out', named(/^(play_board|whiteboard|comms|table|table_b|camera)$/).length + '')
ok(named(/^pylon$/).length === 8, 'eight pylons, one per end-zone corner', named(/^pylon$/).length + '')
ok(named(/^down\d$/).length === 1 && named(/^chain_rod$/).length === 2, 'the chain crew is a down box and two sticks')
ok(named(/^yard\d+$/).length >= 6, 'the yardage markers stand outside the touchline', named(/^yard\d+$/).length + '')
ok(markers.length >= 15, 'the field markers are all placed', markers.length + '')

// ---- both sidelines, and each in its own kit
const left = S.list.filter(i => i.vv < S.midy), right = S.list.filter(i => i.vv > S.midy)
ok(left.length > 40 && right.length > 40, 'both sidelines are populated', `${left.length} / ${right.length}`)
const kits = [...new Set(backups.map(i => (i.name || '').replace(/^spr_([a-z]+)_.*$/, '$1')))].sort()
ok(kits.length === 2, 'the two benches wear two different kits', kits.join(' + '))
const leftKit = [...new Set(backups.filter(i => i.vv < S.midy).map(i => i.team))]
const rightKit = [...new Set(backups.filter(i => i.vv > S.midy).map(i => i.team))]
ok(leftKit.length === 1 && rightKit.length === 1 && leftKit[0] !== rightKit[0],
  'a team camps on one side of the stadium and stays there', `${leftKit} | ${rightKit}`)

// ---- nothing stands on the playing surface — measured against the PAINTED
// touchline (the art draws its boundary ~35 world units outside the sim's, see
// v79.2), and on the sprite's whole drawn BOX, not just its ground point
const overhang = await page.evaluate(() => {
  const sc = window.__gridironScene, S2 = sc.side, M = window.__SIDE_V78.midy
  const rows = []
  for (const im of S2.items) {
    const sd = im._side; if (!sd) continue
    const bank = sd.vv < M ? -1 : 1
    const tl = sc.crowdProject(sd.u, M + bank * (S2.paint || 238))
    const halfW = Math.abs(im.displayWidth) / 2
    const over = bank < 0 ? (im.x + halfW) - tl.x : tl.x - (im.x - halfW)
    rows.push({ name: sd.name, over: Math.round(over) })
  }
  return rows
})
const pylons = overhang.filter(r => r.name === 'pylon')
const rest = overhang.filter(r => r.name !== 'pylon').sort((a, b) => b.over - a.over)
ok(rest.length && rest[0].over <= 0, 'no sprite box crosses the painted touchline — nobody is on the field',
  rest.length ? `worst ${rest[0].name} at ${rest[0].over}px` : 'none')
ok(pylons.every(r => Math.abs(r.over) <= 5), 'the pylons alone stand ON the line', pylons.map(r => r.over).join(','))

// ---- the lanes run outward, in order, inside the apron
const out = (arr) => arr.reduce((a, i) => a + (Math.abs(i.vv - S.midy) - S.half), 0) / Math.max(1, arr.length)
const dE = out(edgeLane), dB = out(benchLane), dK = out(kitLane)
ok(dE < dB && dB < dK, 'the lanes run outward in order: boundary, bench, equipment',
  `${dE.toFixed(1)} < ${dB.toFixed(1)} < ${dK.toFixed(1)}`)
ok(dK < S.gap, 'the outermost lane still stands in front of the stand', `${dK.toFixed(1)} < ${S.gap}`)
ok(dE > 8, 'the boundary lane clears the touchline rather than standing on it', dE.toFixed(1))

// ---- the depth band: over the stands, under the turf FX and the players
const dep = S.list.map(i => i.depth)
const crowdDepth = await page.evaluate(() => (window.TU ? window.TU('crowdDepth', 3.45) : 3.45))
ok(Math.min(...dep) > crowdDepth, 'every sprite draws in FRONT of the stand behind it', `${Math.min(...dep)} > ${crowdDepth}`)
ok(Math.max(...dep) < 3.5, 'and behind the players and their ground FX', Math.max(...dep) + '')

// ---- seeded: the next snap does not reshuffle the bench
const stable = await page.evaluate(() => {
  const sc = window.__gridironScene
  const grab = () => window.__SIDE_V78.list().filter(i => !/^(down\d|chain_rod)$/.test(i.name || ''))
    .map(i => `${i.name}|${Math.round(i.u)}|${Math.round(i.vv)}`)
  const a = grab(); sc.buildSideline(); const b = grab()
  let same = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++
  return { n: a.length, m: b.length, same }
})
ok(stable.n === stable.m && stable.same === stable.n, 'rebuilding the sideline lands every sprite in the same place',
  `${stable.same}/${stable.n}`)

// ---- but the chain crew follows the ball
const chain = await page.evaluate(() => {
  const sc = window.__gridironScene
  const box = () => { const b = window.__SIDE_V78.list().find(i => /^down\d$/.test(i.name || '')); return b ? { name: b.name, u: Math.round(b.u) } : null }
  sc._lastField = [25, 35]; if (sc.play) sc.play.payload = Object.assign({}, sc.play.payload, { down: 1 })
  sc.buildSideline(); const a = box()
  sc._lastField = [70, 80]; if (sc.play) sc.play.payload = Object.assign({}, sc.play.payload, { down: 3 })
  sc.buildSideline(); const b = box()
  return { a, b }
})
ok(chain.a && chain.b && chain.b.u > chain.a.u + 100, 'the chain crew walks the ball down the field',
  chain.a && chain.b ? `${chain.a.u} -> ${chain.b.u}` : 'missing')
ok(chain.a && chain.b && chain.a.name === 'down1' && chain.b.name === 'down3', 'the box shows the down that is actually being played',
  chain.a && chain.b ? `${chain.a.name} / ${chain.b.name}` : '')

// ================================================================ v79 layer
console.log('\n-- v79: light & life --')
ok(S2().fx > 120, 'every sprite casts a contact shadow', S2().fx + ' shadow ellipses')

const lit = await page.evaluate(() => {
  const l = window.__SIDE_V78.list()
  const tints = l.filter(i => i.tint != null && i.tint !== 0xffffff)
  const far = l.filter(i => i.y < 700 && i.tint != null), near = l.filter(i => i.y > 900 && i.tint != null)
  const lum = (t) => ((t >> 16) & 255) + ((t >> 8) & 255) + (t & 255)
  const avg = (a) => a.reduce((s2, i) => s2 + lum(i.tint), 0) / Math.max(1, a.length)
  return { tinted: tints.length, total: l.length, farAvg: avg(far), nearAvg: avg(near), nFar: far.length, nNear: near.length }
})
ok(lit.tinted > lit.total * .8, 'the band runs through the lighting, not at full brightness', `${lit.tinted}/${lit.total} tinted`)
ok(lit.nFar > 4 && lit.nNear > 4 && lit.farAvg < lit.nearAvg, 'the far end of the sideline sits in dimmer air than the near end',
  `${Math.round(lit.farAvg)} < ${Math.round(lit.nearAvg)}`)

const facing = await page.evaluate(() => {
  const l = window.__SIDE_V78.list(), M = window.__SIDE_V78.midy
  const pick = (n) => ({ L: l.filter(i => i.name === n && i.vv < M).map(i => i.sx), R: l.filter(i => i.name === n && i.vv > M).map(i => i.sx) })
  return { bench: pick('bench_back'), rack: pick('helmet_rack') }
})
// the art opens LEFT unflipped, and low-vv is always screen-left, so the left
// bank must mirror (sx=-1) and the right must not (sx=+1) — asserted by SIGN,
// not by difference, because "they differ" was also true when both faced away
const oneWay = (a) => a.length && a.every(v => v === a[0])
ok(oneWay(facing.bench.L) && oneWay(facing.bench.R) && facing.bench.L[0] === -1 && facing.bench.R[0] === 1,
  'the benches on both banks open toward the field', `L=${facing.bench.L[0]} R=${facing.bench.R[0]}`)
ok(oneWay(facing.rack.L) && oneWay(facing.rack.R) && facing.rack.L[0] === -1 && facing.rack.R[0] === 1,
  'so do the racks and the rest of the three-quarter art')

const seated = await page.evaluate(() => {
  const l = window.__SIDE_V78.list(), M = window.__SIDE_V78.midy
  const seats = l.filter(i => /^(bench_|stool)/.test(i.name || ''))
  const sitters = l.filter(i => i.kind === 'player' && i.seated)
  // a sitter rides his seat's own field depth (same u), sits in FRONT of the
  // seat sprite (higher depth, backrest behind him), and faces the field: on
  // the screen-left bank a leftward-facing profile is flipped to look right
  let onSeat = 0, watching = 0
  for (const s2 of sitters) {
    const b = seats.find(b2 => Math.abs(b2.u - s2.u) < 8 && (b2.vv < M) === (s2.vv < M))
    if (b && s2.depth > b.depth) onSeat++
    // profile pose AND mirrored toward the touchline (left bank flips right)
    if (/_sd_/.test(s2.name || '') && (s2.sx < 0) === (s2.vv < M)) watching++
  }
  return { sitters: sitters.length, onSeat, watching }
})
ok(seated.sitters >= 16, 'the benches are occupied', seated.sitters + ' sitting')
ok(seated.onSeat >= seated.sitters * .9, 'every sitter rides his own seat, in front of the backrest', `${seated.onSeat}/${seated.sitters}`)
ok(seated.watching === seated.sitters, 'everyone on a bench is watching the field (profile pose)', `${seated.watching}/${seated.sitters}`)

const watchers = await page.evaluate(() => {
  const l = window.__SIDE_V78.list(), M = window.__SIDE_V78.midy
  const standing = l.filter(i => i.kind === 'player' && !i.seated)
  const prof = standing.filter(i => /_sd_/.test(i.name || ''))
  // a profile "watches the field" when it faces the touchline: on the
  // screen-left bank that is a FLIPPED (rightward) profile, on the right an
  // unflipped one — sx carries the flip, VDIR carries which bank is which side
  // crowdProject carries no VDIR mirror, so a bank's screen side IS its world
  // side: low-vv is ALWAYS screen-left. (The first version probed through PJ,
  // which does mirror — it asserted the same wrong model the renderer had, and
  // passed while half the sideline faced away from the game.)
  let toward = 0
  for (const i of prof) { const screenLeft = i.vv < M; if ((i.sx < 0) === screenLeft) toward++ }
  return { standing: standing.length, prof: prof.length, toward }
})
ok(watchers.prof >= watchers.standing * .6, 'most standing backups watch the field too', `${watchers.prof}/${watchers.standing} in profile`)
ok(watchers.toward === watchers.prof, 'and every profile faces the touchline, not the stands', `${watchers.toward}/${watchers.prof}`)

const react = await page.evaluate(async () => {
  const sc = window.__gridironScene
  sc.side.excite = 0
  sc.sideReact({ type: 'td' })
  const peak = sc.side.excite
  await new Promise(r => setTimeout(r, 1200))
  return { peak, later: sc.side.excite, quiet: (sc.sideReact({ type: 'snap' }), sc.side.excite) }
})
ok(react.peak >= 1, 'a touchdown sends the bench into the air', 'excite=' + react.peak)
ok(react.later < react.peak * .8, 'and the reaction dies back down', `${react.peak} -> ${+react.later.toFixed(2)}`)

const staffTint = await page.evaluate(() => {
  const t = window.__gridironScene.textures
  if (!t.exists('spr_side_coach0') || !t.exists('spr_side_off_coach0')) return null
  const px = (key) => { const im = t.get(key).getSourceImage(), c = document.createElement('canvas')
    c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0)
    return x.getImageData(0, 0, c.width, c.height).data }
  const a = px('spr_side_coach0'), b = px('spr_side_off_coach0')
  let diff = 0, skin = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 40) continue
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) diff++
    // skin/khaki (warm, red-dominant) must be untouched by the tint
    else if (a[i] > a[i + 2] + 20 && a[i] > 90) skin++
  }
  return { diff, skin }
})
ok(staffTint && staffTint.diff > 200, 'the staff kit recolors to the team primary', staffTint ? staffTint.diff + 'px changed' : 'textures missing')
ok(staffTint && staffTint.skin > 200, 'while skin and khakis never tint', staffTint ? staffTint.skin + 'px warm and unchanged' : '')

const paint = await page.evaluate(() => {
  const sc = window.__gridironScene, cv = sc._warpCv; if (!cv) return null
  const ctx = cv.getContext('2d'), S2 = sc.side
  const PW = S2.paint || 238, APR = window.__SIDE_V78.apron || 66, M = window.__SIDE_V78.midy
  const lum = (u, vv) => { const p = sc.crowdProject(u, vv), d = ctx.getImageData(Math.round(p.x + 240), Math.round(p.y), 1, 1).data; return d[0] + d[1] + d[2] }
  let line = 0, grass = 0, kit = 0, mid = 0, n = 0
  for (let u = 250; u <= 470; u += 20) {
    line += Math.max(lum(u, M + PW), lum(u, M + PW + 2), lum(u, M + PW - 2))
    grass += lum(u, M + PW * .5)
    kit += lum(u, M + PW + APR * .78); mid += lum(u, M + PW + APR * .5); n++
  }
  return { line: Math.round(line / n), grass: Math.round(grass / n), kit: Math.round(kit / n), mid: Math.round(mid / n) }
})
ok(paint && paint.line > paint.grass + 100, "sidePaintHalf really is the art's painted touchline",
  paint ? `${paint.line} on the line vs ${paint.grass} grass` : 'no warp canvas')
ok(paint && paint.kit < paint.mid - 8, 'a grounding shade sits under the equipment row', paint ? `${paint.kit} vs ${paint.mid}` : '')

const wx = await page.evaluate(() => {
  const sc = window.__gridironScene
  const count = (re) => window.__SIDE_V78.list().filter(i => re.test(i.name || '')).length
  const base = { ponchos: count(/^ponchos$/), towels: count(/^towels$/), heaters: count(/^heater$/), fans: count(/^fan$/) }
  window.__WX_V79 = 'rain'; sc.buildSideline()
  const rain = { ponchos: count(/^ponchos$/), towels: count(/^towels$/) }
  window.__WX_V79 = 'snow'; sc.buildSideline()
  const snow = { heaters: count(/^heater$/), fans: count(/^fan$/) }
  window.__WX_V79 = 'clear'; sc.buildSideline()
  return { base, rain, snow, rolled: true }
})
ok(wx.rain.ponchos > wx.base.ponchos && wx.rain.towels === 0, 'rain breaks out the ponchos and strikes the towel service',
  `${wx.base.ponchos} -> ${wx.rain.ponchos} ponchos`)
ok(wx.snow.heaters > wx.base.heaters && wx.snow.fans === 0, 'snow doubles the heaters and sends the fans away',
  `${wx.base.heaters} -> ${wx.snow.heaters} heaters, fans ${wx.base.fans} -> 0`)

try { await page.locator('canvas').first().screenshot({ path: 'scripts/_sideline.png' }) } catch (e) {}
console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'none')
if (errs.length) fails.push('page errors')
await b.close()

// ------------------------------------------------------- the blocked-sheet run
console.log('\n-- sheet blocked --')
const blocked = await drive(true)
// the walk into a live game is timing-sensitive — poll for the 22 markers
// rather than reading one instant that may fall between snaps
let bs = null
for (let i = 0; i < 40; i++) {
  bs = await blocked.page.evaluate(() => ({
    scene: !!window.__gridironScene, side: window.__SIDE_V78 ? window.__SIDE_V78.items : 0,
    art: window.__SIDE_ART_V78 || null, players: (window.__gridironScene && window.__gridironScene.markers || []).length,
  }))
  if (bs.players >= 22) break
  // the walk into a live game is timing-sensitive; keep clearing whatever is in
  // the way (wheel, players-to-watch, a stray continue) while we poll
  await blocked.page.evaluate(() => {
    const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') g.click()
    if (document.getElementById('pregameV1513')) window.continuePregameV1513 && window.continuePregameV1513()
    const btn = [...document.querySelectorAll('button')].find(b => /CONTINUE TO MATCH|PLAY WEEK 1 LIVE/i.test(b.innerText || ''))
    if (btn) btn.click()
  })
  await blocked.page.waitForTimeout(500)
}
if (bs && bs.players < 22) console.log('  [blocked-run stuck]', JSON.stringify(bs))
ok(bs.scene && bs.players >= 22, 'players still take the field without the sideline sheet', bs.players + '')
ok(!bs.side, 'no team area is built when the sheet never decodes', bs.side + '')
ok(!blocked.errs.length, 'a blocked sideline sheet raises no page errors', blocked.errs.slice(0, 2).join(' | '))
if (blocked.errs.length) fails.push('blocked-run page errors')
await blocked.b.close()

if (fails.length) { console.log('\nFAILED:', fails.join(', ')); process.exit(1) }
console.log('\nall good')
