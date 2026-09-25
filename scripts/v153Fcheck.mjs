// Dev check (v153 F STARS, HONORS, PP, LEGACY — and CHAOS PAYS THE RANK).
//
//   1. the glyphs: Honors wear the crest (⚜️), never the medal (🎖️) — the medal is the Legacy Rank's alone.
//      Static: HONOR_ICON_V130 is the crest, and no line in src/, public/*.js or index.html that says honor(s)
//      draws a 🎖️ (comments aside). Rendered: the top-bar chip, the prestige tree and the path screen.
//   2. How To Play: the STARS, HONORS, PP & LEGACY section (every one of the four, the tiers, the milestones,
//      where to see it) and the CHAOS section (unlock, dials, risk, the pay) — no "prestige star" left anywhere,
//      nothing overflows at 400 wide.
//   3. the coach: two chaos stops of his own (the tour's 17 stops untouched), said once on the RINGS & CHAOS
//      screen with the tour OFF, the locked one before the unlock and the open one after, with live numbers;
//      SKIP silences the stop, never the tour's switch.
//   4. the numbers: Legacy XP is +8% per chaos point up to ×5 (TU("v153F", 0) restores .03 / ×3), the PP
//      multiplier is ×3·1.16^n, and the Chaos card, the XP card's part and the trophy case quote them.
//
//   GAME_URL=http://localhost:6600/index.html node scripts/v153Fcheck.mjs
import fs from 'node:fs'
import path from 'node:path'
import { gameUrl, launch } from './lib/env.mjs'
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const MEDAL = '\u{1F396}', CREST = '⚜'
const W = 400, H = 860
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }

// ============================== 1a. the glyphs, in the source ==============================
{
  const src07 = fs.readFileSync(path.join(ROOT, 'src/07-career-app.js'), 'utf8')
  const icon = (src07.match(/const HONOR_ICON_V130\s*=\s*"([^"]*)"/) || [])[1] || ''
  const val = JSON.parse('"' + icon + '"')
  ok(val.startsWith(CREST) && !val.includes(MEDAL), 'HONOR_ICON_V130 is the crest, not the medal', JSON.stringify(val))
  const files = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js')).map((f) => 'src/' + f)
    .concat(fs.readdirSync(path.join(ROOT, 'public')).filter((f) => f.endsWith('.js')).map((f) => 'public/' + f), ['index.html'])
  const bad = []
  for (const f of files) {
    fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
      const t = line.trim()
      if (/^(\*|\/\/|\/\*)/.test(t)) return   // a comment that tells the history
      if (/honou?rs?\b/i.test(line) && line.includes(MEDAL)) bad.push(f + ':' + (i + 1))
    })
  }
  ok(bad.length === 0, 'no line that draws Honors draws the medal', bad.slice(0, 6))
  const legacyMedal = fs.readFileSync(path.join(ROOT, 'src/31-legacy.js'), 'utf8').includes(MEDAL + '️ LEGACY')
  ok(legacyMedal, 'the medal is still the Legacy Rank\'s (the milestone rows)')
}

const browser = await launch()
const errors = []
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await ctx.addInitScript(() => { setInterval(() => { try { document.querySelectorAll('.onboard').forEach((e) => e.remove()) } catch {} }, 60) })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message || String(e)))
const E = (fn, arg) => page.evaluate(fn, arg)
const boot = async () => {
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V152A && !!window.__V153F && !!window.__RIB_COACH, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(600)
}
const fresh = (o) => E((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.name = 'Chaos Tester'; S.player.pos = 'QB'; S.player.traits = []; S.player.tiers = {}; S.player.personaV13 = { aggression: 5 }
  S.prestige = o.prestige || 0; S.pp = o.pp || 0
  if (o.chaos) { S.chaosUnlocked = true; S.chaosCap = o.cap || 6; S.chaos = o.chaos }
  S.legacyV152 = { v: 1, xp: o.xp || 0, boot: 1, got: {}, log: [], ms: 0 }
  S.view = o.view || 'hub'; window.GridironStorage.save(S)
}, o || {})
const txt = (sel) => E((sel) => { const el = document.querySelector(sel); return el ? el.textContent.replace(/\s+/g, ' ') : '' }, sel)

await page.goto(U(), { waitUntil: 'domcontentloaded' })
await E(() => { localStorage.clear(); localStorage.setItem('rib.coachTour.v119', 'off') })
await boot()

