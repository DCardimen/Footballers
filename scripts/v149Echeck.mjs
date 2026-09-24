// Dev check (v149 E THE STORE IS WIRED, AND SWITCHED OFF) — src/27-monetize.js, docs/MONETIZATION.md.
//
// OFF (the default, what every player gets): the module exposes window.RIB_MONETIZE and does NOTHING else.
//   Proved against a boot with the file BLOCKED: the same setSpeed and buy functions (not wrappers), the same
//   localStorage keys, no injected node or style, and not one timer, listener, observer or storage write made
//   from the file. The API answers "nothing held, every speed free, no offer".
// ON (`?monetize=1`, honoured on a dev host only): the 4× button is locked on a fresh device, the offer chip sits
//   under the live speed row, a mock rewarded ad grants 4× for 20 minutes (closing it early grants nothing), the
//   fake clock expires it and the live speed steps back to 2×, the entitlement survives a reload and is NOT in the
//   save (a hard reset, an imported save and a new career leave it alone), a hand-edited entitlement store is
//   refused, a mock Pro purchase removes every ad offer and makes 4× permanent, restore() brings it back, the
//   career-end chip doubles the settle once, and the store screen fits a 400x860 phone with no page scroll.
//
//   GAME_URL=http://localhost:5351/index.html node scripts/v149Echeck.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import { gameUrl } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114'].concat(q).join('&')
const ON = ['monetize=1', 'monetizeAdMs=500']
const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const errors = []
const SHOTS = process.env.SHOTS || ''
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}_${name}.png` }) }
const tap = (p, sel) => p.click(sel, { timeout: 5000 }).catch((e) => console.log('     (tap failed: ' + sel + ' — ' + String(e.message).split('\n')[0] + ')'))
const W = 400, H = 860
const newCtx = async () => {
  const context = await browser.newContext({ viewport: { width: W, height: H } })
  await context.addInitScript(() => { setInterval(() => { try { document.querySelector('.onboard')?.remove() } catch {} }, 60) })
  return context
}
const watch = (page, tag) => page.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
const booted = (page) => page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.RIB_MONETIZE, null, { timeout: 30000 })
  .then(() => page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null))
  .then(() => page.waitForTimeout(1000))
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
const step = async (page, t, wait = 900) => {
  const r = await page.evaluate(({ t, visSrc }) => { const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis).filter((e) => !e.closest('#rib-coach-v119') && !e.closest('.mz149-veil')); const txt = (e) => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    const el = t === 'POS' ? (els.find((e) => /^RB\b/.test(txt(e))) || els.find((e) => e.classList.contains('pos-card'))) : els.find((e) => txt(e).includes(t))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return txt(el).slice(0, 40) } return null }, { t, visSrc: vis }).catch((e) => 'ERR ' + e.message)
  await page.waitForTimeout(wait); return r
}
const M = (page, fn, arg) => page.evaluate(fn, arg)

// ============================== 1. OFF: the file is present and changes nothing ==============================
{
  // record every side effect whose stack passes through 27-monetize.js
  const spy = () => {
    const hits = window.__mzSpy = []
    const from = () => /27-monetize\.js/.test(new Error().stack || '')
    const wrap = (obj, name, label) => { const f = obj[name]; if (typeof f !== 'function') return; obj[name] = function () { if (from()) hits.push(label); return f.apply(this, arguments) } }
    wrap(window, 'setInterval', 'setInterval'); wrap(window, 'setTimeout', 'setTimeout'); wrap(window, 'requestAnimationFrame', 'raf')
    wrap(EventTarget.prototype, 'addEventListener', 'addEventListener'); wrap(Storage.prototype, 'setItem', 'setItem'); wrap(Storage.prototype, 'removeItem', 'removeItem')
    wrap(Document.prototype, 'createElement', 'createElement'); wrap(Node.prototype, 'appendChild', 'appendChild'); wrap(Node.prototype, 'insertBefore', 'insertBefore')
    const MO = window.MutationObserver; window.MutationObserver = function (cb) { if (from()) hits.push('MutationObserver'); return new MO(cb) }
  }
  const snapshot = () => ({
    setSpeed: String(window.setSpeed), buy: String(window.buy),
    keys: Object.keys(localStorage).sort(),
    nodes: document.querySelectorAll('[id^="mz149"],[class*="mz149"],#mz149css').length,
    win: Object.keys(window).filter((k) => /monet|mz149/i.test(k))
  })
  const ctxA = await newCtx(), a = await ctxA.newPage(); watch(a, 'off')
  await a.addInitScript(spy)
  await a.goto(U(), { waitUntil: 'networkidle', timeout: 40000 }); await booted(a)
  const ctxB = await newCtx(), b = await ctxB.newPage(); watch(b, 'blocked')
  await b.route(/27-monetize\.js/, (r) => r.abort())
  await b.goto(U(), { waitUntil: 'networkidle', timeout: 40000 })
  await b.waitForFunction(() => !!window.__GRIDIRON_AUDIT__, null, { timeout: 30000 }); await b.waitForTimeout(1500)
  const sa = await a.evaluate(snapshot), sb = await b.evaluate(snapshot)
  ok(sa.setSpeed === sb.setSpeed && /^function setSpeed\(/.test(sa.setSpeed), 'OFF: window.setSpeed is the game\'s own setSpeed() (ml before v149 C), exactly as with the file blocked', sa.setSpeed.slice(0, 40))
  ok(sa.buy === sb.buy, 'OFF: window.buy is the same function as with the file blocked (the patch layer\'s haptics wrapper, nothing on top)')
  ok(JSON.stringify(sa.keys) === JSON.stringify(sb.keys), 'OFF: the same localStorage keys as with the file blocked — nothing written', JSON.stringify(sa.keys))
  ok(sa.nodes === 0, 'OFF: no store chip, offer row, sheet or stylesheet is injected')
  ok(JSON.stringify(sa.win) === '["RIB_MONETIZE"]' && JSON.stringify(sb.win) === '[]', 'OFF: the one new global is window.RIB_MONETIZE', JSON.stringify(sa.win))
  const hits = await a.evaluate(() => window.__mzSpy.slice())
  ok(hits.length === 0, 'OFF: not one timer, listener, observer, element or storage write is made from the file', JSON.stringify(hits))
  const api = await a.evaluate(async () => { const R = window.RIB_MONETIZE
    const ad = await R.showRewarded('speed4'), buy = await R.purchase('rib.pro'), rs = await R.restore()
    return { enabled: R.enabled, has: R.has('pro') || R.has('speed4'), until: R.until('speed4'), s4: R.speedAllowed(4), grant: R.grant('speed4', { minutes: 20 }), list: R.list().length, boost: R.claimPayoutBoost(1000, 'x'),
      ad, buy, rs: rs.ok, hooks: Object.keys(R.hooks).length, fn: ['has', 'until', 'grant', 'list', 'onChange', 'showRewarded', 'purchase', 'restore', 'track'].every((k) => typeof R[k] === 'function'),
      keys: Object.keys(localStorage).filter((k) => /monetize/.test(k)) } })
  ok(api.fn && api.enabled === false, 'OFF: the API is all there, and says it is off')
  ok(!api.has && api.until === 0 && api.s4 === true && api.grant === false && api.list === 0 && api.boost === 0 && api.hooks === 0, 'OFF: nothing is held, grant() refuses, every speed is allowed, the payout boost is 0, no hook installed', JSON.stringify(api))
  ok(api.ad.rewarded === false && api.ad.reason === 'disabled' && api.buy.ok === false && api.buy.reason === 'disabled' && api.keys.length === 0, 'OFF: an ad resolves {rewarded:false,reason:"disabled"}, a purchase {ok:false}, and still nothing is stored')
  // the career-end screens settle exactly as without the file
  const seedEnd = (p, view) => p.evaluate((view) => { const A = window.__GRIDIRON_AUDIT__, S = A.getState(); S.tutorialSeen = true; S.pp = 100
    S.player = A.newPlayer(); S.player.pos = 'RB'; S.player.level = 5; S.player.totalSeasons = 8; S.player.career = [{ level: 'College', ovr: 60, age: 21 }]; S.view = view; window.GridironStorage.save(S) }, view)
  await seedEnd(a, 'gameover'); await seedEnd(b, 'gameover')
  await a.goto(U(), { waitUntil: 'networkidle' }); await booted(a)
  await b.goto(U(), { waitUntil: 'networkidle' }); await b.waitForFunction(() => !!window.__GRIDIRON_AUDIT__); await b.waitForTimeout(1500)
  const pa = await a.evaluate(() => { const S = __GRIDIRON_AUDIT__.getState(); return { pp: S.pp, view: S.view, chip: !!document.getElementById('mz149Pay') } })
  const pb = await b.evaluate(() => { const S = __GRIDIRON_AUDIT__.getState(); return { pp: S.pp, view: S.view } })
  ok(pa.view === 'gameover' && pb.view === 'gameover' && !pa.chip && Math.abs(pa.pp - pb.pp) <= Math.max(2, pb.pp * 0.05), 'OFF: the career-end payout settles with no offer, the same size as with the file blocked', JSON.stringify({ with: pa, without: pb }))
  await ctxA.close(); await ctxB.close()
}

// ============================== 2. ON: the career payout, doubled once ==============================
{
  const ctx = await newCtx(), p = await ctx.newPage(); watch(p, 'pp')
  await p.goto(U(...ON), { waitUntil: 'networkidle', timeout: 40000 }); await booted(p)
  await p.evaluate(() => { const A = window.__GRIDIRON_AUDIT__, S = A.getState(); S.tutorialSeen = true; S.pp = 100
    S.player = A.newPlayer(); S.player.pos = 'RB'; S.player.level = 5; S.player.totalSeasons = 8; S.player.career = [{ level: 'College', ovr: 60, age: 21 }]; S.view = 'gameover'; window.GridironStorage.save(S) })
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  await p.waitForSelector('#mz149Pay', { timeout: 8000 }).catch(() => null)
  const before = await p.evaluate(() => { const S = __GRIDIRON_AUDIT__.getState(), e = S.player; return { pp: S.pp, settle: Math.round((e._vaultPayV137 || 0) - (e._ppBankV136 || 0)), chip: (document.querySelector('#mz149Pay button') || {}).textContent || '' } })
  await shot(p, 'payout')
  ok(before.settle > 0 && /double this payout/.test(before.chip), 'ON: the career-end screen offers "Watch an ad: double this payout"', JSON.stringify(before))
  await tap(p, '#mz149Pay button'); await p.waitForSelector('#mz149Ad', { timeout: 3000 }).catch(() => null)
  const adUp = await p.evaluate(() => !!document.getElementById('mz149Ad'))
  await p.waitForFunction(() => !document.getElementById('mz149Ad'), null, { timeout: 5000 }).catch(() => null); await p.waitForTimeout(400)
  const after = await p.evaluate(() => { const S = __GRIDIRON_AUDIT__.getState(); return { pp: S.pp, mark: S.player._ppDoubledV149E, chip: !!document.getElementById('mz149Pay'), held: RIB_MONETIZE.has('ppDouble'), saved: JSON.parse(localStorage.getItem('gridiron_save_v1')).pp } })
  ok(adUp && after.pp === before.pp + before.settle && after.mark === before.settle && !after.chip && !after.held && after.saved === after.pp, 'ON: the mock ad plays, the settle is paid a second time (once), the chip goes, the ppDouble is spent and the save holds it', JSON.stringify(after))
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const again = await p.evaluate(() => ({ pp: __GRIDIRON_AUDIT__.getState().pp, chip: !!document.getElementById('mz149Pay') }))
  ok(again.pp === after.pp && !again.chip, 'ON: a reload on the same screen offers nothing again and mints nothing', JSON.stringify(again))
  await ctx.close()
}

// ============================== 3. ON: the speed row, the ad, the clock, the save, Pro ==============================
{
  const ctx = await newCtx(), p = await ctx.newPage(); watch(p, 'on')
  await p.goto(U(...ON), { waitUntil: 'networkidle', timeout: 40000 }); await booted(p)
  const s0 = await M(p, () => ({ on: RIB_MONETIZE.enabled, hooks: RIB_MONETIZE.hooks, s4: RIB_MONETIZE.speedAllowed(4), s2: RIB_MONETIZE.speedAllowed(2), list: RIB_MONETIZE.list(), css: !!document.getElementById('mz149css') }))
  ok(s0.on && s0.hooks.setSpeed && s0.hooks.buy && s0.css, 'ON: ?monetize=1 on a dev host turns it on and installs the setSpeed / buy hooks', JSON.stringify(s0.hooks))
  ok(!s0.s4 && s0.s2 && s0.list.length === 0, 'ON: a fresh device (no career yet — not grandfathered) has 1–2× free and 4× locked')

  // drive a real first week into the live game
  await p.waitForSelector('#rib-main-menu-v2 .rib9-tiles', { timeout: 30000 }).catch(() => null); await p.waitForTimeout(600)
  for (const t of ['START NEW CAREER', 'Lock In Personality', 'POS', 'PLAY 8-GAME SEASON']) await step(p, t)
  await p.waitForSelector('#gv139gate', { timeout: 15000 }).catch(() => null)
  await tap(p, '#gv42go'); await p.waitForTimeout(500)
  await p.waitForFunction(() => { const g = document.getElementById('gv42go'); return g && g.style.display !== 'none' && g.getBoundingClientRect().height > 0 }, null, { timeout: 30000 }).catch(() => null)
  await tap(p, '#gv42go'); await p.waitForTimeout(600)
  const top = await M(p, () => { const c = document.querySelector('.topbar .mz149-top'); return c ? { t: c.textContent, r: c.getBoundingClientRect().right } : null })
  ok(top && top.t === 'STORE' && top.r <= W, 'ON: the shell\'s top bar wears a STORE chip, on screen', JSON.stringify(top))
  await step(p, 'CONFIRM TRAINING'); await step(p, 'PLAY WEEK 1 LIVE')
  await p.waitForSelector('#pregameV1513', { timeout: 15000 }).catch(() => null)
  for (let i = 0; i < 12; i++) {
    if (await M(p, () => !!document.querySelector('.speed-row'))) break
    const r = await step(p, 'CONTINUE TO MATCH', 1500) || await step(p, 'THE GAME PLAN', 900) || await step(p, 'NEXT', 800)
    if (!r) await p.waitForTimeout(1000)
  }
  await p.waitForSelector('.speed-row', { timeout: 60000 }).catch(() => null)
  await p.waitForTimeout(1200)
  const row = await M(p, () => { const b4 = document.querySelector('.speed-btn[data-spd="4"]'), off = document.querySelector('.speed-row + .mz149-offer-row button')
    return { live: !!document.querySelector('.speed-row'), lock: !!(b4 && b4.classList.contains('mz149-lock')), offer: off ? off.textContent : null, speed: window.__getGridironLiveSpeed() } })
  ok(row.live, 'reached the live game', JSON.stringify(row))
  await shot(p, 'live')
  ok(row.lock && /Watch an ad: 4× for 20 min/.test(row.offer || ''), 'ON: the 4× button wears the AD badge and "▶ Watch an ad: 4× for 20 min" sits under the speed row', JSON.stringify(row))
  // tapping 4× while locked does not change the speed; it offers the ad
  await tap(p, '.speed-btn[data-spd="2"]'); await p.waitForTimeout(200)
  await tap(p, '.speed-btn[data-spd="4"]'); await p.waitForTimeout(400)
  const tapped = await M(p, () => ({ speed: window.__getGridironLiveSpeed(), sheet: !!document.getElementById('mz149Sheet'), active: (document.querySelector('.speed-btn.active[data-spd]') || {}).dataset?.spd }))
  ok(tapped.speed === 2 && tapped.sheet && tapped.active === '2', 'ON: tapping the locked 4× keeps 2× and opens the offer sheet instead', JSON.stringify(tapped))
  // close the ad early: no reward
  await M(p, () => { RIB_MONETIZE.config.mock.adMs = 6000 })   // long enough to walk away from on a busy machine
  await tap(p, '#mz149Sheet [data-yes]'); await p.waitForSelector('#mz149Ad', { timeout: 3000 }).catch(() => null)
  await tap(p, '#mz149Ad [data-close]'); await p.waitForTimeout(300); await M(p, () => { RIB_MONETIZE.config.mock.adMs = 500 })
  const early = await M(p, () => ({ has: RIB_MONETIZE.has('speed4'), speed: window.__getGridironLiveSpeed(), ev: RIB_MONETIZE.dev.events.map((e) => e.ev).slice(-2) }))
  ok(!early.has && early.speed === 2, 'ON: closing the ad before it ends grants nothing (the rewarded-ad contract)', JSON.stringify(early))
  // watch it to the end from the chip under the row
  await tap(p, '.mz149-offer-row button'); await p.waitForSelector('#mz149Ad', { timeout: 3000 }).catch(() => null)
  await p.waitForFunction(() => !document.getElementById('mz149Ad'), null, { timeout: 6000 }).catch(() => null); await p.waitForTimeout(1300)
  const got = await M(p, () => { const R = RIB_MONETIZE, u = R.until('speed4'), n = R.dev.now(); return { has: R.has('speed4'), mins: (u - n) / 60000, speed: window.__getGridironLiveSpeed(), lock: !!document.querySelector('.speed-btn[data-spd="4"]')?.classList.contains('mz149-lock'), chip: (document.querySelector('.mz149-offer-row button') || {}).textContent } })
  ok(got.has && got.mins > 19.5 && got.mins <= 20.01 && got.speed === 4 && !got.lock && /4× · \d{1,2}:\d\d LEFT/.test(got.chip || ''), 'ON: a watched ad grants 4× for 20 minutes, switches the game to 4× and the chip counts it down', JSON.stringify(got))
  // the fake clock: 21 minutes on, the boost is gone and the live game steps back to 2×
  await M(p, () => RIB_MONETIZE.dev.advance(21 * 60000)); await p.waitForTimeout(1400)
  const exp = await M(p, () => ({ has: RIB_MONETIZE.has('speed4'), speed: window.__getGridironLiveSpeed(), lock: document.querySelector('.speed-btn[data-spd="4"]')?.classList.contains('mz149-lock') }))
  ok(!exp.has && exp.speed === 2 && exp.lock, 'ON: after 21 (fake) minutes the boost has expired, the live speed is back to 2× and 4× is locked again', JSON.stringify(exp))
  await M(p, () => RIB_MONETIZE.dev.advance(-21 * 60000))

  // a second ad (straight through the API), then a reload: it is still held, and it is not in the save
  const r2 = await M(p, () => RIB_MONETIZE.showRewarded('speed4'))
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const rl = await M(p, () => ({ has: RIB_MONETIZE.has('speed4'), save: /speed4|rib\.monetize|noAds/.test(localStorage.getItem('gridiron_save_v1') || ''), store: !!localStorage.getItem('rib.monetize.ents.v1') }))
  ok(r2.rewarded && rl.has && rl.store && !rl.save, 'ON: the boost survives a reload, in its own storage key — the game save does not mention it', JSON.stringify(rl))
  // a new career, an imported save and a hard reset leave it alone
  // v150 A: import writes the save and reloads through boot() (so the migrations run), and both it and the reset
  // ask through the in-app ribDialog — press its confirm, then read the result after the reload
  const yes = () => { const d = document.getElementById('ribDlgV149'); const x = d && d.querySelector('button.danger-v149, button.primary-v149'); if (x) x.click(); return !!x }
  const ind = await M(p, async (yesSrc) => { const yes = eval(yesSrc), A = __GRIDIRON_AUDIT__, out = {}
    const S = A.freshState(); S.tutorialSeen = true; A.setState(S); window.GridironStorage.save(S); out.fresh = RIB_MONETIZE.has('speed4')
    const code = btoa(unescape(encodeURIComponent(JSON.stringify({ prestige: 3, pp: 5, tree: {}, settings: {} }))))
    window.__PLATFORM_V149.noReload = true
    const pr = window.importSave(code); out.asked = yes(); out.accepted = await pr
    out.imported = RIB_MONETIZE.has('speed4') && JSON.parse(localStorage.getItem('gridiron_save_v1')).prestige === 3
    return out }, yes.toString())
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const ind1 = await M(p, async (yesSrc) => { const yes = eval(yesSrc), A = __GRIDIRON_AUDIT__, out = { loaded: A.getState().prestige === 3 }
    const pr = window.hardReset(); out.asked = yes(); await pr
    out.reset = RIB_MONETIZE.has('speed4') && A.getState().prestige === 0
    return out }, yes.toString())
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const ind2 = await M(p, () => RIB_MONETIZE.has('speed4'))
  ok(ind.fresh && ind.imported && ind1.loaded && ind1.reset && ind2, 'ON: a new career, an imported save and a hard reset neither grant nor take the entitlement', JSON.stringify({ ...ind, ...ind1, afterReload: ind2 }))

  // the store screen fits a 400x860 phone, with no page scroll
  const fit = async (tag) => { await M(p, () => RIB_MONETIZE.openStore()); await p.waitForTimeout(300)
    const f = await M(p, () => { const c = document.querySelector('#mz149Store .mz149-card'), r = c.getBoundingClientRect(), s = document.scrollingElement
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), clip: c.scrollHeight > c.clientHeight + 1, pageScroll: s.scrollHeight > innerHeight + 1 || s.scrollWidth > innerWidth + 1, ad: !!c.querySelector('[data-sec=ad]'), font: getComputedStyle(c.querySelector('.mz149-h')).fontFamily } })
    ok(f.top >= 0 && f.bottom <= H && f.left >= 0 && f.right <= W && !f.clip && !f.pageScroll && /Oswald/.test(f.font), `ON: the store (${tag}) fits 400x860 whole — nothing clipped, no page scroll, Oswald`, JSON.stringify(f)); return f }
  const f1 = await fit('free player'); await shot(p, 'store')
  ok(f1.ad, 'ON: a free player\'s store carries the free-boost ad')
  // Pro through the mock checkout
  await tap(p, '#mz149Store [data-buy="rib.pro"]'); await p.waitForSelector('#mz149Buy', { timeout: 3000 }).catch(() => null)
  await tap(p, '#mz149Buy [data-yes]'); await p.waitForTimeout(600)
  const pro = await M(p, async () => { const R = RIB_MONETIZE; const ad = await R.showRewarded('speed4'); return { pro: R.has('pro'), noAds: R.has('noAds'), s4: R.until('speed4') === Infinity, slots: R.value('saveSlots'), ad: ad.reason, top: (document.querySelector('.mz149-top') || {}).textContent } })
  ok(pro.pro && pro.noAds && pro.s4 && pro.slots === 3 && pro.ad === 'no-ads-entitlement' && pro.top === 'PRO ✓', 'ON: the mock Pro purchase grants pro + noAds + permanent 4× + 3 save slots, and no ad will show any more', JSON.stringify(pro))
  const f2 = await fit('Pro'); ok(!f2.ad, 'ON: the Pro store has no ad offer')
  await M(p, () => RIB_MONETIZE.closeStore())
  // the live speed row for a Pro: no badge, no offer
  const proRow = await M(p, () => { const d = document.createElement('div'); d.innerHTML = '<div class="speed-row" id="mzTestRow"><button class="speed-btn" data-spd="4">4×</button></div>'; document.body.appendChild(d); return new Promise((r) => setTimeout(() => { const o = { lock: document.querySelector('#mzTestRow [data-spd="4"]').classList.contains('mz149-lock'), offer: !!document.querySelector('#mzTestRow + .mz149-offer-row') }; d.remove(); r(o) }, 300)) })
  ok(!proRow.lock && !proRow.offer, 'ON: for a Pro the speed row has no AD badge and no offer chip', JSON.stringify(proRow))
  // a hand-edited entitlement store is refused; restore() brings the purchase back from the store's records
  await M(p, () => { const k = 'rib.monetize.ents.v1', j = JSON.parse(localStorage.getItem(k)); j.e.forged = { until: null, uses: null, source: 'me' }; localStorage.setItem(k, JSON.stringify(j)) })
  await p.goto(U(...ON), { waitUntil: 'networkidle' }); await booted(p)
  const tam = await M(p, () => ({ t: RIB_MONETIZE.tampered, pro: RIB_MONETIZE.has('pro'), forged: RIB_MONETIZE.has('forged') }))
  ok(tam.t && !tam.pro && !tam.forged, 'ON: an entitlement store edited by hand fails its tag and is discarded', JSON.stringify(tam))
  const rs = await M(p, async () => { const r = await RIB_MONETIZE.restore(); return { r, pro: RIB_MONETIZE.has('pro'), s4: RIB_MONETIZE.until('speed4') === Infinity } })
  ok(rs.r.ok && rs.pro && rs.s4, 'ON: RESTORE PURCHASES re-grants Pro from the provider\'s records', JSON.stringify(rs))
  await ctx.close()
}

// ============================== 4. the flag is dev-only ==============================
{
  const src = fs.readFileSync(new URL('../src/27-monetize.js', import.meta.url), 'utf8')
  ok(/var MONETIZE_ENABLED = false;/.test(src), 'the master switch ships FALSE')
  ok(/if \(DEV_HOST\) \{[^}]*QS\.get\("monetize"\)/.test(src), '?monetize=1 is read only on a dev host (localhost / 127.0.0.1 / file:)')
  ok(/if \(!ON\) return;/.test(src), 'OFF returns before any hook or UI is built')
}

console.log(JSON.stringify({ pass, fail }))
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
