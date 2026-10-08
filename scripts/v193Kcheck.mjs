// Dev check: v193 K THE BOOK SHOWS THE REWARDS, THE VAULT STANDS CENTRED (src/07 `window.__V193K`, src/31-legacy.js,
// public/rib-vault.js, public/vault/room.webp via scripts/build-vault-art.py).
//   1. THE REWARDS IN THE BOOK — a claimed medal wears a ribbon with the card's icon, its title and tap-detail quote the
//      reward and its effect line; a MAJOR says so; a choice still waiting wears 🎁 and offers CHOOSE NOW; a medal not
//      earned yet says what it will deal ("a choice of two", every 10th "MAJOR: a choice of two unique upgrades" + a look).
//      Under the book, YOUR MEDAL REWARDS lists every reward claimed with its effect line and the running totals.
//   2. THE PAGE CURLS — a tap on the corner turns the leaf in 3D (rotateY on .lgb-leaf mid-turn, five strips), lands on
//      the next page in ~450 ms; a drag released short of half falls back, past half completes.
//   3. REDUCED MOTION — a flat cross-fade: no leaf, no rotateY anywhere in the stage, and it still lands.
//   4. RIB_TUNE.v193K = 0 — no ribbons, no section, v152 A's leaf.
//   5. THE VAULT — the hoard (its coin-weighted centre as drawn) and the door are centred within 6 px at 360 and 430 wide,
//      the outline within 12 (a loose spilled coin); the banner words are not drawn; the cleaned room.webp loads and its
//      banner boxes carry no lettering.
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Kcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const url = gameUrl('index.html?stayStale&noFilmV114')
const SHOTS = process.env.V193K_SHOTS || ''

