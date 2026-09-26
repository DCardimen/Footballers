// Dev check: v156 C — THE 4× IS WON IN THE TITLE GAME (src/07) · EARNED LOOKS, MEMBER LOOKS, SUPER LOOKS (src/28) ·
// SUPER CHALLENGES (src/29). The owner's calls (docs/MONETIZATION.md §1a, docs/SEASONS.md §8), at a 400x860 phone:
//   1. speed: a UFF save (bestLevel 7) has neither 3× nor 4×; a finished UFF season (a level-7 log row) opens 3×; a
//      lost title game, a won Wild Card and a won Conference Final do not open 4×, the won LEAGUE CHAMPIONSHIP does —
//      played through the real finishWeekGame chain — with "🏆 UFF CHAMPIONS — 4× UNLOCKED"; the lock texts; a ring
//      or `dflMvpTitle` in an old save grandfathers 4×; TU v156Cspeed 0 restores v151 A's rule
//   2. OFF stays a no-op: no store UI or storage, and the member looks never touch RIB_MONETIZE.has
//   3. member looks: listed, locked "🔒 Membership" in the Locker, never owned, never granted, never equippable
//   4. grandfathered: a cosmetics store written before v156 C keeps what it owned (and what its old achievements had
//      earned), equipped; a fresh store owns none of it
//   5. harder achievements: `hof` needs a Hall career that made the UFF, `mvp` a League MVP; 5 UFF rings open the
//      "waaay later" Crown of the League and Phoenix wings; angel wings are never granted by hof, pass or earned, and
//      no Career Pass reward in 12 seasons draws angel-style wings
//   6. super challenges: each one progresses and grants its mythic look exactly once (Top 10 for 10 days, Interstellar
//      at all nine positions → Angel Wings, MVP + Interstellar inside 14 seasons, 10 UFF rings, Legacy medal 500)
//   7. the SUPER CHALLENGES section renders on the SEASON tab with progress bars and drawn previews, fitting 400x860
//   8. seeded games are identical with v156 C on and off; no page errors
//   GAME_URL=http://localhost:5491/index.html node scripts/v156Ccheck.mjs
import fs from 'node:fs'
import { launch, gameUrl } from './lib/env.mjs'
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots/'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const browser = await launch()
const page = await browser.newPage({ viewport: { width: 400, height: 860 } })
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')))
await page.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const E = (fn, arg) => page.evaluate(fn, arg)
const url = gameUrl('index.html?stayStale&noFilmV114')
const boot = async () => {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => window.__GRIDIRON_AUDIT__ && window.RIB_COSMETICS && window.RIB_SEASONS && window.RIB_SUPER && window.__V156C && window.__V151A, null, { timeout: 60000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(900)
}
await boot(); await boot()   // warm past vite's one-time reload
const shot = async (n) => { try { await page.evaluate(() => document.querySelectorAll('#personaV13, .lgm-v152, #uffMomentV156C, .onboard').forEach((x) => x.remove())); await page.screenshot({ path: SHOTS + 'v156C-' + n + '.png' }) } catch {} }   // the shot is of the screen, not a first-week card over it
const fits = () => E(() => { const se = document.scrollingElement; return { page: se.scrollHeight <= innerHeight + 2 && se.scrollWidth <= innerWidth + 2, w: se.scrollWidth, h: se.scrollHeight } })
// a fresh account with a level-7 player and a season in hand; `extra` is merged into the state first
const seed = (o = {}) => E((o) => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true
  Object.assign(S, o.state || {}); S.player = A.newPlayer(); S.player.name = 'Test Man'; S.player.pos = o.pos || 'QB'; S.player.level = o.level == null ? 7 : o.level
  Object.assign(S.player, o.player || {}); A.setState(S)
  if (o.season !== false) { try { window.startSeasonGames() } catch (e) {} document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }
  return true }, o)

