// Dev check: v146 B — TWO STRIKES IN THE DFL, AND YOU PICK THE TEAM.
//
// A DFL cut is a strike, counted per season. Short of the allowance (TU("dflCutsAllowedV146B", 2)
// plus the `secondChance` prestige node) a cut releases him to a choice of three clubs that want him
// as a BACKUP; the strike that reaches the allowance ends the career on the cut screen. Signing is a
// choice of three at the door into the DFL too, and the choice drives the game: the club's name and
// crest, its rating in the roster factor, and the snap share the pregame and the engine read.
//
// Asserts:
//   - entering the DFL (`advance` from College Senior) opens the three-offer screen
//   - every offer shows a team OVR and a snap share, the three trade off (the strongest club offers
//     the least playing time), and the screen fits a 400x860 phone without scrolling
//   - choosing one sets the team name (Xe, the scorebug's Team Creator identity, the menu feed), the
//     club quality in the rating the sim reads (teamPairV76), and the share the engine uses
//     (window.__V120.trustShare / __V111.usage) to what the card said
//   - the first cut (the weekly evaluation dropping him to waivers) is strike 1 of 2 and opens
//     backup-only offers at lower snap shares than the entry offers; the second cut in the same
//     season ends the career on the cut screen
//   - with Second Chances at level 1, the second cut is survivable and the third ends it
//   - no page errors
//   node scripts/v146Bcheck.mjs   (GAME_URL=http://localhost:5302/ to point it elsewhere)
import { chromium } from 'playwright'
import fs from 'node:fs'

const url = process.env.GAME_URL || 'http://localhost:5173/'
const SHOT = process.env.SHOT || ''
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []

async function boot() {
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 } })
  const page = await ctx.newPage()
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  await page.addInitScript(() => {
    try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
  })
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForTimeout(2500)
  return { ctx, page }
}

// a College senior one step from the DFL, with the tree set as asked
const seed = (page, tree) => page.evaluate((tree) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.getState()
  S.tree = Object.assign({}, tree || {})
  S.player = A.newPlayer(); const p = S.player
  p.pos = 'RB'; p.level = 6; p.age = 22; p.totalSeasons = 12; p.career = []
  p._wonShown = true                         // skip the one-time "you made the DFL" screen; the offers are the subject
  S.view = 'hub'
  A.advance()
  return { level: p.level, view: S.view, kind: p.offersV146B && p.offersV146B.kind }
}, tree)

const offerScreen = (page) => page.evaluate(() => {
  const cards = [...document.querySelectorAll('.club-card-v146b')]
  const se = document.scrollingElement, dock = document.getElementById('dock'), btn = document.getElementById('clubSignV146B')
  const last = cards[cards.length - 1], rules = document.querySelector('.club-v146b .cc-rules')
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= -1 && r.height > 0 }
  return {
    view: window.S.view, n: cards.length,
    text: cards.map(c => c.innerText.replace(/\s+/g, ' ')),
    rules: rules ? rules.innerText : '',
    kicker: (document.querySelector('.club-v146b .eyebrow') || {}).innerText || '',
    scroll: se.scrollHeight - se.clientHeight,
    allVisible: cards.every(vis) && vis(rules) && vis(btn),
    btnBelowCards: !!(btn && last && btn.getBoundingClientRect().top >= last.getBoundingClientRect().bottom - 1),
    btnDisabled: !!(btn && btn.disabled),
  }
})

