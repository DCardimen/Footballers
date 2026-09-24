// Dev check (v147 C THE GEAR HAS A ROLL): gear rolls 0–3 modifiers by rarity, and every one is real.
//
// Asserts: the catalogue has 40–50 modifiers with unique keys, each naming its hook; over 2,500
// generated pieces the modifier count sits inside its rarity's band (Common 0–1, Rare 1, Epic 2,
// Legendary 3, Mythic 3), no piece carries the same modifier twice and a higher tier rolls bigger
// values; the roll is a pure function of the id; a piece survives a reload with the same roll; a
// pre-v147 save gets its modifiers ONCE, keyed on the id (the equipped copy and the inventory copy
// agree), and a second boot changes nothing; for a sample of modifiers spanning attributes,
// production, injury, fatigue, recovery, PP, trust, snaps, soft caps, fate odds, age, clutch,
// training and the call-up, equipping a piece moves the number the real hook reads and unequipping
// puts it back; totals are capped; the locker fits 400x860 with no page scroll and its compare view
// opens; no page errors.
//
//   node scripts/v147Ccheck.mjs        (GAME_URL=… to point it elsewhere)
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, gameUrl } from './lib/env.mjs'
const url = gameUrl('index.html')
const OUT = process.env.SHOT_DIR || '/tmp/claude-0/shots'
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.addInitScript(() => {
  try { localStorage.setItem('rib.coachTour.v119', '0'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
  setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove() }, 60)
})
const boot = async () => { await page.goto(url + (url.includes('?') ? '&' : '?') + 'stayStale', { waitUntil: 'networkidle', timeout: 30000 }); await page.waitForTimeout(1200) }
await boot()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
ok(await page.evaluate(() => !!window.__V147C), 'window.__V147C is mounted')

// ---- 1. the catalogue ----
const cat = await page.evaluate(() => window.__V147C.cat().map(c => ({ k: c.k, kind: c.kind, hook: c.hook, name: c.name })))
const keys = new Set(cat.map(c => c.k))
ok(cat.length >= 40 && cat.length <= 50, 'the catalogue has 40–50 modifiers', cat.length)
ok(keys.size === cat.length, 'every modifier key is unique')
ok(cat.every(c => c.hook && c.name), 'every modifier names its hook and its label')
console.log('kinds:', JSON.stringify(cat.reduce((a, c) => (a[c.kind] = (a[c.kind] || 0) + 1, a), {})))

// ---- 2. counts by rarity, over many pieces ----
const dist = await page.evaluate(() => {
  const V = window.__V147C, R = ['common', 'rare', 'epic', 'legendary', 'mythic'], out = {}, band = { common: [0, 1], rare: [1, 1], epic: [2, 2], legendary: [3, 3], mythic: [3, 3] }
  let bad = 0, dup = 0, n = 0
  for (const r of R) { const seen = {}; for (let i = 0; i < 500; i++) { const it = V.roll({ id: 'chk_' + r + '_' + i, rarity: r, slot: 'cleats' }, i % 9); n++
      const c = it.mods.length; seen[c] = (seen[c] || 0) + 1; if (c < band[r][0] || c > band[r][1]) bad++
      if (new Set(it.mods.map(m => m.k)).size !== c) dup++ } out[r] = seen }
  // a higher tier, and a rarer piece, roll bigger values of the same modifier
  const avg = (r, t) => { let s = 0, k = 0; for (let i = 0; i < 400; i++) { const it = V.roll({ id: 'tv_' + i, rarity: r }, t); it.mods.forEach(m => { if (m.k.startsWith('p_')) { s += m.v; k++ } }) } return k ? s / k : 0 }
  return { out, bad, dup, n, t0: avg('epic', 0), t7: avg('epic', 7), leg: avg('legendary', 0), myth: avg('mythic', 0) }
})
console.log('counts:', JSON.stringify(dist.out))
ok(dist.bad === 0, `every one of ${dist.n} pieces rolls a modifier count inside its rarity's band`, dist.bad)
ok(dist.out.common[0] > 0 && dist.out.common[1] > 0, 'Common rolls both 0 and 1')
ok(dist.dup === 0, 'no piece carries the same modifier twice')
ok(dist.t7 > dist.t0 * 1.4, 'a DFL-tier piece rolls bigger values than a Pee Wee one', `${dist.t0.toFixed(3)} → ${dist.t7.toFixed(3)}`)
ok(dist.myth > dist.leg, 'a Mythic rolls bigger than a Legendary', `${dist.leg.toFixed(3)} → ${dist.myth.toFixed(3)}`)
const pure = await page.evaluate(() => { const V = window.__V147C; const a = V.roll({ id: 'same_id', rarity: 'legendary' }, 3), b = V.roll({ id: 'same_id', rarity: 'legendary' }, 3); return JSON.stringify(a.mods) === JSON.stringify(b.mods) })
ok(pure, 'the roll is a pure function of the id')

