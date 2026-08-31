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
  return { items: D.items, live: D.live, gap: D.gap, lanes: D.lanes, span: D.span, half: D.half, midy: D.midy, list: D.list() }
})
ok(!!S, 'the team area is built', S ? S.items + ' sprites' : 'none')
if (!S) { console.log('page errors:', errs.join('\n')); await b.close(); process.exit(1) }

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

// ---- nothing but the pylons stands on the playing surface
const onField = S.list.filter(i => i.name !== 'pylon' && Math.abs(i.vv - S.midy) < S.half)
ok(onField.length === 0, 'nothing but the pylons stands on the playing surface',
  onField.length ? onField.slice(0, 4).map(i => `${i.name}@${Math.round(i.vv)}`).join(',') : 'clear')

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

try { await page.locator('canvas').first().screenshot({ path: 'scripts/_sideline.png' }) } catch (e) {}
console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'none')
if (errs.length) fails.push('page errors')
await b.close()

// ------------------------------------------------------- the blocked-sheet run
console.log('\n-- sheet blocked --')
const blocked = await drive(true)
const bs = await blocked.page.evaluate(() => ({
  scene: !!window.__gridironScene, side: window.__SIDE_V78 ? window.__SIDE_V78.items : 0,
  art: window.__SIDE_ART_V78 || null, players: (window.__gridironScene && window.__gridironScene.markers || []).length,
}))
ok(bs.scene && bs.players >= 22, 'players still take the field without the sideline sheet', bs.players + '')
ok(!bs.side, 'no team area is built when the sheet never decodes', bs.side + '')
ok(!blocked.errs.length, 'a blocked sideline sheet raises no page errors', blocked.errs.slice(0, 2).join(' | '))
if (blocked.errs.length) fails.push('blocked-run page errors')
await blocked.b.close()

if (fails.length) { console.log('\nFAILED:', fails.join(', ')); process.exit(1) }
console.log('\nall good')