async function bookPage ({ reduced = false, tune = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  if (tune) await ctx.addInitScript((t) => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, t) }, tune)
  await ctx.addInitScript(() => { setInterval(() => { try { document.querySelectorAll('.onboard').forEach((e) => e.remove()) } catch {} }, 60) })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
  const E = (fn, a) => page.evaluate(fn, a)
  const boot = async () => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => { await page.waitForTimeout(1500); await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }) })
    await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.RIB_LEGACY && !!window.__V152A && !!window.__V193K, null, { timeout: 40000 })
    await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
    await page.waitForTimeout(600)
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await E(() => localStorage.clear()); await boot()
  await E(() => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
    S.player = A.newPlayer(); S.player.name = 'Collector'; S.legacyV152 = { v: 1, xp: 0, boot: 1, got: {}, log: [], ms: 0 }; S.view = 'menu'; window.GridironStorage.save(S) })
  await boot()
  // Legacy rank 37; the medal rewards from medal 30 on: 30 (a MAJOR) .. 35 claimed, 36 and 37 waiting
  const rw = await E(() => {
    const A = window.__V152A, S = __GRIDIRON_AUDIT__.getState(); A.pay(S.player, A.xpAt(37) + 40, 'career', []); A.save()
    localStorage.setItem('rib.legacy.v152', JSON.stringify({ award: 99, chip: 37, ms: 30 }))
    const V = window.__V179.medals, M = V.store(); M.seen = 29; M.pending = []; M.log = []; V.sync()
    const dealt = M.pending.map((p) => p.rank)
    for (let i = 0; i < 6 && M.pending.length; i++) V.claim(i % 2)
    S.player = null
    return { dealt, log: M.log.map((l) => ({ rank: l.rank, name: l.name, major: l.major, id: l.id })), pending: M.pending.map((p) => p.rank) }
  })
  await E(() => window.go('profile')); await page.waitForTimeout(1000)
  await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="book"]'); if (t) t.click(); const sp = document.getElementById('splash'); if (sp) sp.remove() })
  await page.waitForTimeout(700)
  return { ctx, page, E, rw }
}
const pageName = (E) => E(() => (document.querySelector('.lgb-stage .lgb-page .lgb-pt b') || {}).textContent || '')
// watch a turn in the page: every transform written on the leaf (a MutationObserver, so a starved headless frame clock
// still shows every step the tween wrote), whether anything in the stage went 3D, how long it took, where it landed
const watchTurn = (E, trigger) => E((trigger) => new Promise((res) => {
  const st = document.querySelector('.lgb-stage'), frames = [], t0 = performance.now(); let gone = 0, seen = 0, rot = false, fade = false
  const look = () => {
    const leaf = st.querySelector('.lgb-leaf'), t = performance.now() - t0
    if (leaf) { seen = seen || t; frames.push({ t: Math.round(t), tf: leaf.style.transform, curl: leaf.classList.contains('lgb-curl-v193k'), strips: leaf.querySelectorAll('.lgb-seg-v193k').length,
      shade: !!(leaf.querySelector('.lgb-ssh-v193k') && /gradient/.test(leaf.querySelector('.lgb-ssh-v193k').style.background || '')) }) } else if (seen && !gone) gone = t
    if (st.querySelector('[style*="rotateY"]') || [...st.children].some((e) => /^matrix3d/.test(getComputedStyle(e).transform || ''))) rot = true
    if (st.querySelector('.lgb-xf-v193k')) fade = true
  }
  const mo = new MutationObserver(look)
  mo.observe(st, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class'] })
  const fr = () => { look(); if (performance.now() - t0 < 2600) requestAnimationFrame(fr); else { mo.disconnect(); res({ frames, rot, fade, start: seen, end: gone, ms: (window.__V152A_UI || {}).turnMsV193K, page: (st.querySelector('.lgb-page .lgb-pt b') || {}).textContent || '' }) } }
  if (trigger === 'next') document.querySelector('.lgb-turn.next').click()
  requestAnimationFrame(fr)
}), trigger)

// ---------- 1. the rewards in the book ----------
{
  const { ctx, page, E, rw } = await bookPage()
  ok(rw.dealt.join(',') === '30,31,32,33,34,35,36,37' && rw.log.length === 6 && rw.pending.join(',') === '36,37', 'the save holds six claimed medal rewards (30 a MAJOR) and two waiting', rw)
  const D = await E(() => window.__V193K.rewards())
  ok(D && D.log.length === 6 && D.log[0].major && D.log.every((l) => l.icon && Array.isArray(l.lines)), 'window.__V193K.rewards() hands the book every claim with its icon and effect lines', D && D.log.map((l) => l.rank + ':' + l.lines.length))
  const cells = await E(() => [30, 31, 36, 38, 40].map((r) => { const c = document.querySelector('.lgb-cell[data-rank="' + r + '"]'), rb = c && c.querySelector('.lgb-rib-v193k'); return { r, title: c && c.title, rib: rb && rb.className.replace('lgb-rib-v193k ', ''), icon: rb && rb.textContent } }))
  const byR = Object.fromEntries(cells.map((c) => [c.r, c]))
  const l30 = rw.log[0], l31 = rw.log[1]
  ok(byR[30].rib === 'k-major' && byR[30].title.includes('MAJOR') && byR[30].title.includes(l30.name), 'the MAJOR medal (30) wears its reward: the ribbon and "MAJOR · <the upgrade>"', byR[30])
  ok(byR[31].rib === 'k-got' && byR[31].icon === D.log[1].icon && byR[31].title.includes(l31.name), 'a claimed medal (31) wears the card\'s icon and names the reward it gave', byR[31])
  ok(byR[36].rib === 'k-wait' && /waiting/.test(byR[36].title), 'a medal whose choice is still waiting (36) wears 🎁', byR[36])
  ok(byR[38].rib === 'k-fsmall' && /choice of two/.test(byR[38].title), 'a medal not earned yet (38) says what it will deal: a choice of two', byR[38])
  ok(byR[40].rib === 'k-fmajor' && /MAJOR: a choice of two unique upgrades/.test(byR[40].title) && /look/.test(byR[40].title), 'every 10th (40): "MAJOR: a choice of two unique upgrades" + a new look', byR[40])
  await E(() => document.querySelector('.lgb-cell[data-rank="31"]').click()); await page.waitForTimeout(350)
  const det = await E(() => { const d = document.querySelector('.lgb-detail.on .lgb-drw-v193k'); return d && d.textContent })
  const want31 = D.log[1].lines[0] || D.log[1].name
  ok(det && /MEDAL REWARD/.test(det) && det.includes(D.log[1].name) && det.includes(want31), 'tapping it: the detail reads MEDAL REWARD, the card and its effect line', det)
  await E(() => document.querySelector('.lgb-cell[data-rank="36"]').click()); await page.waitForTimeout(300)
  const det36 = await E(() => { const d = document.querySelector('.lgb-detail.on .lgb-drw-v193k'); return { t: d && d.textContent, go: !!(d && d.querySelector('[data-rwgo-v193k]')) } })
  ok(det36.go && /TO CHOOSE/.test(det36.t), 'a waiting one offers CHOOSE NOW', det36)
  const sum = await E(() => { const s = document.querySelector('.lg-book-v152 .lgb-rw-v193k'); if (!s) return null
    return { head: s.querySelector('.lgb-rwh').textContent, items: [...s.querySelectorAll('.lgb-rwlist-v193k li')].map((li) => li.textContent), tot: [...s.querySelectorAll('.lgb-rwtot li')].map((li) => li.textContent), go: !!s.querySelector('[data-rwgo-v193k]') } })
  ok(sum && /YOUR MEDAL REWARDS/.test(sum.head) && /6 claimed/.test(sum.head), 'under the book: YOUR MEDAL REWARDS · 6 claimed', sum && sum.head)
  ok(sum && rw.log.every((l) => sum.items.some((t) => t.includes('#' + l.rank) && t.includes(l.name))) && D.log.every((l) => !l.lines.length || sum.items.some((t) => t.includes(l.lines[0]))), 'it lists every reward claimed, each with its effect line', sum && sum.items.length)
  ok(sum && sum.tot.length === D.totals.length && D.totals.every((t) => sum.tot.includes(t)) && sum.tot.length > 0, 'and the running totals of every permanent bonus', sum && sum.tot)
  ok(sum && sum.go, 'and the chooser, while two wait')
  if (SHOTS) { await E(() => document.querySelector('.lgb-rw-v193k').scrollIntoView({ block: 'center' })); await page.screenshot({ path: SHOTS + '/v193K_summary.png' }) }

  // ---------- 2. the page curls ----------
  const p0 = await pageName(E)
  const T = await watchTurn(E, 'next')
  const mid = T.frames.filter((f) => /rotateY\((-?[\d.]+)deg\)/.test(f.tf)).map((f) => +/rotateY\((-?[\d.]+)deg\)/.exec(f.tf)[1])
  ok(mid.some((a) => a < -1 && a > -179), 'mid-turn the leaf is a rotateY on the spine (3D), not a slide or a fade', { writes: T.frames.length, angles: [...new Set(mid.map(Math.round))].slice(0, 12) })
  ok(T.frames.every((f) => f.curl && f.strips >= 3 && f.shade), 'the leaf curls: hinged strips, each shaded by its angle', T.frames[2])
  const dur = T.end - T.start
  ok(T.ms === 450 && dur > 0 && dur < 3000, 'the turn is asked for 450 ms (ease-in-out) and the leaf is gone after it', { ms: T.ms, wall: Math.round(dur) })
  ok(T.page && T.page !== p0 && /SILVER/.test(T.page), 'and lands on the next page', { from: p0, to: T.page })
  await page.waitForTimeout(500)
  // a drag: short of half falls back, past half completes
  const sr = await E(() => { const s = document.querySelector('.lgb-stage'); s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left + r.width * 0.9, y: r.top + r.height * 0.5, w: r.width } })
  const drag = async (f) => { await page.mouse.move(sr.x, sr.y); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(sr.x - sr.w * f * i / 10, sr.y); await page.waitForTimeout(30) } await page.waitForTimeout(120)
    const held = await E(() => { const l = document.querySelector('.lgb-leaf'); return l ? l.style.transform : '' }); await page.mouse.up(); await page.waitForTimeout(900); return held }
  const p1 = await pageName(E)
  const h1 = await drag(0.3), p2 = await pageName(E)
  ok(/rotateY/.test(h1) && p2 === p1, 'a drag follows the finger and, released short of half, falls back', { held: h1, page: p2 })
  const h2 = await drag(0.62), p3 = await pageName(E)
  ok(/rotateY/.test(h2) && p3 !== p1, 'released past half, it completes the turn', { from: p1, to: p3 })
  await ctx.close()
}

