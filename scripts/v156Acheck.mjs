// Dev check (v156 A THE MEDALS ARE THE KEY): the Legacy medals replace Honors as the rank that opens the tree.
//
//   1. the table: MEDAL_TABLE_V156A is monotone and hits the owner-approved anchors (effective Honors → medals:
//      6→12 … 40→200 … 64→420); every gated node's requirement is a friendly number (multiple of 5 above 20);
//      the first gated nodes want 12, the Impossible branch 260+; honorsEquiv is the table read backwards.
//   2. a fresh save: 1 medal, a 0 mirror, every medal-gated node locked, the tree says "Needs 🎖️ N medals —
//      you have 1", and the chip / tree / menu / How To Play say MEDALS, never Honors.
//   3. the gate: seeding the ledger to rank R opens exactly the nodes whose medal requirement ≤ R, and
//      state.prestige mirrors honorsEquiv(R); Reputation takes 5% a level off every requirement.
//   4. the pay: Legacy XP moves the mirror; G.O.A.T. / Immortal multiply Legacy XP; a career end pays no Honors
//      (the win and the cut), and the cards say MEDALS.
//   5. the Path: opens at 12 medals, a switch costs PP (25%, at least 50), never Honors.
//   6. grandfathering: an old save's Honors become a medal floor once (`state.honorsV156A`), no node it could
//      buy is locked, the old Honors stand in the mirror, the save stays valid (finite prestige, checkSave).
//   7. the kill switch TU("v156A", 0) restores the Honors gate, the Honors pay and the HONORS chip.
//   8. no page errors.
//
//   GAME_URL=http://localhost:5411/index.html node scripts/v156Acheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const MEDAL = '\u{1F396}', CREST = '⚜'
const W = 420, H = 900
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }

const browser = await launch()
const errors = []
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await ctx.addInitScript(() => { setInterval(() => { try { document.querySelectorAll('.onboard').forEach((e) => e.remove()) } catch {} }, 60) })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message || String(e)))
const E = (fn, arg) => page.evaluate(fn, arg)
const boot = async () => {
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V152A && !!window.__V156A, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.waitForTimeout(500)
}
// a save written to disk, then booted — the boot migrations (the grandfather record) run on it
const fresh = (o) => E((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.name = 'Medal Tester'; S.player.pos = 'QB'
  S.prestige = o.prestige || 0; S.pp = o.pp || 0; S.tree = o.tree || {}
  S.legacyV152 = { v: 1, xp: o.xp || 0, boot: 1, got: {}, log: [], ms: 0 }
  if (o.noMigrate === false) S.honorsV156A = { old: 0, rep: 0, floor: 0, at: 1 }
  S.view = o.view || 'hub'; window.GridironStorage.save(S)
}, o || {})
const txt = (sel) => E((sel) => { const el = document.querySelector(sel); return el ? el.textContent.replace(/\s+/g, ' ') : '' }, sel)

await page.goto(U(), { waitUntil: 'domcontentloaded' })
await E(() => { localStorage.clear(); localStorage.setItem('rib.coachTour.v119', 'off') })
await boot()