// ============================== 1b. the glyphs, on screen ==============================
{
  ok(await E(() => window.__V130.icon.startsWith('⚜')), 'window.__V130.icon is the crest')
  await fresh({ prestige: 7, pp: 500, view: 'hub' }); await boot()
  const chip = await txt('.prestige-chip')
  ok(chip.includes(CREST) && !chip.includes(MEDAL) && /HONORS/.test(chip) && /PP/.test(chip), 'the top-bar chip reads ⚜️ N HONORS · 🪙 M PP', chip)
  const order = await E(() => { const c = document.querySelector('.prestige-chip'), cr = c.querySelector('.honor-crest-v153'), coin = c.querySelector('img.coin-v147'), pp = c.querySelector('#ppCount')
    return !!(cr && coin && pp && (cr.compareDocumentPosition(coin) & 4) && (coin.compareDocumentPosition(pp) & 4)) })
  ok(order, 'the crest stands by the Honors, the coin by the PP')
  await E(() => window.go('shop')); await page.waitForTimeout(700)
  const shop = await txt('#screen')
  ok(/HONORS/.test(shop) && !shop.includes(MEDAL), 'the prestige tree says HONORS and draws no medal', (shop.match(/Needs[^·]{0,40}HONORS/) || [''])[0])
  ok(/⚜️?\s*7 Honors/.test(shop), 'the tree\'s banner reads ⚜️ 7 Honors', (shop.match(/.{0,4}⚜.{0,12}Honors/) || [''])[0])
  await E(() => { __GRIDIRON_AUDIT__.getState().prestige = 3; window.go('shop') }); await page.waitForTimeout(600)
  const dock = await txt('#dock')
  ok(/Path \(⚜️?6\)/.test(dock) && !dock.includes(MEDAL), 'the locked Path asks for ⚜️6, not a medal', (dock.match(/.{0,8}Path \(.{0,6}\)/) || [''])[0])
}

// ============================== 2. How To Play ==============================
{
  await E(() => window.go('menu')); await page.waitForTimeout(900)
  await E(() => { window.__RIB_HOWTO.open(); window.__RIB_HOWTO.sections.forEach((id) => window.__RIB_HOWTO.toggle(id, true)) }); await page.waitForTimeout(400)
  const g = await E(() => {
    const secT = (id) => { const s = document.querySelector('#rib-howto-v111 [data-fq-sec="' + id + '"]'); return s ? s.textContent.replace(/\s+/g, ' ') : '' }
    return { ids: window.__RIB_HOWTO.sections, cur: secT('currency'), chaos: secT('chaos'), all: document.getElementById('rib-howto-v111').textContent.replace(/\s+/g, ' '),
      docW: document.documentElement.scrollWidth, guideW: document.getElementById('rib-howto-v111').scrollWidth }
  })
  ok(g.ids.includes('currency') && g.ids.includes('chaos') && g.ids.length === 11, 'the guide has STARS, HONORS, PP & LEGACY and CHAOS (eleven sections)', g.ids)
  const c = g.cur
  ok(/STARS/.test(c) && /recruit rating/.test(c) && c.includes('★'), 'STARS: the recruit rating, the player\'s own')
  ok(/HONORS/.test(c) && c.includes(CREST) && /prestige tree/.test(c) && /Path at 6/.test(c), 'HONORS: the crest, the rank that unlocks the tree and the Path')
  ok(/PP/.test(c) && /Prestige Points/.test(c) && /VAULT/.test(c), 'PP: the money, spent in the vault')
  ok(/LEGACY/.test(c) && c.includes(MEDAL) && /500 medals/.test(c) && /Ultimate Legacy/.test(c) && /Legacy Level/.test(c), 'LEGACY: the medal, 500 ranks, Ultimate Legacy, the Legacy Level past it')
  ok(['Rookie', 'Established', 'Elite', 'Superstar', 'Legendary', 'Hall of Fame', 'Icon', 'All-Time Great', 'Immortal', 'Mythic'].every((t) => c.includes(t)), 'the ten tiers are listed')
  ok(/every season/i.test(c) && /career end/i.test(c) && /MILESTONE/.test(c) && /PP bounty/.test(c), 'XP every season and at the career end; milestones pay PP')
  ok(/TROPHY CASE/.test(c) && /COLLECTION BOOK/.test(c) && /PROFILE/.test(c), 'where to see it: the profile\'s trophy case and collection book')
  const k = g.chaos
  ok(/UFF championship/.test(k) && /85\+ OVR/.test(k) && /20 season objectives/.test(k) && /capacity of 6/.test(k), 'CHAOS: how to unlock it and the capacity')
  ok(/17 attributes/.test(k) && /MAXIMUM CHAOS/.test(k) && /attribute cap/.test(k), 'CHAOS: what the dials do')
  ok(/\+8% per chaos point/.test(k) && /×5/.test(k) && /×3 the moment/.test(k) && /1\.16/.test(k), 'CHAOS: the pay — +8% Legacy XP a point up to ×5, PP ×3 then ×1.16 a point')
  ok(/THE RISK IS REAL/.test(k) && /only part of the PP/.test(k), 'CHAOS: the risk')
  ok(!/prestige stars?\b/i.test(g.all) && !/unlocks at 6 stars/.test(g.all), 'no "prestige star" left in the guide', (g.all.match(/.{0,30}prestige star.{0,30}/i) || [''])[0])
  ok(g.docW <= W && g.guideW <= W, 'nothing overflows sideways at 400 with every section open', { docW: g.docW, guideW: g.guideW })
  await page.screenshot({ path: '/tmp/claude-0/v153F_howto.png' }).catch(() => null)
  await E(() => window.__RIB_HOWTO.close())
}