// ================= 1. the speed gates =================
await seed({ state: { bestLevel: 7, nflReached: 1 } })
const s0 = await E(() => { const V = window.__V151A, g = V.gates(); return { s3: V.speedOk(3), s4: V.speedOk(4), w3: g.speed3.why, w4: g.speed4.why, gf: window.S.gatesV156C > 0, flags: [!!window.S.uffSeasonV156C, !!window.S.uffTitleV156C], txt: window.__V156C.speedText('lock', 3) + ' | ' + window.__V156C.speedText('lock', 4) } })
ok(!s0.s3 && !s0.s4 && s0.w3 === 'Finish a full UFF season' && s0.w4 === 'Win the UFF championship' && s0.gf && !s0.flags[0] && !s0.flags[1], 'a UFF save (bestLevel 7, no finished UFF season, no title) has neither 3× nor 4×', s0)
ok(s0.txt === '3× unlocks after a full UFF season | 4× unlocks by winning the UFF championship (or with membership)', 'the lock texts are the owner\'s', s0.txt)
// a full UFF season logged (the season-end report) opens 3×
const s1 = await E(() => { const e = window.S.player; e.seasonLogV77 = [{ n: 7, level: 7, pos: 'QB', champion: false, awards: [] }]; window.__V156C.sync(true)
  return { s3: window.__V151A.speedOk(3), s4: window.__V151A.speedOk(4), how: window.S.uffSeasonV156C && window.S.uffSeasonV156C.how, moment: (document.getElementById('uffMomentV156C') || {}).textContent || '' } })
ok(s1.s3 && !s1.s4 && s1.how === 'season' && /3× UNLOCKED/.test(s1.moment), 'a finished UFF season opens 3× (not 4×), with its moment', s1)
// the playoffs through the real finishWeekGame chain: the Wild Card and the Conference Final won do not open 4×; the title game does
const po = await E(async () => { const st = window.S, e = st.player, out = []
  e.weekResults.forEach((w) => { if (!w.playoff) { w.played = true; w.won = true; w.us = 21; w.them = 7 } })
  document.getElementById('uffMomentV156C')?.remove()
  for (let k = 0; k < 4; k++) {
    window.go('season'); await new Promise((r) => setTimeout(r, 300))
    const w = e.weekResults[e.weekResults.length - 1]; if (!w.playoff || w.played) break
    e.currentWeek = e.weekResults.length - 1
    let g; for (let t = 0; t < 40; t++) { g = window.__simGameV2(80, 'QB'); if (g.usScore > g.themScore) break }
    st._liveGame = g; window.finishWeekGame(); await new Promise((r) => setTimeout(r, 450))
    if (document.getElementById('pgOverlayV13') && window.__pgContinueV13) window.__pgContinueV13()   // the post-game card's Continue books the week
    await new Promise((r) => setTimeout(r, 400))
    out.push({ round: w.round, won: w.won, s4: window.__V151A.speedOk(4), moment: (document.getElementById('uffMomentV156C') || {}).textContent || '' })
  }
  return { out, flag: st.uffTitleV156C, champ: !!(e.playoffState && e.playoffState.champion) } })