// ============================== 1. the table ==============================
{
  const t = await E(() => {
    const V = window.__V156A, T = V.table()
    return { T, anchors: [6, 8, 10, 13, 16, 19, 22, 26, 29, 32, 35, 38, 40, 48, 53, 58, 64].map((h) => [h, Math.round(V.medalsFor(h))]),
      inv: [12, 50, 100, 200, 420].map((m) => [m, +V.honorsEquiv(m).toFixed(2)]), pathReq: V.pathReq() }
  })
  const want = { 6: 12, 8: 18, 10: 25, 13: 35, 16: 50, 19: 65, 22: 80, 26: 100, 29: 120, 32: 140, 35: 165, 38: 185, 40: 200, 48: 260, 53: 300, 58: 350, 64: 420 }
  ok(t.anchors.every(([h, m]) => want[h] === m), 'the table hits every anchor (effective Honors → medals)', t.anchors.map((a) => a.join('→')).join(' '))
  ok(t.T.every((r, i) => i === 0 || (r[0] > t.T[i - 1][0] && r[1] > t.T[i - 1][1])), 'and it is strictly monotone in both columns')
  ok(t.inv.every(([m, h]) => Math.abs(t.T.find((r) => r[1] === m)[0] - h) < 1e-6), 'honorsEquiv reads it backwards (12→6, 50→16, 100→26, 200→40, 420→64)', t.inv)
  ok(t.pathReq === 12, 'a Prestige Path opens at 12 medals (the old 6 Honors)', t.pathReq)
}
// read every gated node through the public tree export
const nodes = await E(() => {
  const V = window.__V156A, A = window.__GRIDIRON_AUDIT__, S = A.getState(); S.tree = {}
  const TN = A.TREE_NODES || {}
  return Object.values(TN).filter((n) => n.req && (n.req.honors != null || n.req.stars != null))
    .map((n) => ({ key: n.key, branch: n.branch || '', honors: n.req.honors != null ? n.req.honors : n.req.stars, node: n.req.node || null, lvl: n.req.lvl || 0, req: V.nodeReq(n.key), base: V.baseReq(n.req.honors != null ? n.req.honors : n.req.stars) }))
})
{
  ok(nodes.length >= 80, 'every Honors-gated node is read (' + nodes.length + ')', nodes.length)
  ok(nodes.every((n) => n.req === n.base && (n.req <= 20 || n.req % 5 === 0)), 'every medal requirement is a friendly number (a multiple of 5 above 20)', nodes.filter((n) => !(n.req <= 20 || n.req % 5 === 0)).map((n) => n.key + ':' + n.req))
  const min = Math.min(...nodes.map((n) => n.req)), max = Math.max(...nodes.map((n) => n.req))
  ok(min === 12 && max === 420, 'the first gated nodes want 12 medals, the last 420', { min, max })
  const imp = nodes.filter((n) => n.branch === 'impossible')
  ok(imp.length >= 10 && imp.every((n) => n.req >= 260 && n.req <= 420), 'the Impossible branch sits at 260-420 (ruby to diamond)', imp.map((n) => n.req).join(','))
  const apex = nodes.filter((n) => n.branch === 'apex')
  ok(apex.length >= 5 && apex.every((n) => n.req >= 35 && n.req <= 260), 'the Apex branch sits at 35-260', apex.map((n) => n.req).join(','))
  const hist = {}; nodes.forEach((n) => { hist[n.req] = (hist[n.req] || 0) + 1 })
  console.log('medal requirements (medals: nodes):', JSON.stringify(hist))
}