// ============================== 3. the coach on chaos ==============================
{
  const h = await E(() => ({ stops: window.__RIB_COACH.stops.length, chaos: window.__RIB_COACH.chaos && window.__RIB_COACH.chaos.stops, key: window.__RIB_COACH.chaos && window.__RIB_COACH.chaos.key }))
  ok(h.stops === 17, 'the tour\'s own stops are untouched (17)', h.stops)
  ok(h.chaos && h.chaos.map((s) => s.id).join(',') === 'chaosLocked,chaosOpen' && h.chaos.every((s) => s.lines.length >= 3), 'two chaos stops of his own, three or more lines each', h.chaos && h.chaos.map((s) => s.id + ':' + s.lines.length))
  const all = h.chaos.map((s) => s.lines.join(' ')).join(' ')
  ok(/85/.test(all) && /20 season objectives/.test(all) && /Legacy XP/.test(all) && /PP/.test(all) && /\+8%/.test(all), 'the lines say how to open it and what it pays')

  // locked: the tour is OFF and he still says it, once
  await fresh({ prestige: 9, view: 'hub' }); await boot()
  await E(() => { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.removeItem('rib.coachChaos.v153'); window.go('dynasty') })
  await page.waitForFunction(() => window.__RIB_COACH.isOpen && window.__RIB_COACH.stop === 'chaosLocked', null, { timeout: 8000 }).catch(() => null)
  const L = await E(() => ({ open: window.__RIB_COACH.isOpen, stop: window.__RIB_COACH.stop, crumb: (document.querySelector('#rib-coach-v119 [data-c-crumb]') || {}).textContent }))
  ok(L.open && L.stop === 'chaosLocked', 'RINGS & CHAOS, locked, tour off: the coach explains how to open Chaos', L)
  await E(() => { const C = window.__RIB_COACH; let n = 0; while (C.isOpen && n++ < 10) { C.next() } }); await page.waitForTimeout(500)
  const L2 = await E(() => ({ open: window.__RIB_COACH.isOpen, said: window.__RIB_COACH.chaos.said(), tour: localStorage.getItem('rib.coachTour.v119') }))
  ok(!L2.open && L2.said.chaosLocked && L2.tour === 'off', 'said once, and the tour switch is untouched', L2)
  await E(() => { window.go('hub') }); await page.waitForTimeout(300); await E(() => window.go('dynasty')); await page.waitForTimeout(1600)
  ok(!(await E(() => window.__RIB_COACH.isOpen)), 'he does not say it twice')

  // open: the dial, with the live numbers
  await E(() => { const S = __GRIDIRON_AUDIT__.getState(); S.chaosUnlocked = true; S.chaosCap = 12; S.chaos = { speed: 6, strength: 4 }; window.go('hub') }); await page.waitForTimeout(300)
  await E(() => window.go('dynasty'))
  await page.waitForFunction(() => window.__RIB_COACH.isOpen && window.__RIB_COACH.stop === 'chaosOpen', null, { timeout: 8000 }).catch(() => null)
  const O = await E(() => ({ open: window.__RIB_COACH.isOpen, stop: window.__RIB_COACH.stop, lines: window.__RIB_COACH.chaos.lines().map((l) => l.t).join(' ') }))
  ok(O.open && O.stop === 'chaosOpen', 'unlocked: the coach walks the dial', O.stop)
  ok(/\+8% Legacy XP/.test(O.lines) && /×1\.80 Legacy XP/.test(O.lines) && /×13\.2 PP/.test(O.lines) && /room for 12/.test(O.lines), 'with the live numbers (chaos 10: ×13.2 PP, ×1.80 Legacy XP, capacity 12)', (O.lines.match(/Right now[^.]*\.[^.]*\./) || [''])[0])
  await page.screenshot({ path: '/tmp/claude-0/v153F_coach.png' }).catch(() => null)
  await E(() => window.__RIB_COACH.skip()); await page.waitForTimeout(400)
  const O2 = await E(() => ({ open: window.__RIB_COACH.isOpen, said: window.__RIB_COACH.chaos.said(), tour: localStorage.getItem('rib.coachTour.v119') }))
  ok(!O2.open && O2.said.chaosOpen && O2.tour === 'off', 'SKIP silences the chaos stop, not the tour', O2)
}

