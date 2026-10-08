// Dev check: v193 N — PERSONALITY GIVES A STAT, AND STATS ARE WHOLE (src/14-personality.js, src/07-career-app.js, src/11).
//   1. PERSONALITY — the v20 `perf` poles (Win-Now, Process, Coasts, Me-First, Team-First) no longer add to EVERY
//      attribute: each moves ONE attribute (`ATTR_OF_POLE_V193N`) by a whole number (perf × pts, rounded); the game's
//      accessor (`_raw`) and the sheet (`effAttrsV85`) carry exactly that attribute's flat and nothing on the rest; the
//      page says "▲ +2 Grit" / "▼ −1 Vision", never "to all stats"; the per-pole list (`effectsOf`) is whole; an old save's
//      fx is recomputed; kill switch `TU("v193N", 0)` = the old all-stats `perfFlat`.
//   2. STATS ARE WHOLE — a player seeded with deliberately fractional attributes (47.38, 12.5, 99.999 …) and fractional
//      gear, played into a real season, and every stat screen visited: the season screen, the quick-play card (YOUR GAME,
//      `heroHtmlV189`), every page of the pregame wizard, the season report (`screenResult`), the growth screen
//      (`growShowV132`), the hub, the skill sheet (all three groups), the Recruiting Board, the leaders, the training
//      board, the profile, the locker and its compare. The visible text (hidden tabs included) carries no number with 2+
//      decimals, and no decimal at all on a line labelled with an attribute name or OVR.
//   REPORT=1 prints every hit. No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Ncheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60) })
await page.goto(gameUrl('index.html?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__personaV192C && !!window.__V193N && !!window.__V85, null, { timeout: 40000 })
await page.waitForTimeout(800)
const M = (fn, arg) => page.evaluate(fn, arg)
const NEUTRAL = { aggression: 5, iq: 5, eq: 5, longterm: 5, workethic: 5, loyalty: 5, confidence: 5, coachability: 5 }

// ---------------------------------------------------------------- 1. personality: one attribute, whole numbers
const P1 = await M((NEUTRAL) => {
  const A = window.__GRIDIRON_AUDIT__, V = window.__personaV192C, S = A.freshState(); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.pos = 'RB'; S.player.level = 3; A.setState(S)
  window.RIB_TUNE = window.RIB_TUNE || {}; delete window.RIB_TUNE.v193N
  const p = S.player
  const set = (o) => { p.personaV13 = Object.assign({}, NEUTRAL, o); p.personaFxV20 = null; window.__personaApplyV13(p); return p.personaFxV20 }
  // the five perf poles at full lean
  const poles = { winnow: set({ longterm: 0 }).attrFlatV193N, process: set({ longterm: 10 }).attrFlatV193N, coasts: set({ workethic: 0 }).attrFlatV193N,
    mefirst: set({ loyalty: 0 }).attrFlatV193N, teamfirst: set({ loyalty: 10 }).attrFlatV193N, relentless: set({ workethic: 10 }).attrFlatV193N }
  // Win-Now 0 + Coasts 2 + Me-First 1: grit +2, awareness −1, vision +1
  const fx = set({ longterm: 0, workethic: 2, loyalty: 1 })
  const ef = window.__V85.effAttrs(p), flat = window.__V193N.flat(p)
  const base = {}; A.ATTRS.forEach(k => { base[k] = p.attrs[k] })
  const moved = A.ATTRS.filter(k => (ef.persona[k] || 0) !== 0)
  // the page's chips
  window.__personaViewV192C()
  const el = document.getElementById('personaViewV192C'), txt = el ? el.textContent.replace(/\s+/g, ' ') : ''
  const chips = el ? [...el.querySelectorAll('.pv13-boosts .pv13-chip')].map(c => c.textContent.trim()) : []
  el && el.remove()
  // every effectsOf line of every pole, at every point count, is whole where it names an attribute flat
  const lines = []
  V.P.forEach(tr => ['lo', 'hi'].forEach(side => { for (let pts = 0; pts <= 5; pts++) V.effectsOf(tr, side, pts).forEach(e => lines.push(pts ? e.tot : e.per)) }))
  const attrLines = lines.filter(l => / (Grit|Awareness|Vision)\b/.test(l) && !/max /.test(l))
  // kill switch: the old all-stats flat
  window.RIB_TUNE.v193N = 0
  const off = window.__V193N.flat(p), offEf = window.__V85.effAttrs(p)
  window.__personaViewV192C(); const el0 = document.getElementById('personaViewV192C'), offTxt = el0 ? el0.textContent : ''; el0 && el0.remove()
  delete window.RIB_TUNE.v193N
  // an old save: a v20-era fx without the map is recomputed on first read
  p.personaFxV20 = { injMult: 1, varMult: 1, perfFlat: 2.1, gasBurn: 1, sprintIQ: 0 }; window.__youPersonaFxV20 = p.personaFxV20
  const oldFlat = window.__V193N.flat(p)
  return { poles, fx: { perfFlat: fx.perfFlat, map: fx.attrFlatV193N }, flat, moved, persona: ef.persona, chips, allStats: /to all stats|every stat/.test(txt), attrLines, off, offPersona: Object.values(offEf.persona).some(v => v), offAll: /all stats/.test(offTxt), oldFlat, oldFx: p.personaFxV20 && p.personaFxV20.attrFlatV193N }
}, NEUTRAL)
ok(P1.poles.winnow.grit === 2 && P1.poles.process.grit === -1 && P1.poles.coasts.awareness === -1 && P1.poles.mefirst.vision === 1 && P1.poles.teamfirst.vision === -1 && !Object.keys(P1.poles.relentless).length,
  'each perf pole moves ONE attribute by a whole number (Win-Now +2 Grit, Process −1 Grit, Coasts −1 Awareness, Me-First +1 Vision, Team-First −1 Vision; Relentless none)', P1.poles)
ok(JSON.stringify(P1.flat.by) === JSON.stringify(P1.fx.map) && P1.flat.all === 0 && P1.fx.map.grit === 2 && P1.fx.map.awareness === -1 && P1.fx.map.vision === 1, 'the game accessor reads the per-attribute map and NOTHING on every stat (all = 0)', P1.flat)
ok(P1.moved.sort().join() === 'awareness,grit,vision' && P1.persona.grit === 2 && P1.persona.awareness === -1 && P1.persona.vision === 1, 'the sheet (effAttrsV85) carries exactly those three attributes', P1.persona)
ok(P1.chips.includes('▲ +2 Grit') && P1.chips.includes('▼ −1 Awareness') && P1.chips.includes('▲ +1 Vision') && !P1.allStats, 'the personality page says "▲ +2 Grit" / "▼ −1 Awareness" — never "to all stats"', P1.chips.filter(c => /Grit|Awareness|Vision|stat/.test(c)))
ok(P1.attrLines.length > 10 && P1.attrLines.every(l => !/\d\.\d/.test(l)), 'every per-pole line naming the attribute is a whole number', P1.attrLines.slice(0, 6))
ok(P1.off.all === P1.fx.perfFlat && !Object.keys(P1.off.by).length && !P1.offPersona && P1.offAll, 'kill switch v193N 0: the old all-stats perfFlat in the accessor, the old sheet and the old chip', P1.off)
ok(P1.oldFlat.by && P1.oldFlat.by.grit === 2 && P1.oldFlat.all === 0 && P1.oldFx && P1.oldFx.grit === 2, 'an old save\'s fx (perfFlat only) is recomputed into the per-attribute map', P1.oldFlat)

// the live accessor (`_raw` in simGameV2) adds the per-attribute map, read once a game — never the persona's perfFlat directly
const SRC = await M(async () => (await fetch('src/07-career-app.js')).text())
const rawAt = SRC.indexOf('_raw = (w, k) => {'), rawBlock = SRC.slice(rawAt, SRC.indexOf('return _v;', rawAt))
ok(rawAt > 0 && /_pf193N\.all\s*\+\s*\(_pf193N\.by\[k\]\s*\|\|\s*0\)/.test(rawBlock) && !/__youPersonaFxV20\.perfFlat/.test(rawBlock) && /_pf193N\s*=\s*personaGameFlatV193N\(/.test(SRC),
  'the game accessor (_raw) adds the one-attribute flat (_pf193N.by[k]), not the persona perfFlat on every attribute')

// ---------------------------------------------------------------- 2. stats are whole: drive a real season with fractional attributes
await M(() => {
  const BLOCK = /^(DIV|P|LI|TR|TD|TH|SECTION|BUTTON|H1|H2|H3|H4|H5|H6|HEADER|FOOTER|ARTICLE|UL|OL|TABLE|BR|SUMMARY|DETAILS|LABEL|SMALL)$/
  const NAMES = ['Speed', 'Strength', 'Quickness', 'Agility', 'Awareness', 'Catching', 'Throwing', 'Tackling', 'Grit', 'Stamina', 'Durability', 'Vision', 'Acceleration', 'Jumping', 'Blocking', 'Ball Control', 'Discipline']
  const attrRe = new RegExp('\\b(' + NAMES.join('|') + '|OVR)\\b', 'i')
  // every text line under root — hidden tabs included (a tap away), styles/scripts/svg excluded; a line is one block's text
  window.__scanV193N = (root, tag) => {
    if (!root) return []
    const lines = []; let cur = '', curBlock = null
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => { let el = n.parentElement; while (el && el !== root.parentElement) { if (/^(STYLE|SCRIPT|NOSCRIPT|TEMPLATE|svg)$/i.test(el.tagName)) return NodeFilter.FILTER_REJECT; el = el.parentElement } return NodeFilter.FILTER_ACCEPT } })
    let n
    while ((n = w.nextNode())) {
      let b = n.parentElement; while (b && b !== root && !BLOCK.test(b.tagName)) b = b.parentElement
      if (b !== curBlock) { if (cur.trim()) lines.push(cur.replace(/\s+/g, ' ').trim()); cur = ''; curBlock = b }
      cur += n.nodeValue
    }
    if (cur.trim()) lines.push(cur.replace(/\s+/g, ' ').trim())
    const hits = []
    lines.forEach(l => {
      if (/(?<![\d.])\d+\.\d{2,}/.test(l)) hits.push(tag + ' · 2+ decimals · ' + l.slice(0, 150))
      else if (l.length < 100 && attrRe.test(l) && /(?<![\d.v×])\d+\.\d(?![\d%])/.test(l)) hits.push(tag + ' · attr/OVR decimal · ' + l.slice(0, 150))
    })
    return hits
  }
  window.__hitsV193N = []
  window.__scanAllV193N = (tag) => {
    const roots = [document.getElementById('screen'), document.getElementById('dock')]
    document.querySelectorAll('.decision-overlay,#pregameV1513,#growV132,#simCardV178,#pgOverlayV13,.life-event-overlay-v12,.stat-info-v142').forEach(x => roots.push(x))
    const h = []; roots.forEach(r => h.push(...window.__scanV193N(r, tag)))
    window.__hitsV193N.push(...h)
    return h.length
  }
})
const drive = await M(async (NEUTRAL) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const A = window.__GRIDIRON_AUDIT__, S = () => A.getState(), P = () => S().player
  const fresh = A.freshState(); fresh.tutorialSeen = true; A.setState(fresh)
  window.startCareer(true); await sleep(60)
  for (let i = 0; i < 20 && !document.getElementById('personaV13'); i++) await sleep(60)
  try { window.__personaConfirmV13() } catch (e) {}
  const p = P(); if (!p.originV11) { try { window.chooseOriginV11('walk-on') } catch (e) {} }
  p.personaV13 = Object.assign({}, NEUTRAL, { longterm: 0, workethic: 2, loyalty: 1 }); window.__personaApplyV13(p)
  window.pickPos('RB'); await sleep(40)
  const views = []
  for (let k = 0; k < 40; k++) {
    const v = S().view; views.push(v)
    document.getElementById('gv42go')?.click()
    if (v === 'season' && P().weekResults) break
    if (v === 'hub') { window.startSeason(); await sleep(40); continue }
    if (v === 'training') { window.chooseTraining('balanced'); await sleep(40); continue }
    if (v === 'event') { const ev = A.EVENTS.find(z => z.id === P().pendingEvent); if (!ev) { P().pendingEvent = null; window.go('sim') } else { const i = window.__V147A.pickEvent(P(), ev); if (i < 0) { P().pendingEvent = null; window.go('sim') } else window.chooseEvent(i) } await sleep(40); continue }
    if (v === 'sim') { window.go('sim'); await sleep(40); continue }
    await sleep(120)
  }
  // the fractional player: attributes, gear with fractional modifiers
  const fr = [47.38, 12.5, 99.999, 33.333, 61.07, 20.25, 70.6667, 55.55, 41.01, 66.666, 18.4, 77.777, 50.5, 39.99, 88.123, 24.75, 58.3]
  A.ATTRS.forEach((k, i) => { P().attrs[k] = fr[i % fr.length] })
  P().points = 3.5
  const s = S()
  s.inventory = s.inventory || []
  const piece = { id: 'fracV193N', slot: 'chain', rarity: 'mythic', name: 'Fraction Chain', eff: 'growth', val: 0.0333, icon: '📿', modsV147: 1, mods: [{ k: 'a_speed', v: 2.5 }, { k: 'a_vision', v: 1.25 }, { k: 'a_grit', v: 0.333 }] }
  const spare = { id: 'fracV193N2', slot: 'cleats', rarity: 'epic', name: 'Fraction Cleats', eff: 'power', val: 2.75, icon: '👟', modsV147: 1, mods: [{ k: 'a_agility', v: 1.75 }] }
  s.inventory.push(piece, spare); s.equipped = Object.assign({}, s.equipped || {}, { chain: piece })
  return { views, view: S().view, weeks: (P().weekResults || []).length }
}, NEUTRAL)
ok(drive.view === 'season' && drive.weeks > 0, 'a real season is under way with a fractional player', drive)

