// Dev check: v192 B THE CAREER'S END, IN THE VAULT (src/07-career-app.js).
//   1 the top bar's 🏦 shows × the career's PP multiplier over the pot, and fits a 360 px top bar
//   2 the breakdown (the chip, the prestige screen): every multiplier, the flat PP tallied by source, the pot
//   3 the career's end opens the Vault (no coin rain over the screen); its one exit is the main menu
//   4 a failed declare is final: the bottom nav / the hub / a reload cannot roll it again
//   5 ribDialog confirms: a major medal reward, "pick the rest for me", a Prestige Path, raising the chaos lock
//   6 the season screen's team quality card: before → after the prestige (team nodes, Locker Room, legacy share)
// No page errors.  GAME_URL=http://localhost:5173/ node scripts/v192Bcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + (e.message || String(e))))
await page.addInitScript(() => { setInterval(() => { for (const s of ['.onboard', '#personaV13', '#growthV42', '#gv139gate']) document.querySelector(s)?.remove() }, 80) })
const boot = async () => {
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V192B && !!window.__RIB_VAULT_BRIDGE && !!window.ribDialog, null, { timeout: 40000 })
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
  return true
}, o)
const dlgOpen = () => M(() => !!window.ribDialog.isOpen)
const dlgClick = (i) => M((i) => { const b = document.querySelector('.rib-dlg-v149 button[data-i="' + i + '"]'); b && b.click(); return !!b }, i)

// 1 + 2: the chip and the breakdown
await setup({ tree: { endorse: 3, brand: 2 }, era: 2, pp: 1234567, titles: 2, seasons: 9 })
const A = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player
  window.__V136_C.bank(25000, 'goal'); window.__V136_C.bank(120, 'milestone')
  S.bankShownV189 = window.__V189.pot(p)
  window.go('hub')
  const b = document.getElementById('ppBankChipV139'), tb = document.querySelector('.topbar')
  const want = (1 + 3 * 0.2 + 2 * 0.35) * Math.pow(1.2, 2) * X.tierPPMult(p) * X.pathVal('ppMult', 1) * X.chaosEarnedMult(p.level)
  return { html: b.innerHTML, hidden: b.hidden, mult: window.__V192B.mult().total, want, pot: window.__V189.pot(p), shown: window.__V189.shown(), tally: p.ppFlatV192B, sw: tb.scrollWidth, cw: tb.clientWidth, chipR: Math.round(b.getBoundingClientRect().right), barR: Math.round(tb.getBoundingClientRect().right) }
})
ok(!A.hidden && A.html.includes('×' + A.mult.toFixed(2)) && /🏦[\d.,]+[KM]?/.test(A.html) && A.shown > 0, /* v192 A caps the flat bank at half the pay, so the pot is not the raw 25K */ 'the 🏦 chip shows × the career multiplier over the pot', A.html)
ok(Math.abs(A.mult - A.want) < 1e-6, 'the × is the payout formula\'s multiplier (tree nodes × era × tier × path × chaos)', { mult: A.mult, want: A.want })
ok(A.sw <= A.cw && A.chipR <= A.barR, 'the top bar fits 360 px — nothing clipped', A)
ok(A.tally && A.tally.goal === 25000 && A.tally.milestone === 120, 'flat PP banked this career is tallied by where it came from', A.tally)
await page.click('#ppBankChipV139')
await page.waitForTimeout(300)
const B = await M(() => { const d = document.querySelector('.rib-dlg-v149'); return { open: !!window.ribDialog.isOpen, text: d ? d.innerText : '' } })
ok(B.open && /Endorsements/.test(B.text) && /Global Brand/.test(B.text) && /Era/.test(B.text) && B.text.includes('×' + A.mult.toFixed(2)), 'tapping the chip opens the breakdown: every multiplier with its value', B.text.slice(0, 200))
ok(/Goals & challenges · flat/.test(B.text) && /Level milestones/.test(B.text) && /Projected at the career's end/.test(B.text) && /FLAT PRESTIGE BONUSES/.test(B.text), 'the breakdown lists the flat PP by source, the projected total and the flat bonuses on offer', B.text.slice(200, 700))
await page.screenshot({ path: '/tmp/v192B-breakdown.png' })
await M(() => window.ribDialog.close())
const Bs = await M(() => { window.go('shop'); const b = document.getElementById('ppBreakBtnV192B'); b && b.click(); const r = { btn: !!b, open: !!window.ribDialog.isOpen }; window.ribDialog.close(); return r })
ok(Bs.btn && Bs.open, 'the prestige screen has the breakdown button, and it opens it', Bs)

// 6: the team's quality, before and after
await setup({ tree: { culture: 6, lkAll: 220 }, level: 4 })
const T = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), N = X.TREE_NODES
  const k = Object.keys(N).find((k) => N[k].fx && N[k].fx.teamLiftV190 === 1 && N[k].name === 'Winning Culture')
  S.tree = { lkAll: 220 }; S.tree[k] = 6
  const Q = window.__V192B.team(), pair = window.__TEAMPAIR_V76(S.player).us
  window.go('season')
  const el = document.getElementById('teamQualV192B')
  return { k, Q, pair, text: el ? el.innerText : '' }
})
ok(T.Q && T.Q.full === T.pair && T.Q.full > T.Q.base && T.Q.lift > 0 && T.Q.locker === 10 && T.Q.full - T.Q.base === T.Q.lift + T.Q.locker + T.Q.share, 'team OVR before → after: the team nodes and the Locker Room add up to the badge\'s number', T.Q)
ok(new RegExp(T.Q.base + '\\s*→\\s*' + T.Q.full).test(T.text) && /team nodes/.test(T.text) && /Locker Room/.test(T.text), 'the season screen shows the team quality card', T.text)
await M(() => document.getElementById('teamQualV192B')?.scrollIntoView())
await page.screenshot({ path: '/tmp/v192B-team.png' })