// ============================== 4. the numbers ==============================
{
  const n = await E(() => {
    const S = __GRIDIRON_AUDIT__.getState(), F = window.__V153F, A = window.__V152A, set = (c) => { S.chaos = c }
    const r = {}
    set({}); r.d0 = A.diff(); r.pp0 = F.ppMult()
    set({ speed: 10 }); r.d10 = A.diff(); r.pp10 = F.ppMult(); r.per = F.per(); r.cap = F.cap()
    set({ speed: 10, strength: 10, agility: 10, tackling: 10, blocking: 10, catching: 10 }); r.d60 = A.diff()
    window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v153F = 0
    set({ speed: 10 }); r.off10 = A.diff(); set({ speed: 10, strength: 10, agility: 10, tackling: 10, blocking: 10, catching: 10, throwing: 10 }); r.off70 = A.diff()
    delete window.RIB_TUNE.v153F
    set({ speed: 10 })
    const p = S.player; p.level = 7
    const x = A.seasonXp(p, { grade: 'B', playoffs: {}, awards: [] }); r.part = x.parts.map((q) => q[0]).find((q) => /Chaos/.test(q)); r.gain = x.gain
    set({}); r.gain0 = A.seasonXp(p, { grade: 'B', playoffs: {}, awards: [] }).gain
    set({ speed: 10 })
    return r
  })
  ok(n.d0 === 1 && n.pp0 === 1, 'no chaos, no bonus', { d0: n.d0, pp0: n.pp0 })
  ok(Math.abs(n.d10 - 1.8) < 1e-9 && n.per === 0.08 && n.cap === 5 && n.d60 === 5, 'Legacy XP: +8% a chaos point, capped at ×5 (chaos 10 → ×1.80, chaos 60 → ×5)', { d10: n.d10, d60: n.d60 })
  ok(Math.abs(n.off10 - 1.3) < 1e-9 && n.off70 === 3, 'TU("v153F", 0) restores v152 A\'s .03 / ×3 (chaos 10 → ×1.30, chaos 70 → ×3)', { off10: n.off10, off70: n.off70 })
  ok(Math.abs(n.pp10 - 3 * Math.pow(1.16, 10)) < 1e-6, 'PP: ×3 on the first point, ×1.16 a point (chaos 10 → ×13.2)', n.pp10.toFixed(2))
  ok(n.part === 'Chaos +80% XP' /* v92: no decimals on a sheet */ && Math.abs(n.gain / n.gain0 - 1.8) < 0.01, 'the Legacy XP card lists the Chaos part with its bonus, and the gain carries it', { part: n.part, gain: n.gain, gain0: n.gain0 })

  await E(() => window.go('hub')); await page.waitForTimeout(300)
  await E(() => { localStorage.setItem('rib.coachChaos.v153', JSON.stringify({ chaosLocked: 1, chaosOpen: 1 })); window.go('dynasty') }); await page.waitForTimeout(800)
  const d = await E(() => { const sc = document.getElementById('screen'), box = sc.querySelector('.chaos-lxp-v153'), note = sc.querySelector('.chaos-reward-v153')
    return { box: box ? box.textContent.replace(/\s+/g, ' ').trim() : '', note: note ? note.textContent.replace(/\s+/g, ' ') : '', pp: [...sc.querySelectorAll('.cs-box')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()), docW: document.documentElement.scrollWidth } })
  ok(/\+80%\s*Legacy XP/i.test(d.box), 'the Chaos card shows the Legacy XP bonus', d.box)
  ok(d.pp.some((t) => /×13\s*PP Gains/i.test(t)), 'and the PP multiplier (a whole number — v92: no decimals on a sheet)', d.pp)
  ok(/\+8% Legacy XP/.test(d.note) && /×5/.test(d.note) && /×13\.2 PP/.test(d.note) && /×1\.80 Legacy XP/.test(d.note), 'and says what it pays, now', d.note.slice(0, 160))
  ok(d.docW <= W, 'the Chaos card fits 400 wide', d.docW)
  await page.screenshot({ path: '/tmp/claude-0/v153F_chaos.png', fullPage: false }).catch(() => null)

  await E(() => { const S = __GRIDIRON_AUDIT__.getState(); window.__keepP = S.player; S.player = null; window.go('profile') }); await page.waitForTimeout(1200)
  const tc = await E(() => { const c = document.querySelector('.lgk-chaos-v153'); return c ? c.textContent.replace(/\s+/g, ' ') : '' })
  ok(/CHAOS BONUS \+80% LEGACY XP/.test(tc), 'the trophy case quotes the Chaos bonus', tc)
  await E(() => { const S = __GRIDIRON_AUDIT__.getState(); S.player = window.__keepP })
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
