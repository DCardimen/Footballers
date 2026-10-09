// Dev check: v193 Y THE EMOJI BECOME ART (src/24-bottom-nav.js `ribArtV193Y`, the symbol sprite, `NODE_ART_V193Y`, the sweep;
// 07 `nodeArtV193Y` / `artV193Y` above `screenPrestige`).
//   1 the library: every concept a <symbol> in ONE sprite (#ribArtSpriteV193Y); every tree node in every branch maps to a
//     concept straight from NODE_ART_V193Y (no keyword fallback, no emoji left — the allowed list is empty)
//   2 phone 390x844 @3x: every node row the tree draws, in every branch, is an <svg> whose <use> resolves to a defined
//     <symbol>, 30-40 px, tinted by the branch (its gradient is the branch colour's, one gradient a tint, shared), the
//     emoji kept as screen-reader text and the svg aria-hidden
//   3 QUICK BUY tiles draw small art (14-18 px, the fine detail off); the hub card, the season cards, Settings' rows,
//     the Locker's slots, the medal chooser's cards and chip, the career-end receipt draw art
//   4 the kill switch TU("v193Y", 0) gives every one of them its emoji back; no page errors
//   5 at 360 px nothing overflows (the tree, the hub, Settings, the Locker)
// Screenshots: scripts/_v193Y_*.png.  GAME_URL=http://localhost:5173/ node scripts/v193Ycheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const SHOT = (n) => new URL('./_v193Y_' + n + '.png', import.meta.url).pathname
// the nodes allowed to keep their emoji (none)
const ALLOWED_FALLBACK = []

async function open(vp, dpr) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
  await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate', '#sprayHintV170']) document.querySelector(s)?.remove() }, 80) })
  await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.ribArtV193Y && !!window.__V193Y, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  await page.evaluate(() => {
    const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tutorialSeen = true
    S.tree = { genetics: 1, talent: 1 }; S.pp = 5000
    S.player = X.newPlayer(); const p = S.player
    p.pos = 'QB'; p.level = 3; p.totalSeasons = 3; p.seasonsAtLevel = 1; p.personaV13 = { loyalty: 5 }; p.traits = []
    document.body.classList.remove('rib-menu-open')
    window.go('hub')
  })
  await page.waitForTimeout(700)
  await page.evaluate(() => {
    // what an art slot holds: the svg, its <use>, whether the symbol is defined, its size, its tint
    window.__probeV193Y = (slot) => {
      if (!slot) return { slot: false }
      const a = slot.matches && slot.matches('rib-art') ? slot : slot.querySelector('rib-art.ra-v193y'), svg = a && a.querySelector('svg'), use = svg && svg.querySelector('use')
      const href = use ? use.getAttribute('href') || '' : '', sym = href ? document.getElementById(href.slice(1)) : null, r = svg ? svg.getBoundingClientRect() : null
      const m = svg ? (svg.getAttribute('style') || '').match(/--raM:url\(#(ribartM-[0-9a-z]+)\)/) : null, g = m ? document.getElementById(m[1]) : null
      return { slot: true, art: !!a, concept: a ? a.dataset.art : '', svg: !!svg, use: !!use, sym: !!(sym && sym.tagName.toLowerCase() === 'symbol' && sym.querySelectorAll('path').length > 0), inSprite: !!(sym && sym.closest('#ribArtSpriteV193Y')), w: r ? Math.round(r.width * 10) / 10 : 0, h: r ? Math.round(r.height * 10) / 10 : 0, grad: m ? m[1] : '', gradOk: !!(g && g.tagName.toLowerCase() === 'lineargradient' && g.querySelectorAll('stop').length >= 5), hidden: svg ? svg.getAttribute('aria-hidden') === 'true' : false, sr: a ? ((a.querySelector('.sr-only-v193y') || {}).textContent || '') : '', small: a ? a.classList.contains('ra-sm-v193y') : false, text: slot.textContent.trim() }
    }
  })
  return { ctx, page }
}
const go = async (page, v, ms = 800) => { await page.evaluate((v) => window.go(v), v); await page.waitForTimeout(ms) }
const drawn = (p, lo, hi) => p.art && p.svg && p.use && p.sym && p.inSprite && p.hidden && p.w >= lo && p.w <= hi
const hexOf = (c) => String(c || '').replace('#', '').toLowerCase().replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3')

// ================= 1: the library and the map =================
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 3)
  const L = await page.evaluate(() => {
    const T = window.__GRIDIRON_AUDIT__.TREE, Y = window.__V193Y, nodes = [], by = {}
    for (const [k, br] of Object.entries(T)) for (const n of br.nodes) {
      const direct = Y.map[n.icon] || Y.map[String(n.icon).replace(/️/g, '')] || null
      const c = Y.concept(n.icon, n.name + ' ' + n.desc)
      nodes.push({ b: k, key: n.key, icon: n.icon, direct: !!direct, c })
      by[c] = (by[c] || 0) + 1
    }
    const lib = Y.library()
    // every concept draws: a symbol with paths
    lib.forEach((c) => Y.symbol(c))
    const bad = lib.filter((c) => { const s = document.getElementById('ribart-' + c); return !s || !s.querySelectorAll('path').length })
    const sprites = document.querySelectorAll('#ribArtSpriteV193Y').length
    return { nodes, lib: lib.length, bad, sprites, used: Object.keys(by).length }
  })
  const left = L.nodes.filter((n) => !n.direct || !n.c).filter((n) => !ALLOWED_FALLBACK.includes(n.key))
  ok(L.nodes.length >= 150, 'the tree has its ~150+ nodes', L.nodes.length)
  ok(L.lib >= 50 && !L.bad.length && L.sprites === 1, `the library: ${L.lib} drawn concepts, every one a <symbol> in ONE sprite`, { bad: L.bad, sprites: L.sprites })
  ok(!left.length, `every node's emoji maps to a concept straight from NODE_ART_V193Y (${L.used} concepts used; allowed on the fallback: ${ALLOWED_FALLBACK.length})`, left.slice(0, 8))
  await ctx.close()
}

