// Dev check (v146 E THE MENUS LIVE AT THE BOTTOM, AND NOTHING SCROLLS).
//
// Every career screen sits in one shell built off the main menu's frame: the crest, wordmark and
// honors chip at the top with the career ticker under them, fixed; the screen in ONE panel
// (`#screen`); and at the thumb end the action slot (`.dock`), the section tabs (`.hubv75-tabs`,
// lifted out of the top of the page) and the v139 bar. The page never scrolls, and every view —
// and the boot's restore of a saved one — opens at the top.
//
// Asserts, at 400x860 (CHECK_W / CHECK_H), walking a real career:
//   - for every main view: the page does not scroll (document AND #app), and the panel fits
//     (a long list scrolls inside its own box — `.fill-v146` — never the panel or the page);
//   - the header's top is at y=0 before AND after scrolling every inner panel to its end;
//   - the section tabs sit in the bottom area, directly above the v139 bar;
//   - navigating from a scrolled state lands the new view at scrollTop 0 on every scroller;
//   - the prestige tree's bottom chrome (action slot + tabs + bar) is under 20% of the viewport;
//   - the dock keeps every id / onclick / button text the drive loops click by;
//   - a save restored cold opens at the top, in the shell; no page errors.
//
//   node scripts/v146Echeck.mjs            (GAME_URL=http://localhost:5305/ for another port)
import { chromium } from 'playwright'
import { pageSource } from './lib/layout.mjs'   // v149 A: the served page + the src/ files it names
const W = +(process.env.CHECK_W || 400), H = +(process.env.CHECK_H || 860)
const base = process.env.GAME_URL || 'http://localhost:5173/'
const url = base + (base.includes('?') ? '&' : '?') + 'stayStale'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const ctx = await browser.newContext({ viewport: { width: W, height: H } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message || String(e)))
await page.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', '0'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.o) window.o.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 })
await page.waitForTimeout(2000)
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const el = [...document.querySelectorAll('button,[onclick],a')].filter(vis).find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.click(); return true } return false
  }, { t, visSrc: vis })
  await page.waitForTimeout(700); return r
}
await click('START NEW CAREER')
for (let i = 0; i < 8; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc)
    const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const want of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(want)); if (b) { b.click(); return false } }
    const card = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e)))
    if (card) { card.click(); return false }
    return true
  }, { visSrc: vis })
  await page.waitForTimeout(450)
  if (done) break
}
await page.waitForTimeout(800)

// everything one screen can tell us about the shell
const probe = () => page.evaluate(() => {
  const a = document.getElementById('app'), s = document.getElementById('screen'), top = document.querySelector('#app > .topbar')
  const shown = e => !!e && e.isConnected && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0
  const nav = document.getElementById('navV139'), dock = document.getElementById('dock'), tabs = document.querySelector('#screen > .hubv75-tabs')
  const bottoms = [nav, dock, tabs].filter(shown)
  const chromeTop = bottoms.reduce((t, e) => Math.min(t, e.getBoundingClientRect().top), innerHeight)
  const scrollers = [document.scrollingElement, a, s, ...s.querySelectorAll('*')].filter(e => e.scrollTop > 0).map(e => (e.id || e.className || e.tagName) + ':' + e.scrollTop)
  return {
    view: (window.S || {}).view, shell: document.documentElement.classList.contains('shell-v146'),
    pageScroll: document.scrollingElement.scrollHeight - innerHeight, appScroll: a.scrollHeight - a.clientHeight,
    panelOver: s.scrollHeight - s.clientHeight, headerTop: top ? Math.round(top.getBoundingClientRect().top) : null,
    ticker: !!document.querySelector('#tickV146 li'),
    tabsTop: shown(tabs) ? Math.round(tabs.getBoundingClientRect().top) : null,
    tabsBottom: shown(tabs) ? Math.round(tabs.getBoundingClientRect().bottom) : null,
    navTop: shown(nav) ? Math.round(nav.getBoundingClientRect().top) : null,
    bottomChrome: Math.round(innerHeight - chromeTop), scrolled: scrollers,
  }
})
// scroll every inner panel (and try the page) to its end, then read the header again
const scrollAll = () => page.evaluate(() => {
  const s = document.getElementById('screen'), a = document.getElementById('app')
  const els = [document.scrollingElement, a, s, ...s.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(e).overflowY))
  for (const e of els) e.scrollTop = e.scrollHeight
  try { window.scrollTo(0, 1e5); a.scrollTop = 1e5 } catch (e) {}
  return els.length
})

