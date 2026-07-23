// v44 TEAM EMBLEMS check: every in-game team nickname resolves to a sensible emblem,
// every emblem's palette index is a real TEAM_PALETTES entry, the packed sheet loads,
// and a driven live game shows emblem chips in the scoreboard and the home crest
// composited onto the field art. Prints JSON + page errors; exits 1 on failure.
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => {
  setInterval(() => {
    try { if (window.o) window.o.tutorialSeen = true } catch {}
    document.querySelector('.onboard')?.remove()
  }, 60)
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 })
await page.waitForTimeout(1500)

const api = await page.evaluate(() => {
  const L = window.TEAM_LOGOS_V44, P = window.TEAM_PALETTES
  if (!L) return { ok: false, why: 'TEAM_LOGOS_V44 missing' }
  // the exact nicknames the game generates (Dt levels + standings pool) plus the default team
  const expected = {
    Wolves: 'Wolf', 'TIMBERWOLVES': 'Wolf', Bears: 'Grizzly', Cubs: 'Grizzly', 'POLAR BEARS': 'Polar Bear',
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
  for (const [name, want] of Object.entries(expected)) {
    const got = L.name(L.forName(name))
    if (got !== want) misses.push(`${name}: got ${got}, want ${want}`)
  }
  // structural checks: 90 entries, every palette index valid, fallback is deterministic + in range
  const badPal = L.db.filter(d => !P[d.p]).length
  const fb1 = L.forName('Dallas State'), fb2 = L.forName('Dallas State')
  return {
    ok: !misses.length && !badPal && L.db.length === 90 && fb1 === fb2 && fb1 >= 0 && fb1 < 90,
    logos: L.db.length, palettes: P.length, badPal, misses, fallbackPick: L.name(fb1),
  }
})
console.log('name-matching:', JSON.stringify(api))

// drive into a live game the same way live.mjs does
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const ok = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    let el
    if (t === 'ARCH') el = els.find(e => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim()))
    else if (t === 'PLAN') el = els.find(e => /plan|Execution|Spotlight|Highlight|Dirty|Recovery/i.test(e.className + ' ' + e.innerText))
    else el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis })
  console.log(`>> ${t} -> ${ok ? 'ok' : 'MISS'}`)
  await page.waitForTimeout(900)
}
for (const s of ['START NEW CAREER', 'ARCH', 'QB Quarterback', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await click(s)
for (let i = 0; i < 20; i++) { const c = await page.evaluate(() => document.querySelectorAll('canvas').length); if (c) break; await page.waitForTimeout(300) }
await page.waitForTimeout(2500)   // let a snap or two run so warpField() bakes the crest in

const live = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('.live-scoreboard .sb-logo')]
  return {
    view: window.o?.view,
    opp: window.o?._oppName || null,
    chips: chips.map(c => ({ hasSprite: /rib_logos_v44/.test(c.getAttribute('style') || ''), title: c.title, mark: c.dataset.mark })),
    fieldState: window.__fieldLogoStateV44 || null,
  }
})
console.log('live:', JSON.stringify(live))
await page.screenshot({ path: 'scripts/_emblem_live.png' })

const pass = api.ok && live.chips.length >= 2 && live.chips.every(c => c.hasSprite) &&
  live.fieldState && live.fieldState.composited
console.log(JSON.stringify({ pass, pageErrors: errs.length }))
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'))
await browser.close()
process.exit(pass && !errs.length ? 0 : 1)