// 4: one roll — a failed declare cannot be rolled again
await setup({ level: 2, sal: 3, seasons: 6 })
const D = await M(async () => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState(), p = S.player
  window.go('hub')
  const R = Math.random; Math.random = () => 0.9999
  try { window.declareFromHub() } finally { Math.random = R }
  const v0 = S.view
  document.getElementById('verdictV179')?.remove()
  document.querySelector('#navV139 button[data-k=hub]')?.click()
  await new Promise((r) => setTimeout(r, 300))
  const v1 = X.getState().view
  window.go('training'); const v2 = X.getState().view
  Math.random = () => 0; try { window.declareFromHub(); window.declareAdvance() } finally { Math.random = R }
  return { v0, v1, v2, level: X.getState().player.level, sealed: window.__V192B.sealed() }
})
ok(D.v0 === 'declineResult' && D.v1 === 'declineResult' && D.v2 === 'declineResult', 'after a failed declare the bottom nav\'s HUB and the training pick land back on the epitaph', D)
ok(D.level === 2 && D.sealed === 'declineResult', 'a sure roll afterwards does not advance — the declare was one shot', D)
await page.reload({ waitUntil: 'networkidle' })
await boot()
const D2 = await M(() => { const X = window.__GRIDIRON_AUDIT__; window.go('hub'); return { view: X.getState().view, level: X.getState().player && X.getState().player.level } })
ok(D2.view === 'declineResult' && D2.level === 2, 'and after a reload the menu\'s CONTINUE still lands on the epitaph', D2)
const D3 = await M(() => {
  const X = window.__GRIDIRON_AUDIT__, S = X.getState()
  window.endCareer ? window.endCareer() : window.go('gameover')
  const settled = S.player._settled, over = S.player._careerOverV192B
  window.go('hub'); const v = S.view
  window.chooseRegretVowV12 && window.chooseRegretVowV12('smarter')
  const shop = S.view
  window.go('menu')
  return { settled, over, v, shop, after: S.view, player: !!S.player }
})
ok(D3.settled && D3.over && D3.v === 'gameover', 'a settled career end is sealed too: the hub goes back to it', D3)
ok(D3.shop === 'shop' && D3.after === 'menu' && !D3.player, 'a vow ("Train smarter") → the tree → MENU ends the career; there is nothing to continue', D3)

