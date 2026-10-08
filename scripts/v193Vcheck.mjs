// Dev check: v193 V ICONS IN THE MENU'S STYLE (src/24-bottom-nav.js `ribIconV193V`; 22's tab strip, 34's section bar
// and spray, 07's branch tabs).
//   1 phone 390x844 @3x: every bottom-nav tab shows an icon element (the menu's painting or a drawn SVG), loaded, 20-28 px,
//     no emoji text left in it, the label kept, a 36 px target; the bar fits 360 px
//   2 the section bar (‹ NOW ›) on the hub / season / tree / locker / profile carries the tab's icon, and its spray too
//   3 desktop 900x844 @1x: every section tab strip (hub, season, settings, tree, locker, profile) shows an icon per tab
//   4 the tree's branch tabs: one drawn icon each, tinted to the branch (a distinct gradient), the name kept and not clipped
//   5 an image that fails to load gives its emoji back; TU("v193V", 0) draws the emoji everywhere
// Screenshots: scripts/_v193V_*.png.  GAME_URL=http://localhost:5173/ node scripts/v193Vcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const SHOT = (n) => new URL('./_v193V_' + n + '.png', import.meta.url).pathname

async function open(vp, dpr, mobile) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, hasTouch: mobile, isMobile: mobile })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
  await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate', '#sprayHintV170']) document.querySelector(s)?.remove() }, 80) })
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.ribIconV193V && !!window.__NAV_V139, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  await page.evaluate(() => {
    const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tutorialSeen = true
    S.tree = {}; S.pp = 5000
    S.player = X.newPlayer(); const p = S.player
    p.pos = 'QB'; p.level = 3; p.totalSeasons = 3; p.seasonsAtLevel = 1; p.personaV13 = { loyalty: 5 }; p.traits = []
    document.body.classList.remove('rib-menu-open')
    window.go('hub')
  })
  await page.waitForTimeout(700)
  return { ctx, page }
}
const go = async (page, v, ms = 700) => { await page.evaluate((v) => window.go(v), v); await page.waitForTimeout(ms) }

/* what an icon slot holds: the icon element, whether it loaded, its size, any emoji text left beside it */
const PROBE = () => {
  window.__probeV193V = (slot) => {
    if (!slot) return { slot: false }
    const ic = slot.querySelector('.ric-v193v'), r = ic && ic.getBoundingClientRect()
    const text = [...slot.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
    const fb = slot.querySelector('.ric-fb-v193v')
    const loaded = !!ic && (ic.tagName === 'IMG' ? ic.complete && ic.naturalWidth > 0 : ic.querySelectorAll('path').length > 0)
    return { slot: true, icon: !!ic, tag: ic ? ic.tagName.toLowerCase() : '', ric: ic ? ic.getAttribute('data-ric') : '', loaded, w: r ? Math.round(r.width * 10) / 10 : 0, h: r ? Math.round(r.height * 10) / 10 : 0, nat: ic && ic.tagName === 'IMG' ? ic.naturalWidth : 0, text, fb: !!fb, fill: ic && ic.tagName !== 'IMG' ? (((p) => p ? (p.getAttribute('fill') + '|' + p.getAttribute('stroke')).match(/ricMV193V-[0-9a-z]+?(?=u?\))/)?.[0] || '' : '')(ic.querySelector('path[fill^="url(#ricM"],path[stroke^="url(#ricM"]'))) : '' }
  }
}
const good = (p, lo = 20, hi = 28) => p.icon && p.loaded && !p.text && !p.fb && p.w >= lo && p.w <= hi && p.h >= lo && p.h <= hi

