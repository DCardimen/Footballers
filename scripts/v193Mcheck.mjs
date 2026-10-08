// Dev check: v193 I EVERY SHEET, EVERY PHONE — the phone half (src/styles/00-app.css, src/07-career-app.js, src/11-pregame-v1513.js).
//   The v193 screens on two EMULATED phones. Only Chromium is installed, so this is Chromium's mobile emulation
//   (viewport, device scale, isMobile, hasTouch, a phone user agent) — WEBKIT / REAL iOS SAFARI IS NOT COVERED: no
//   Safari rubber-banding, no iOS font boosting, no `100vh` toolbar math, no WebKit sticky quirks.
//     iphone   390x844 @3x, iOS Safari user agent
//     android  360x740 @2x, Android Chrome user agent
//   The screens: the Locker's GEAR tab with ~30 seeded pieces (`__V147C.make`), the prestige tree (go('shop')) with PP so
//   QUICK BUY / SPEND NOW has tiles (and the v193 E sideways chip row, TU v193L 0), the season screen's PRESTIGE THIS
//   SEASON card, the career-end receipt (go('gameover') on a set-up player), and the pregame wizard's YOUR TEAM page and
//   plan board (a real career walked to week 1, as v193Bcheck does).
//   At each: no horizontal page overflow (document / #app / #screen scrollWidth ≤ clientWidth, no element past the right
//   edge outside a sideways scroller); every button / chip / link tap target ≥ 36 px tall (its box, or its hit area
//   measured with elementFromPoint 18 px above and below its centre); every visible text ≥ 10.5 px.
//   Touch: a real touch swipe (CDP Input.dispatchTouchEvent) up the gear list scrolls it and the chip bar stays on screen
//   (sticky); a sideways swipe on the gear chip row and on the SPEND NOW row scrolls them; `page.tap` on a chip filters.
// Screenshots: scripts/_v193M_<device>_<screen>.png (gitignored).
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Mcheck.mjs   (DEVICE=iphone|android for one)
import { gameUrl, launch } from './lib/env.mjs'

const DEVICES = {
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  android: { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A136B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' }
}
const TAP_MIN = 36, TEXT_MIN = 10.5
const only = process.env.DEVICE
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const browser = await launch()

// ---- the measuring kit (runs in the page) ----
const AUDIT = ({ root, TAP_MIN, TEXT_MIN }) => {
  const R = root ? document.querySelector(root) : document.getElementById('screen')
  if (!R) return { missing: root }
  const vis = (el) => { if (!el || !el.getClientRects().length) return false; const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false } return true }
  const name = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) + '"')
  const vw = document.documentElement.clientWidth
  // overflow: the page, the shell, and any element past the right edge that is not inside a sideways scroller
  const sx = (el) => { for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true } return false }
  const app = document.getElementById('app'), sc = document.getElementById('screen')
  const over = { page: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth, app: app ? app.scrollWidth - app.clientWidth : 0, screen: sc ? sc.scrollWidth - sc.clientWidth : 0, els: [] }
  for (const el of R.querySelectorAll('*')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if ((r.right > vw + 1 || r.left < -1) && !sx(el)) over.els.push(name(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)) }
  // tap targets
  const taps = [...R.querySelectorAll('button, a[href], [onclick], [role="button"], select, input[type="button"], input[type="checkbox"], .gear-chip-v193')].filter(vis)
  const small = []
  for (const el of taps) {
    const r = el.getBoundingClientRect(); if (r.height >= TAP_MIN - 0.5) continue
    // its hit area: does a tap 18 px above / below its centre still land on it?
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
    const q = el.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2
    const hit = (y) => { const h = document.elementFromPoint(cx, y); return !!h && (h === el || el.contains(h)) }
    if (hit(cy - TAP_MIN / 2 + 1) && hit(cy + TAP_MIN / 2 - 1)) continue
    small.push(name(el) + ' ' + Math.round(r.height) + 'px')
  }
  // text
  const tiny = []; const seen = new Set()
  const tw = document.createTreeWalker(R, NodeFilter.SHOW_TEXT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.textContent.trim()) continue
    const p = n.parentElement; if (!p || seen.has(p) || !vis(p)) continue; seen.add(p)
    const fs = parseFloat(getComputedStyle(p).fontSize); if (fs < TEXT_MIN - 0.01) tiny.push(name(p) + ' ' + fs + 'px')
  }
  try { (document.getElementById('screen') || document.scrollingElement).scrollTop = 0; document.scrollingElement.scrollTop = 0 } catch (e) {}
  return { over, taps: taps.length, all: R.querySelectorAll('button').length, small, tiny }
}