const last = po.out[po.out.length - 1] || {}
ok(po.out.length === 3 && po.out.slice(0, -1).every((r) => r.won && !r.s4 && !/4×/.test(r.moment)), 'a won Wild Card and a won Conference Final do not open 4×', po.out)
ok(last.round === 'LEAGUE CHAMPIONSHIP' && last.won && last.s4 && po.flag && po.flag.how === 'game' && po.champ && /UFF CHAMPIONS — 4× UNLOCKED/.test(last.moment), 'the won LEAGUE CHAMPIONSHIP (played live, through finishWeekGame) opens 4× with "🏆 UFF CHAMPIONS — 4× UNLOCKED"', { last, flag: po.flag })
// a lost title game does not; neither does a won national (college) title; the flag is account-wide (a new career keeps it)
const neg = await E(() => { const e = window.S.player, T = window.__V156C.titleGame
  const keep = window.S.uffTitleV156C; delete window.S.uffTitleV156C
  const lost = T(e, { playoff: true, round: 'LEAGUE CHAMPIONSHIP', roundIdx: 2, won: false }), semi = T(e, { playoff: true, round: 'Conference Final', roundIdx: 1, won: true })
  e.level = 5; const col = T(e, { playoff: true, round: 'NATIONAL CHAMPIONSHIP', roundIdx: 1, won: true }); e.level = 7
  const isl = (() => { e.level = 8; const r = T(e, { playoff: true, round: 'THE INTERSTELLAR CHAMPIONSHIP', roundIdx: 3, won: true }); e.level = 7; return r })()
  const after = !!window.S.uffTitleV156C; window.S.uffTitleV156C = keep
  const A = window.__GRIDIRON_AUDIT__; window.S.player = A.newPlayer(); window.S.player.level = 0
  return { lost, semi, col, isl, after, newCareer4: window.__V151A.speedOk(4), newCareer3: window.__V151A.speedOk(3) } })
ok(!neg.lost && !neg.semi && !neg.col && neg.isl && neg.newCareer4 && neg.newCareer3, 'a lost title game, a semifinal and a college title open nothing; the Interstellar title counts (level ≥ 7); a new career keeps 3× and 4×', neg)
// grandfathering and the kill switch
const gf = await E(() => { const A = window.__GRIDIRON_AUDIT__, V = window.__V151A, out = {}
  let S = A.freshState(); S.challenges = { dflMvpTitle: true }; A.setState(S); out.mvpTitle = V.speedOk(4)
  S = A.freshState(); S.rings = 1; A.setState(S); out.ring = V.speedOk(4); out.how = S.uffTitleV156C && S.uffTitleV156C.how
  S = A.freshState(); S.hof = [{ name: 'Old', pos: 'RB', rings: 0, reached: 7, box: { log: [{ n: 8, level: 7, champion: false, awards: [] }] } }]; A.setState(S); out.hof3 = V.speedOk(3); out.hof4 = V.speedOk(4)
  S = A.freshState(); S.bestLevel = 7; A.setState(S); window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v156Cspeed: 0 }); out.kill4 = V.speedOk(4); out.kill3 = V.speedOk(3); out.killWhy = V.speedWhy(4)
  window.RIB_TUNE.v156Cspeed = 1; out.back4 = V.speedOk(4)
  return out })
ok(gf.mvpTitle && gf.ring && gf.how === 'grandfather' && gf.hof3 && !gf.hof4, 'an old save grandfathers: dflMvpTitle or a ring → 4×; a Hall career with a UFF season → 3× only', gf)
ok(gf.kill4 && gf.kill3 && gf.killWhy === 'Reach the UFF' && !gf.back4, 'TU v156Cspeed 0 restores v151 A (3× and 4× at the UFF while the store is off)', gf)

// ================= 2. OFF is a no-op =================
const off = await E(() => { const R = window.RIB_MONETIZE, C = window.RIB_COSMETICS
  const mem = C.catalog().filter((i) => i.source === 'member'); let calls = 0; const h = R.has; R.has = function () { calls++; return h.apply(this, arguments) }
  let own = 0, lst = 0; try { mem.forEach((i) => { if (C.owned(i.id)) own++; if (C.listed(i)) lst++ }); C.equip(mem[0].cat, mem[0].id) } finally { R.has = h }
  return { on: R.enabled, keys: Object.keys(localStorage).filter((k) => /monetize/.test(k)), nodes: document.querySelectorAll('[id^="mz149"],[class*="mz149"],[class*="mz151"]').length, n: mem.length, own, lst, calls, member: C.member() } })
ok(!off.on && !off.keys.length && !off.nodes && off.calls === 0 && off.member === false, 'OFF: no store UI or storage, and the member looks never call RIB_MONETIZE.has', off)