// ------------------------------------------------------------------ entry
{
  const { ctx, page } = await boot()
  const s = await seed(page, {})
  ok(s.level === 7 && s.kind === 'entry', 'advancing into the DFL opens three entry offers', s)
  await page.waitForTimeout(600)
  // the win screen is skipped in the seed; the hub redirect is what sends him to the screen
  await page.evaluate(() => { window.S.view = 'hub'; window.go ? window.go('hub') : null })
  await page.waitForTimeout(500)
  const scr = await offerScreen(page)
  ok(scr.view === 'club' && scr.n === 3, 'the hub waits for the signature: the three-offer screen is up', { view: scr.view, n: scr.n })
  ok(scr.text.every(t => /TEAM OVR/.test(t) && /SNAP SHARE/.test(t) && /\d+%/.test(t) && /DEPTH/.test(t)), 'every offer shows team OVR, snap share, depth', scr.text[0])
  ok(/2 times in one UFF season/.test(scr.rules), 'the rule is stated on the screen', scr.rules.slice(0, 90))
  ok(scr.scroll <= 1 && scr.allVisible, 'the screen fits 400x860 with no scroll, every card and the sign button on screen', { scroll: scr.scroll })
  ok(scr.btnBelowCards && scr.btnDisabled, 'the action is at the bottom, and needs a pick first')
  if (SHOT) {
    fs.mkdirSync(SHOT.replace(/\/[^/]*$/, ''), { recursive: true })
    await page.waitForFunction(() => !document.getElementById('splash') || getComputedStyle(document.getElementById('splash')).display === 'none' || document.getElementById('splash').classList.contains('gone'), null, { timeout: 15000 }).catch(() => {})
    await page.evaluate(() => document.getElementById('splash')?.remove())
    await page.screenshot({ path: SHOT })
  }

  const offers = await page.evaluate(() => window.S.player.offersV146B.list.map(c => ({ name: c.name, mascot: c.mascot, tier: c.tier, role: c.role, share: c.share, rating: c.rating, q: c.q })))
  ok(offers[0].rating > offers[2].rating && offers[0].share < offers[2].share, 'the offers trade off: the strongest club gives the least playing time', offers.map(o => `${o.tier}:${o.rating}/${Math.round(o.share * 100)}%`).join(' '))
  ok(new Set(offers.map(o => o.name)).size === 3, 'three different clubs')

  // choose the middle one, through the screen: tap, then the dock button
  await page.click('.club-card-v146b >> nth=1'); await page.waitForTimeout(200)
  const btnTxt = await page.evaluate(() => document.getElementById('clubSignV146B').innerText)
  ok(/Sign with the/i.test(btnTxt), 'a tap arms the sign button with the club\'s name', btnTxt)
  await page.click('#clubSignV146B'); await page.waitForTimeout(900)
  const after = await page.evaluate(() => {
    const p = window.S.player, fd = window.__RIB_MENU_DATA_V89 ? window.__RIB_MENU_DATA_V89() : null
    return {
      view: window.S.view, club: p.clubV146B, offers: !!p.offersV146B, xe: window.__GRIDIRON_AUDIT__ && (document.getElementById('screen').innerText || ''),
      custom: window.__GRIDIRON_TEAM_CUSTOM__ && { school: window.__GRIDIRON_TEAM_CUSTOM__.schoolName, team: window.__GRIDIRON_TEAM_CUSTOM__.teamName, logo: window.__GRIDIRON_TEAM_CUSTOM__.logo },
      feed: fd && fd.team ? { school: fd.team.school, name: fd.team.name } : null,
      trust: p.coachTrust, share: window.__V120.trustShare(p), usage: window.__V111.usage(p, null).share,
      pairQ: window.__TEAMPAIR_V76(p, {}).us, pair0: window.__TEAMPAIR_V76(p, { clubQ: 0 }).us, teamOvr: p.teamOvr,
      status: p.nflStateV11 && p.nflStateV11.status, logoFor: window.TEAM_LOGOS_V44.forName(p.clubV146B.name)
    }
  })
  const pick = offers[1]
  ok(after.view === 'hub' && !after.offers && after.club && after.club.name === pick.name, 'signing lands on the hub with the chosen club', { view: after.view, club: after.club && after.club.name })
  ok(after.xe.includes(pick.name), 'the hub names the club (Xe)')
  ok(after.custom && after.custom.team === pick.mascot && after.feed && after.feed.name === pick.mascot, 'the scorebug identity and the menu feed wear the club\'s name', { custom: after.custom, feed: after.feed })
  ok(after.custom && after.custom.logo === after.logoFor, 'and its crest')
  ok(Math.abs(after.share - pick.share) < 0.011 && Math.abs(after.usage - pick.share) < 0.011, 'the snap share the pregame and the engine read is the one on the card', { card: pick.share, trustShare: after.share, usage: after.usage })
  ok(after.pairQ === pick.rating && after.teamOvr === pick.rating, 'the team rating the sim reads is the club\'s', { card: pick.rating, pair: after.pairQ, noClub: after.pair0 })

  // ---------------- the first cut: the weekly evaluation drops him to waivers
  const cut1 = await page.evaluate(() => { const p = window.S.player; p.nflStateV11.security = 0; const r = window.__V146B.evaluate(5); return { r: r && r.cutV146B, strikes: window.__V146B.strikes(), kind: p.offersV146B && p.offersV146B.kind, list: p.offersV146B && p.offersV146B.list.map(c => ({ role: c.role, share: c.share })) } })
  ok(cut1.r && !cut1.r.end && cut1.strikes === 1 && cut1.kind === 'cut', 'the first cut is strike 1 of 2 and releases him to offers', cut1.r)
  ok(cut1.list.every(c => c.role === 'backup'), 'after a cut every offer is a backup\'s role')
  const minEntry = Math.min(...offers.map(o => o.share))
  ok(cut1.list.every(c => c.share < minEntry) && cut1.list.every(c => c.share < pick.share), 'at a lower snap share than any entry offer', { cut: cut1.list.map(c => c.share), entry: offers.map(o => o.share) })
  await page.evaluate(() => window.go('season')); await page.waitForTimeout(500)
  const scr2 = await offerScreen(page)
  ok(scr2.view === 'club' && /STRIKE 1 OF 2/.test(scr2.kicker), 'the season screen waits: the released screen says strike 1 of 2', scr2.kicker)
  ok(scr2.scroll <= 1 && scr2.allVisible, 'the released screen fits too', { scroll: scr2.scroll })
  await page.evaluate(() => document.getElementById('personaV13')?.remove())   // a fresh test player's first-week persona card, not this screen's
  if (SHOT) await page.screenshot({ path: SHOT.replace(/\.png$/, '-cut.png') })
  await page.click('.club-card-v146b >> nth=2'); await page.click('#clubSignV146B'); await page.waitForTimeout(700)
  const back = await page.evaluate(() => ({ view: window.S.view, role: window.S.player.clubV146B.role, share: window.__V120.trustShare(window.S.player), status: window.S.player.nflStateV11.status }))
  ok(back.view === 'season' && back.role === 'backup' && back.status === 'active-backup', 'he signs as a backup and goes back where he was', back)

  // ---------------- the second cut, same season: the career is over
  const cut2 = await page.evaluate(() => { const p = window.S.player; p.nflStateV11.security = 0; const r = window.__V146B.evaluate(5); return { r: r && r.cutV146B, out: !!p.cutOutV146B, offers: !!p.offersV146B } })
  ok(cut2.r && cut2.r.end && cut2.out && !cut2.offers, 'the second cut in the same season ends the career', cut2.r)
  await page.evaluate(() => window.go('season')); await page.waitForTimeout(800)
  const end = await page.evaluate(() => ({ view: window.S.view, txt: (document.getElementById('screen') || {}).innerText || '' }))
  ok(end.view === 'gameover' && /cut at OVR/i.test(end.txt), 'and lands on the cut career-end screen', end.view)

  // ---------------- a new season starts the count clean
  const clean = await page.evaluate(() => { const p = { level: 7, totalSeasons: 3, cutsV146B: { k: '7:2', n: 1 } }; return window.__V146B.strikes(p) })
  ok(clean === 0, 'the count is per season: last season\'s strike does not carry')
  await ctx.close()
}

