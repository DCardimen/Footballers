// Dev check: v193 D THE PAYOUT, SHOWN (src/07-career-app.js).
//   1 the career-end ledger (a level-4 cut, a level-7 arrival): its rows add / multiply to its total, the total is the
//     PP delta at the settle (= what rained into the Vault), the PP Earned box shows the same number, the bank is by
//     source with the flat cap as a row, the HoF Path row shows on an arrival, the total counts up
//   2 the season screen's 📈 PRESTIGE THIS SEASON card: "+N so far" is the pot over the last season's end, the sources
//     banked this season, its button opens the breakdown, it collapses (remembered)
//   3 the v192 B breakdown: the HoF Path row, the rates by kind, "if you reach the UFF"
//   4 the respec refunds what a ×24 core node cost
//   5 fits 360×780 with no page scroll; kill switch v193D 0 draws the old card
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v193Dcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate', '#teamModalV153', '.team-modal-v153']) document.querySelector(s)?.remove() }, 80) })
const boot = async () => {
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V193D && !!window.__V192B && !!window.ribDialog, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  await page.waitForTimeout(500)
}
await page.goto(gameUrl(), { waitUntil: 'networkidle', timeout: 60000 })
await boot()
const M = (fn, arg) => page.evaluate(fn, arg)
const setup = (o) => M((o) => {
  const X = window.__GRIDIRON_AUDIT__, S = X.freshState(); X.setState(S); S.tutorialSeen = true
  S.tree = o.tree || {}; S.era = o.era || 0; S.pp = o.pp || 1000
  S.player = X.newPlayer(); const p = S.player
  p.pos = 'RB'; p.level = o.level != null ? o.level : 4; p.totalSeasons = o.seasons || 6; p.titles = o.titles || 0; p.seasonsAtLevel = o.sal || 1; p.personaV13 = { loyalty: 5 }; p.traits = []
  window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, o.tune || {})
  document.getElementById('bankRainV189')?.remove()
  return true
}, o)
// read the ledger off the page and replay it as a receipt: base/adds add, mults multiply, sums and the total are the running figure
const readLedger = () => M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player, L = p._ledgerV193D, el = document.getElementById('payLedgerV193D')
  const rows = el ? [...el.querySelectorAll(':scope > .pl-row')].map((r) => ({ cls: r.className, label: r.querySelector('.pl-l')?.childNodes[0]?.textContent || '', num: r.querySelector('b')?.textContent || '' })) : []
  let run = 0, maxErr = 0
  const bad = []
  for (const r of (L && L.rows) || []) {
    if (r.kind === 'head') continue
    if (r.kind === 'base' || r.kind === 'add' || r.kind === 'cut') run += r.val
    else if (r.kind === 'mult') run *= r.val
    else if (r.kind === 'sum' || r.kind === 'total') { const err = Math.abs(run - r.val); maxErr = Math.max(maxErr, err); err > 1 && bad.push(r.label + ':' + run.toFixed(2) + '≠' + r.val); run = r.val }
  }
  const earned = ([...document.querySelectorAll('.statbox')].find((b) => /PP Earned/.test(b.textContent)) || {}).textContent || ''
  return { has: !!el, kind: L && L.kind, total: L && L.total, careerPays: L && L.careerPays, bank: L && L.bank, cut: L && L.cut, cards: L && L.cards, hof: L && L.hof, maxErr, bad, rows, labels: ((L && L.rows) || []).map((r) => r.label), pp: S.pp, vault: p._vaultPayV137, lvault: L && L.vault, earned: earned.replace(/\s+/g, ' ').trim(), totalText: el && el.querySelector('.pl-total').textContent, note: !!document.querySelector('.bank-note-v136'), fmt: window.__V179.fmt(L ? L.total : 0), width: el && Math.round(el.getBoundingClientRect().right), pageScroll: document.scrollingElement.scrollHeight - innerHeight, pageScrollW: document.scrollingElement.scrollWidth - innerWidth }
})