// ---- 3. a real drop, stable across a reload ----
const SAVE = 'gridiron_save_v1'
const drop = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S
  const p = A.newPlayer(S, 'RB'); p.pos = 'RB'; S.player = p; S.inventory = []; S.equipped = {}
  const it = window.__V147C.make(3); S.inventory.push(it); window.go('menu')
  return { id: it.id, mods: it.mods, tier: it.tierV147, flag: it.modsV147 }
})
ok(drop.flag === 1 && Array.isArray(drop.mods) && drop.mods.length >= 2, 'a real drop (Kr) carries its roll', JSON.stringify(drop.mods))
await boot()
const again = await page.evaluate((id) => { const it = (window.S.inventory || []).find(x => x.id === id); return it && JSON.stringify(it.mods) }, drop.id)
ok(again === JSON.stringify(drop.mods), 'the roll survives a reload unchanged')

// ---- 4. a pre-v147 save is migrated once ----
await page.evaluate((SAVE) => {
  const st = JSON.parse(localStorage.getItem(SAVE) || JSON.stringify(window.S))
  const old = [{ id: '1700000000000_321', slot: 'gloves', rarity: 'epic', name: 'Vapor Gloves', eff: 'ppMult', val: .14, icon: '🧤' },
    { id: '1700000000001_654', slot: 'cleats', rarity: 'legendary', name: 'Golden Cleats', eff: 'power', val: 5.4, icon: '👟' },
    { id: '1700000000002_987', slot: 'chain', rarity: 'common', name: 'Worn Chain', eff: 'growth', val: .03, icon: '📿' }]
  st.inventory = old; st.equipped = { gloves: JSON.parse(JSON.stringify(old[0])) }
  localStorage.setItem(SAVE, JSON.stringify(st)); localStorage.removeItem(SAVE + '_backup')
}, SAVE)
await boot()
const mig = await page.evaluate(() => { const S = window.S; window.go('locker'); const inv = S.inventory.map(i => ({ id: i.id, f: i.modsV147, m: JSON.stringify(i.mods) })), eq = S.equipped.gloves
  const expect = S.inventory.map(i => JSON.stringify(window.__V147C.roll({ id: i.id, rarity: i.rarity }, 0).mods))
  window.go('menu'); return { inv, eq: eq && JSON.stringify(eq.mods), expect } })
ok(mig.inv.every(i => i.f === 1), 'every old piece is given its modifiers', JSON.stringify(mig.inv.map(i => i.m)))
ok(mig.inv.every((i, n) => i.m === mig.expect[n]), 'and the migration is the id-keyed roll')
ok(mig.eq === mig.inv.find(i => i.id === '1700000000000_321').m, 'the equipped copy and the inventory copy rolled the same')
await boot()
const mig2 = await page.evaluate(() => { const n = window.__V147C.migrate(); return { n, m: window.S.inventory.map(i => JSON.stringify(i.mods)) } })
ok(mig2.n === 0 && mig2.m.every((m, i) => m === mig.inv[i].m), 'a second boot migrates nothing and moves nothing', mig2.n)