// ---------- 3. reduced motion: a plain cross-fade ----------
{
  const { ctx, E } = await bookPage({ reduced: true })
  const p0 = await pageName(E)
  const T = await watchTurn(E, 'next')
  ok(!T.rot && T.frames.length === 0, 'reduced motion: no leaf and no rotateY anywhere in the stage', { rot: T.rot, leafFrames: T.frames.length })
  ok(T.fade && T.page !== p0 && /SILVER/.test(T.page), 'it cross-fades and lands on the next page', { fade: T.fade, page: T.page })
  await ctx.close()
}

// ---------- 4. the kill switch ----------
{
  const { ctx, E } = await bookPage({ tune: { v193K: 0 } })
  const k = await E(() => ({ ribs: document.querySelectorAll('.lgb-rib-v193k').length, sum: !!document.querySelector('.lgb-rw-v193k') }))
  const T = await watchTurn(E, 'next')
  ok(k.ribs === 0 && !k.sum, 'RIB_TUNE.v193K = 0: no ribbons, no rewards section', k)
  ok(T.frames.length > 0 && T.frames.every((f) => !f.curl) && /SILVER/.test(T.page), 'and v152 A\'s single leaf turns the page', { frames: T.frames.length, page: T.page })
  await ctx.close()
}

// ---------- 5. the vault ----------
for (const [w, h] of [[360, 760], [430, 932]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true })
  await ctx.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
  const E = (fn, a) => page.evaluate(fn, a)
  await page.goto(gameUrl('?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1200)
  await E(() => { try { window.__splashDoneV94 && window.__splashDoneV94() } catch (e) {} })
  await page.waitForFunction(() => { const s = document.getElementById('splash'); if (!s) return true
    const c = getComputedStyle(s); return c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 }, null, { timeout: 25000 }).catch(() => {})
  await E(() => { try { localStorage.setItem('rib.vaultDoor.v137', '1'); localStorage.setItem('rib.coachTour.v119', '0') } catch (e) {} })
  const cen = []
  for (const pp of [800, 250000, 5e6]) {
    await E((pp) => { const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = pp; o.prestige = 40; window.__V156A && window.__V156A.seed(200); o.tree = {}; window.go('shop') }, pp)
    await E(() => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true })); await page.waitForTimeout(900)
    cen.push(await E(() => { const s = window.__RIB_VAULT_DEV.scene(), h = s.hoardCentreV193K(), c = s.corePoint(), m = innerWidth / 2
      return { pile: +(h.mass - m).toFixed(1), outline: +(h.outline - m).toFixed(1), core: +(c.x - m).toFixed(1), words: s.bannerWordsOffV193K === true } }))
    if (SHOTS && pp === 250000) await page.screenshot({ path: SHOTS + '/v193K_vault_' + w + '.png' })
    await E(() => window.__RIB_VAULT.close('test')); await page.waitForTimeout(250)
  }
  ok(cen.every((c) => Math.abs(c.pile) <= 6 && Math.abs(c.core) <= 6), `${w}px: the vault stands centred — the hoard (its weight, as drawn) and the door within 6 px of the middle (three balances)`, cen.map((c) => [c.pile, c.core]))
  ok(cen.every((c) => Math.abs(c.outline) <= 12), `${w}px: and the hoard's outline (loose spilled coins and all) within 12 px`, cen.map((c) => c.outline))
  ok(cen.every((c) => c.words), `${w}px: the banner words are not drawn`)
  if (w === 360) {
    const art = await E(() => new Promise((res) => {
      const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0)
        const ink = [[68, 104, 116, 166], [392, 121, 436, 169]].map(([x0, y0, x1, y1]) => {
          const X0 = Math.round(x0 * 2.6), Y0 = Math.round(y0 * 2.6), d = x.getImageData(X0, Y0, Math.round(x1 * 2.6) - X0, Math.round(y1 * 2.6) - Y0).data
          let n = 0, k = 0; for (let i = 0; i < d.length; i += 4) { n++; if (Math.max(d[i], d[i + 1], d[i + 2]) > 90 && d[i] - d[i + 2] > 25) k++ } return +(k / n).toFixed(4) })
        res({ w: im.naturalWidth, h: im.naturalHeight, ink })
      }
      im.onerror = () => res(null)
      im.src = window.__RIB_ASSET ? window.__RIB_ASSET('vault/room.webp') : './public/vault/room.webp'
    }))
    ok(art && art.w === 1305 && art.h === 1268, 'the cleaned room.webp loads (1305 x 1268)', art)
    ok(art && art.ink.every((f) => f < 0.005), 'its two banners carry no lettering (bright gold pixels in the old text boxes: the art had ~21%)', art && art.ink)
  }
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(() => { window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193K: 0 }) })
  const page = await ctx.newPage(); const E = (fn, a) => page.evaluate(fn, a)
  await page.goto(gameUrl('?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 45000 }); await page.waitForTimeout(1200)
  await E(() => { try { window.__splashDoneV94 && window.__splashDoneV94(); localStorage.setItem('rib.vaultDoor.v137', '1') } catch (e) {} })
  await E(() => { const o = window.__GRIDIRON_AUDIT__.getState(); o.pp = 250000; o.prestige = 40; window.__V156A && window.__V156A.seed(200); o.tree = {}; window.go('shop') })
  await E(() => window.__RIB_VAULT_BRIDGE.open({ skipDoor: true })); await page.waitForTimeout(900)
  const off = await E(() => { const s = window.__RIB_VAULT_DEV.scene(); return { words: s.bannerWordsOffV193K === true } })
  ok(!off.words, 'RIB_TUNE.v193K = 0 in the vault: the banner words are drawn again')
  await ctx.close()
}

ok(errs.length === 0, 'no page errors', errs.slice(0, 4))
console.log(`\nv193Kcheck: ${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
