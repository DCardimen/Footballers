// Dev check: v119 — THE COACH'S TOUR. Drives a real browser at a phone width and proves:
//   * the dev-check boot (welcome cards removed without a click) never meets the tour;
//   * the switch is on the menu, reads ON on a fresh install, and opens the tour when tapped;
//   * the tour dims the page but leaves the menu behind it, the coach TALKS (his picture flips
//     between the closed and open mouth while a line types, in a variable pattern, and a muddle of
//     pitched blips plays letter by letter; VOICE mutes it), twelve chapters, five to ten minutes;
//   * NEXT and the keyboard move the lines, a chapter's spotlight lands on the element it names,
//     nothing scrolls sideways at 400px;
//   * SKIP / Escape close it and switch it OFF, the switch is remembered across a reload, and
//     switching it back ON replays it;
//   * on a REAL first visit the game's welcome cards show above the menu (v119 lifted them from
//     under it), and clicked through they hand to the coach; `?coachTour` starts it on the first
//     menu mount;
//   * every league string on the menu and in the guide says DFL, never the real one.
//   node scripts/coachcheck.mjs      (GAME_URL, SHOTS=/tmp/coach writes screenshots)
import { chromium } from 'playwright'
import fs from 'node:fs'
const url = process.env.GAME_URL || 'http://127.0.0.1:5173/index.html'
const shots = process.env.SHOTS || ''
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const errors = []
const newPage = async (opts = {}) => {
  const context = await browser.newContext({ viewport: { width: opts.w || 400, height: opts.h || 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  if (!opts.realFirstVisit) await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
  return { page, context }
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}_${name}.png` }) }
const menuUp = async (page) => { await page.waitForSelector('#rib-main-menu-v2 .rib9-tiles', { timeout: 30000 }); await page.waitForTimeout(600) }
const H = (page) => page.evaluate(() => { const C = window.__RIB_COACH; return C ? { open: C.isOpen, enabled: C.enabled, chapter: C.chapter, line: C.line, typing: C.typing, flips: C.flips, spot: C.spot, auto: C.auto, openedBy: C.openedBy || null, closedBy: C.closedBy || null, chapters: C.chapters.length, lines: C.chapters.reduce((n, c) => n + c.lines, 0), estimateMin: C.estimateMs() / 60000, last: C.last || null } : null })

// ================= 1. the dev-check boot, the switch, the tour =================
{
  const { page, context } = await newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await menuUp(page)
  await page.waitForTimeout(1500)
  let h = await H(page)
  ok(!!h, 'the coach module is loaded on the menu', h && `${h.chapters} chapters · ${h.lines} lines`)
  ok(h && !h.open, 'the dev-check boot (welcome cards removed without a click) never starts the tour on its own')
  const tile = await page.evaluate(() => { const t = document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]'); return t ? { on: t.getAttribute('aria-checked'), role: t.getAttribute('role'), label: (t.querySelector('b') || {}).textContent, face: (t.querySelector('small') || {}).textContent, img: !!t.querySelector('img') } : null })
  ok(tile && tile.role === 'switch' && tile.on === 'true' && /COACH'S TOUR/.test(tile.label) && /^ON\b/.test(tile.face) && tile.img, "the COACH'S TOUR switch is on the menu and reads ON on a fresh install", JSON.stringify(tile))
  ok(h && h.chapters === 12 && h.estimateMin >= 5 && h.estimateMin <= 10, 'twelve chapters, and the scripted pace lands between five and ten minutes', h && `${h.estimateMin.toFixed(1)} min · ${h.lines} lines`)
  await shot(page, 'menu')
  await page.click('#rib-main-menu-v2 [data-rib-action="coach"]')
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 8000 })
  await page.waitForTimeout(300)
  h = await H(page)
  ok(h && h.open && h.chapter === 'kickoff' && h.line === 0 && h.openedBy === 'tile', 'tapping the switch opens the tour at the kickoff', JSON.stringify({ chapter: h && h.chapter, by: h && h.openedBy }))
  const layer = await page.evaluate(() => {
    const root = document.getElementById('rib-coach-v119'), menu = document.getElementById('rib-main-menu-v2')
    const dim = root && root.querySelector('.rib-coach-dim'), man = root && root.querySelector('[data-c-man]'), bub = root && root.querySelector('[data-c-bubble]')
    const bg = dim && !dim.hidden ? getComputedStyle(dim).backgroundColor : null
    const z = root ? +getComputedStyle(root).zIndex : 0, mz = menu ? +getComputedStyle(menu).zIndex : 0
    const mr = man ? man.getBoundingClientRect() : null, br = bub ? bub.getBoundingClientRect() : null
    return { menuStill: !!menu && menu.isConnected, dim: !!bg && /rgba\(/.test(bg), above: z > mz, man: mr && { w: Math.round(mr.width), h: Math.round(mr.height), bottom: Math.round(mr.bottom) }, bubble: br && { w: Math.round(br.width), top: Math.round(br.top), bottom: Math.round(br.bottom) }, overlap: mr && br ? br.bottom <= mr.top + Math.round(mr.height * 0.35) : null, vw: innerWidth, vh: innerHeight }
  })
  ok(layer.menuStill && layer.dim && layer.above, 'the tour dims the page and stands above the menu, which is still there behind it', JSON.stringify({ dim: layer.dim, above: layer.above }))
  ok(layer.man && layer.man.h >= 200 && layer.man.h <= 360 && layer.man.bottom <= layer.vh + 2, 'the coach stands at the bottom of a phone screen at a readable size', JSON.stringify(layer.man))
  ok(layer.bubble && layer.bubble.w >= 300 && layer.bubble.w <= 400 && layer.overlap, 'his bubble sits over his shoulder, not on his face', JSON.stringify(layer.bubble))
  // the mouth: sample the picture while the first line types
  const srcs = new Set(); const t0 = Date.now()
  while (Date.now() - t0 < 1400) { srcs.add(await page.evaluate(() => (document.querySelector('#rib-coach-v119 [data-c-man]') || {}).getAttribute?.('src') || '')); await page.waitForTimeout(40) }
  h = await H(page)
  ok(srcs.size >= 2 && [...srcs].some((s) => /_a\.webp/.test(s)) && [...srcs].some((s) => /_b\.webp/.test(s)) && h.flips >= 2, 'the coach talks — his mouth flips between the closed and open drawing while the line types', `${srcs.size} pictures · ${h.flips} flips`)
  const typed = await page.evaluate(() => (document.querySelector('#rib-coach-v119 [data-c-text]') || {}).textContent || '')
  ok(typed.length > 10 && /Coach/.test(typed), 'the line types out on the bubble', JSON.stringify(typed.slice(0, 50)))
  // the mouth is not a metronome, and the voice muddles along with the letters
  const mouth = await page.evaluate(() => { const L = window.__RIB_COACH.voice.mouthLog; return { n: L.length, distinct: new Set(L).size, min: Math.min(...L), max: Math.max(...L) } })
  ok(mouth.n >= 8 && mouth.distinct >= 6 && mouth.max - mouth.min >= 60, 'the mouth moves in a variable pattern — no two beats the same, a real spread', JSON.stringify(mouth))
  const v1 = await page.evaluate(() => ({ on: window.__RIB_COACH.voice.enabled, blips: window.__RIB_COACH.voice.blips, state: window.__RIB_COACH.voice.state }))
  ok(v1.on && v1.blips >= 8 && !!v1.state, 'the coach has a voice — a muddle of blips scheduled letter by letter through WebAudio', JSON.stringify(v1))
  await page.click('#rib-coach-v119 [data-c-voice]'); const b0 = await page.evaluate(() => window.__RIB_COACH.voice.blips); await page.waitForTimeout(700)
  const v2 = await page.evaluate(() => ({ on: window.__RIB_COACH.voice.enabled, blips: window.__RIB_COACH.voice.blips, stored: localStorage.getItem(window.__RIB_COACH.voice.key) }))
  ok(!v2.on && v2.blips === b0 && v2.stored === 'off', 'VOICE mutes him and remembers', JSON.stringify(v2))
  await page.click('#rib-coach-v119 [data-c-voice]')
  await shot(page, 'kickoff')
  await page.click('#rib-coach-v119 [data-c-next]')
  await page.waitForTimeout(200)
  h = await H(page)
  ok(h.chapter === 'kickoff' && h.line === 1, 'NEXT moves to the next line', `line ${h.line}`)
  // walk to a spotlight line: START HERE opens on the CAREER tile
  await page.evaluate(() => { const C = window.__RIB_COACH; let n = 0; while (C.chapter !== 'start' && n++ < 20) C.next() })
  await page.waitForTimeout(700)
  const spot = await page.evaluate(() => {
    const C = window.__RIB_COACH, spot = document.querySelector('#rib-coach-v119 [data-c-spot]'), dim = document.querySelector('#rib-coach-v119 .rib-coach-dim')
    const target = document.querySelector('#rib-main-menu-v2 .rib9-tiles .rib9-tile:nth-child(1)')
    const sr = spot && !spot.hidden ? spot.getBoundingClientRect() : null, tr = target ? target.getBoundingClientRect() : null
    const inside = sr && tr && sr.left <= tr.left + 1 && sr.top <= tr.top + 1 && sr.right >= tr.right - 1 && sr.bottom >= tr.bottom - 1
    const onScreen = sr && sr.top >= 0 && sr.bottom <= innerHeight
    return { chapter: C.chapter, spot: C.spot, shown: !!sr, dimHidden: !!dim && dim.hidden, inside: !!inside, onScreen: !!onScreen, sr: sr && [Math.round(sr.left), Math.round(sr.top), Math.round(sr.width), Math.round(sr.height)], tr: tr && [Math.round(tr.left), Math.round(tr.top), Math.round(tr.width), Math.round(tr.height)] }
  })
  ok(spot.chapter === 'start' && spot.shown && spot.dimHidden && spot.inside && spot.onScreen, "the START HERE chapter cuts its spotlight over the CAREER tile, scrolled into view", JSON.stringify(spot))
  await shot(page, 'spotlight')
  const wide = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))
  ok(wide <= 400, 'nothing scrolls sideways at 400px with the tour open', wide + 'px')
  // keyboard
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150)
  const before = await H(page)
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150)
  const after = await H(page)
  ok(after.line !== before.line || after.chapter !== before.chapter || !after.typing, 'the right arrow finishes the line or moves on', `${before.chapter}:${before.line} -> ${after.chapter}:${after.line}`)
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  h = await H(page)
  const tile2 = await page.evaluate(() => (document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]') || {}).getAttribute?.('aria-checked'))
  const stored = await page.evaluate((k) => localStorage.getItem(k), await page.evaluate(() => window.__RIB_COACH.key))
  ok(!h.open && h.closedBy === 'skip' && !h.enabled && tile2 === 'false' && stored === 'off', 'Escape skips the tour and switches it OFF, and the switch remembers', JSON.stringify({ tile: tile2, stored }))
  await page.reload({ waitUntil: 'networkidle' }); await menuUp(page)
  const tile3 = await page.evaluate(() => (document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]') || {}).getAttribute?.('aria-checked'))
  ok(tile3 === 'false', 'after a reload the switch still reads OFF')
  await page.click('#rib-main-menu-v2 [data-rib-action="coach"]')
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 8000 })
  h = await H(page)
  ok(h.open && h.enabled && h.chapter === 'kickoff', 'switching it back ON replays the tour from the kickoff')
  await page.evaluate(() => window.__RIB_COACH.skip()); await page.waitForTimeout(200)
  h = await H(page)
  ok(!h.open && !h.enabled, 'SKIP closes it and switches it OFF again')
  // ?coachTour starts it on the first mount
  await page.goto(url + '?coachTour', { waitUntil: 'networkidle', timeout: 30000 }); await menuUp(page)
  await page.waitForSelector('#rib-coach-v119', { timeout: 8000 }).catch(() => null)
  h = await H(page)
  ok(h && h.open && h.openedBy === 'query' && h.enabled, '?coachTour switches it ON and starts the tour on the first menu mount', h && JSON.stringify({ open: h.open, by: h.openedBy, enabled: h.enabled }))
  await context.close()
}

// ================= 2. a real first visit: the welcome cards, then the coach =================
{
  const { page, context } = await newPage({ realFirstVisit: true })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await menuUp(page)
  const cards = await page.waitForSelector('.onboard', { timeout: 15000 }).catch(() => null)
  const stack = await page.evaluate(() => { const c = document.querySelector('.onboard'), m = document.getElementById('rib-main-menu-v2'); return c && m ? { cards: +getComputedStyle(c).zIndex, menu: +getComputedStyle(m).zIndex } : null })
  ok(!!cards && stack && stack.cards > stack.menu, "the game's own welcome cards show on a first visit, ABOVE the menu overlay (they were buried under it)", JSON.stringify(stack))
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  const early = await H(page)
  ok(early && !early.open, 'the tour waits while the cards are up')
  let clicks = 0
  for (let i = 0; i < 3 && cards; i++) { const b = await page.$('.onboard #onNext'); if (!b) break; await b.click({ timeout: 8000 }); clicks++; await page.waitForTimeout(350) }
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 10000 }).catch(() => null)
  const h = await H(page)
  ok(clicks === 3 && h && h.open && h.openedBy === 'welcome', 'clicked through, the cards hand straight to the coach', JSON.stringify({ clicks, open: h && h.open, by: h && h.openedBy }))
  await shot(page, 'firstvisit')
  // cut short (the page reloaded mid-tour), it comes back — until it is finished or skipped
  await page.reload({ waitUntil: 'networkidle' }); await menuUp(page)
  await page.waitForSelector('#rib-coach-v119.rib-coach-ready', { timeout: 30000 }).catch(() => null)
  const again = await H(page)
  ok(again && again.open && again.openedBy === 'switch', 'a tour cut short by a reload plays again at the next visit', JSON.stringify({ open: again && again.open, by: again && again.openedBy }))
  await page.evaluate(() => window.__RIB_COACH.skip())
  await page.reload({ waitUntil: 'networkidle' }); await menuUp(page); await page.waitForTimeout(9000)
  const done = await H(page)
  ok(done && !done.open && !done.enabled, 'once skipped, a later visit does not start it on its own', JSON.stringify({ open: done && done.open, enabled: done && done.enabled }))
  await context.close()
}

// ================= 3. the league is the DFL, everywhere the player reads =================
{
  const { page, context } = await newPage()
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); await menuUp(page)
  await page.click('#rib-main-menu-v2 [data-rib-action="howto"]'); await page.waitForSelector('#rib-howto-v111', { timeout: 8000 })
  await page.evaluate(() => window.__RIB_HOWTO.sections.forEach((id) => window.__RIB_HOWTO.toggle(id, true)))
  const txt = await page.evaluate(() => (document.getElementById('rib-howto-v111').textContent + ' ' + document.getElementById('rib-main-menu-v2').textContent + ' ' + JSON.stringify(window.__RIB_COACH.chapters)))
  const coachText = await page.evaluate(() => { const s = [...document.scripts].map((x) => x.src).find((u) => /rib-menu-coach/.test(u)); return fetch(s).then((r) => r.text()) })
  const bad = (txt + coachText).match(/\bNFL\b|Pro Bowl/g) || []
  ok(bad.length === 0 && /\bDFL\b/.test(txt), 'the guide, the menu and the coach say DFL — the real league name is gone', bad.length ? bad.slice(0, 4).join(',') : 'DFL present, NFL absent')
  await context.close()
}

console.log(JSON.stringify({ pass, fail, errors: errors.length }))
console.log('page errors:', errors.length ? errors.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