// ================= 3. member looks =================
await E(() => { window.RIB_COSMETICS._reset() })
const mb = await E(() => { const C = window.RIB_COSMETICS, all = C.catalog(), mem = all.filter((i) => i.source === 'member')
  const r = window.__V156C.rules(), want = Object.keys(r).filter((k) => r[k] === 'member')
  return { n: mem.length, want: want.length, all: want.every((id) => mem.some((i) => i.id === id)), listed: mem.every((i) => C.listed(i)), owned: mem.filter((i) => C.owned(i.id)).length,
    grant: mem.map((i) => C.grant(i.id, 'earned')).filter(Boolean).length, equip: C.equip('wings', 'wings_seraph'), how: C.howTo(all.find((i) => i.id === 'wings_seraph')),
    rar: mem.filter((i) => /legendary|mythic/.test(i.rarity)).length, kinds: [...new Set(mem.map((i) => i.cat))].sort().join(',') } })
ok(mb.n >= 30 && mb.all && mb.listed && mb.owned === 0 && mb.grant === 0 && mb.equip === false && mb.how === 'Membership', 'the member looks are listed, never owned, never granted, never equippable while the store is off', mb)
ok(mb.rar >= 20 && /aura/.test(mb.kinds) && /wings/.test(mb.kinds) && /crown/.test(mb.kinds) && /uniform/.test(mb.kinds) && /helmet/.test(mb.kinds) && /trail/.test(mb.kinds), 'most legendary / mythic looks and the flashy kinds are member looks', mb.kinds)
await E(() => { window.go('locker') }); await page.waitForTimeout(900)
await E(() => { const t = document.querySelector('.hubv75-tab[data-sec="style"]'); t && t.click() }); await page.waitForTimeout(500)
await E(() => window.cosCatV151B('wings')); await page.waitForTimeout(700)
const lk = await E(() => { const it = document.querySelector('.cos-item-v151b[data-cos="wings_seraph"]'), an = document.querySelector('.cos-item-v151b[data-cos="wings_angel"]')
  const eq0 = window.RIB_COSMETICS.equipped('wings'); it && it.click()
  return { seraph: it ? it.textContent : null, locked: !!(it && it.classList.contains('locked')), angel: an ? an.textContent : null, eq: window.RIB_COSMETICS.equipped('wings'), eq0 } })
ok(lk.locked && /🔒 Membership/.test(lk.seraph || '') && lk.eq === lk.eq0 && /Super challenge/.test(lk.angel || ''), 'the Locker lists a member look "🔒 Membership" (a tap equips nothing) and Angel Wings as a super challenge', lk)
await shot('locker-member')

// ================= 4. grandfathered =================
const gfc = await E(() => { const C = window.RIB_COSMETICS
  localStorage.setItem('rib.cosmetics.v1', JSON.stringify({ v: 1, owned: { uni_marble: { source: 'earned', at: 1 }, frame_gold: { source: 'earned', at: 1 } }, equipped: { uniform: 'uni_marble', wings: 'wings_angel' }, ach: { hof: 1, title: 1 } }))
  window.__V156C.reloadCosmetics()
  const out = { marble: C.owned('uni_marble'), angel: C.owned('wings_angel'), halo: C.owned('crown_halo'), holo: C.owned('frame_holo'), eqU: C.equipped('uniform'), eqW: C.equipped('wings'), gf: window.__V156C.grandfathered().length }
  const back = JSON.parse(localStorage.getItem('rib.cosmetics.v1')); out.stored = !!back.v156C && !!back.gf156 && !!back.gf156.uni_marble
  C._reset(); out.fresh = [C.owned('uni_marble'), C.owned('wings_angel'), C.owned('crown_halo')].some(Boolean)
  return out })
ok(gfc.marble && gfc.angel && gfc.halo && !gfc.holo && gfc.eqU === 'uni_marble' && gfc.eqW === 'wings_angel' && gfc.stored && !gfc.fresh, 'a store from before v156 C keeps what it owned and what its old achievements earned (still equipped); a fresh store owns none of it', gfc)