const go = async (v) => { await page.evaluate((v) => window.go(v), v); await page.waitForTimeout(900) }
const tabKeys = () => page.evaluate(() => [...document.querySelectorAll('#screen > .hubv75-tabs .hubv75-tab')].map(t => t.dataset.sec))
const results = []
async function visit(view, label) {
  const tks = await tabKeys()
  for (const k of (tks.length ? tks : [null])) {
    if (k) { await page.evaluate((k) => document.querySelector(`.hubv75-tab[data-sec="${k}"]`).click(), k); await page.waitForTimeout(450) }
    const m = await probe()
    const n = await scrollAll(); await page.waitForTimeout(150)
    const m2 = await probe()
    results.push({ name: label + (k ? '_' + k : ''), ...m, headerTopAfter: m2.headerTop, pageAfter: m2.pageScroll, innerScrollers: n })
  }
}

// the loop: the hub, the tree, the training board, the season, and the rest by name
await visit('hub', 'hub')
await go('shop'); await visit('shop', 'shop')
const shopDock = await page.evaluate(() => [...document.querySelectorAll('#dock button')].map(b => (b.getAttribute('onclick') || '') + '|' + b.textContent.trim()))
await go('hub')
await click('GAME SEASON'); await page.waitForTimeout(500)
const gate = await page.evaluate(() => { const g = document.getElementById('growthV42'); if (g) g.style.visibility = 'hidden'; return !!g })
await visit('training', 'training')
const trainDock = await page.evaluate(() => [...document.querySelectorAll('#dock button')].map(b => b.textContent.trim()))
await page.evaluate(() => { const g = document.getElementById('growthV42'); if (g) g.style.visibility = '' })
await click('Balanced Program'); await click('CONFIRM TRAINING')
await page.waitForTimeout(600)
await page.evaluate(() => document.getElementById('growthV42')?.remove())
await page.waitForTimeout(500)
await visit('season', 'season')
const seasonDock = await page.evaluate(() => [...document.querySelectorAll('#dock button')].map(b => b.textContent.trim()))
for (const v of ['upgrade', 'stats', 'challenges', 'settings', 'hof', 'locker', 'rank']) { await go(v); await visit(v, v) }


// play the season out to the report card through the game's own entry points (as coachcheck does)
async function toResult() {
  await page.evaluate(() => window.go('season')); await page.waitForTimeout(600)
  for (let i = 0; i < 30; i++) {
    const v = await page.evaluate(() => { try { return window.__GRIDIRON_AUDIT__.getState().view } catch (e) { return null } })
    if (v === 'result') break
    await page.evaluate(() => { try { window.simRemainingWeeks && window.simRemainingWeeks() } catch (e) {} }); await page.waitForTimeout(500)
    await page.evaluate(() => { const A = window.__GRIDIRON_AUDIT__, p = A.getState().player
      for (const w of (p.weekResults || [])) { if (!w || w.played) continue
        try { A.resolveSequentialWeekV11(p, w, 'balanced') } catch (e) {}
        w.played = true; w.won = !!(w.us > w.them) } }); await page.waitForTimeout(300)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^\s*(CONTINUE|OK|CLOSE|NEXT)\s*$/i.test((x.innerText || '').trim()) && x.getBoundingClientRect().height > 0 && !x.closest('#rib-coach-v119')); if (b) b.click() })
    await page.waitForTimeout(400)
    await page.evaluate(() => { try { window.finishSeasonGames && window.finishSeasonGames() } catch (e) {} }); await page.waitForTimeout(700)
  }
  // the offseason body screen and the coach's debrief come up over the card; look under them
  await page.evaluate(() => { document.getElementById('growV132')?.remove(); document.querySelector('.rib-coach')?.remove(); document.body.classList.remove('rib-coach-open') })
  await page.waitForTimeout(700)
  return page.evaluate(() => window.__GRIDIRON_AUDIT__.getState().view)
}
const reached = await toResult()
if (reached === 'result') await visit('result', 'result')
const MAIN = /^(hub|shop|training|season|upgrade|stats|challenges|settings|result)/
for (const r of results) {
  const tag = r.name
  const good = r.shell && r.pageScroll <= 2 && r.appScroll <= 2 && r.pageAfter <= 2
  ok(good, `${tag}: in the shell, and the page does not scroll`, { page: r.pageScroll, app: r.appScroll, after: r.pageAfter })
  if (MAIN.test(tag)) ok(r.panelOver <= 2, `${tag}: the screen fits its panel (a long list scrolls inside its own box)`, { over: r.panelOver })
  ok(r.headerTop === 0 && r.headerTopAfter === 0 && r.ticker, `${tag}: the header is at y=0 with the ticker under it, before and after scrolling every inner panel`, { before: r.headerTop, after: r.headerTopAfter, inner: r.innerScrollers })
  if (r.tabsTop != null) ok(r.tabsTop > H * 0.6 && (r.navTop == null || Math.abs(r.tabsBottom - r.navTop) <= 2), `${tag}: the section tabs are at the bottom, directly above the bar`, { tabsTop: r.tabsTop, tabsBottom: r.tabsBottom, navTop: r.navTop })
}
const shop = results.find(r => r.name.startsWith('shop'))
ok(shop && shop.bottomChrome < H * 0.2, 'the prestige tree: the bottom chrome (options + tabs + bar) is under 20% of the screen', { px: shop && shop.bottomChrome, pct: shop && +(shop.bottomChrome / H * 100).toFixed(1) })
ok(shopDock.some(t => /go\('dynasty'\)/.test(t)) && shopDock.some(t => /openVaultV137/.test(t)) && shopDock.some(t => /shopBack/.test(t)), "the tree's options keep their handlers", shopDock.length + ' buttons')
ok(trainDock.some(t => /CONFIRM TRAINING/i.test(t)), 'the training board still says CONFIRM TRAINING', trainDock.join(' | '))
ok(seasonDock.some(t => /Play Week 1 Live/i.test(t)), 'the season still says PLAY WEEK 1 LIVE', seasonDock.join(' | '))
ok(gate, '(the season commitment gate was up over the board, and was looked under, not removed)')
ok(reached === 'result', 'the season was played out to the report card, which is in the shell too', reached)

