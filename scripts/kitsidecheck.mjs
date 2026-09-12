// Dev check: v105.2 — THE KIT FOLLOWS THE TEAM. The kits are registered by palette ("off" =
// the user's team's colours, "def" = the opponent's) but markers used to be dressed by SIDE, so
// whenever the user's team defended, the opponent's offense wore the user's colours and the
// user's defense the opponent's — and the you-player was dressed to match the wrong side. With
// a LINEBACKER (so the user's "my plays" are on defense) this watches a live game across both
// possessions and asserts, on every sampled play:
//   * the eleven on the user's side of the ball wear the "off" kit and the opponent's eleven the
//     "def" kit — whichever of them has the ball;
//   * the you-player is dressed from his own team's palette ("off"), on defense as on offense;
//   * the depth rule that lifts the OFFENSE in an engaged pair still reads the side, not the kit
//     (m.team stays the side; m.kit is the palette).
//   node scripts/kitsidecheck.mjs        (READ_POS defaults to LB)
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const errs = []
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const page = await browser.newPage({ viewport: { width: 520, height: 900 } })
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 200)) })
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200)
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(2500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', null, { timeout: 60000 })
await page.evaluate(p => { window.__readPos = p }, process.env.READ_POS || 'LB')
async function step(t) {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    let el = t === 'POS' ? (els.find(e => new RegExp('^' + window.__readPos + '\\b').test(txt(e))) || els.find(e => e.classList.contains('pos-card')))
      : t === 'PLAN' ? els.find(e => /gs-card/i.test(e.className))
      : els.find(e => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis })
  console.log('>>', t, '->', r); await page.waitForTimeout(t === 'PLAN' ? 4000 : 900)
}
for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON', 'Balanced Program', 'PLAY WEEK 1 LIVE', 'PLAN', 'CONTINUE TO MATCH']) await step(t)
let scene = false
for (let i = 0; i < 60; i++) { scene = await page.evaluate(() => !!(window.__gridironScene && window.__gridironScene.markers && window.__gridironScene.markers.length)); if (scene) break; await page.waitForTimeout(400) }
ok(scene, 'the broadcast is live')

const plays = new Map()   // one row per play (keyed by the payload's own identity)
for (let i = 0; i < 2000 && plays.size < 8; i++) {
  const st = await page.evaluate(() => { const sc = window.__gridironScene, P = sc && sc.play; if (!P || !P.payload || !sc.markers || sc.markers.length < 22) return null
    const et = P.payload, usOff = et.offense !== 'them'
    const rows = sc.markers.slice(0, 22).map((m, i) => ({ i, side: m.team, kit: m.kit, tex: m.body && m.body.texture && m.body.texture.key, kitSide: m.kitSide }))
    return { key: String(et.desc || '') + '|' + (et.startBall || 0) + '|' + P.t.toFixed(0).slice(0, 1), usOff, ev: et.event, pos: et.playerPos, rows, you: window.__V105_2 && window.__V105_2.you } })
  if (st && st.ev && /^(run|pass|incomplete|sack|turnover)$/.test(st.ev)) plays.set(st.key.split('|').slice(0, 2).join('|'), st)
  await page.waitForTimeout(120)
}
const P = [...plays.values()]
const withUs = P.filter(p => p.usOff), withThem = P.filter(p => !p.usOff)
ok(withUs.length > 0 && withThem.length > 0, 'plays were watched with the ball on BOTH sides', `${withUs.length} ours / ${withThem.length} theirs`)
// the kit each eleven wears, per possession
const wrong = []
for (const p of P) {
  for (const r of p.rows) {
    const userSide = (r.side === 'off') === p.usOff
    const wantKit = r.tex && r.tex.startsWith('spr_you_') ? 'you' : userSide ? 'off' : 'def'
    const gotKit = r.tex && r.tex.startsWith('spr_you_') ? 'you' : r.kit
    if (wantKit !== 'you' && gotKit !== wantKit) wrong.push(`${p.usOff ? 'ours' : 'theirs'}:${r.i}(${r.side})->${gotKit}`)
    if (r.tex && !r.tex.startsWith('spr_' + (gotKit || r.kit) + '_') && r.tex !== 'rib_player_fallback') wrong.push(`${r.i} tex ${r.tex} != kit ${gotKit}`)
  }
}
ok(wrong.length === 0, 'the user\'s eleven wear the user\'s kit and the opponent\'s eleven the opponent\'s — whoever has the ball', wrong.length ? wrong.slice(0, 8).join(' ') : `${P.length} plays × 22 men`)
// the side is still the side
const sides = P.every(p => p.rows.slice(0, 11).every(r => r.side === 'off' || r.side === 'you') && p.rows.slice(11).every(r => r.side === 'def' || r.side === 'you'))
ok(sides, 'm.team still names the SIDE (first eleven off, last eleven def) so the engaged-pair depth rule keeps its meaning')
// the you-player: a linebacker dressed from his own team's palette while his team defends
const youThem = withThem.map(p => p.you).filter(Boolean)
ok(youThem.length > 0 && youThem.every(y => y.kitSide === 'off'), 'the you-player (a defender) is dressed from HIS team\'s palette on the opponent\'s possessions', JSON.stringify(youThem[0] || null))
const youUs = withUs.map(p => p.you).filter(Boolean)
ok(youUs.every(y => y.kitSide === 'off'), 'and on his own team\'s possessions too', JSON.stringify(youUs[0] || null))

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
