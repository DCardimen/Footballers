import { chromium } from 'playwright'
import fs from 'node:fs'

/* ===== v89 MAIN MENU integration check =====
 * The menu overlay must: mount over the legacy menu screen with every picture loaded and
 * the team tint laid over the art; show a career's real numbers (the v89 feed, not a
 * scrape); route every tile and nav link to the right game view and come back to the
 * same menu; and stay reachable top to bottom on a phone. Run with the dev server up:
 *   node scripts/menu-integration-check.mjs            (fresh page + a new career)
 *   MENU_INTEGRATION_URL=http://127.0.0.1:5173/index.html node scripts/menu-integration-check.mjs */
const integrationUrl = process.env.MENU_INTEGRATION_URL || 'http://127.0.0.1:5173/index.html'
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await context.newPage()
const errors = [], failedRequests = []
page.on('pageerror', error => errors.push(error.message))
page.on('requestfailed', request => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'failed'}`))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const clickText = async (t) => { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const el = els.find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis }); await page.waitForTimeout(600); return r }
const waitMenu = () => page.waitForSelector('#rib-main-menu-v2 .rib9-shell', { state: 'visible', timeout: 12000 })
const snapshot = () => page.evaluate(() => {
  const menu = document.querySelector('#rib-main-menu-v2')
  const imgs = [...menu.querySelectorAll('img')]
  return {
    ready: document.documentElement.classList.contains('rib-assets-ready'),
    assets: window.__RIB_MENU_ASSETS,
    images: imgs.length, broken: imgs.filter(i => !i.complete || !i.naturalWidth).map(i => i.src.split('/').pop()),
    tiles: [...menu.querySelectorAll('.rib9-tile')].map(t => t.dataset.ribAction),
    nav: [...menu.querySelectorAll('.rib9-navlink')].map(t => t.dataset.ribAction),
    tints: menu.querySelectorAll('.rib9-tint').length,
    tintPx: [...menu.querySelectorAll('.rib9-tint')].every(t => /px$/.test(t.style.getPropertyValue('--mx'))),
    helmetLogo: !!menu.querySelector('.rib9-helmet-logo'),
    wordmark: !!menu.querySelector('.rib9-hero-copy h1 img'),
    swash: !!menu.querySelector('.rib9-swash'),
    legacyIcons: menu.querySelectorAll('.rib9-lt i img').length,
    heroSlogan: /DISCIPLINE/.test(menu.innerText),
    dots: menu.querySelectorAll('.rib9-dot').length,
    playedDots: menu.querySelectorAll('.rib9-dot.won,.rib9-dot.lost,.rib9-dot.sat').length,
    name: menu.querySelector('.rib9-name')?.textContent.trim(),
    ovr: Number(menu.querySelector('.rib9-ring-val')?.textContent),
    ring: menu.querySelector('.rib9-ring')?.style.getPropertyValue('--rib-ovr'),
    hasCareer: !menu.classList.contains('rib-no-career'),
    text: menu.innerText.replace(/\s+/g, ' ').trim(),
    scroll: menu.scrollHeight, client: menu.clientHeight,
    footerBottom: Math.round(menu.querySelector('.rib9-footer').getBoundingClientRect().bottom),
    feed: window.__RIB_MENU_DATA_V89 && window.__RIB_MENU_DATA_V89(),
  }
})

try {
  await page.goto(integrationUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 })
  await waitMenu(); await page.waitForTimeout(800)

  // ---- 1. a fresh page: the no-career menu, every picture in
  const fresh = await snapshot()
  ok(fresh.ready && fresh.assets && fresh.assets.ready && !fresh.assets.fallback && fresh.assets.failed.length === 0, 'the asset runtime opened the gate with every picture decoded', `loaded=${fresh.assets?.loaded.length} failed=${fresh.assets?.failed.join(',') || 'none'}`)
  ok(fresh.images >= 9 && fresh.broken.length === 0, 'every <img> in the menu rendered', `${fresh.images} images, broken: ${fresh.broken.join(',') || 'none'}`)
  ok(fresh.tiles.length === 6 && fresh.nav.length === 6, 'six tiles and six nav links', `${fresh.tiles.join(' ')} | ${fresh.nav.join(' ')}`)
  // the drawn wordmark, the swash and the six legacy icons are art, not CSS: if any of them
  // falls back to type or an inline path the menu stops matching the reference
  ok(fresh.wordmark && fresh.swash && fresh.legacyIcons === 6 && !fresh.heroSlogan,
    'the hero wears the drawn wordmark and swash, the legacy panel wears its six icons, and the wall slogan comes from the photograph',
    `wordmark=${fresh.wordmark} swash=${fresh.swash} icons=${fresh.legacyIcons} sloganInText=${fresh.heroSlogan}`)
  ok(!fresh.hasCareer && /START NEW CAREER/.test(fresh.text) && fresh.tiles[0] === 'new', 'without a save the card offers START NEW CAREER and the CAREER tile starts one')

  // ---- 2. a career: the feed drives the card
  await clickText('START NEW CAREER')
  for (let i = 0; i < 8; i++) {
    const done = await page.evaluate(({ visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
      for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false } }
      const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (card) { card.click(); return false } return true }, { visSrc: vis })
    await page.waitForTimeout(450); if (done) break
  }
  await clickText('PLAY 8-GAME SEASON'); await clickText('Balanced Program')
  const played = await page.evaluate(async () => {
    document.getElementById('growthV42')?.remove()
    const pl = window.S.player; const c = pl.conditionV11 || {}; c.fatigue = 10; c.injury = null
    for (let i = 0; i < 3; i++) { const wk = pl.weekResults.find(x => !x.played); if (wk) { window.__silentWeekV85(pl, wk); await new Promise(r => setTimeout(r, 200)) } }
    window.go('menu')
    return { name: pl.name, pos: pl.pos, ovr: Math.round(window.__RIB_MENU_DATA_V89().player.ovr), games: pl.weekResults.filter(w => !w.playoff).length, played: pl.weekResults.filter(w => w.played).length }
  })
  await waitMenu(); await page.waitForTimeout(1600)
  const career = await snapshot()
  ok(career.hasCareer && career.name === played.name.toUpperCase() && career.ovr === played.ovr, 'the player card shows the career (name, OVR) from the v89 feed', `${career.name} ${career.ovr} vs ${played.name} ${played.ovr}`)
  ok(career.dots === played.games && career.playedDots === played.played, 'season dots = the schedule, played dots = the weeks played', `${career.playedDots}/${career.dots} vs ${played.played}/${played.games}`)
  ok(career.tints >= 5 && career.tintPx && career.helmetLogo, 'team color tints are laid over the hero, helmet and continue card in picture pixels, with the emblem on the helmet', `tints=${career.tints} px=${career.tintPx} logo=${career.helmetLogo}`)
  // a week the player sat carries no score, so the row must say so instead
  const last = career.feed && career.feed.season.last
  const lastShown = !last ? false : last.sat ? /DID NOT PLAY/.test(career.text) : new RegExp(String(last.us) + ' - ' + String(last.them)).test(career.text)
  ok(lastShown, 'the latest game row carries the last score, or says the player sat out', last ? (last.sat ? 'DNP week' : `${last.us}-${last.them}`) : 'no last game')
  ok(career.tiles[0].startsWith('view:') && career.tiles[1] === 'view:upgrade' && parseFloat(career.ring) > 0, 'CAREER goes to the season, TRAINING to the upgrade sheet, the OVR ring is drawn', `${career.tiles[0]} ring=${career.ring}`)

  // ---- 3. routing: every tile and nav link lands on its view and the menu comes back the same
  const routes = [['.rib9-tile[data-rib-action^="view:"]', /season|hub/], ['.rib9-tile[data-rib-action="view:upgrade"]', /upgrade/], ['.rib9-tile[data-rib-action="goals"]', /challenges/], ['.rib9-tile[data-rib-action="hall"]', /hof/],
    ['.rib9-tile[data-rib-action="locker"]', /locker/], ['.rib9-tile[data-rib-action="settings"]', /settings/], ['.rib9-navlink[data-rib-action="view:leaderboard"]', /leaderboard/], ['.rib9-latest[data-rib-action]', /stats/], ['.rib9-continue', /hub|season|live|sim/], ['.rib9-prestige', /shop/]]
  const routed = []
  const sig = (snap) => [snap.name, snap.ovr, snap.hasCareer, snap.dots, snap.tiles.join(','), snap.nav.join(','), snap.images, snap.tints].join('|')
  const beforeSig = sig(career)
  for (const [sel, want] of routes) {
    const before = career.text
    await page.locator(sel).first().scrollIntoViewIfNeeded()
    await page.locator(sel).first().click()
    const gone = await page.waitForFunction(() => !document.querySelector('#rib-main-menu-v2'), null, { timeout: 8000 }).then(() => true).catch(() => false)
    await page.waitForTimeout(350)
    const view = await page.evaluate(() => window.S && window.S.view)
    await page.evaluate(() => window.go('menu'))
    await waitMenu(); await page.waitForTimeout(500)
    const back = await snapshot()
    // the milestone board is live: an objective can legitimately flip to done while we are away,
    // so identity is the stable signature of the menu, not every word in it
    const A = before.split(' '), B = back.text.split(' '), diff = []
    for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) diff.push(`[${i}] ${A[i]} -> ${B[i]}`)
    routed.push({ sel, gone, view, want: String(want), same: sig(back) === beforeSig, textDiff: diff.slice(0, 8) })
  }
  const bad = routed.filter(r => !(r.gone && r.want && new RegExp(r.want.slice(1, -1)).test(r.view || '') && r.same))
  ok(bad.length === 0, 'every tile / nav link / card routes to its view and the same menu returns', bad.length ? JSON.stringify(bad) : routed.map(r => r.view).join(' '))

  // ---- 4. reachability: the footer is reachable at a phone height, nothing overflows sideways
  const reach = await page.evaluate(() => { const menu = document.querySelector('#rib-main-menu-v2'); menu.scrollTop = 1e6; const fb = Math.round(menu.querySelector('.rib9-footer').getBoundingClientRect().bottom); return { fb, h: innerHeight, sw: document.documentElement.scrollWidth, w: innerWidth, menuSw: menu.scrollWidth } })
  ok(reach.fb <= reach.h && reach.menuSw <= reach.w && reach.sw <= reach.w, 'scrolled to the bottom the footer is on screen and nothing scrolls sideways', JSON.stringify(reach))

  fs.writeFileSync('menu-integration-diagnostics.json', JSON.stringify({ integrationUrl, fresh: { ...fresh, feed: undefined, text: fresh.text.slice(0, 300) }, career: { ...career, feed: undefined, text: career.text.slice(0, 300) }, routed, errors, failedRequests }, null, 2))
} catch (error) {
  await page.screenshot({ path: 'menu-integration-failure.png', fullPage: true }).catch(() => {})
  console.error(error); fail++
}
await browser.close()
ok(errors.length === 0 && failedRequests.length === 0, 'no page errors, no failed requests', errors.concat(failedRequests).join(' | ') || 'clean')
console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errors.length ? errors : 'none')
if (fail) process.exit(1)