// ============================== 2. a fresh save ==============================
{
  await fresh({ pp: 500 }); await boot()
  const f = await E(() => { const S = __GRIDIRON_AUDIT__.getState(), V = window.__V156A
    return { medals: V.medals(), prestige: S.prestige, rec: S.honorsV156A, mig: !!S.honorsV156A } })
  ok(f.medals === 1 && f.prestige === 0, 'a fresh save holds 1 medal and a 0 mirror', f)
  ok(f.mig && f.rec.old === 0 && f.rec.floor === 0, 'the first boot recorded the (empty) old Honors once', f.rec)
  const open = await E((keys) => keys.filter((k) => window.__V156A.open(k)), nodes.map((n) => n.key))
  ok(open.length === 0, 'every medal-gated node is locked', open)
  await E(() => window.go('hub')); await page.waitForTimeout(400)
  const chip = await txt('.prestige-chip')
  ok(chip.includes(MEDAL) && /1 MEDALS/.test(chip) && !/HONOR/i.test(chip) && !chip.includes(CREST), 'the top-bar chip reads 🎖️ 1 MEDALS · 🪙 PP', chip)
  const title = await E(() => document.querySelector('.prestige-chip').title)
  ok(/MEDALS/.test(title) && /NOT the 1-5 star recruit rating/.test(title) && !/HONORS/.test(title), 'and its title says what the medals are', title.slice(0, 80))
  await E(() => window.go('shop')); await page.waitForTimeout(700)
  const shop = await txt('#screen')
  const lock = (shop.match(/🔒 Needs 🎖️? ?\d+ medals — you have \d+/) || [''])[0]
  ok(/Needs 🎖️? ?\d+ medals — you have 1\b/.test(shop), 'a locked node says "🔒 Needs 🎖️ N medals — you have M"', lock)
  ok(!/honou?rs?/i.test(shop) && !shop.includes(CREST), 'the prestige tree never says Honors', (shop.match(/.{0,30}honou?rs?.{0,30}/i) || [''])[0])
  ok(/1 MEDALS/.test(shop), 'the tree\'s banner shows the medal count', (shop.match(/.{0,10}MEDALS/) || [''])[0])
  const art = await E(() => document.querySelectorAll('#screen .medal-art-v156a .lg-medal-v152').length)
  ok(art > 0, 'a locked node draws the medal it needs', art)
  const dock = await txt('#dock')
  ok(/Path \(🎖️?12 medals\)/.test(dock), 'the locked Path asks for 12 medals', (dock.match(/.{0,6}Path \([^)]*\)/) || [''])[0])
  await E(() => window.go('path')); await page.waitForTimeout(400)
  const path = await txt('#screen')
  ok(/Reach 🎖️? ?12 medals/.test(path) && !/honou?rs?/i.test(path), 'the Path screen asks for medals, not Honors', (path.match(/Reach.{0,60}/) || [''])[0])
  await E(() => window.go('menu')); await page.waitForTimeout(1200)
  const menu = await E(() => { const m = document.getElementById('rib-main-menu-v2'); return m ? m.textContent.replace(/\s+/g, ' ') : document.getElementById('screen').textContent.replace(/\s+/g, ' ') })
  ok(/MEDALS/.test(menu) && !/HONORS/.test(menu), 'the main menu says MEDALS, never HONORS', (menu.match(/.{0,20}MEDALS.{0,20}/) || [''])[0])
  const data = await E(() => { const d = window.__RIB_MENU_DATA_V89(); return { medals: d.state.medals, on: d.state.medalsOn } })
  ok(data.medals === 1 && data.on === true, 'the menu data carries the medal count', data)
  const how = await E(() => { window.__RIB_HOWTO.open(); window.__RIB_HOWTO.toggle('currency', true)
    const s = document.querySelector('#rib-howto-v111 [data-fq-sec="currency"]'); const all = document.getElementById('rib-howto-v111').textContent.replace(/\s+/g, ' ')
    const r = { cur: s ? s.textContent.replace(/\s+/g, ' ') : '', all }; window.__RIB_HOWTO.close(); return r })
  ok(/MEDALS/.test(how.cur) && /12 medals/.test(how.cur) && /Reputation/.test(how.cur) && /5%/.test(how.cur), 'How To Play: medals unlock the tree, a Path at 12, Reputation takes 5% a level', how.cur.slice(0, 120))
  ok(!/honou?rs?\b/i.test(how.all) && !how.all.includes(CREST), 'How To Play never says Honors', (how.all.match(/.{0,30}honou?rs?.{0,30}/i) || [''])[0])
  ok(/medal level/.test(how.all), 'the soft-cap formula reads the medal level', (how.all.match(/\(potential ceiling[^)]*\)[^)]*\)/) || [''])[0])
}