// ---- a touch swipe through CDP: real touch events, the browser's own scrolling ----
async function swipe (page, cdp, x0, y0, x1, y1, steps = 12) {
  const pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 4, radiusY: 4, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(x0, y0) })
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps) }); await page.waitForTimeout(16) }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(450)
}

for (const [dev, D] of Object.entries(DEVICES)) {
  if (only && only !== dev) continue
  const errs = []
  const ctx = await browser.newContext(D)
  await ctx.addInitScript(() => {
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} for (const s of ['.onboard', '#personaV13', '#gv139gate', '#teamModalV153']) document.querySelector(s)?.remove() }, 80)
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
  const cdp = await ctx.newCDPSession(page)
  const shot = (n) => page.screenshot({ path: new URL(`./_v193M_${dev}_${n}.png`, import.meta.url).pathname }).catch(() => null)
  const M = (fn, a) => page.evaluate(fn, a)
  const audit = async (tag, root) => {
    await page.waitForTimeout(250)
    const A = await M(AUDIT, { root: root || null, TAP_MIN, TEXT_MIN })
    if (A.missing) { ok(false, `${dev} ${tag}: the screen is there`, A.missing); return A }
    const wide = Math.max(A.over.page, A.over.app, A.over.screen)
    ok(wide <= 1 && !A.over.els.length, `${dev} ${tag}: no horizontal overflow`, wide > 1 || A.over.els.length ? { ...A.over, els: A.over.els.slice(0, 5) } : `${A.over.page}/${A.over.app}/${A.over.screen}`)
    ok(A.taps > 0 && !A.small.length, `${dev} ${tag}: every tap target ≥ ${TAP_MIN} px tall`, A.small.length ? A.small.slice(0, 6).join(' | ') + (A.small.length > 6 ? ` (+${A.small.length - 6})` : '') : `${A.taps} targets (${A.all} buttons)`)
    ok(!A.tiny.length, `${dev} ${tag}: no text under ${TEXT_MIN} px`, A.tiny.length ? A.tiny.slice(0, 6).join(' | ') + (A.tiny.length > 6 ? ` (+${A.tiny.length - 6})` : '') : 'ok')
    return A
  }
  // a sideways swipe across a chip row from its right end: it must scroll (the furthest scrollLeft the row reached
  // while the finger moved and the fling ran), or fit the screen outright
  const sideSwipe = async (sel, tag) => {
    const row = await M((sel) => {
      const c = document.querySelector(sel); c.scrollIntoView({ block: 'center' }); c.scrollLeft = 0
      c.__maxV193I = 0; c.addEventListener('scroll', () => { c.__maxV193I = Math.max(c.__maxV193I, c.scrollLeft) }, { passive: true })
      const r = c.getBoundingClientRect(); return { x0: r.right - 12, x1: r.left + 12, y: r.top + r.height / 2, sw: c.scrollWidth, cw: c.clientWidth, sec: (document.querySelector('#screen > .hubv75-tabs .hubv75-tab.on') || {}).dataset?.sec || null }
    }, sel)
    if (row.sw <= row.cw + 2) { ok(true, `${dev} ${tag} fits the screen (no sideways scroll needed)`, row); return }
    await page.waitForTimeout(150)
    await swipe(page, cdp, row.x0, row.y, row.x1, row.y)
    const got = await M((sel) => { const c = document.querySelector(sel); return { max: Math.round(c.__maxV193I || 0), now: Math.round(c.scrollLeft), same: c.__maxV193I !== undefined, sec: (document.querySelector('#screen > .hubv75-tabs .hubv75-tab.on') || {}).dataset?.sec || null } }, sel)
    ok(got.max > 20 && got.now > 20 && got.sec === row.sec, `${dev} ${tag} scroll sideways under a horizontal swipe — and the swipe stays the row's (the section does not turn)`, { ...got, sec0: row.sec, sw: row.sw, cw: row.cw })
  }
  await page.goto(gameUrl('?stayStale&noFilmV114&noGrowV132'), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V147C && !!window.__V193A && !!window.__V193D && !!window.go, null, { timeout: 60000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await M(() => document.getElementById('splash')?.remove())
  const setup = (o) => M((o) => {
    const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tutorialSeen = true
    S.tree = o.tree || {}; S.era = o.era || 0; S.pp = o.pp != null ? o.pp : 1000
    S.player = X.newPlayer(); const p = S.player
    p.pos = 'RB'; p.level = o.level != null ? o.level : 4; p.totalSeasons = o.seasons || 6; p.titles = o.titles || 0; p.seasonsAtLevel = 1; p.personaV13 = { loyalty: 5 }; p.traits = []
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, o.tune || {})
    document.getElementById('bankRainV189')?.remove()
    return true
  }, o)

  // ================= 1. the Locker's GEAR tab =================
  await setup({ level: 3 })
  await M(() => {
    const S = window.__GRIDIRON_AUDIT__.getState(), V = window.__V147C, R = ['common', 'common', 'rare', 'rare', 'epic', 'legendary', 'mythic']
    S.inventory = []; S.equipped = {}; window.__V193A.filter(null)
    for (let i = 0; i < 30; i++) { const it = V.make(R[i % R.length], i % 8); it.id = 'm193_' + i; S.inventory.push(it) }
    const bySlot = {}; for (const it of S.inventory) if (!bySlot[it.slot]) bySlot[it.slot] = it
    S.equipped = bySlot
    window.go('locker')
  })
  await page.waitForTimeout(900)
  await M(() => { const t = [...document.querySelectorAll('button, .tab, [onclick]')].find((e) => /^\s*(🎒\s*)?GEAR\s*$/i.test((e.innerText || '').trim())); t && t.click() })
  await page.waitForTimeout(500)
  await shot('gear')
  const G0 = await M(() => ({ n: (window.__GRIDIRON_AUDIT__.getState().inventory || []).length, rows: document.querySelectorAll('.gear-row').length, bar: !!document.querySelector('.gear-bar-v193') }))
  ok(G0.n >= 28 && G0.rows > 0 && G0.bar, `${dev} gear: the GEAR tab is up with ~30 seeded pieces and the chip bar`, G0)
  await audit('gear', '#screen')
  // a touch swipe up the list: it scrolls, and the chip bar stays on screen
  {
    // the lowest point a thumb can put down ON the list (above the bottom nav and anything else fixed over it)
    const box = await M(() => {
      const l = document.querySelector('.gear-list-v147'), r = l.getBoundingClientRect(), x = r.left + r.width / 2, top = Math.max(r.top, 0)
      let bottom = Math.min(r.bottom, innerHeight) - 4
      while (bottom > top + 60) { const h = document.elementFromPoint(x, bottom); if (h && l.contains(h)) break; bottom -= 8 }
      return { x, top, bottom: bottom + 4, coarse: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches }
    })
    if (!box.coarse) console.log(`INFO ${dev}: (pointer: coarse) does not match under this emulation`)
    const before = await M(() => { const l = document.querySelector('.gear-list-v147'), s = document.getElementById('screen'); return { list: l.scrollTop, screen: s.scrollTop, page: document.scrollingElement.scrollTop } })
    await swipe(page, cdp, box.x, box.bottom - 20, box.x, Math.max(box.top + 20, box.bottom - 340))
    await swipe(page, cdp, box.x, box.bottom - 20, box.x, Math.max(box.top + 20, box.bottom - 340))
    const after = await M(() => {
      const l = document.querySelector('.gear-list-v147'), s = document.getElementById('screen'), bar = document.querySelector('.gear-bar-v193'), r = bar.getBoundingClientRect()
      const chip = bar.querySelector('.gear-chip-v193'), c = chip.getBoundingClientRect(), hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2)
      return { list: l.scrollTop, screen: s.scrollTop, page: document.scrollingElement.scrollTop, barTop: Math.round(r.top), barBottom: Math.round(r.bottom), vh: innerHeight, chipOnTop: !!hit && (hit === chip || chip.contains(hit)) }
    })
    const moved = (after.list - before.list) + (after.screen - before.screen) + (after.page - before.page)
    ok(moved > 40, `${dev} gear: a touch swipe up scrolls the inventory`, { before, after: { list: after.list, screen: after.screen, page: after.page } })
    ok(after.barTop >= -1 && after.barBottom <= after.vh && after.chipOnTop, `${dev} gear: the chip bar stays on screen (sticky) and on top after the swipe`, after)
    await shot('gear-swiped')
  }
  // the chip row: sideways under a horizontal swipe (when it is wider than the screen), and page.tap filters
  {
    await sideSwipe('.gear-chips-v193', 'gear: the filter chip row')
    const target = await M(() => { const on = document.querySelector('.gear-chip-v193.on'); const b = [...document.querySelectorAll('.gear-chips-v193 .gear-chip-v193')].find((x) => x !== on && x.dataset.chip === 'all') || [...document.querySelectorAll('.gear-chips-v193 .gear-chip-v193')].find((x) => x !== on); b.scrollIntoView({ inline: 'center', block: 'nearest' }); return b.dataset.chip })
    await page.waitForTimeout(700)   // the fling has settled: a tap during momentum only stops the scroll
    const bb = await page.locator(`.gear-chips-v193 .gear-chip-v193[data-chip="${target}"]`).boundingBox()
    const at = bb ? await M(({ x, y }) => { const h = document.elementFromPoint(x, y); return h ? (h.dataset && h.dataset.chip) || h.className || h.tagName : null }, { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }) : null
    if (bb) await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2)
    await page.waitForTimeout(500)
    const T = await M(() => ({ on: (document.querySelector('.gear-chip-v193.on') || {}).dataset?.chip, current: window.__V193A.current() }))
    ok(T.on === target && T.current === target, `${dev} gear: tapping a chip (a real tap) filters the list`, { target, under: at, bb, ...T })
    // the kill switch: TU v193I 0 — the same sideways swipe on the chips turns the section (the bug v193 I fixed)
    const K = await M(() => { window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v193I = 0; const c = document.querySelector('.gear-chips-v193'); c.scrollLeft = 0; const r = c.getBoundingClientRect(); return { x0: r.right - 12, x1: r.left + 12, y: r.top + r.height / 2, sec: (document.querySelector('#screen > .hubv75-tabs .hubv75-tab.on') || {}).dataset?.sec } })
    await swipe(page, cdp, K.x0, K.y, K.x1, K.y)
    const K2 = await M(() => { delete window.RIB_TUNE.v193I; return (document.querySelector('#screen > .hubv75-tabs .hubv75-tab.on') || {}).dataset?.sec })
    ok(K.sec === 'gear' && K2 && K2 !== 'gear', `${dev} gear (TU v193I 0): the same swipe on the chips turns the section — what v193 I stopped`, { before: K.sec, after: K2 })
  }

  // ================= 2. the prestige tree: QUICK BUY, and the v193 E SPEND NOW row =================
  await setup({ pp: 4000, tree: {} })
  await M(() => window.go('shop'))
  await page.waitForTimeout(700)
  const Q = await M(() => ({ has: !!document.getElementById('spendNowV193E'), tiles: document.querySelectorAll('#spendNowV193E .qb-tile-v193l, #spendNowV193E .sn-row-v193e').length }))
  ok(Q.has && Q.tiles > 0, `${dev} tree: the spend strip shows tiles with PP in the bank`, Q)
  await shot('tree')
  await audit('tree', '#screen')
  {
    const arr = await page.locator('#spendNowV193E .qb-arr-v193l:not([disabled])').first()
    if (await arr.count()) {
      const pg0 = await M(() => (document.querySelector('#spendNowV193E .qb-tile-v193l') || {}).dataset?.key)
      await arr.scrollIntoViewIfNeeded(); const b = await arr.boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400)
      const pg1 = await M(() => (document.querySelector('#spendNowV193E .qb-tile-v193l') || {}).dataset?.key)
      ok(pg0 && pg1 && pg0 !== pg1, `${dev} tree: tapping QUICK BUY's arrow pages the tiles`, { pg0, pg1 })
    }
  }
  await M(() => { window.RIB_TUNE.v193L = 0; window.go('shop') })
  await page.waitForTimeout(600)
  await shot('tree-spendnow')
  {
    const chips = await M(() => document.querySelectorAll('.sn-chips-v193e .sn-row-v193e').length)
    ok(chips > 0, `${dev} tree (v193L 0): SPEND NOW shows its chip row`, chips)
    if (chips) await sideSwipe('.sn-chips-v193e', 'tree (v193L 0): the SPEND NOW chips')
    await page.waitForTimeout(600)
    await audit('tree (v193L 0)', '#spendNowV193E')
  }
  await M(() => { delete window.RIB_TUNE.v193L })

  // ================= 3. the season screen: PRESTIGE THIS SEASON =================
  await setup({ tree: { endorse: 2, hof: 1 }, level: 3, seasons: 4, titles: 1 })
  const SN = await M(() => {
    const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player
    S.bankShownV189 = window.__V189.pot(p); window.startSeason()
    window.__V136_C.bank(500, 'goal'); window.__V136_C.bank(9, 'nemesis')
    window.go('season')
    const el = document.getElementById('seasonGainV193D'); if (el && !el.classList.contains('open')) { const b = el.querySelector('button, [onclick]'); b && b.click() }
    return { has: !!el }
  })
  await page.waitForTimeout(500)
  ok(SN.has, `${dev} season: the PRESTIGE THIS SEASON card is on the season screen`, SN)
  await M(() => document.getElementById('seasonGainV193D')?.scrollIntoView({ block: 'start' }))
  await shot('season')
  await audit('season', '#screen')

  // ================= 4. the career-end receipt =================
  await setup({ tree: { endorse: 3, brand: 2, legacy: 2 }, era: 2, pp: 5000, titles: 2, seasons: 9 })
  await M(() => { window.__V136_C.bank(25000, 'goal'); window.__V136_C.bank(120, 'milestone'); window.go('gameover') })
  await page.waitForFunction(() => !!document.getElementById('payLedgerV193D'), null, { timeout: 8000 }).catch(() => null)
  await page.waitForTimeout(2200)
  ok(await M(() => !!document.getElementById('payLedgerV193D')), `${dev} receipt: the career-end ledger is drawn`)
  await M(() => document.getElementById('payLedgerV193D')?.scrollIntoView({ block: 'start' }))
  await shot('receipt')
  await audit('receipt', '#screen')

  // ================= 5. the pregame: YOUR TEAM and the plan board =================
  {
    const vis = `el => { if(!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
    const click = async (t) => { await M(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis); const el = t === 'ARCH' ? els.find((e) => /^(⭐|🦾|🏘️|🚪|🩹|🔄|💎|🔥|🧊|👑)/.test((e.innerText || '').trim())) : els.find((e) => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t))); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } }, { t, visSrc: vis }); await page.waitForTimeout(650) }
    await M(() => { const X = window.__GRIDIRON_AUDIT__; X.setState(X.freshState()); window.RIB_TUNE = {}; window.go('menu') })
    await page.waitForTimeout(600)
    for (const s of ['START NEW CAREER', 'ARCH', 'RB Running Back', 'Lock In Personality', 'PLAY 8-GAME SEASON']) await click(s)
    for (let i = 0; i < 60; i++) { const d = await M(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') { g.click(); return false } return !document.getElementById('growthV42') }); if (d) break; await page.waitForTimeout(300) }
    await click('Balanced Program'); await click('CONFIRM TRAINING')
    await M(() => { const el = [...document.querySelectorAll('button')].find((e) => /PLAY WEEK 1 LIVE/.test(e.innerText || '')); el && el.click() })
    for (let i = 0; i < 80; i++) { if (await M(() => !!document.getElementById('pregameV1513'))) break; await M(() => { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') g.click() }); await page.waitForTimeout(250) }
    const up = await M(() => !!document.getElementById('pregameV1513') && !!window.__V136_PAGES)
    ok(up, `${dev} pregame: a real career reached the week-1 pregame`)
    if (up) {
      const goPage = async (id) => { await M((id) => { const P = window.__V136_PAGES.active(); window.__V112_D.go(P.indexOf(id)) }, id); await page.waitForTimeout(450) }
      await goPage('v112PageTeam'); await shot('pregame-team')
      await audit('pregame YOUR TEAM', '#v112PageTeam')
      await goPage('v112Page5'); await shot('pregame-plan')
      await audit('pregame plan board', '#v112Page5')
    }
  }
  ok(errs.length === 0, `${dev}: no page errors`, errs.slice(0, 3).join(' | '))
  await ctx.close()
}
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