// ================= 5. harder achievements, angel wings =================
const ach = await E(() => { const C = window.RIB_COSMETICS, A = window.__GRIDIRON_AUDIT__, S = A.freshState(); C._reset()
  S.hof = [{ name: 'Short', pos: 'RB', won: false, reached: 3, rings: 0, goat: 10, box: { log: [{ n: 3, level: 4, champion: false, awards: ['🏆 State Player of the Year'] }] } }]; A.setState(S)
  const g0 = C.checkEarned(S), a0 = C.account(S)
  S.hof.push({ name: 'Pro', pos: 'QB', won: true, reached: 7, rings: 5, goat: 900, box: { log: [{ n: 6, level: 5, champion: false, awards: ['🏆 League MVP'] }, { n: 9, level: 7, champion: true, awards: [] }] } })
  const g1 = C.checkEarned(S), a1 = C.account(S)
  return { a0: [a0.hofWon, a0.leagueMvps, a0.mvps], a1: [a1.hofWon, a1.leagueMvps, a1.uffRings], g0, g1, angel: C.owned('wings_angel'), king: C.owned('crown_king'), phoenix: C.owned('wings_phoenix'), mvpCrown: C.owned('crown_mvp'),
    gAngel: [C.grant('wings_angel', 'earned'), C.grant('wings_angel', 'pass')], angelOwned: C.owned('wings_angel') } })
ok(ach.a0[0] === 0 && ach.a0[1] === 0 && ach.a0[2] === 1 && ach.g0.length === 0, 'a Hall career that never made the UFF is not "Hall of Fame", and a high-school Player of the Year is not an MVP', { a0: ach.a0, g0: ach.g0 })
ok(ach.a1[0] === 1 && ach.a1[1] === 1 && ach.a1[2] >= 5 && ach.king && ach.phoenix && ach.mvpCrown, 'a UFF Hall career, a League MVP and 5 UFF rings open the waaay-later Crown of the League, Phoenix wings and the Golden Laurel', { a1: ach.a1, got: ach.g1 })
ok(!ach.angel && ach.gAngel.every((x) => x === false) && !ach.angelOwned && !ach.g1.includes('wings_angel'), 'angel wings are not granted by hof, by an earned grant or by a pass grant', ach.gAngel)
const pa = await E(() => { const S = window.RIB_SEASONS, C = window.RIB_COSMETICS; let wings = 0, angel = []
  for (let n = 1; n <= 12; n++) { const R = S.rewards('s' + n); R.free.concat(R.premium).filter((r) => r.kind === 'wings').forEach((r) => { wings++; const it = C.passItem(r); if (r.style === 'angel' || /Angel/.test(r.name) || (it && it.w && it.w.kind === 'angel')) angel.push(r.id) }) }
  return { wings, angel } })
ok(pa.wings >= 40 && pa.angel.length === 0, 'no Career Pass reward in 12 seasons draws angel-style wings', pa)