// 1a: a level-4 cut — bonuses, Family Legacy, two titles, a bank over the flat cap
await setup({ tree: { endorse: 3, brand: 2, legacy: 2 }, era: 2, pp: 5000, titles: 2, seasons: 9 })
const pre = await M(() => { const S = window.__GRIDIRON_AUDIT__.getState(); window.__V136_C.bank(25000, 'goal'); window.__V136_C.bank(120, 'milestone'); return { pp: S.pp, bank: S.ppBankV136, pot: window.__V189.pot(S.player) } })
await M(() => window.go('gameover'))
// the total counts up (350 ms + ledgerFillMsV193D 1.6 s): wait for the figure, not a fixed sleep (rAF is late under load)
const counted = () => page.waitForFunction(() => { const el = document.querySelector('#payLedgerV193D .pl-total'), S = window.__GRIDIRON_AUDIT__.getState(), L = S.player && S.player._ledgerV193D; return !!(el && L && el.textContent === window.__V179.fmt(L.total)) }, null, { timeout: 6000 }).catch(() => null)
await counted()
const G = await readLedger()
ok(G.has && G.kind === 'gameover' && G.labels.some((l) => /^Reached /.test(l)) && G.labels.some((l) => /9 seasons × 0\.35/.test(l)) && G.labels.some((l) => /2 titles × 4/.test(l)) && G.labels.some((l) => /× your bonuses/.test(l)) && G.labels.some((l) => /× chaos/.test(l)) && G.labels.some((l) => /Family Legacy 2 × 9 seasons/.test(l)) && G.labels.some((l) => /THE CAREER PAYS/.test(l)) && G.labels.some((l) => /PAID INTO THE VAULT/.test(l)), 'the cut career draws the ledger: the level, the seasons, the titles, the bonuses, chaos, Family Legacy, the career pays, the vault', G.labels)
ok(G.maxErr <= 1 && !G.bad.length, 'the rows add and multiply to each sum and to the total (a receipt)', { maxErr: G.maxErr, bad: G.bad, careerPays: G.careerPays, total: G.total })
ok(G.total === G.pp - pre.pp && G.total === G.vault && G.total > 0, 'the total is the PP paid at the settle (the Vault\'s figure)', { total: G.total, delta: G.pp - pre.pp, vault: G.vault })
ok(G.cut > 0 && G.labels.some((l) => /Goals & challenges/.test(l)) && G.labels.some((l) => /Level milestones/.test(l)) && G.labels.some((l) => /over the flat cap/.test(l)) && G.bank === 25120 - G.cut && G.note, 'the bank is listed by source, and the flat cap is a row when it bit', { bank: G.bank, cut: G.cut })
ok(new RegExp('\\+' + G.fmt.replace(/[.]/g, '\\.') + '(?!\\d)').test(G.earned.replace(/,/g, '')) || new RegExp('\\+' + G.total + '(?!\\d)').test(G.earned.replace(/,/g, '')), 'the PP Earned box shows the ledger\'s total', { earned: G.earned, total: G.total })
ok(G.totalText === G.fmt, 'the big number counted up to the total', { text: G.totalText, want: G.fmt })
ok(G.width <= 360 && G.pageScrollW <= 0 && G.pageScroll <= 0, 'the ledger fits 360 px — no page scroll, nothing clipped', { right: G.width, pageScroll: G.pageScroll, pageScrollW: G.pageScrollW })
const X1 = await M(() => { const r = document.querySelector('#payLedgerV193D .pl-x'); r.click(); const sub = r.nextElementSibling; return { open: r.classList.contains('open'), shown: sub && getComputedStyle(sub).display !== 'none', text: sub ? sub.innerText : '' } })
ok(X1.open && X1.shown && /Endorsements/.test(X1.text) && /Global Brand/.test(X1.text) && /Era/.test(X1.text), 'tapping × your bonuses opens the multiplier rows inline', X1.text.slice(0, 120))
await page.screenshot({ path: '/tmp/v193D-gameover.png' })
const R1 = await M(() => { window.render(); const S = window.__GRIDIRON_AUDIT__.getState(); return { pp: S.pp, total: S.player._ledgerV193D.total, text: document.querySelector('#payLedgerV193D .pl-total').textContent } })
ok(R1.total === G.total && R1.pp === G.pp && R1.text === G.fmt, 'a redraw keeps the same ledger (the settle ran once; the figure stays)', R1)