// ------------------------------------------------------------------ Second Chances, level 1
{
  const { ctx, page } = await boot()
  await seed(page, { secondChance: 1 })
  const r = await page.evaluate(() => {
    const p = window.S.player, out = { allowed: window.__V146B.allowed(), node: window.__GRIDIRON_AUDIT__.TREE_NODES.secondChance }
    window.__V146B.sign(0)
    const cut = () => { p.nflStateV11.security = 0; const r = window.__V146B.evaluate(5); const c = r && r.cutV146B; if (p.offersV146B) window.__V146B.sign(0); return c }
    out.c1 = cut(); out.c2 = cut(); out.c3 = cut(); out.out = !!p.cutOutV146B
    out.rules = window.__V146B.rules()
    return out
  })
  ok(r.node && /cut/i.test(r.node.desc) && r.allowed === 3, 'Second Chances is a prestige node and level 1 allows one more cut', { allowed: r.allowed, desc: r.node && r.node.desc })
  ok(r.c1 && !r.c1.end && r.c2 && !r.c2.end, 'with it, the second cut is survived too', [r.c1, r.c2])
  ok(r.c3 && r.c3.end && r.out, 'and the third one ends the career', r.c3)
  ok(/3 times in one UFF season/.test(r.rules), 'the stated rule follows the node', r.rules.slice(0, 60))
  await ctx.close()
}

// ------------------------------------------------------------------ the season-end roll is a strike again
{
  const { ctx, page } = await boot()
  await seed(page, {})
  const r = await page.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__, p = window.S.player
    window.__V146B.sign(0)
    const was = Math.random; Math.random = () => 0.001            // the cut roll lands
    let t = null, err = null
    try { A.startSeasonGames(); p.weekResults.forEach(w => { w.played = true; w.perf = 20; w.us = 3; w.them = 30; w.won = false }); t = A.simSeason(p) } catch (e) { err = String(e) }
    Math.random = was
    return { err, cut: t && t.cutV146B, kind: p.offersV146B && p.offersV146B.kind, strikes: p.cutsV146B && p.cutsV146B.n }
  })
  ok(!r.err && r.cut && !r.cut.end && r.kind === 'cut', 'the season-end cut roll (the one longLeash / survivor tune) is a real strike again', r)
  await ctx.close()
}

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await b.close()
process.exit(fail || errs.length ? 1 : 0)
