// v44 TEAM EMBLEMS check: every in-game team nickname resolves to a sensible emblem,
// every emblem's palette index is a real TEAM_PALETTES entry, the sheet is BAKED (loads
// with no server file), and every surface the emblem appears on renders at the right
// size with no overflow — creator tiles (520px AND 320px viewports), the creator's live
// identity preview (reacts to palette picks), pregame matchup chips, live scoreboard
// chips, and the midfield crest proportion. Prints JSON + page errors; exits 1 on failure.
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const fails = []
const errs = []
function check(name, ok, detail) { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' ' + JSON.stringify(detail) : ''}`); if (!ok) fails.push(name) }

async function boot(viewport) {
  const page = await browser.newPage({ viewport })
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  await page.addInitScript(() => {
    setInterval(() => {
      try { if (window.o) window.o.tutorialSeen = true } catch {}
      document.querySelector('.onboard')?.remove()
    }, 60)
  })
  await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 })
  await page.waitForFunction(() => window.TEAM_LOGOS_V44 && window.openTeamCreatorV153, { timeout: 20000 })
  await page.waitForTimeout(800)
  return page
}

// element-geometry helper injected per-evaluate: rect + computed background + containment
const GEO = `(el, container) => {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
  const out = { w: +r.width.toFixed(1), h: +r.height.toFixed(1), img: cs.backgroundImage !== 'none' }
  if (container) { const c = container.getBoundingClientRect()
    out.inside = r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1 }
  return out }`

const page = await boot({ width: 520, height: 900 })

// ---- name matching + structure + baked delivery ----
const api = await page.evaluate(() => {
  const L = window.TEAM_LOGOS_V44, P = window.TEAM_PALETTES
  if (!L) return { why: 'TEAM_LOGOS_V44 missing' }
  const expected = {
    Wolves: 'Wolf', TIMBERWOLVES: 'Wolf', Bears: 'Grizzly', Cubs: 'Grizzly', 'POLAR BEARS': 'Polar Bear',
    Panthers: 'Panther', Cougars: 'Panther', Wildcats: 'Panther', Eagles: 'Eagle', Gators: 'Gator',
    Sharks: 'Shark', 'JR. RAMS': 'Ram', Tigers: 'Tiger', Jaguars: 'Jaguar', Hawks: 'Hawk', Falcons: 'Hawk',
    Vipers: 'Cobra', Cobras: 'Cobra', Broncos: 'Unicorn', Colts: 'Unicorn', Mustangs: 'Unicorn',
    Spartans: 'Spartan', Knights: 'Knight', Vikings: 'Viking', Titans: 'Trojan', Kings: 'King',
    Warriors: 'Barbarian', Raiders: 'Outlaw', Bulldogs: 'Jackal', Storm: 'Storm', Blitz: 'Bolt',
    Chargers: 'Bolt', Empire: 'King', Reign: 'King', 'VOID TITANS': 'Phantom', 'NEBULA REAPERS': 'Reaper',
    'SOLAR WRAITHS': 'Phantom', 'METEOR LEGION': 'Meteor', 'ANDROMEDA SOVEREIGNS': 'King',
    'LUNAR COMMAND': 'Moon Knight', 'EUROPA FROST': 'Frost Knight', 'ALL-STARS': 'Sun King',
  }
  const misses = []
  for (const [name, want] of Object.entries(expected)) { const got = L.name(L.forName(name)); if (got !== want) misses.push(`${name}: got ${got}, want ${want}`) }
  const fb1 = L.forName('Dallas State')
  return { logos: L.db.length, palettes: P.length, badPal: L.db.filter(d => !P[d.p]).length,
    misses, baked: /^data:image\/png/.test(L.url), fb: fb1 === L.forName('Dallas State') && fb1 >= 0 && fb1 < 90 }
})
check('name matching', api.misses && !api.misses.length, api.misses)
check('90 logos / valid palettes', api.logos === 90 && api.badPal === 0, { logos: api.logos, palettes: api.palettes })
check('sheet baked as data URL (no server file needed)', !!api.baked)
check('deterministic fallback', !!api.fb)

// ---- team creator: tiles, live preview, palette reaction (520px) ----
async function creatorAudit(pg, label) {
  await pg.evaluate(() => window.openTeamCreatorV153())
  await pg.waitForTimeout(400)
  // lift the modal above the main-menu overlay so screenshots show what we measured
  await pg.evaluate(() => { const m = document.getElementById('teamModalV153'); if (m) m.style.zIndex = 2147483000 })
  const audit = await pg.evaluate((geoSrc) => {
    const geo = eval(geoSrc)
    const tiles = [...document.querySelectorAll('.logo-pick-v153 .team-logo-v44')]
    const tileGeo = tiles.map(t => geo(t, t.closest('.logo-pick-v153')))
    const badTiles = tileGeo.filter(g => !g.img || !g.inside || g.w < 18 || Math.abs(g.w - g.h) > 1.5).length
    // the preview card re-renders (innerHTML swap) on every pick — always re-query it
    const jersey = () => document.querySelector('#creatorPreviewV44 .id-jersey-v44')
    const before = jersey() ? getComputedStyle(jersey()).backgroundColor : null
    window.pickPaletteV153(7)                     // palette pick must visibly change the preview
    const after = jersey() ? getComputedStyle(jersey()).backgroundColor : null
    window.pickLogoV153(0)                        // wolf -> its matched palette selected + ✓
    const m = document.querySelector('.palette-v153.match')
    const matchIsOn = m && m.classList.contains('on')
    const prevName = document.querySelector('#creatorPreviewV44 .id-meta-v44 b')?.textContent
    const pj = jersey(), pe = pj && pj.querySelector('i')
    return { tiles: tiles.length, sampleTile: tileGeo[0], badTiles,
      preview: pj ? { ...geo(pj), emblem: pe ? geo(pe) : null } : null,
      paletteReacts: !!before && !!after && before !== after, matchIsOn, prevName }
  }, GEO)
  check(`${label}: 90 tiles, square, sprite-backed, inside buttons`, audit.tiles === 90 && audit.badTiles === 0, { sample: audit.sampleTile, bad: audit.badTiles })
  check(`${label}: live preview present + emblem sized`, !!audit.preview && audit.preview.emblem && audit.preview.emblem.img && audit.preview.emblem.w > 30, audit.preview)
  check(`${label}: palette pick updates the preview`, !!audit.paletteReacts)
  check(`${label}: emblem pick selects+marks its palette`, !!audit.matchIsOn && audit.prevName === 'Wolf', { name: audit.prevName })
  return audit
}
await creatorAudit(page, 'creator@520')
await page.screenshot({ path: 'scripts/_emblem_creator.png' })
await page.evaluate(() => window.closeTeamCreatorV153())

// same audit on a narrow phone (grid drops to 7 columns)
const page320 = await boot({ width: 320, height: 700 })
await creatorAudit(page320, 'creator@320')
await page320.screenshot({ path: 'scripts/_emblem_creator_320.png' })
await page320.close()

// ---- drive into a game: pregame chips, scoreboard chips, field crest ----
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const ok = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  console.log(`>> ${t} -> ${ok ? 'ok' : 'MISS'}`)
  await page.waitForTimeout(900)
}
for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'Lock In Personality', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE']) await click(s)
await page.waitForTimeout(600)

async function dismissModals() {
  for (let i = 0; i < 12; i++) {
    const gone = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^CONTINUE$/.test((x.innerText || '').trim()) && x.getBoundingClientRect().width > 0)
      if (b) { b.click(); return false } return true
    })
    await page.waitForTimeout(600)
    if (gone && i > 1) break
  }
}
const pregame = await page.evaluate((geoSrc) => {
  const geo = eval(geoSrc)
  const chips = [...document.querySelectorAll('.pregame-emblem-v44')]
  return { n: chips.length, chips: chips.map(c => geo(c, c.closest('.pregame-team-v1513'))) }
}, GEO)
check('pregame: 2 emblem chips, 44px, sprite-backed, inside tiles',
  pregame.n === 2 && pregame.chips.every(c => c.img && c.inside && Math.abs(c.w - 44) < 2 && Math.abs(c.h - 44) < 2), pregame)
// the commitment modal respawns with the pregame screen — hide it for the shot only
await page.evaluate(() => { [...document.querySelectorAll('body > div')].filter(d => /SEASON COMMITMENT/.test(d.innerText || '')).forEach(d => d.style.visibility = 'hidden') })
await page.screenshot({ path: 'scripts/_emblem_pregame.png' })
await page.evaluate(() => { [...document.querySelectorAll('body > div')].forEach(d => { if (d.style.visibility === 'hidden') d.style.visibility = '' }) })

await click('CONTINUE TO MATCH')
for (let i = 0; i < 20; i++) { const c = await page.evaluate(() => document.querySelectorAll('canvas').length); if (c) break; await page.waitForTimeout(300) }
await page.waitForTimeout(2500)   // let a snap or two run so warpField() bakes the crest in
await dismissModals()                // season-commitment style modals steal the frame

const live = await page.evaluate((geoSrc) => {
  const geo = eval(geoSrc)
  const chips = [...document.querySelectorAll('.live-scoreboard .sb-logo')]
  const bar = document.querySelector('.live-scoreboard')
  return {
    opp: window.o?._oppName || null,
    chips: chips.map(c => ({ ...geo(c, bar), title: c.title })),
    fieldState: window.__fieldLogoStateV44 || null,
  }
}, GEO)
// the live bar scales chips 0.8: accept 28-40px rendered boxes, sprite-backed, inside the bar
check('scoreboard: 2 emblem chips sized 28-40px inside the bar',
  live.chips.length === 2 && live.chips.every(c => c.img && c.inside && c.w >= 28 && c.w <= 40 && Math.abs(c.w - c.h) < 1.5), live.chips)
const fs2 = live.fieldState
check('field crest composited at ~44% of field width',
  !!fs2 && fs2.composited && fs2.baseW > 0 && Math.abs(fs2.crestW / fs2.baseW - 0.44) < 0.03, fs2)
await dismissModals()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'scripts/_emblem_live.png' })

console.log(JSON.stringify({ pass: !fails.length && !errs.length, fails, pageErrors: errs.length }))
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'))
await browser.close()
process.exit(!fails.length && !errs.length ? 0 : 1)