// ---- 5. the hooks move ----
const hooks = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S, V = window.__V147C
  const p = A.newPlayer(S, 'RB'); p.pos = 'RB'; p.level = 4; p.age = 34; p.stars = 3; S.player = p; S.equipped = {}
  if (!p.conditionV11) p.conditionV11 = { fatigue: 30, recovery: 55, susceptibility: 18 }
  const piece = (k, v) => ({ id: 'probe_' + k, slot: 'chain', rarity: 'mythic', name: 'Probe', eff: 'growth', val: 0, icon: '📿', modsV147: 1, tierV147: 0, mods: [{ k, v }] })
  const read = {
    a_speed: () => V.effAttrs(p).eff.speed,
    a_tackling: () => V.effAttrs(p).eff.tackling,
    p_rushYds: () => V.seasonLine('RB', 70, 4).rushYds,
    p_ypc: () => V.seasonLine('RB', 70, 4).ypc,
    injChance: () => window.__injChanceV54(p, {}),
    injDur: () => V.heal(6),
    fatigueGain: () => V.wearFatK(),
    recovery: () => V.recovMul(),
    ppGain: () => V.ppMul(),
    trustGain: () => V.trustMul(),
    snapShare: () => V.trustShare(p),
    softCap: () => V.softCap(p, 'speed'),
    fateOdds: () => V.fateOdds('grind'),
    ageDecline: () => V.ageCut(p),
    clutch: () => V.clutch(p),
    training: () => V.trainMul(),
    callUp: () => A.advanceChance(A.LEVELS[5].need + 14, 4, 'RB', 82),
  }
  const val = { a_speed: 8, a_tackling: 8, p_rushYds: .2, p_ypc: .2, injChance: .2, injDur: .3, fatigueGain: .2, recovery: .3, ppGain: .2, trustGain: .3, snapShare: .08, softCap: .03, fateOdds: .06, ageDecline: .25, clutch: 6, training: .2, callUp: 3 }
  const out = {}
  for (const k in read) { S.equipped = {}; const off = read[k](); S.equipped = { chain: piece(k, val[k]) }; const on = read[k](); const got = V.get(k); S.equipped = {}; const back = read[k]()
    out[k] = { off, on, back, got } }
  // the cap: two Mythics on one attribute cannot pass gearAttrCapV147
  S.equipped = { chain: piece('a_speed', 18), gloves: Object.assign(piece('a_speed', 18), { id: 'probe2', slot: 'gloves' }) }
  const capped = V.get('a_speed'); S.equipped = {}
  return { out, capped }
})
for (const [k, r] of Object.entries(hooks.out)) {
  ok(r.on !== r.off && r.back === r.off && r.got > 0, `equipping ${k} moves its hook, unequipping restores it`, `${r.off} → ${r.on} → ${r.back}`)
}
ok(Object.keys(hooks.out).length >= 10, 'at least ten modifier types probed', Object.keys(hooks.out).length)
ok(hooks.capped === 20, 'two Mythic +18 Speed rolls are capped at gearAttrCapV147 (20)', hooks.capped)
// direction: a good modifier is good
const d = hooks.out
ok(d.a_speed.on > d.a_speed.off && d.p_rushYds.on > d.p_rushYds.off && d.injChance.on < d.injChance.off && d.injDur.on < d.injDur.off && d.fatigueGain.on < d.fatigueGain.off && d.ageDecline.on < d.ageDecline.off && d.callUp.on > d.callUp.off,
  'every probed modifier points the right way')