// ================= 2 + 3: the phone =================
{
  const { ctx, page } = await open({ width: 390, height: 844 }, 3)
  // every branch, every node the tree draws
  await go(page, 'shop', 900)
  const keys = await page.evaluate(() => Object.keys(window.__GRIDIRON_AUDIT__.TREE))
  const per = {}
  for (const k of keys) {
    per[k] = await page.evaluate(async (k) => {
      window.setBranch(k); await new Promise((r) => setTimeout(r, 120))
      const T = window.__GRIDIRON_AUDIT__.TREE[k]
      const rows = [...document.querySelectorAll('#branchNodes .shop-item')]
      return { color: T.color, rows: rows.map((r) => window.__probeV193Y(r.querySelector('.ic'))) }
    }, k)
    if (['physical', 'mental', 'fate'].includes(k)) {
      await page.evaluate(() => document.getElementById('branchNodes')?.scrollIntoView({ block: 'start' }))
      await page.waitForTimeout(150); await page.screenshot({ path: SHOT('tree_' + k) })
    }
  }
  const rows = Object.entries(per).flatMap(([k, v]) => v.rows.map((r) => ({ k, ...r })))
  const badRows = rows.filter((r) => !drawn(r, 30, 40))
  ok(rows.length >= 100 && !badRows.length, `every node row in every branch (${rows.length} drawn, ${keys.length} branches) is an <svg> whose <use> resolves to a defined symbol, 30-40 px, aria-hidden`, badRows.slice(0, 4))
  ok(rows.every((r) => r.sr && r.sr === r.text), 'each row keeps its emoji as screen-reader text (and nothing else beside the drawing)', rows.filter((r) => !r.sr || r.sr !== r.text).slice(0, 3))
  const tintBad = Object.entries(per).filter(([k, v]) => !v.rows.every((r) => r.gradOk && r.grad === 'ribartM-' + hexOf(v.color)))
  ok(!tintBad.length, 'the metal follows the branch: every row\'s gradient is its branch colour\'s', tintBad.map(([k, v]) => k + ':' + v.color + '→' + (v.rows[0] || {}).grad))
  const G = await page.evaluate(() => ({ grads: document.querySelectorAll('#ribArtSpriteV193Y linearGradient').length, uses: document.querySelectorAll('#branchNodes rib-art use').length, defsInIcons: document.querySelectorAll('#branchNodes rib-art defs, #branchNodes rib-art linearGradient').length }))
  ok(G.defsInIcons === 0 && G.grads <= 2 * (keys.length + 8), 'the icons carry no gradient defs of their own: one shared gradient pair per tint', G)

  // QUICK BUY
  await page.evaluate(() => document.getElementById('spendNowV193E')?.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(150)
  const QB = await page.evaluate(() => [...document.querySelectorAll('.qb-tile-v193l')].map((t) => window.__probeV193Y(t.querySelector('.qb-n-v193l i'))))
  ok(QB.length >= 2 && QB.every((p) => drawn(p, 14, 18) && p.small), 'QUICK BUY tiles draw their node small (14-18 px, the fine detail off)', QB.map((p) => p.concept + ' ' + p.w))
  await page.screenshot({ path: SHOT('quickbuy') })

  // the hub: the player card, the dock, the medal chip
  await page.evaluate(() => { const st = window.__V179.medals.store(); st.pending = [{ rank: 20, major: false, opts: [{ id: 'pp', icon: '💰', name: 'Prestige windfall', rar: 'common', ctx: 'x' }, { id: 'luck', icon: '🍀', name: 'Luckier card flips', rar: 'rare', ctx: 'y' }] }] })
  await go(page, 'hub', 900)
  const H = await page.evaluate(() => ({
    hero: [...document.querySelectorAll('.player-hero rib-art')].map((a) => window.__probeV193Y(a)),
    chip: window.__probeV193Y(document.getElementById('medalChipV179')),
    dock: [...document.querySelectorAll('#dock rib-art')].map((a) => window.__probeV193Y(a)),
    afford: (document.querySelector('#dock .afford-v193e') || {}).textContent || ''
  }))
  ok(H.hero.length >= 3 && H.hero.every((p) => drawn(p, 14, 32)), 'the hub\'s player card draws its line icons (team, family, body, the ceiling)', H.hero.map((p) => p.concept))
  ok(H.chip.art && drawn(H.chip, 16, 24), 'the medal-reward chip\'s 🎁 is drawn', H.chip.concept)
  ok(H.dock.length >= 3 && H.dock.every((p) => drawn(p, 12, 32)), 'the dock\'s buttons and lines draw their emoji', H.dock.map((p) => p.concept))
  ok(/🌳\s*\d+ upgrades? affordable/.test(H.afford.replace(/\s+/g, ' ')), 'a line\'s text still reads as it did (the emoji stays as screen-reader text)', H.afford.slice(0, 60))
  await page.screenshot({ path: SHOT('hub') })

  // the medal chooser
  const MP = await page.evaluate(async () => { window.__V179.medals.open(); await new Promise((r) => setTimeout(r, 200)); const r = [...document.querySelectorAll('#medalPickV179 .mp-face')].map((f) => window.__probeV193Y(f.querySelector('i'))); return r })
  ok(MP.length === 2 && MP.every((p) => drawn(p, 32, 48)) && MP[0].grad !== MP[1].grad, 'the medal chooser\'s cards draw their reward, each in its rarity\'s metal', MP.map((p) => p.concept + ' ' + p.grad))
  await page.screenshot({ path: SHOT('medals') })
  await page.evaluate(() => { window.__V179.medals.close(); window.__V179.medals.store().pending = [] })

  // the season screen
  await go(page, 'season', 900)
  const SE = await page.evaluate(() => ({ team: window.__probeV193Y(document.querySelector('#teamQualV192B .eyebrow')), gain: window.__probeV193Y(document.querySelector('#seasonGainV193D .sg-head')) }))
  ok(drawn(SE.team, 12, 24) && drawn(SE.gain, 12, 24), 'the season screen\'s 👥 YOUR TEAM\'S QUALITY and 📈 PRESTIGE THIS SEASON headers draw', [SE.team.concept, SE.gain.concept])
  await page.screenshot({ path: SHOT('season') })

  // Settings, every section
  await go(page, 'settings', 900)
  const ST = await page.evaluate(async () => {
    document.querySelectorAll('#screen .hubv75-sec').forEach((s) => s.classList.add('on'))
    await new Promise((r) => setTimeout(r, 300))
    return { rows: [...document.querySelectorAll('#screen .toggle-label rib-art, #screen .fx-label rib-art')].map((a) => window.__probeV193Y(a)), heads: [...document.querySelectorAll('#screen .card > .l rib-art')].map((a) => window.__probeV193Y(a)) }
  })
  ok(ST.rows.length >= 2 && ST.rows.every((p) => drawn(p, 14, 28)) && ST.heads.length >= 3, 'Settings\' rows (🔊 📳 🎬 📣 …) and its card headers draw', { rows: ST.rows.map((p) => p.concept), heads: ST.heads.map((p) => p.concept) })
  await page.evaluate(() => { document.querySelectorAll('#screen .hubv75-sec').forEach((s, i) => s.classList.toggle('on', i === 0)) })
  await page.screenshot({ path: SHOT('settings') })

  // the Locker: the slots, a piece in its rarity
  await page.evaluate(() => { const S = window.__GRIDIRON_AUDIT__.getState(); S.inventory = [{ id: 'y1', slot: 'chain', rarity: 'epic', name: 'Phantom Chain', eff: 'growth', val: 0.03, icon: '📿', modsV147: 1, tierV147: 2, mods: [] }] })
  await go(page, 'locker', 900)
  const LK = await page.evaluate(() => ({ slots: [...document.querySelectorAll('.eq-ic')].map((s) => window.__probeV193Y(s)), rows: [...document.querySelectorAll('.gr-ic')].map((s) => window.__probeV193Y(s)) }))
  ok(LK.slots.length === 3 && LK.slots.every((p) => drawn(p, 24, 36)) && LK.slots.map((p) => p.concept).join() === 'cleat,glove,chain', 'the Locker\'s three slots draw 👟 🧤 📿 (cleat, glove, chain)', LK.slots.map((p) => p.concept))
  ok(LK.rows.length >= 1 && LK.rows.every((p) => drawn(p, 20, 32)) && LK.rows[0].grad === 'ribartM-a05ac9', 'an inventory piece draws in its rarity\'s metal (epic)', LK.rows.map((p) => p.concept + ' ' + p.grad))
  await page.screenshot({ path: SHOT('locker') })

  // the career-end receipt
  await go(page, 'gameover', 1200)
  const RC = await page.evaluate(() => window.__probeV193Y(document.querySelector('#payLedgerV193D .pl-head')))
  ok(drawn(RC, 14, 24) && RC.concept === 'receipt', 'the career-end receipt\'s 🧾 header draws', RC.concept)
  await page.evaluate(() => document.getElementById('payLedgerV193D')?.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(200)
  await page.screenshot({ path: SHOT('receipt') })

  // the kill switch
  const K = await page.evaluate(async () => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v193Y: 0 })
    const S = window.__GRIDIRON_AUDIT__.getState()
    S.player = window.__GRIDIRON_AUDIT__.newPlayer(); Object.assign(S.player, { pos: 'QB', level: 3, totalSeasons: 3, seasonsAtLevel: 1, personaV13: { loyalty: 5 }, traits: [] })
    const T = window.__GRIDIRON_AUDIT__.TREE
    window.go('shop'); await new Promise((r) => setTimeout(r, 700))
    window.setBranch('physical'); await new Promise((r) => setTimeout(r, 200))
    const ics = [...document.querySelectorAll('#branchNodes .shop-item .ic')]
    const tree = { art: ics.some((i) => i.querySelector('rib-art')), text: ics.slice(0, 4).map((i) => i.textContent.trim()), want: T.physical.nodes.slice(0, 4).map((n) => n.icon) }
    const qb = [...document.querySelectorAll('.qb-tile-v193l rib-art')].length
    window.go('locker'); await new Promise((r) => setTimeout(r, 700))
    const lk = { art: document.querySelectorAll('.eq-ic rib-art').length, text: [...document.querySelectorAll('.eq-ic')].map((s) => s.textContent.trim()).join('') }
    window.go('hub'); await new Promise((r) => setTimeout(r, 900))
    const hub = document.querySelectorAll('#screen rib-art, #dock rib-art').length
    const unk = window.ribArtV193Y('💪')
    window.RIB_TUNE.v193Y = 1
    window.go('shop'); await new Promise((r) => setTimeout(r, 700))
    const back = !!document.querySelector('#branchNodes .shop-item .ic rib-art')
    return { tree, qb, lk, hub, unk, back, unknown: window.ribArtV193Y('no-such-thing-🛸') }
  })
  ok(!K.tree.art && K.tree.text.join() === K.tree.want.join() && !K.qb, 'TU v193Y 0: the tree\'s nodes and QUICK BUY are the emoji again', K.tree)
  ok(!K.lk.art && K.lk.text === '👟🧤📿' && !K.hub && K.unk === '💪', 'TU v193Y 0: the Locker, the hub and the dock are the emoji again', { lk: K.lk, hub: K.hub })
  ok(K.back, 'and back on, the art returns', K.back)
  ok(!/rib-art/.test(K.unknown), 'an unknown concept gives its text back', K.unknown)
  await ctx.close()
}

// ================= 5: 360 px, nothing overflows =================
{
  const { ctx, page } = await open({ width: 360, height: 740 }, 2)
  const W = {}
  for (const v of ['shop', 'hub', 'settings', 'locker', 'season']) {
    await go(page, v, 900)
    W[v] = await page.evaluate(() => {
      const doc = document.documentElement.scrollWidth
      const out = [...document.querySelectorAll('rib-art')].filter((a) => { const r = a.getBoundingClientRect(); return r.width && (r.right > 360.5 || r.left < -0.5) && !a.closest('.qb-grid-v193l,.qa-row-v146,.gear-chips-v193,[style*="overflow-x"]') }).length
      return { doc, out }
    })
  }
  ok(Object.values(W).every((w) => w.doc <= 360 && !w.out), 'at 360 px no page scrolls sideways and no drawing sits off the screen (tree, hub, Settings, Locker, season)', W)
  await ctx.close()
}

ok(!errs.length, 'no page errors', errs.slice(0, 3))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