// ================= 6. super challenges =================
const sup = await E(() => { const C = window.RIB_COSMETICS, V = window.__V156C, A = window.__GRIDIRON_AUDIT__, R = window.RIB_SUPER; C._reset(); V.resetSuper(); const lbAll = window.__lb.career.all().length; window.__lb.career._reset()   // an empty season board: only the recorded days count
  const S = A.freshState(); S.tutorialSeen = true; A.setState(S)
  const cnt = (id) => window.__V151B.grants.filter((g) => g.id === id).length, own = (id) => C.owned(id), out = {}
  // Top 10 for 10 days
  for (let d = 1; d <= 9; d++) V.recordDay('2026-08-0' + d)
  R.tick(S); out.lad9 = [own('crown_ladder'), R.progress().find((c) => c.id === 'ladder10').have]
  V.recordDay('2026-08-10'); R.tick(S); R.tick(S); out.lad10 = [own('crown_ladder'), cnt('crown_ladder')]
  // Interstellar at all nine positions: eight in the Hall, the ninth in the career being played
  const hofRow = (pos, rows, extra) => Object.assign({ name: pos + ' man', pos, won: true, reached: 8, rings: 1, goat: 500, box: { log: rows } }, extra || {})
  S.hof = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB'].map((p) => hofRow(p, [{ n: 16, level: 8, champion: true, awards: [] }]))
  R.tick(S); out.pos8 = [own('wings_angel'), R.progress().find((c) => c.id === 'allPositions').have, own('aura_supernova')]
  S.player = A.newPlayer(); S.player.pos = 'S'; S.player.level = 8; S.player.seasonLogV77 = [{ n: 17, level: 8, pos: 'S', champion: true, awards: [] }]
  R.tick(S); R.tick(S); out.pos9 = [own('wings_angel'), cnt('wings_angel'), window.__V151B.grants.filter((g) => g.id === 'wings_angel').map((g) => g.source).join()]
  // MVP and the Interstellar title within 14 seasons (one career)
  S.hof.push(hofRow('QB', [{ n: 4, level: 5, champion: false, awards: ['🏆 League MVP'] }, { n: 15, level: 8, champion: true, awards: [] }])); R.tick(S); out.mvp15 = [own('aura_supernova'), R.progress().find((c) => c.id === 'mvpInterstellar').have]
  S.hof.push(hofRow('RB', [{ n: 5, level: 5, champion: false, awards: ['🏆 League MVP'] }, { n: 13, level: 8, champion: true, awards: [] }])); R.tick(S); R.tick(S); out.mvp13 = [own('aura_supernova'), cnt('aura_supernova')]
  // Gold Rush: 10 UFF rings (the Hall now holds 11 careers with a ring each)
  out.gold = [own('trail_goldrush'), cnt('trail_goldrush'), R.progress().find((c) => c.id === 'goldRush').have]
  // The Ultimate: Legacy medal 500
  out.ult0 = own('frame_ultimate'); S.legacyV152 = { xp: window.__V152A.xpAt(500) + 1 }; R.tick(S); R.tick(S); out.ult = [own('frame_ultimate'), cnt('frame_ultimate'), window.__V152A.rank(S.legacyV152.xp).medal]
  out.store = V.superStore(); out.done = Object.keys(out.store.done).sort().join(','); out.inSave = /rib\.super|crown_ladder/.test(localStorage.getItem('gridiron_save_v1') || '')
  // super looks equip (they are OWNED), and the kill switch hides the section's source
  out.lbAll = lbAll; out.eq = [C.equip('wings', 'wings_angel'), C.equip('crown', 'crown_ladder'), C.equip('aura', 'aura_supernova'), C.equip('trail', 'trail_goldrush'), C.equip('frame', 'frame_ultimate')]
  return out })
ok(sup.lad9[0] === false && sup.lad9[1] === 9 && sup.lad10[0] && sup.lad10[1] === 1, 'Top 10 for 10 Days: 9 days progress, the 10th grants the Ladder Laurel — once', { lad9: sup.lad9, lad10: sup.lad10 })
ok(sup.pos8[0] === false && sup.pos8[1] === 8 && sup.pos8[2] === false && sup.pos9[0] && sup.pos9[1] === 1 && sup.pos9[2] === 'super', 'Interstellar at every position: 8 of 9 progress; the ninth (the career being played) grants Angel Wings — once, from the super challenge', { pos8: sup.pos8, pos9: sup.pos9 })
ok(sup.mvp15[0] === false && sup.mvp15[1] === 1 && sup.mvp13[0] && sup.mvp13[1] === 1, 'MVP to the Stars: MVP + Interstellar in season 15 is not enough; inside 14 seasons grants Supernova — once', { mvp15: sup.mvp15, mvp13: sup.mvp13 })
ok(sup.gold[0] && sup.gold[1] === 1 && sup.gold[2] === 10 && !sup.ult0 && sup.ult[0] && sup.ult[1] === 1 && sup.ult[2] === 500, 'Gold Rush at 10 UFF rings and The Ultimate at Legacy medal 500 each grant once', { gold: sup.gold, ult: sup.ult })
ok(sup.done === 'allPositions,goldRush,ladder10,mvpInterstellar,ultimate' && !sup.inSave && sup.eq.every(Boolean), 'the super store (rib.super.v1, outside the save) records all five; every super look equips', { done: sup.done, eq: sup.eq })