const visit = async (tag, fn, wait = 350) => { await M(fn); await page.waitForTimeout(wait); return M(t => ({ view: window.S.view, lines: window.__scanAllV193N(t),
  // the pieces each visit is there to read
  has: ['#simCardV178', '#pgHeroV186', '#growV132', '.gear-cmp-v147', '.gear-sum-v147', '.up-group-v97', '.poise-card-v192c'].filter(q => document.querySelector(q)) }), tag) }
const seen = {}
seen.season = await visit('season', () => window.go('season'))
// one quick-play week: the YOUR GAME card (heroHtmlV189) and the season race
seen.simcard = await visit('quick-play card', async () => { const b = document.querySelector('#dock button[onclick="playWeek(false)"]'); b ? b.click() : window.playWeek(false) }, 1200)
// YOUR GAME (heroHtmlV189 — the live post-game card and the quick-play card both draw it): the week just played, and a
// box whose numbers are fractional (a season summed from fractional lines must still print whole numbers)
seen.hero = await M(() => {
  const p = window.S.player, V = window.__V189, w = (p.weekResults || []).filter(x => x && x.played && x.statLine).slice(-1)[0]
  const frac = { carries: 7, rush: 47.25, td: 1, longest: 18.5, rec: 12.333, fum: 0 }, sb = V.seasonBox(p, w && w.statLine, w)
  const host = document.createElement('div'); host.id = 'heroProbeV193N'
  host.innerHTML = (w ? V.hero(p, w.statLine, sb.box, sb.n) : '') + V.hero(p, frac, { carries: 30.5, rush: 151.75, td: 2, longest: 33, rec: 40.4, fum: 1 }, 3)
  document.body.appendChild(host)
  const r = { view: window.S.view, lines: 0, has: host.querySelector('#pgHeroV186') ? ['#pgHeroV186'] : [], played: !!w }
  window.__hitsV193N.push(...window.__scanV193N(host, 'YOUR GAME card')); r.lines = window.__hitsV193N.length
  host.remove()
  return r
})
await M(() => { try { window.__V178 && window.__V178.closeCard && window.__V178.closeCard() } catch (e) {} document.querySelectorAll('.decision-overlay,#simCardV178').forEach(x => x.remove()); window.go('season') })
await page.waitForTimeout(300)
// the pregame wizard: every page
const pre = await M(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const btn = [...document.querySelectorAll('button')].find(e => /PLAY WEEK \d+ LIVE/.test(e.innerText || ''))
  btn && btn.click()
  for (let i = 0; i < 80 && !document.getElementById('pregameV1513'); i++) { const g = document.getElementById('gv42go'); if (g && g.style.display !== 'none') g.click(); await sleep(250) }
  if (!document.getElementById('pregameV1513')) return { opened: false }
  await sleep(600)
  const pages = window.__V136_PAGES ? window.__V136_PAGES.active() : []
  let n = 0
  for (let i = 0; i < pages.length; i++) { window.__V112_D.go(i); await sleep(450); n += window.__scanAllV193N('pregame ' + pages[i]) }
  const sheet = !!document.querySelector('#pregameV1513 #preStatsV25')
  try { window.__V112_D.go(0); await sleep(200); window.__v112BackD() } catch (e) {}
  document.getElementById('pregameV1513')?.remove()
  return { opened: true, pages, n, sheet }
})
ok(pre.opened && pre.pages.length >= 5 && pre.sheet, 'the pregame wizard opened and every page was read (the stat sheet among them)', pre.pages)
// the rest of the season, then the report and the growth screen
const end = await M(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const A = window.__GRIDIRON_AUDIT__, S = () => A.getState(), P = () => S().player
  window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v156Bplayoffs = 0
  for (let k = 0; k < 40 && S().view !== 'result'; k++) {
    document.querySelectorAll('.decision-overlay,#simCardV178').forEach(x => x.remove())
    const left = (P().weekResults || []).filter(w => !w.played).length
    if (!left && P().weekResults) { window.finishSeasonGames(); await sleep(60); continue }
    window.simRemainingWeeks(); await sleep(60)
    if ((P().weekResults || []).filter(w => !w.played).length === left) { window.playWeek(false); await sleep(60) }
  }
  delete window.RIB_TUNE.v156Bplayoffs
  return { view: S().view }
})
ok(end.view === 'result', 'the season ended on the report', end)
await M(() => { document.getElementById('growV132')?.remove(); window.go('result') })
await page.waitForTimeout(400)
seen.result = await M(() => { document.getElementById('growV132')?.remove(); return { view: window.S.view, lines: window.__scanAllV193N('season report') } })
seen.grow = await visit('growth screen', async () => { window.__GROW_V132.show(); await new Promise(r => setTimeout(r, 300)); window.__GROW_V132.finish() }, 5200)
await M(() => { try { window.__GROW_V132.close() } catch (e) {} document.getElementById('growV132')?.remove() })
// re-seed the fractions (the season's growth rewrote them) and walk every stat screen
await M(() => { const A = window.__GRIDIRON_AUDIT__, p = A.getState().player, fr = [47.38, 12.5, 99.999, 33.333, 61.07, 20.25, 70.6667, 55.55, 41.01, 66.666, 18.4, 77.777, 50.5, 39.99, 88.123, 24.75, 58.3]; A.ATTRS.forEach((k, i) => { p.attrs[k] = fr[i % fr.length] }) })
seen.hub = await visit('hub', () => window.go('hub'))
seen.upgrade = await visit('skill sheet', () => window.go('upgrade'))
seen.rank = await visit('recruiting board', () => window.go('rank'))
seen.stats = await visit('leaders', () => window.go('stats'))
seen.profile = await visit('profile', () => window.go('profile'))
seen.locker = await visit('locker', () => window.go('locker'))
seen.compare = await visit('gear compare', () => { window.gearPickV147('fracV193N2') })
seen.training = await visit('training board', () => { window.startSeason() }, 600)
const hits = await M(() => window.__hitsV193N)
if (process.env.REPORT) { const seenTxt = new Set(); console.log('      hits (each line once, first screen it was seen on):'); hits.forEach(h => { const t = h.replace(/^[^·]*· /, ''); if (seenTxt.has(t)) return; seenTxt.add(t); console.log('        ' + h) }) }
ok(hits.length === 0, 'no stat screen shows a number with 2+ decimals, or a decimal on an attribute / OVR line', hits.slice(0, 12))
const want = { season: 'season', hub: 'hub', upgrade: 'upgrade', rank: 'rank', stats: 'stats', profile: 'profile', locker: 'locker', compare: 'locker', training: 'training', result: 'result' }
ok(Object.keys(want).every(k => seen[k] && seen[k].view === want[k]), 'every screen was visited (the view each visit landed on)', Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.view])))
ok(seen.hero.played && seen.hero.has.includes('#pgHeroV186') && seen.grow.has.includes('#growV132') && seen.compare.has.includes('.gear-cmp-v147') && seen.locker.has.includes('.gear-sum-v147') && seen.upgrade.has.includes('.up-group-v97') && seen.hub.has.includes('.poise-card-v192c'),
  'and each drew what it was visited for (YOUR GAME for the week just played, the growth screen, the gear compare and totals, the skill groups, the Poise card)', Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.has])))
ok(errs.length === 0, 'no page errors', errs.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
