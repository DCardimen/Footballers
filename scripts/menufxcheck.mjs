// Dev check: v132 A THOUSAND HOURS — the main menu's second layer of life.
//
// Asserts, with a career on the page:
//   * the ticker is there, built from the feed (the player, the level, NEXT UP), and it is moving
//   * the ambient canvas is drawing embers (frames counting, ink on the canvas) and the odd spark
//   * the stadium sweep, the topbar's wire, the OVR spark, the tile gloss, the hot tile's ring, the
//     radar ping on the week that is up, the name's sweep and the hero's grain / leak / flashbang exist
//     and every one of them is animating
//   * the spark on the OVR ring sits where the arc ends
//   * a pointer crossing the hero moves the picture and the wordmark (parallax)
//   * the name's metal sweep never leaves the letters transparent (the flat chalk sits under the band)
//   * the coach tile still shows its switch (tiles clip their gloss, that one does not)
//   * v89's contract holds: nine tiles (v139 added PRESTIGE), seven nav links, no new <img>, no page errors
//   * prefers-reduced-motion: nothing animates and the ember loop never starts
//   node scripts/menufxcheck.mjs
import { chromium } from 'playwright'

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const URL = process.env.URL || 'http://localhost:5173/'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' })
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`

async function menuWithCareer(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage(); const errs = []
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 160)) })
  await page.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  await page.goto(URL + '?noFilmV114', { waitUntil: 'networkidle', timeout: 60000 })
  for (let i = 0; i < 200; i++) { if (await page.evaluate(() => !document.getElementById('splash'))) break; await page.waitForTimeout(100) }
  const click = async (t) => { const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a,[role=button]')].filter(vis); const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim(); const el = t === 'POS' ? (els.find(e => /^RB\b/.test(txt(e))) || els.find(e => e.classList.contains('pos-card'))) : els.find(e => txt(e).includes(t)); if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false }, { t, visSrc: vis }); await page.waitForTimeout(800); return r }
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON']) await click(t)
  for (let i = 0; i < 60; i++) { const d = await page.evaluate(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
  await click('CONFIRM TRAINING')
  // one week, so the ticker has a last game and a next opponent
  await page.evaluate(() => { const A = window.__GRIDIRON_AUDIT__, p = A.getState().player; const w = (p.weekResults || []).find(x => x && !x.played); if (w) { try { A.resolveSequentialWeekV11(p, w, 'balanced') } catch (e) {} w.played = true; w.won = !!(w.us > w.them) } })
  await page.evaluate(() => { try { document.querySelector('.hamb') && document.querySelector('.hamb').click() } catch (e) {} })
  await page.waitForSelector('#rib-main-menu-v2', { state: 'attached', timeout: 20000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1600)
  return { page, ctx, errs }
}

// ---- 1. the effects, with a career on the page
{
  const { page, ctx, errs } = await menuWithCareer()
  const anim = (sel) => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el); return { name: s.animationName, dur: s.animationDuration } }
  const r = await page.evaluate(() => {
    const M = document.getElementById('rib-main-menu-v2'), FX = window.__RIB_MENU_FX_V132 || null
    const tick = M.querySelector('.rib9-ticker-v132'), ul = tick && tick.querySelector('ul')
    const items = ul ? [...ul.querySelectorAll('li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()) : []
    const cv = M.querySelector('.rib9-ambient-v132'); let ink = 0
    try { const x = cv.getContext('2d'); const d = x.getImageData(0, 0, cv.width, Math.min(cv.height, 1200)).data; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 8) ink++ } catch (e) { ink = -1 }
    const pieces = ['.rib9-hero-grain-v132', '.rib9-hero-leak-v132', '.rib9-ring-v132', '.rib9-dot.now', '.rib9-name', '.rib9-tile-hot img', '.rib9-level.rib9-cta', '.rib9-ms-plate', '.rib9-nextup-v132']
    const animOf = (sel, pseudo) => { const el = M.querySelector(sel); if (!el) return { sel, missing: true }; const s = getComputedStyle(el, pseudo || null); return { sel, name: s.animationName, dur: s.animationDuration } }
    const pcs = [animOf('.rib9-topbar', '::after'), animOf('.rib9-hero-grain-v132'), animOf('.rib9-hero-leak-v132'), animOf('.rib9-ring-v132'), animOf('.rib9-dot.now', '::after'), animOf('.rib9-name'), animOf('.rib9-tile-hot img'), animOf('.rib9-ms-plate'), animOf('.rib9-ticker-v132 ul')]
    const ring = M.querySelector('.rib9-ring')
    const arc = ring && parseFloat(getComputedStyle(ring).getPropertyValue('--rib-ovr'))
    const orb = M.querySelectorAll('.rib9-ring-spark-v132').length   // v141: gone, and it stays gone
    const name = M.querySelector('.rib9-name'), ns = name && getComputedStyle(name)
    const coach = M.querySelector('.rib9-tile-coach'), sw = coach && coach.querySelector('.rib9-sw'), cr = coach && coach.getBoundingClientRect(), sr = sw && sw.getBoundingClientRect()
    const nav = M.querySelector('.rib9-nav'), first = nav && nav.firstElementChild, nr = nav && nav.getBoundingClientRect(), fr = first && first.getBoundingClientRect()
    return { fx: FX && { on: FX.on, frames: FX.frames, embers: FX.embers, sparks: FX.sparks, ticker: FX.ticker, reduced: FX.reduced }, tickerMoving: ul ? getComputedStyle(ul).animationName : null, tickerDur: ul ? getComputedStyle(ul).animationDuration : null,
      items: items.slice(0, items.length / 2), doubled: ul ? items.length : 0, ink, cvSize: cv ? [cv.width, cv.height] : null,
      pieces: pcs, arc, orb, nameBg: ns && ns.backgroundColor, nameClip: ns && (ns.webkitBackgroundClip || ns.backgroundClip), nameColor: ns && ns.color,
      coachSwitchIn: !!(sr && cr && sr.left >= cr.left - 1 && sr.right <= cr.right + 1 && sr.width > 0), coachOverflow: coach && getComputedStyle(coach).overflow,
      navFirstIn: !!(fr && nr && fr.left >= nr.left - 1), tiles: M.querySelectorAll('.rib9-tile').length, navLinks: M.querySelectorAll('.rib9-navlink').length, imgs: M.querySelectorAll('img').length,
      broken: [...M.querySelectorAll('img')].filter(i => !i.complete || i.naturalWidth === 0).length }
  })
  console.log('v132:', JSON.stringify({ fx: r.fx, ink: r.ink, cv: r.cvSize, items: r.items }))
  await page.waitForTimeout(500)
  const later = await page.evaluate(() => window.__RIB_MENU_FX_V132.frames)
  ok(r.fx && r.fx.on && r.fx.frames > 8 && later > r.fx.frames, 'the ember loop is running', r.fx && `${r.fx.frames} -> ${later} frames, ${r.fx.embers} embers, ${r.fx.sparks} sparks`)
  ok(r.ink > 20, 'and there is ink on the ambient canvas', `${r.ink} lit samples`)
  ok(r.fx && r.fx.ticker >= 6 && r.doubled === r.fx.ticker * 2, 'the ticker has the career\'s headlines, doubled for the loop', `${r.fx && r.fx.ticker} items`)
  ok(r.items.some(t => /PEE WEE|YEAR 1/.test(t)) && r.items.some(t => /NEXT UP/.test(t)) && r.items.some(t => /LAST WEEK/.test(t)), 'and they are built from the feed — the level, NEXT UP, last week', r.items.join(' | ').slice(0, 200))
  ok(r.tickerMoving === 'rib9ticker' && parseFloat(r.tickerDur) >= 26, 'the ticker is moving, at a pace set by its length', `${r.tickerMoving} ${r.tickerDur}`)
  const dead = r.pieces.filter(p => p.missing || !p.name || p.name === 'none')
  ok(dead.length === 0, 'every piece exists and animates — wire, grain, leak, ring, ping, name, float, plate, ticker (v134: the page sweep and the card streak are gone on purpose; v141: so is the OVR orb)', dead.length ? JSON.stringify(dead) : `${r.pieces.length} pieces`)
  ok(r.arc > 0 && r.orb === 0, 'the OVR arc is drawn, and no glowing orb rides it (v141: the bead is gone)', `arc ${r.arc}, ${r.orb} orbs`)
  ok(/text/.test(r.nameClip || '') && r.nameBg && !/rgba\(0, 0, 0, 0\)/.test(r.nameBg), 'the name is clipped to its metal with the flat chalk under the band (never transparent letters)', `${r.nameClip} on ${r.nameBg}`)
  ok(r.coachSwitchIn && r.coachOverflow === 'visible', 'the coach tile keeps its switch on screen', `switch in tile=${r.coachSwitchIn} overflow=${r.coachOverflow}`)
  ok(r.navFirstIn, 'the nav\'s first link (HOME) is not clipped at a tablet width', String(r.navFirstIn))
  ok(r.tiles === 9 && r.navLinks === 7 && r.broken === 0, 'v89\'s contract holds — nine tiles (v139 added PRESTIGE), seven links, every picture rendered', `${r.tiles} tiles ${r.navLinks} links ${r.imgs} imgs`)
  // parallax: cross the hero with the pointer
  const hero = await page.locator('#rib-main-menu-v2 .rib9-hero').boundingBox()
  await page.mouse.move(hero.x + hero.width * 0.1, hero.y + hero.height * 0.2); await page.waitForTimeout(80)
  await page.mouse.move(hero.x + hero.width * 0.9, hero.y + hero.height * 0.8, { steps: 6 }); await page.waitForTimeout(120)
  const par = await page.evaluate(() => { const h = document.querySelector('#rib-main-menu-v2 .rib9-hero'); const FX = window.__RIB_MENU_FX_V132; return { moves: FX.parallax.moves, x: FX.parallax.x, ax: h.style.getPropertyValue('--ax'), cx: h.style.getPropertyValue('--cx') } })
  ok(par.moves > 0 && par.x > 0.4 && parseFloat(par.ax) < 0 && parseFloat(par.cx) > 0, 'a pointer crossing the hero leans the picture away and the wordmark toward it', JSON.stringify(par))
  await page.mouse.move(hero.x + hero.width * 0.5, hero.y + hero.height + 300); await page.waitForTimeout(150)
  const back = await page.evaluate(() => { const h = document.querySelector('#rib-main-menu-v2 .rib9-hero'); return h.style.getPropertyValue('--ax') })
  ok(parseFloat(back) === 0, 'and settles back when it leaves', back)
  // the flashbang, on demand
  const bang = await page.evaluate(() => { const FX = window.__RIB_MENU_FX_V132; const b = document.querySelector('.rib9-hero-bang-v132'); FX.bang(); return { go: b.classList.contains('go'), n: FX.bangs } })
  ok(bang.go && bang.n >= 1, 'the flashbang fires on its clock (and on demand)', JSON.stringify(bang))
  ok(errs.length === 0, 'no page errors', errs.join(' | ') || 'none')
  await ctx.close()
}

// ---- 2. reduced motion: still, and cheap
{
  const { page, ctx, errs } = await menuWithCareer({ reduced: true })
  const r = await page.evaluate(() => { const M = document.getElementById('rib-main-menu-v2'), FX = window.__RIB_MENU_FX_V132
    const sels = ['.rib9-ticker-v132 ul', '.rib9-hero-grain-v132', '.rib9-name', '.rib9-tile-hot img', '.rib9-ms-plate']
    return { reduced: FX && FX.reduced, frames: FX && FX.frames, anims: sels.map(s => { const el = M.querySelector(s); return el ? getComputedStyle(el).animationName : 'missing' }) } })
  ok(r.reduced === true && r.frames === 0, 'prefers-reduced-motion: the ember loop never starts', JSON.stringify({ reduced: r.reduced, frames: r.frames }))
  ok(r.anims.every(a => a === 'none'), 'and nothing new animates', JSON.stringify(r.anims))
  ok(errs.length === 0, 'no page errors', errs.join(' | ') || 'none')
  await ctx.close()
}

console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