// always at the top: scroll a long view, go somewhere else, and read every scroller
const hops = [['season', 'upgrade'], ['upgrade', 'shop'], ['shop', 'stats'], ['stats', 'settings'], ['settings', 'hub'], ['hub', 'challenges']]
for (const [from, to] of hops) {
  await go(from)
  await scrollAll()
  await page.evaluate(() => { document.getElementById('app').scrollTop = 400 })
  await go(to)
  const m = await probe()
  ok(m.view === to && !m.scrolled.length, `${from} (scrolled) -> ${to} opens at the top of every scroller`, m.scrolled.length ? m.scrolled.join(', ') : 'all at 0')
}
// the tab strip's own switch does not push the page (it used to scrollIntoView)
await go('hub'); await scrollAll()
await page.evaluate(() => document.querySelector('.hubv75-tab[data-sec="body"]')?.click()); await page.waitForTimeout(400)
{ const m = await probe(); ok(m.headerTop === 0 && m.appScroll <= 2 && !m.scrolled.filter(s => /^app|^screen/.test(s)).length, 'a tab switch opens its section at the top and the page stays put', m.scrolled.join(', ') || 'all at 0') }
// the main menu opens at its top too
await page.evaluate(() => window.go('menu')); await page.waitForTimeout(1200)
await page.evaluate(() => { const m = document.getElementById('rib-main-menu-v2'); if (m) m.scrollTop = 900 })
await page.evaluate(() => window.go('hub')); await page.waitForTimeout(700)
await page.evaluate(() => window.go('menu')); await page.waitForTimeout(1200)
{ const st = await page.evaluate(() => { const m = document.getElementById('rib-main-menu-v2'); return m ? m.scrollTop : -1 }); ok(st === 0, 'the main menu opens at its top after being left scrolled', st) }

// the boot: a save on a long view, reloaded cold, opens at the top in the shell
for (const v of ['season', 'upgrade', 'shop']) {
  await page.evaluate((v) => { const S = window.__GRIDIRON_AUDIT__.getState(); S.view = v; window.GridironStorage.save(S) }, v)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForTimeout(3500)
  await page.evaluate(() => { try { document.getElementById('splash')?.remove() } catch (e) {} })
  const m = await probe()
  ok(m.view === v && m.shell && !m.scrolled.length && m.headerTop === 0, `a save on "${v}" restores cold at the top, in the shell`, { view: m.view, scrolled: m.scrolled })
}
// the hook the career block calls is hoisted (v140)
const src = await page.evaluate(pageSource)
ok(/function shellPreV146\(/.test(src) && /function shellPostV146\(/.test(src) && /const _qV146\s*=\s*q;\s*q\s*=\s*function/.test(src), 'the shell hook is a hoisted declaration wrapped round the last q()')

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