// ============================== 3. the gate ==============================
{
  const g = await E((nodes) => {
    const V = window.__V156A, S = __GRIDIRON_AUDIT__.getState(), out = []
    S.tree = {}
    for (const R of [11, 12, 35, 50, 100, 185, 200, 259, 260, 300, 419, 420, 500]) {
      V.seed(R)
      const open = nodes.filter((n) => V.open(n.key)).map((n) => n.key).sort()
      const want = nodes.filter((n) => n.req <= R && (!n.node || (S.tree[n.node] || 0) >= n.lvl)).map((n) => n.key).sort()
      out.push({ R, medals: V.medals(), mirror: S.prestige, equiv: Math.round(V.honorsEquiv(R) * 10) / 10, open: open.length, want: want.length, same: open.join() === want.join() })
    }
    return out
  }, nodes)
  ok(g.every((r) => r.medals === r.R || (r.R > 500 && r.medals === 500)), 'seeding the ledger to rank R gives R medals', g.map((r) => r.R + ':' + r.medals).join(' '))
  ok(g.every((r) => r.same), 'rank R opens exactly the nodes whose medal requirement ≤ R', g.map((r) => r.R + ':' + r.open + '/' + r.want).join(' '))
  ok(g[0].open === 0 && g[1].open > 0 && g[g.length - 1].open === g[g.length - 1].want, '11 medals opens nothing, 12 the first nodes, 500 everything that is not behind another node', g.map((r) => r.open).join(','))
  ok(g.every((r) => r.mirror === r.equiv), 'state.prestige mirrors honorsEquiv(medals) at every rank', g.map((r) => r.R + '→' + r.mirror).join(' '))
  const rep = await E(() => {
    const V = window.__V156A, S = __GRIDIRON_AUDIT__.getState()
    S.tree = {}; const k = Object.values(__GRIDIRON_AUDIT__.TREE_NODES).find((n) => n.req && n.req.honors != null && V.baseReq(n.req.honors) === 100).key
    const base = V.nodeReq(k)
    S.tree = { reputation: 1 }; const r1 = V.nodeReq(k)
    S.tree = { reputation: 3 }; const r3 = V.nodeReq(k)
    V.seed(85); const open85 = V.open(k); V.seed(84); const open84 = V.open(k)
    S.tree = {}; const back = V.nodeReq(k)
    const desc = __GRIDIRON_AUDIT__.TREE_NODES.reputation.desc
    return { k, base, r1, r3, open85, open84, back, desc }
  })
  ok(rep.base === 100 && rep.r1 === 95 && rep.r3 === 85 && rep.back === 100, 'Reputation takes 5% a level off every medal requirement (100 → 95 → 85)', rep)
  ok(rep.open85 && !rep.open84, 'and the gate reads the lowered number (85 opens, 84 does not)', { open85: rep.open85, open84: rep.open84 })
  ok(/medal requirement/.test(rep.desc) && /5%/.test(rep.desc) && !/honou?rs?/i.test(rep.desc), 'Reputation\'s own line says so', rep.desc)
}

