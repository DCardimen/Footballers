import { chromium } from 'playwright'
import fs from 'node:fs'

/* ===== v111 HOW TO PLAY check =====
 * The guide is a view of the main menu with no screen behind it in the game app, so everything
 * about it — the entry points, the accordions, the keyboard, and surviving the menu's own
 * re-render — lives in the menu files. This drives a real browser at a phone width and proves:
 *   * the tile and the nav link exist and open the guide;
 *   * all nine sections are there, and every one expands and collapses;
 *   * a keyboard user can open it (Enter on the tile) and close it (Escape), with focus landing
 *     inside the dialog and coming back to the tile afterwards;
 *   * the menu's data re-render (mountMenu rebuilds #rib-main-menu-v2.innerHTML) does not wipe
 *     the open guide or the sections the reader had expanded;
 *   * nothing scrolls sideways at 400px, open or closed;
 *   * the menu's other actions still route after the guide has been used.
 *   GAME_URL=http://localhost:5194/index.html node scripts/faqcheck.mjs
 * SHOTS=/tmp/faq writes screenshots of the closed menu, the guide, and an open section. */
const url = process.env.GAME_URL || 'http://127.0.0.1:5173/index.html'
const shots = process.env.SHOTS || ''
const W = Number(process.env.W || 400), H = Number(process.env.H || 860)
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) })
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
await page.addInitScript(() => { setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}_${name}.png`, fullPage: false }) }
const guideOpen = () => page.evaluate(() => !!document.getElementById('rib-howto-v111'))
const sideways = () => page.evaluate(() => {
  const g = document.getElementById('rib-howto-v111'), m = document.getElementById('rib-main-menu-v2')
  const wide = [...(g || m || document).querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 1)
    .map(el => `${el.tagName.toLowerCase()}.${(el.className.baseVal || el.className || '').toString().split(' ')[0]}@${Math.round(el.getBoundingClientRect().right)}`)
  return { doc: document.documentElement.scrollWidth, win: innerWidth, guide: g ? g.scrollWidth : null, menu: m ? m.scrollWidth : null, wide: [...new Set(wide)].slice(0, 6) }
})

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('#rib-main-menu-v2 .rib9-shell', { state: 'visible', timeout: 20000 })
  await page.waitForFunction(() => document.documentElement.classList.contains('rib-assets-ready'), null, { timeout: 30000 }).catch(() => {})
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 20000 }).catch(() => {})   // the v94 loader stands in front of the menu
  await page.waitForTimeout(900)

  // ---- 1. the entry points
  const entry = await page.evaluate(() => {
    const tile = document.querySelector('#rib-main-menu-v2 .rib9-tile[data-rib-action="howto"]')
    const nav = document.querySelector('#rib-main-menu-v2 .rib9-navlink[data-rib-action="howto"]')
    const img = tile && tile.querySelector('img')
    return { tile: !!tile, nav: !!nav, label: tile && tile.innerText.replace(/\s+/g, ' ').trim(), navLabel: nav && nav.textContent.trim(),
      icon: !!(img && img.complete && img.naturalWidth), tileW: tile ? Math.round(tile.getBoundingClientRect().width) : 0 }
  })
  ok(entry.tile && entry.nav && entry.icon, 'the menu carries a HOW TO PLAY tile (with its icon drawn) and a nav link', `${entry.label} | ${entry.navLabel}`)
  await shot('menu')

  // ---- 2. the tile opens it, and every section is there and collapsed
  await page.click('#rib-main-menu-v2 .rib9-tile[data-rib-action="howto"]')
  await page.waitForSelector('#rib-howto-v111 .rib9-fq-sec', { state: 'visible', timeout: 8000 })
  const want = await page.evaluate(() => window.__RIB_HOWTO.sections)
  const sec = await page.evaluate(() => [...document.querySelectorAll('#rib-howto-v111 .rib9-fq-sec')].map(s => ({
    id: s.dataset.fqSec, title: s.querySelector('.rib9-fq-head b').textContent,
    expanded: s.querySelector('.rib9-fq-head').getAttribute('aria-expanded') === 'true',
    bodyShown: !document.getElementById('fq-b-' + s.dataset.fqSec).hidden,
    words: document.getElementById('fq-b-' + s.dataset.fqSec).textContent.trim().split(/\s+/).length })))
  ok(sec.length === want.length && want.length === 9 && sec.every((s, i) => s.id === want[i]), `the guide opened with all ${want.length} sections`, sec.map(s => s.title).join(' / '))
  ok(sec.every(s => !s.expanded && !s.bodyShown), 'every section starts collapsed', `expanded=${sec.filter(s => s.expanded).length}`)
  ok(sec.every(s => s.words > 90), 'every section carries real copy', sec.map(s => s.id + ':' + s.words).join(' '))

  // ---- 3. each one expands and collapses
  const toggled = []
  for (const s of sec) {
    await page.click(`#rib-howto-v111 [data-fq="${s.id}"]`)
    const open = await page.evaluate((id) => ({ aria: document.querySelector(`[data-fq="${id}"]`).getAttribute('aria-expanded'), shown: !document.getElementById('fq-b-' + id).hidden,
      h: Math.round(document.getElementById('fq-b-' + id).getBoundingClientRect().height) }), s.id)
    await page.click(`#rib-howto-v111 [data-fq="${s.id}"]`)
    const shut = await page.evaluate((id) => ({ aria: document.querySelector(`[data-fq="${id}"]`).getAttribute('aria-expanded'), shown: !document.getElementById('fq-b-' + id).hidden }), s.id)
    toggled.push({ id: s.id, opened: open.aria === 'true' && open.shown && open.h > 120, closed: shut.aria === 'false' && !shut.shown, h: open.h })
  }
  const bad = toggled.filter(t => !(t.opened && t.closed))
  ok(bad.length === 0, 'every section expands and collapses again', bad.length ? JSON.stringify(bad) : toggled.map(t => t.id + ':' + t.h + 'px').join(' '))

  // ---- 4. no sideways scroll at this width, with the longest sections open
  await page.click('#rib-howto-v111 [data-fq="position"]')
  await page.click('#rib-howto-v111 [data-fq="ladder"]')
  await page.click('#rib-howto-v111 [data-fq="body"]')
  await page.waitForTimeout(200)
  await shot('guide_open')
  const flow = await sideways()
  ok(flow.doc <= flow.win && flow.guide <= flow.win && flow.wide.length === 0, `nothing overflows sideways at ${W}px with the widest sections open`, JSON.stringify(flow))
  await page.evaluate(() => document.getElementById('rib-howto-v111').scrollTo(0, 900))
  await page.waitForTimeout(200)
  await shot('guide_scrolled')

  // ---- 5. it survives the menu re-rendering underneath it
  const before = await page.evaluate(() => window.__RIB_HOWTO.openSections.slice().sort())
  const rerender = await page.evaluate(() => {
    const menu = document.getElementById('rib-main-menu-v2')
    const was = menu.innerHTML.length
    window.__RIB_MENU_V89.mountMenu()                     // a no-op: the fingerprint has not moved
    window.S.prestige = (window.S.prestige || 0) + 1      // now the feed really changes
    window.__RIB_MENU_V89.mountMenu()
    return { rebuilt: menu.innerHTML.length !== was || /PRESTIGE/.test(menu.innerText), tile: !!menu.querySelector('[data-rib-action="howto"]') }
  })
  await page.waitForTimeout(400)
  const after = await page.evaluate(() => ({ open: !!document.getElementById('rib-howto-v111'), secs: window.__RIB_HOWTO.openSections.slice().sort(),
    shown: [...document.querySelectorAll('#rib-howto-v111 .rib9-fq-sec.on')].map(s => s.dataset.fqSec).sort() }))
  ok(after.open && rerender.tile && String(after.secs) === String(before) && String(after.shown) === String(before),
    'the menu re-rendered underneath and the guide — and the sections the reader opened — survived', `${before.join(',')} -> ${after.secs.join(',')}`)

  // ---- 6. the keyboard: escape closes, the tile opens with Enter, focus comes home
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  ok(!(await guideOpen()), 'Escape closes the guide')
  const home = await page.evaluate(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.ribAction)
  ok(home === 'howto', 'focus returns to the HOW TO PLAY control that opened it', String(home))
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  const kb = await page.evaluate(() => {
    const g = document.getElementById('rib-howto-v111')
    return { open: !!g, inside: !!(g && g.contains(document.activeElement)), focus: document.activeElement && document.activeElement.className }
  })
  ok(kb.open && kb.inside, 'Enter on the focused tile opens the guide and focus lands inside it', kb.focus)
  // and a keyboard user can work the accordions and leave by the close button
  await page.focus('#rib-howto-v111 [data-fq="attrs"]')
  await page.keyboard.press('Enter')
  const kbOpen = await page.evaluate(() => !document.getElementById('fq-b-attrs').hidden)
  ok(kbOpen, 'Enter on a section heading expands it')
  await page.click('#rib-howto-v111 .rib9-fq-close')
  await page.waitForTimeout(250)
  ok(!(await guideOpen()), 'the close button leaves the guide')

  // ---- 7. the menu still works afterwards
  const closedFlow = await sideways()
  ok(closedFlow.doc <= closedFlow.win && closedFlow.menu <= closedFlow.win, 'the menu underneath still fits the width', JSON.stringify(closedFlow))
  await page.click('#rib-main-menu-v2 .rib9-navlink[data-rib-action="view:leaderboard"]')
  const gone = await page.waitForFunction(() => !document.querySelector('#rib-main-menu-v2'), null, { timeout: 8000 }).then(() => true).catch(() => false)
  await page.waitForTimeout(400)
  const view = await page.evaluate(() => window.S && window.S.view)
  await page.evaluate(() => window.go('menu'))
  await page.waitForSelector('#rib-main-menu-v2 .rib9-shell', { state: 'visible', timeout: 10000 })
  await page.waitForTimeout(400)
  const back = await page.evaluate(() => ({ tile: !!document.querySelector('#rib-main-menu-v2 [data-rib-action="howto"]'), guide: !!document.getElementById('rib-howto-v111'), body: document.body.classList.contains('rib-howto-open') }))
  ok(gone && /leaderboard/.test(view || '') && back.tile && !back.guide && !back.body,
    'after the guide, another menu action still routes and the menu comes back clean', `view=${view} tile=${back.tile}`)
  // and the guide opens again from the nav link
  await page.click('#rib-main-menu-v2 .rib9-navlink[data-rib-action="howto"]')
  await page.waitForTimeout(350)
  ok(await guideOpen(), 'the nav link opens the guide too')
  await shot('guide_nav')

  console.log('\npage errors:', errors.length ? errors.join(' | ') : 'none')
  console.log(JSON.stringify({ url, width: W, sections: want, toggled: toggled.length, flow, errors: errors.length }, null, 2))
} catch (error) {
  await page.screenshot({ path: 'faqcheck-failure.png', fullPage: false }).catch(() => {})
  console.log('FAIL threw  ' + error.message)
  fail++
}

console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