// 1b: the arrival — the HoF Path row, Family Legacy flat, 85 + 0.75 a season + 6 a title
await setup({ tree: { hof: 2, endorse: 1, legacy: 1 }, level: 7, titles: 1, seasons: 12, pp: 100 })
const pre2 = await M(() => { const S = window.__GRIDIRON_AUDIT__.getState(); window.__V136_C.bank(40, 'title'); S.player.flipPPPctV186 = 12; return { pp: S.pp } })
await M(() => window.go('win'))
await counted()
const W = await readLedger()
ok(W.has && W.kind === 'win' && W.labels.some((l) => /Reached the UFF/.test(l)) && W.labels.some((l) => /12 seasons × 0\.75/.test(l)) && W.labels.some((l) => /1 title × 6/.test(l)) && W.labels.some((l) => /Hall of Fame Path · Lv 2/.test(l)) && Math.abs(W.hof - 1.6) < 1e-9, 'the arrival\'s ledger: 85 + 0.75 a season + 6 a title, and the Hall of Fame Path ×1.6 row', W.labels)
ok(W.maxErr <= 1 && !W.bad.length && W.total === W.pp - pre2.pp && W.lvault === W.vault && W.vault > 0, 'the arrival\'s rows add up: the Vault\'s figure is a sum row, the total is the whole PP delta', { maxErr: W.maxErr, bad: W.bad, total: W.total, delta: W.pp - pre2.pp, vault: W.vault, lvault: W.lvault })
ok(W.cards > 0 && W.labels.some((l) => /Prestige cards · \+12%/.test(l)) && W.labels.some((l) => /Titles/.test(l)) && W.bank === 40, 'the Prestige cards and the banked title are rows too', { cards: W.cards, bank: W.bank })
ok(W.vault < W.total && W.labels.some((l) => /= paid into the Vault/.test(l)) && W.labels.some((l) => /Goals & challenges/.test(l)) && W.labels.some((l) => /THE CAREER PAID, ALL IN/.test(l)), 'what the ending paid at once (a goal completed by the arrival, a Legacy bounty) is on the receipt after the Vault\'s figure', { vault: W.vault, total: W.total, late: W.labels.slice(-4) })
ok(W.totalText === W.fmt && (new RegExp('\\+' + W.fmt.replace(/[.]/g, '\\.') + '(?!\\d)').test(W.earned.replace(/,/g, '')) || new RegExp('\\+' + W.total + '(?!\\d)').test(W.earned.replace(/,/g, ''))), 'the arrival\'s PP Earned box and the counted-up number are the ledger\'s total', { earned: W.earned, text: W.totalText })
await page.screenshot({ path: '/tmp/v193D-win.png' })

// 2: the season screen's prestige view
await setup({ tree: { endorse: 2, hof: 1 }, level: 3, seasons: 4, titles: 1 })
const S1 = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player
  S.bankShownV189 = window.__V189.pot(p)
  window.startSeason() /* the snapshot: the season's flat sources are measured from here */
  const snap = Object.assign({}, p.ppFlatSeasonStartV193D)
  window.__V136_C.bank(500, 'goal'); window.__V136_C.bank(9, 'nemesis')
  window.go('season')
  const el = document.getElementById('seasonGainV193D'), G = window.__V193D.seasonGain(p)
  const prev = el && el.previousElementSibling
  return { snap, has: !!el, open: el && el.classList.contains('open'), text: el ? el.innerText : '', G, after: prev && prev.id, pot: window.__V189.pot(p), shown: S.bankShownV189 }
})
ok(S1.has && S1.open && S1.snap && Object.keys(S1.snap).length === 0 && S1.G.gain === S1.pot - S1.shown && S1.G.gain > 0 && new RegExp('\\+' + String(S1.G.gain).replace(/[.]/g, '\\.') + ' so far').test(S1.text.replace(/,/g, '')), 'the season screen shows PRESTIGE THIS SEASON: the pot over the last season\'s end, "+N so far"', { gain: S1.G.gain, pot: S1.pot, shown: S1.shown, text: S1.text.slice(0, 160) })
ok(S1.G.moved.length === 2 && S1.G.moved[0].v === 500 && /Goals & challenges/.test(S1.text) && /Nemesis wins/.test(S1.text) && /A title this season pays/.test(S1.text) && S1.G.titleBank > 0, 'it lists what was banked this season by source, and what a title pays', { moved: S1.G.moved, titleBank: S1.G.titleBank, titleEnd: S1.G.titleEnd })
ok(S1.after === 'teamQualV192B', 'the card sits under the TEAM QUALITY card', S1.after)
await page.screenshot({ path: '/tmp/v193D-season.png' })
await page.click('#seasonMathBtnV193D')
await page.waitForTimeout(300)
const B = await M(() => { const d = document.querySelector('.rib-dlg-v149'); const r = { open: !!window.ribDialog.isOpen, text: d ? d.innerText : '' }; window.ribDialog.close(); return r })
ok(B.open && /THE CAREER'S PP MULTIPLIER/.test(B.text) && /Projected at the career's end/.test(B.text), 'THE FULL MATH opens the v192 B breakdown', B.text.slice(0, 100))
ok(/Hall of Fame Path · Lv 1/.test(B.text) && /if it ended now \(a cut\)/.test(B.text) && /If you reach the UFF instead/.test(B.text) && /\+4 at a cut · \+6 at the UFF arrival/.test(B.text) && /\+0\.35 at a cut · \+0\.75 at the UFF arrival/.test(B.text), 'the breakdown names the HoF Path, the rates by kind, and what an arrival would pay', B.text.split('\n').filter((l) => /Hall of Fame|ended now|reach the UFF|at a cut/.test(l)).join(' | ').slice(0, 300))
const T1 = await M(() => { document.querySelector('#seasonGainV193D .sg-head').click(); const el = document.getElementById('seasonGainV193D'); const body = el.querySelector('.sg-body'); return { open: el.classList.contains('open'), hidden: getComputedStyle(body).display === 'none', ls: localStorage.getItem('rib.seasonGainOpen.v193') } })
await M(() => window.go('season')) /* a redraw through the wrapped render (window.render is the bare one) */
const T2 = await M(() => { const el = document.getElementById('seasonGainV193D'); return { open: !!el && el.classList.contains('open'), has: !!el } })
await M(() => { document.querySelector('#seasonGainV193D .sg-head').click() })
const T3 = await M(() => ({ open: document.getElementById('seasonGainV193D').classList.contains('open'), ls: localStorage.getItem('rib.seasonGainOpen.v193') }))
ok(!T1.open && T1.hidden && T1.ls === '0' && T2.has && !T2.open && T3.open && T3.ls === '1', 'the card collapses on its header, and a redraw remembers it (localStorage rib.seasonGainOpen.v193)', { T1, T2, T3 })