// ================= 7. the SUPER CHALLENGES section =================
await E(() => { window.RIB_COSMETICS.equip('frame', null); window.__V156C.resetSuper(); window.__V156C.recordDay('2026-08-01'); window.__seasonsUI.tab = 'season'; window.go('seasons') }); await page.waitForTimeout(1600)
const sec = await E(() => { const s = document.getElementById('ss156Super'); if (!s) return null
  const rows = [...s.querySelectorAll('.ss156-sup')]
  return { n: rows.length, ids: rows.map((r) => r.dataset.sup).join(','), bars: s.querySelectorAll('.ss151-bar').length, pv: s.querySelectorAll('.cos-pvbox-v151b canvas, .cos-pvbox-v151b div').length, pos: s.querySelectorAll('.ss156-pos i').length,
    text: s.textContent.replace(/\s+/g, ' ').slice(0, 900), vis: s.getBoundingClientRect().height > 100 } })
ok(sec && sec.n === 5 && sec.bars === 5 && sec.pv >= 5 && sec.pos === 9 && sec.vis && /Angel Wings/.test(sec.text || '') && /1\/10/.test(sec.text || ''), 'the SEASON tab shows SUPER CHALLENGES: five rows with progress bars, drawn reward previews and the nine positions', sec)
await E(() => { const s = document.getElementById('ss156Super'); s && s.scrollIntoView({ block: 'start' }) }); await page.waitForTimeout(300)
await shot('super-section')
const sf = await fits(); ok(sf.page, 'the SEASON tab with the super section fits 400x860 with no page scroll', sf)
await E(() => { window.__seasonsUI.go('pass'); window.__seasonsUI.subtab('challenges') }); await page.waitForTimeout(500)
ok(await E(() => !!document.querySelector('.ss151-body[data-tab="pass"] #ss156Super')), 'the PASS › CHALLENGES tab carries the super section too')

// ================= 8. no gameplay change =================
const neutral = await E(() => { const seedRun = () => { let s = 9001; const orig = Math.random; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let v = Math.imul(s ^ s >>> 15, 1 | s); v = v + Math.imul(v ^ v >>> 7, 61 | v) ^ v; return ((v ^ v >>> 14) >>> 0) / 4294967296 }
    const out = []; try { for (let g = 0; g < 5; g++) { const r = window.__simGameV2(52 + g * 5, ['QB', 'RB', 'WR', 'LB', 'CB'][g]); out.push([r.usScore, r.themScore, r.plays.length]) } } finally { Math.random = orig } return JSON.stringify(out) }
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v156Ccos: 1, v156Cspeed: 1 }); const a = seedRun()
  window.RIB_TUNE.v156Ccos = 0; window.RIB_TUNE.v156Cspeed = 0; const b = seedRun(); const src = window.RIB_COSMETICS.catalog().find((i) => i.id === 'wings_angel').source
  window.RIB_TUNE.v156Ccos = 1; window.RIB_TUNE.v156Cspeed = 1
  return { same: a === b, a: a.slice(0, 60), killSrc: src, onSrc: window.RIB_COSMETICS.catalog().find((i) => i.id === 'wings_angel').source } })
ok(neutral.same && neutral.killSrc === 'earned' && neutral.onSrc === 'super', 'seeded games are identical with v156 C on and off; TU v156Ccos 0 restores the old sources', neutral)

console.log(JSON.stringify({ pass, fail, errors: errs.length }))
console.log('page errors:', errs.length ? errs.slice(0, 8) : 'none')
ok(errs.length === 0, 'no page errors')
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