// ================= 1 + 2: the phone =================
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 3, true)
  await page.evaluate(PROBE)
  // wait for the paintings to arrive
  await page.waitForFunction(() => [...document.querySelectorAll('#navV139 img.ric-v193v')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => null)
  const N = await page.evaluate(() => [...document.querySelectorAll('#navV139 button[data-k]')].map((b) => {
    const r = b.getBoundingClientRect()
    return { k: b.dataset.k, label: (b.querySelector('b') || {}).textContent, bw: Math.round(r.width), bh: Math.round(r.height), ...window.__probeV193V(b.querySelector('i')) }
  }))
  ok(N.length === 5 && N.every((n) => good(n)), 'every bottom-nav tab shows a loaded icon element (no emoji text), 20-28 px', N.map((n) => `${n.k}:${n.tag}/${n.ric} ${n.w}x${n.h} nat${n.nat}${n.text ? ' text=' + n.text : ''}`).join(' · '))
  ok(N.map((n) => n.label).join(',') === 'HUB,SEASON,SKILLS,TREE,MENU', 'the labels are kept', N.map((n) => n.label))
  ok(N.filter((n) => n.tag === 'img').every((n) => n.nat >= n.w * 3), 'the paintings carry enough pixels for 3x (natural width ≥ 3 × the drawn size)', N.map((n) => n.k + ':' + n.nat))
  ok(N.find((n) => n.k === 'season').tag === 'svg' && ['hub', 'upgrade', 'shop', 'menu'].every((k) => N.find((n) => n.k === k).tag === 'img'), 'HUB / SKILLS / TREE / MENU are the menu tiles\' art, SEASON a drawn SVG', N.map((n) => n.k + ':' + n.ric))
  ok(N.every((n) => n.bh >= 36 && n.bw >= 36), 'every tab is a 36 px target', N.map((n) => n.bw + 'x' + n.bh))
  const glow = await page.evaluate(() => { const b = document.querySelector('#navV139 button.on .ric-v193v'); return b ? getComputedStyle(b).filter : '' })
  ok(/drop-shadow/.test(glow) && /255, 214, 107/.test(glow), 'the lit tab\'s icon wears the menu tile\'s gold glow', glow)
  await page.screenshot({ path: SHOT('hub') })

  // the section bar and its spray
  const bars = {}
  for (const v of ['hub', 'season', 'shop', 'locker', 'profile']) {
    await go(page, v, 900)
    bars[v] = await page.evaluate(() => { const b = document.querySelector('#screen > .secbar-v170 .sb-mid'); return b ? { name: (b.querySelector('b') || {}).textContent, ...window.__probeV193V(b.querySelector('i')) } : { slot: false } })
    if (v === 'season' || v === 'shop') await page.screenshot({ path: SHOT(v) })
  }
  ok(Object.values(bars).every((p) => good(p, 20, 28)), 'the section bar shows the tab\'s icon on the hub, season, tree, locker and profile', Object.entries(bars).map(([v, p]) => `${v}:${p.name}/${p.ric} ${p.w}${p.text ? ' text=' + p.text : ''}`).join(' · '))
  const sp = await page.evaluate(async () => {
    document.querySelector('#screen > .secbar-v170 .sb-mid').click(); await new Promise((r) => setTimeout(r, 450))
    const bs = [...document.querySelectorAll('#sprayV170 .spr-b')].map((b) => ({ label: (b.querySelector('b') || {}).textContent, ...window.__probeV193V(b.querySelector('i')) }))
    return bs
  })
  ok(sp.length >= 2 && sp.every((p) => p.icon && p.loaded && !p.text), 'the section bar\'s spray carries the same icons', sp.map((p) => p.label + ':' + p.ric))
  await page.screenshot({ path: SHOT('spray') })
  await page.evaluate(() => window.__V170 && window.__V170.close())

  // the tree's branch tabs
  await go(page, 'shop', 900)
  const BR = await page.evaluate(() => {
    const T = window.__GRIDIRON_AUDIT__.TREE
    return [...document.querySelectorAll('#screen .branch-tab')].map((b) => {
      const key = (b.getAttribute('onclick') || '').replace(/^.*'(\w+)'.*$/, '$1')
      return { key, name: T[key] && T[key].name, txt: b.textContent.trim(), clipped: b.scrollWidth > b.clientWidth + 1, ...window.__probeV193V(b) }
    })
  })
  ok(BR.length >= 4 && BR.every((b) => b.icon && b.loaded && b.tag === 'svg' && b.w >= 20 && b.w <= 28), 'every branch tab shows a drawn icon, 20-28 px', BR.map((b) => `${b.key}:${b.ric} ${b.w}`).join(' · '))
  ok(BR.every((b) => b.txt === b.name && !b.text.replace(b.name, '').trim()), 'each branch tab keeps its name and no emoji', BR.map((b) => b.txt))
  ok(new Set(BR.map((b) => b.fill)).size === BR.length && BR.every((b) => /ricMV193V-[0-9a-f]{6}/.test(b.fill)), 'each branch\'s metal is its own colour', BR.map((b) => b.key + ':' + b.fill))
  ok(BR.every((b) => !b.clipped), 'no branch name is clipped under its icon', BR.filter((b) => b.clipped).map((b) => b.key))
  await page.evaluate(() => document.querySelector('#screen .branch-tab')?.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: SHOT('tree') })

  // a painting that fails gives its emoji back
  const FB = await page.evaluate(async () => {
    const box = document.createElement('div'); box.innerHTML = window.ribIconV193V('nav:hub', '🏠'); document.body.appendChild(box)
    const im = box.querySelector('img'); im.src = im.src.replace(/icon_career/, 'icon_missing_v193v')
    await new Promise((r) => setTimeout(r, 600))
    const r = { img: !!box.querySelector('img'), fb: (box.querySelector('.ric-fb-v193v') || {}).textContent }
    box.remove(); return r
  })
  ok(!FB.img && FB.fb === '🏠', 'an icon image that fails to load is replaced by its emoji', FB)
  const UNK = await page.evaluate(() => window.ribIconV193V('no-such-glyph', '🛸'))
  ok(UNK === '🛸', 'an unknown name gives its emoji back', UNK)

  // the kill switch
  const K = await page.evaluate(async () => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193V: 0 })
    window.go('hub'); await new Promise((r) => setTimeout(r, 900))
    const nav = [...document.querySelectorAll('#navV139 button i')].map((i) => ({ icon: !!i.querySelector('.ric-v193v'), text: i.textContent.trim() }))
    const bar = document.querySelector('#screen > .secbar-v170 .sb-mid i'), tab = document.querySelector('.hubv75-tab i')
    window.go('shop'); await new Promise((r) => setTimeout(r, 900))
    const br = [...document.querySelectorAll('#screen .branch-tab')].map((b) => ({ icon: !!b.querySelector('.ric-v193v'), text: b.textContent.trim() }))
    const T = window.__GRIDIRON_AUDIT__.TREE
    const r = { nav, bar: bar ? { icon: !!bar.querySelector('.ric-v193v'), text: bar.textContent } : null, tab: tab ? { icon: !!tab.querySelector('.ric-v193v'), text: tab.textContent } : null, br, want: Object.values(T).map((b) => b.icon + ' ' + b.name) }
    window.RIB_TUNE.v193V = 1; window.go('hub'); await new Promise((r) => setTimeout(r, 900))
    r.back = [...document.querySelectorAll('#navV139 button i')].every((i) => !!i.querySelector('.ric-v193v'))
    return r
  })
  ok(K.nav.every((n) => !n.icon) && K.nav.map((n) => n.text).join('') === '🏠📅📈🌳☰', 'TU v193V 0: the bottom nav is the emoji again', K.nav.map((n) => n.text).join(''))
  ok(K.bar && !K.bar.icon && K.bar.text === '🏈' && K.tab && !K.tab.icon && K.tab.text === '🏈', 'TU v193V 0: the section bar and the tab strip are the emoji again', { bar: K.bar, tab: K.tab })
  ok(K.br.length && K.br.every((b, i) => !b.icon && b.text === K.want[i]), 'TU v193V 0: the branch tabs are the emoji again', K.br.slice(0, 4).map((b) => b.text))
  ok(K.back, 'and back on, the icons return', K.back)
  await ctx.close()
}