// ============================== 4. the pay ==============================
{
  const p = await E(() => {
    const V = window.__V156A, A = window.__V152A, S = __GRIDIRON_AUDIT__.getState()
    S.tree = {}; V.seed(1)
    const r = {}
    A.pay(S.player, A.xpAt(50), 'season', [])
    r.m50 = V.medals(); r.mir50 = S.prestige; r.eq50 = Math.round(V.honorsEquiv(r.m50) * 10) / 10
    S.tree = { goat: 2 }; r.goat = V.xpMult(S.player, 'season')
    S.tree = { goat: 2, immortal: 3 }; S.player.level = 7; r.uff = V.xpMult(S.player, 'career'); r.uffSeason = V.xpMult(S.player, 'season')
    S.player.level = 4; r.cut = V.xpMult(S.player, 'career')
    S.tree = { goat: 1 }; const x0 = S.legacyV152.xp; const a = A.pay(S.player, 1000, 'season', []); r.paid = S.legacyV152.xp - x0; r.part = (a.parts || []).map((q) => q[0]).find((q) => /Legacy nodes/.test(q))
    const T = __GRIDIRON_AUDIT__.TREE_NODES; r.goatDesc = T.goat.desc; r.immDesc = T.immortal.desc
    S.tree = {}
    return r
  })
  ok(p.m50 >= 50 && p.mir50 === p.eq50, 'Legacy XP moves the medals and the mirror follows', p)
  ok(Math.abs(p.goat - 1.1) < 1e-9 && Math.abs(p.uff - 1.4) < 1e-9 && Math.abs(p.uffSeason - 1.1) < 1e-9 && Math.abs(p.cut - 1.1) < 1e-9, 'G.O.A.T. is +5% Legacy XP a level; Immortal +10% a level on a UFF career end only', { goat: p.goat, uff: p.uff, season: p.uffSeason, cut: p.cut })
  ok(p.paid === 1050 && p.part === 'Legacy nodes +5% XP', 'the payment carries it, and the XP card names it', { paid: p.paid, part: p.part })
  ok(/Legacy XP/.test(p.goatDesc) && /Legacy XP/.test(p.immDesc) && !/prestige stars?/.test(p.immDesc), 'G.O.A.T. and Immortal say Legacy XP now', [p.goatDesc, p.immDesc])
  // a career end: the win, then the cut
  const settle = async (lvl, screen) => {
    await E(({ lvl }) => {
      const A = __GRIDIRON_AUDIT__, S = A.getState(), V = window.__V156A
      S.tree = {}; V.seed(30)
      const p = A.newPlayer(); p.name = 'Medal Tester'; p.pos = 'RB'; p.level = lvl; p.totalSeasons = 6; p.career = []; p.peakOvr = 80
      S.player = p; window.__before = { prestige: S.prestige, xp: S.legacyV152.xp }
      S.view = lvl >= 7 ? 'win' : 'gameover'; window.render()
    }, { lvl })
    await page.waitForTimeout(600)
    return E(() => { const S = __GRIDIRON_AUDIT__.getState(), V = window.__V156A, sc = document.getElementById('screen').textContent.replace(/\s+/g, ' ')
      return { settled: !!S.player._settled, star: S.player._starGain, before: window.__before.prestige, after: S.prestige, equiv: Math.round(V.honorsEquiv(V.medals()) * 10) / 10,
        xp: S.legacyV152.xp - window.__before.xp, honors: /honou?rs?\b/i.test(sc), medalsTxt: (sc.match(/🎖️? ?\d+ ?MEDALS|🎖️?\d+ ?Medals/i) || [''])[0] } })
  }
  const win = await settle(7, 'win')
  ok(win.settled && win.star === 0 && win.xp > 0 && win.after === win.equiv, 'a UFF arrival pays no Honors — the mirror moves only with the medals', win)
  ok(!win.honors && !!win.medalsTxt, 'and the card says MEDALS, not HONORS', win.medalsTxt)
  const cut = await settle(4, 'gameover')
  ok(cut.settled && cut.star === 0 && cut.after === cut.equiv, 'a career cut short pays no Honors either', cut)
  ok(!cut.honors && !!cut.medalsTxt, 'and its card shows the medals, not "+N Honors"', cut.medalsTxt)
}

// ============================== 5. the Path ==============================
{
  const r = await E(() => {
    const A = __GRIDIRON_AUDIT__, S = A.getState(), V = window.__V156A, out = {}
    S.tree = {}; S.path = null; V.seed(11); out.open11 = V.pathOpen()
    V.seed(12); out.open12 = V.pathOpen()
    const keys = V.paths(); out.keys = keys.length
    S.pp = 1000; window.choosePath(keys[0]); out.first = S.path === keys[0] && S.pp === 1000
    const mir = S.prestige; window.choosePath(keys[1]); out.second = S.path === keys[1] && S.pp === 750 && S.prestige === mir
    S.pp = 100; window.choosePath(keys[0]); out.min = S.path === keys[0] && S.pp === 50
    S.pp = 10; window.choosePath(keys[1]); out.poor = S.path === keys[0] && S.pp === 10
    S.path = null
    return out
  })
  ok(!r.open11 && r.open12, 'the Path opens at 12 medals', r)
  ok(r.first && r.second && r.min && r.poor, 'choosing is free; a switch costs 25% of the PP (at least 50) and never touches the rank', r)
}