// ---- 6. the locker screen ----
await page.evaluate(() => {
  const S = window.S, V = window.__V147C; S.inventory = []; S.equipped = {}
  const R = ['common', 'rare', 'epic', 'legendary', 'mythic'], slots = ['cleats', 'gloves', 'chain'], eff = ['power', 'perfFlat', 'ppMult', 'growth', 'injDown', 'startAll', 'pointsFlat']
  for (let i = 0; i < 24; i++) S.inventory.push(V.roll({ id: 'lk_' + i, slot: slots[i % 3], rarity: R[i % 5], name: ['Worn', 'Custom', 'Phantom', 'Golden', 'GOAT'][i % 5] + ' ' + ['Cleats', 'Gloves', 'Chain'][i % 3], eff: eff[i % 7], val: { power: 3, perfFlat: 2, ppMult: .08, growth: .05, injDown: .08, startAll: 3, pointsFlat: 2 }[eff[i % 7]], icon: ['👟', '🧤', '📿'][i % 3] }, i % 8))
  S.equipped = { gloves: S.inventory[4], cleats: S.inventory[3], chain: S.inventory[2] }
  window.go('locker')
})
await page.waitForTimeout(2500)
await page.evaluate(() => { try { document.getElementById('splash')?.remove(); window.closeTeamCreatorV153 && window.closeTeamCreatorV153(); document.getElementById('teamModalV153')?.remove() } catch (e) {} })
await page.waitForTimeout(500)
const lk = await page.evaluate(() => {
  const a = document.getElementById('app'), sc = document.getElementById('screen'), list = document.querySelector('.gear-list-v147')
  return { page: document.scrollingElement.scrollHeight - innerHeight, app: a.scrollHeight - a.clientHeight, rows: document.querySelectorAll('.gear-row').length,
    sum: (document.querySelector('.gear-sum-v147') || {}).innerText || '', listScroll: list ? list.scrollHeight > list.clientHeight : null, panelOver: sc.scrollHeight - sc.clientHeight }
})
await page.screenshot({ path: `${OUT}/v147C_locker.png` })
ok(lk.rows === 24, 'the locker lists every piece', lk.rows)
ok(lk.page <= 1 && lk.app <= 1, 'the locker fits 400x860 with no page scroll', JSON.stringify(lk))
ok(/TOTAL GEAR BONUSES/.test(lk.sum) && /[+−]\d/.test(lk.sum), 'the total gear bonuses card reads as lines', lk.sum.replace(/\s+/g, ' ').slice(0, 160))
await page.evaluate(() => { const r = document.querySelectorAll('.gear-row')[6]; r.querySelector('.gr-info').click() })
await page.waitForTimeout(700)
const cmp = await page.evaluate(() => { const c = document.querySelector('.gear-cmp-v147'); return c ? { txt: c.innerText, rows: c.querySelectorAll('.gc-row-v147').length, page: document.scrollingElement.scrollHeight - innerHeight, app: (a => a.scrollHeight - a.clientHeight)(document.getElementById('app')) } : null })
await page.screenshot({ path: `${OUT}/v147C_compare.png` })
ok(cmp && cmp.rows > 0 && /vs |EQUIPPED|slot is empty/.test(cmp.txt), 'tapping a piece opens its compare view against the slot', cmp && cmp.txt.replace(/\s+/g, ' ').slice(0, 140))
ok(cmp && cmp.page <= 1 && cmp.app <= 1, 'and the page still does not scroll', cmp && JSON.stringify({ page: cmp.page, app: cmp.app }))
const eqd = await page.evaluate(() => { const b = [...document.querySelectorAll('.gear-cmp-v147 button')].find(x => /EQUIP/.test(x.textContent) && !/UN/.test(x.textContent)); const id = b && b.closest('.gear-row').dataset.gear; b && b.click(); const it = window.S.inventory.find(i => i.id === id); return it && window.S.equipped[it.slot] && window.S.equipped[it.slot].id === id })
ok(eqd, 'EQUIP from the compare view equips that piece')
// the pregame sheet reads the gear
const sheet = await page.evaluate(() => { const S = window.S, p = S.player, V = window.__V147C; S.equipped = {}; const a = V.effAttrs(p).eff.speed
  S.equipped = { chain: { id: 'sh', slot: 'chain', rarity: 'mythic', eff: 'growth', val: 0, modsV147: 1, mods: [{ k: 'a_speed', v: 9 }] } }; const b = V.effAttrs(p); S.equipped = {}; return { a, b: b.eff.speed, g: b.gear.speed } })
ok(sheet.b - sheet.a === 9 && sheet.g === 9, 'the effective sheet (effAttrsV85 → pregame sheet) carries the gear', JSON.stringify(sheet))

ok(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '))
console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errs.length)
await browser.close()
process.exit(fail ? 1 : 0)