// ================= the 360 px phone: the bar still fits =================
{
  const { ctx, page } = await open({ width: 360, height: 740 }, 2, true)
  const F = await page.evaluate(() => {
    const n = document.getElementById('navV139'), tb = document.querySelector('.topbar')
    const bs = [...n.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right) } })
    return { sw: n.scrollWidth, cw: n.clientWidth, bs, doc: document.documentElement.scrollWidth, tb: tb ? tb.scrollWidth <= tb.clientWidth : true }
  })
  ok(F.sw <= F.cw && F.doc <= 360 && F.bs.every((b) => b.r <= 360 && b.w >= 36 && b.h >= 36) && F.tb, 'at 360 px the bottom nav fits, every tab a 36 px target, the page does not scroll sideways', F)
  await ctx.close()
}

// ================= 3: desktop, the tab strips =================
{
  const { ctx, page } = await open({ width: 900, height: 844 }, 1, false)
  await page.evaluate(PROBE)
  const strips = {}
  for (const v of ['hub', 'season', 'settings', 'shop', 'locker', 'profile']) {
    await go(page, v, 900)
    strips[v] = await page.evaluate(() => [...document.querySelectorAll('#screen > .hubv75-tabs .hubv75-tab')].map((t) => ({ sec: t.dataset.sec, name: t.textContent.trim(), ...window.__probeV193V(t.querySelector('i')) })))
    if (v === 'settings') { await page.waitForTimeout(300); await page.screenshot({ path: SHOT('desk-settings') }) }
  }
  const all = Object.entries(strips).flatMap(([v, ts]) => ts.map((t) => ({ v, ...t })))
  ok(Object.values(strips).every((ts) => ts.length >= 2) && all.every((t) => good(t, 18, 28)), 'every section tab (hub, season, settings, tree, locker, profile) shows a loaded icon, no emoji', all.filter((t) => !good(t, 18, 28)).map((t) => `${t.v}/${t.sec}:${t.tag} ${t.w} ${t.text}`).join(' · ') || all.length + ' tabs')
  ok(all.every((t) => /^[A-Z][A-Z ]+$/.test(t.name)), 'the section names are kept', all.map((t) => t.name).join(','))
  await ctx.close()
}

ok(!errs.length, 'no page errors', errs.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