// ============================== 6. grandfathering ==============================
{
  await fresh({ prestige: 40, pp: 100, tree: { reputation: 0 } }); await boot()
  const g = await E((nodes) => {
    const S = __GRIDIRON_AUDIT__.getState(), V = window.__V156A
    const oldOpen = nodes.filter((n) => Math.max(1, Math.round(n.honors * 1.6)) <= 40 && !n.node).map((n) => n.key)
    return { rec: S.honorsV156A, medals: V.medals(), legacy: V.legacyMedals(), prestige: S.prestige, locked: oldOpen.filter((k) => !V.open(k)), n: oldOpen.length,
      valid: window.__V150A ? window.__V150A.checkSave(JSON.parse(JSON.stringify(S))) : 'no api', disk: JSON.parse(localStorage.getItem('gridiron_save_v1') || '{}').prestige }
  }, nodes)
  ok(g.rec && g.rec.old === 40 && g.rec.floor === 200, 'the first boot records the old 40 Honors as a floor of 200 medals, once', g.rec)
  ok(g.legacy <= 2 && g.medals === 200, 'the gate reads the floor, not the empty ledger', { legacy: g.legacy, medals: g.medals })
  ok(g.n > 30 && g.locked.length === 0, 'no node the old Honors could buy is locked (' + g.n + ' of them)', g.locked)
  ok(g.prestige === 40, 'the old Honors stand in the mirror until the medals pass the floor', g.prestige)
  ok(g.valid === '' && typeof g.disk === 'number' && isFinite(g.disk), 'the save is still valid (a finite prestige on disk, checkSave passes)', { valid: g.valid, disk: g.disk })
  const again = await E(() => { const S = __GRIDIRON_AUDIT__.getState(); S.prestige = 3; window.__V156A.migrate(); return S.honorsV156A.old })
  ok(again === 40, 'the record is written once — a later migrate does not rewrite it', again)
  const pass2 = await E(() => { const V = window.__V156A, S = __GRIDIRON_AUDIT__.getState(); V.seed(300); return { m: V.medals(), p: S.prestige, eq: Math.round(V.honorsEquiv(300) * 10) / 10 } })
  ok(pass2.m === 300 && pass2.p === pass2.eq && pass2.p > 40, 'once the medals pass the floor, they lead', pass2)
  // reputation bought before v156 A counts toward the floor too
  await fresh({ prestige: 35, tree: { reputation: 3 } }); await boot()
  const gr = await E((nodes) => { const S = __GRIDIRON_AUDIT__.getState(), V = window.__V156A
    const oldOpen = nodes.filter((n) => Math.max(1, Math.round(n.honors * 1.6)) - 3 <= 35 && !n.node).map((n) => n.key)
    return { rec: S.honorsV156A, locked: oldOpen.filter((k) => !V.open(k)), n: oldOpen.length } }, nodes)
  ok(gr.rec.rep === 3 && gr.locked.length === 0, 'a save with Reputation 3 keeps every node its old Honors-minus-3 gate opened', gr)
}

// ============================== 7. the kill switch ==============================
{
  await fresh({ prestige: 7, pp: 500, view: 'hub' })
  await page.goto(U(), { waitUntil: 'domcontentloaded' })
  await E(() => { window.RIB_TUNE = window.RIB_TUNE || {}; window.RIB_TUNE.v156A = 0 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V156A, null, { timeout: 40000 })
  await page.waitForTimeout(800)
  const k = await E((nodes) => {
    window.RIB_TUNE.v156A = 0
    const S = __GRIDIRON_AUDIT__.getState(), V = window.__V156A
    S.prestige = 7; S.tree = {}
    window.go('hub')
    const chip = document.querySelector('.prestige-chip').textContent.replace(/\s+/g, ' ')
    const open = nodes.filter((n) => V.open(n.key)).map((n) => n.key)
    const want = nodes.filter((n) => Math.max(1, Math.round(n.honors * 1.6)) <= 7 && !n.node).map((n) => n.key)
    return { on: V.on(), chip, gain: V.gain(4), open: open.sort().join(), want: want.sort().join(), n: want.length, path: V.pathOpen() }
  }, nodes)
  ok(!k.on && /HONORS/.test(k.chip) && k.chip.includes(CREST), 'TU("v156A", 0): the chip is ⚜️ HONORS again', k.chip)
  ok(k.open === k.want && k.n > 0, 'the Honors gate is back (7 Honors opens the Li ≤ 7 nodes)', k.n)
  ok(k.gain === 4 && k.path, 'Honors are paid again and the Path reads Honors', { gain: k.gain, path: k.path })
  await E(() => { delete window.RIB_TUNE.v156A })
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(JSON.stringify({ pass, fail }))
await browser.close()
process.exit(fail ? 1 : 0)