// 4: the respec refund is the price paid (a ×24 core node)
await setup({ tree: { endorse: 2 }, level: 2, pp: 0 })
const R = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), N = X.TREE_NODES.endorse
  const paid = X.nodeCost(N, 0) + X.nodeCost(N, 1), raw = Math.round(N.cost) + Math.round(N.cost * N.mult)
  S.prestige = 1; S.respecUsed = 0; S.view = 'shop'
  const pp0 = S.pp   // setup's pp default is 1000 (0 is falsy there) — measure the refund, not the balance
  window.respecTree()
  return { paid, raw, got: S.pp - pp0, helper: window.__V193D.paid('endorse', 2), tree: Object.keys(S.tree).length, price: window.__V179.price(N.branch) }
})
ok(R.got === R.paid && R.helper === R.paid && R.paid > R.raw && R.tree === 0 && R.price === 24, 'the respec refunds what the two levels cost (×24 the core price), not a 24th of it', R)
const R0 = await M(() => { const X = window.__GRIDIRON_AUDIT__, S = X.getState(); S.tree = { endorse: 2 }; S.pp = 0; S.respecUsed = 0; window.RIB_TUNE.v193Drefund = 0; window.respecTree(); delete window.RIB_TUNE.v193Drefund; return S.pp })
ok(R0 === R.raw, 'kill switch v193Drefund 0: the old cost·mult^i refund', { got: R0, raw: R.raw })

// 5: kill switch v193D 0 — the old three-box card and its notes, no season card
await setup({ tree: { endorse: 3 }, level: 4, seasons: 9, titles: 1, tune: { v193D: 0 } })
const K = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(); window.__V136_C.bank(30, 'goal')
  window.go('season'); const season = !!document.getElementById('seasonGainV193D')
  window.go('gameover')
  const r = { season, ledger: !!document.getElementById('payLedgerV193D'), note: !!document.querySelector('.bank-note-v136'), boost: /boosted PP earnings/.test(document.getElementById('screen').innerText), stored: !!S.player._ledgerV193D }
  delete window.RIB_TUNE.v193D
  return r
})
ok(!K.season && !K.ledger && K.note && K.boost && !K.stored, 'kill switch v193D 0: the old card (its notes), no season card, nothing stored', K)

ok(errs.length === 0, 'no page errors', errs.slice(0, 5))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