// 3: the career's end opens the Vault, its one exit the main menu
await setup({ level: 3, seasons: 7, titles: 1, tune: { v192Bvault: 1 } })
await M(() => { document.getElementById('bankRainV189')?.remove() /* an earlier step's rain (4.2 s) is not this one */; const S = window.__GRIDIRON_AUDIT__.getState(); window.__V136_C.bank(300, 'goal'); S.bankShownV189 = window.__V189.pot(S.player); window.go('gameover') })
await page.waitForFunction(() => { const r = document.getElementById('ribVault'); return r && r.classList.contains('up') && r.classList.contains('career-end-v192b') }, null, { timeout: 8000 }).catch(() => null)
await page.waitForTimeout(1200)
const V = await M(() => {
  const r = document.getElementById('ribVault'), S = window.__GRIDIRON_AUDIT__.getState()
  const vis = (s) => { const e = r && r.querySelector(s); return !!(e && e.offsetParent !== null && getComputedStyle(e).display !== 'none') }
  return { up: !!(r && r.classList.contains('up')), mode: !!(r && r.classList.contains('career-end-v192b')), rain: !!document.getElementById('bankRainV189'), back: r && r.querySelector('.rv-back').innerText, exit: r && r.querySelector('[data-end-v192b]') && r.querySelector('[data-end-v192b]').innerText, restock: vis('.rv-restock'), details: vis('.rv-details'), pay: S.player._vaultPayV137, chip: window.__V189.shown(), payday: window.__RIB_VAULT_DEV && window.__RIB_VAULT_DEV.payday ? window.__RIB_VAULT_DEV.payday() : null }
})
ok(V.up && V.mode && !V.rain, 'the career\'s end hands off to the Vault — no coins rained over the screen', V)
ok(/MAIN MENU/i.test(V.back) && /Main Menu/i.test(V.exit) && !V.restock && !V.details, 'in the Vault the only way out is the main menu', V)
ok(V.payday && (V.payday.active || V.payday.done), 'the Vault plays the payday rain', V.payday)
await page.screenshot({ path: '/tmp/v192B-vault.png' })
await page.click('#ribVault [data-end-v192b]')
await page.waitForTimeout(400)
const V2 = await M(() => { const S = window.__GRIDIRON_AUDIT__.getState(); const r = document.getElementById('ribVault'); return { view: S.view, player: !!S.player, open: !!window.__RIB_VAULT.isOpen(), mode: !!(r && r.classList.contains('career-end-v192b')), back: r && r.querySelector('.rv-back').innerText } })
ok(V2.view === 'menu' && !V2.player && !V2.open && !V2.mode && !/MAIN MENU/.test(V2.back), 'MAIN MENU closes the Vault onto the menu (and the Vault is itself again next time)', V2)
await setup({ level: 3, seasons: 7, tune: { v192Bvault: 1, v192B: 0 } })
const V3 = await M(async () => { window.go('gameover'); await new Promise((r) => setTimeout(r, 900)); const r = { rain: !!document.getElementById('bankRainV189'), vault: !!window.__RIB_VAULT.isOpen() }; document.getElementById('bankRainV189')?.remove(); delete window.RIB_TUNE.v192B; return r })
ok(V3.rain && !V3.vault, 'kill switch v192B 0: the v189 C coin rain is back', V3)

// 5: the big choices ask first
await setup({ level: 3, tune: { v192Bconfirm: 1, v192Bvault: 0 } })
const C1 = await M(() => {
  const Md = window.__V179.medals, st = Md.store()
  st.pending = [Md.deal(10, st)]
  Md.open(); Md.tap(0) /* the first tap turns the sealed cards over */
  Md.tap(0)
  return { major: st.pending[0] && st.pending[0].major, left: st.pending.length, open: !!window.ribDialog.isOpen }
})
ok(C1.major && C1.open && C1.left === 1, 'locking in a 10th-medal reward asks first (nothing claimed yet)', C1)
await dlgClick(1)
await page.waitForTimeout(200)
const C2 = await M(() => ({ left: window.__V179.medals.store().pending.length, log: window.__V179.medals.store().log.length }))
ok(C2.left === 0 && C2.log >= 1, 'confirming locks it in', C2)
const C3 = await M(() => {
  const Md = window.__V179.medals, st = Md.store()
  st.pending = [Md.deal(11, st), Md.deal(20, st)]
  window.medalAutoAskV192B()
  return { open: !!window.ribDialog.isOpen, left: st.pending.length }
})
await dlgClick(0)
await page.waitForTimeout(150)
const C3b = await M(() => window.__V179.medals.store().pending.length)
ok(C3.open && C3.left === 2 && C3b === 2, '"pick the rest for me" over a major asks — and Cancel keeps them waiting', { C3, after: C3b })
const C4 = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(); S.honorsV156A = { floor: 200 }; S.path = null; S.pp = 1e6
  window.go('path')
  const card = document.querySelector('#screen .pos-card[onclick^="choosePath"]')
  card && card.click()
  return { card: !!card, open: !!window.ribDialog.isOpen, path: S.path }
})
ok(C4.card && C4.open && !C4.path, 'choosing a Prestige Path asks first', C4)
await dlgClick(1)
await page.waitForTimeout(150)
const C4b = await M(() => window.__GRIDIRON_AUDIT__.getState().path)
ok(!!C4b, 'and commits on confirm', C4b)
const C5 = await M(() => {
  const S = window.__GRIDIRON_AUDIT__.getState(); S.chaos = { a: 5 }; S.chaosLockV186 = 0; S.chaosCap = 30
  const before = S.player && S.player.name
  window.startCareer()
  return { open: !!window.ribDialog.isOpen, same: (S.player && S.player.name) === before, lock: S.chaosLockV186 }
})
ok(C5.open && C5.same && !C5.lock, 'starting a career that raises the chaos lock asks first', C5)
await dlgClick(0)
await M(() => { delete window.RIB_TUNE.v192Bconfirm; delete window.RIB_TUNE.v192Bvault })

ok(errs.length === 0, 'no page errors', errs.slice(0, 5))
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail ? 1 : 0)
