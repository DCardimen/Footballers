// Dev check (v150 A THE BUGS THE AUDIT FOUND).
//
//   1. a hostile name — `<img src=x onerror=…>` and friends — renders as inert TEXT on the hub, the menu,
//      the leaders, the Hall of Fame, the three career-end screens, the team creator and the leaderboard,
//      whether it came in through an input (cleaned there), a stored save (cleaned at boot) or straight
//      into the state (escaped at render);
//   2. the v42 growth dials in Settings save, and survive a reload (they wrote `window.o`, which never existed);
//   3. the declare's one-shot stakes are on screen at the moment of the decision (the report card's dock and the hub's);
//   4. importing a pre-migration save runs the boot migrations on it (the import reloads through boot()),
//      and a save with the wrong shape or markup in it is refused;
//   5. a corrupt save boots from a backup — the one-deep copy, or the v149 D rolling backups — and says so;
//   6. every confirm / prompt / pop-up is the in-app ribDialog: the browser's own is never called, and the
//      sandbox auto-accept shim is gone;
//   7. no page errors.
//
//   node scripts/v150Acheck.mjs            (GAME_URL=http://localhost:5500/ to point it at another server)
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'

const url = gameUrl('index.html')
const U = (q = '') => url + (url.includes('?') ? '&' : '?') + 'stayStale&noGrowV132' + q
const b = await chromium.launch({ executablePath: CHROME })
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errs = []
const PAY = `Bo<img src=x onerror="(window.__xss=window.__xss||[]).push(location.hash||1)">"'&<svg onload=window.__xss2=1>`

async function boot (opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  page.on('pageerror', e => errs.push('PAGEERROR: ' + (e.message || e)))
  page.on('dialog', d => { errs.push('NATIVE DIALOG: ' + d.type() + ' ' + d.message().slice(0, 60)); d.dismiss() })
  await page.addInitScript(() => {
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove() }, 60)
  })
  if (opts.seed) {   // write storage BEFORE the game boots: land on a same-origin non-page first
    await page.goto(gameUrl('rib-build.json'), { waitUntil: 'load' }).catch(() => {})
    await page.evaluate(opts.seed, opts.arg)
  }
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.ribDialog, null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  return { ctx, page }
}
const dlg = page => page.evaluate(() => { const d = document.getElementById('ribDlgV149'); return d ? { title: (d.querySelector('h3') || {}).textContent || '', msg: (d.querySelector('.msg-v149') || {}).textContent || '', frame: !!d.querySelector('iframe'), input: !!d.querySelector('input,textarea') } : null })
const yes = page => page.evaluate(() => { const d = document.getElementById('ribDlgV149'); const x = d && d.querySelector('button.danger-v149, button.primary-v149'); if (x) x.click(); return !!x })
const no = page => page.evaluate(() => { if (!window.ribDialog.isOpen) return false; window.ribDialog.close(); return true })

// ---------------------------------------------------------------------------------------------- 1. names
{
  const { ctx, page } = await boot()
  // (a) through the inputs
  const inp = await page.evaluate((PAY) => {
    const A = window.__GRIDIRON_AUDIT__, S = A.getState()
    window.startCareer()
    const p = S.player || A.getState().player
    window.setPlayerNameV96(PAY)
    const name = A.getState().player.name
    window.__LINEAGE_V139 && window.__LINEAGE_V139.rename('O<b>Neil"x')
    const sur = window.__LINEAGE_V139 ? window.__LINEAGE_V139.surname() : ''
    return { name, sur, has: !!p }
  }, PAY)
  const bad = s => /[<>"'`]/.test(s || '')
  ok(inp.has && !bad(inp.name) && inp.name.length <= 24 && /Bo/.test(inp.name), 'the name box cleans what it stores: no < > quotes or backticks, capped', inp.name)
  ok(!bad(inp.sur), 'the family name is cleaned the same way', inp.sur)

  // (b) straight into the state: every screen that prints it must escape it
  await page.evaluate((PAY) => {
    const A = window.__GRIDIRON_AUDIT__, S = A.getState(), p = S.player
    p.pos = 'RB'; p.level = 4; p.totalSeasons = 6; p.career = [{ level: 'Varsity', ovr: 40, age: 18 }]
    p.name = PAY; p.teamIdentity && (p.teamIdentity.town = PAY)
    S.lineageV136 = { gen: 2, surname: PAY, fathers: [{ name: PAY, pos: 'QB', level: 3, fate: 'cut', seasons: 4 }] }
    S.hof = [{ name: PAY, pos: 'QB', reached: 3, peak: 50, titles: 0, power: 50 }]
  }, PAY)
  const views = ['menu', 'hub', 'season', 'stats', 'leaderboard', 'hof', 'roster', 'challenges', 'declineResult', 'gameover', 'win']
  const hits = {}
  for (const v of views) {
    await page.evaluate(v => { window.__xss = []; window.__xss2 = 0; location.hash = v; window.go(v) }, v)
    await page.waitForTimeout(750)
    const r = await page.evaluate(() => ({ x: (window.__xss || []).length + (window.__xss2 ? 1 : 0), el: document.querySelectorAll('#app img[onerror], #app svg[onload], body > img[onerror]').length,
      lit: /<img src=x/.test((document.getElementById('screen') || {}).textContent || '') || /<img src=x/.test((document.getElementById('rib-main-menu-v2') || document.body).textContent || '') }))
    hits[v] = r
    await page.evaluate(() => { const p = window.S.player; if (p) p._settled = false })
  }
  const burned = Object.entries(hits).filter(([, r]) => r.x || r.el)
  ok(!burned.length, `a raw hostile name in the state renders inert on ${views.length} screens (hub, menu, leaders, HOF, career-end…)`, burned.length ? burned : 'none fired')
  ok(hits.hub.lit && hits.hof.lit, 'and it is shown as the literal text it is', { hub: hits.hub.lit, hof: hits.hof.lit })

  // (c) the team creator: stored names with a quote that used to close value="…"
  await page.evaluate((PAY) => { localStorage.setItem('gridironTeamCustomV153', JSON.stringify({ schoolName: '" autofocus onfocus="window.__xss3=1', teamName: PAY, palette: 1, logo: 1 })); window.__xss = []; window.__xss3 = 0 }, PAY)
  await page.evaluate(() => { window.go('hub'); window.openTeamCreatorV153() }); await page.waitForTimeout(800)
  const tc = await page.evaluate(() => {
    const m = document.getElementById('teamModalV153'), a = document.getElementById('schoolNameV153'), t = document.getElementById('teamNameV153')
    return { open: !!m, school: a && a.value, team: t && t.value, attrs: a ? a.getAttributeNames() : [], fired: (window.__xss || []).length + (window.__xss3 ? 1 : 0), hostile: m ? m.querySelectorAll('img[onerror],svg[onload]').length : -1 }
  })
  ok(tc.open && !tc.fired && !tc.hostile && !tc.attrs.includes('onfocus') && !bad(tc.school) && !bad(tc.team), 'the Team Creator renders stored hostile names as plain values (no attribute break-out)', tc)
  const tcs = await page.evaluate(async (PAY) => {
    document.getElementById('schoolNameV153').value = PAY; document.getElementById('teamNameV153').value = '"><b>x'
    const saved = window.saveTeamCreatorV153() /* v151 B: the save waits on the team-style gate's confirm */
    await new Promise(r => setTimeout(r, 150)); if (window.ribDialog.isOpen) window.ribDialog.close(true)
    await saved
    return JSON.parse(localStorage.getItem('gridironTeamCustomV153'))
  }, PAY)
  ok(!bad(tcs.schoolName) && !bad(tcs.teamName), 'and what it saves is cleaned', { school: tcs.schoolName, team: tcs.teamName })

  // (d) the leaderboard handle
  await page.evaluate(async (PAY) => { window.__xss = []; await window.__lb.setName(PAY); window.go('leaderboard') }, PAY)
  await page.waitForTimeout(900)
  const lb = await page.evaluate(() => ({ handle: localStorage.getItem('rib_lb_handle'), fired: (window.__xss || []).length + (window.__xss2 ? 1 : 0) }))
  ok(!bad(lb.handle) && lb.handle.length <= 16 && !lb.fired, 'the leaderboard handle is cleaned and renders inert', lb)

  // (e) a stored save carrying the payload is cleaned the moment it boots
  await page.evaluate((PAY) => { const S = window.__GRIDIRON_AUDIT__.getState(); S.player.name = PAY; S.hof[0].name = PAY; S.view = 'hub'; window.GridironStorage.save(S) }, PAY)
  await page.goto(U(), { waitUntil: 'networkidle' }); await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__); await page.waitForTimeout(1500)
  const bootc = await page.evaluate(() => { const S = window.__GRIDIRON_AUDIT__.getState(); return { name: S.player.name, hof: S.hof[0].name, sur: S.lineageV136.surname, fired: (window.__xss || []).length } })
  ok(!bad(bootc.name) && !bad(bootc.hof) && !bad(bootc.sur) && !bootc.fired, 'a save with hostile names in it is cleaned at boot (player, Hall, family)', bootc)
  await ctx.close()
}

// ---------------------------------------------------------------------------------------------- 2. growth dials
{
  const { ctx, page } = await boot()
  await page.evaluate(() => { window.startCareer(); window.go('settings') })
  await page.waitForFunction(() => document.querySelectorAll('select[data-growth-dial]').length === 4, null, { timeout: 8000 }).catch(() => {})
  const set = await page.evaluate(() => {
    const pick = (k, v) => { const el = document.querySelector(`select[data-growth-dial="${k}"]`); if (!el) return false; el.value = String(v); el.dispatchEvent(new Event('change', { bubbles: true })); return true }
    const r = { n: document.querySelectorAll('select[data-growth-dial]').length, luck: pick('luck', 2), freq: pick('freq', 3), soften: pick('soften', 2), jive: pick('jive', 0.35) }
    const S = window.__GRIDIRON_AUDIT__.getState()
    r.state = S.settings && { luck: S.settings.growth_luck, freq: S.settings.growth_freq, soften: S.settings.growth_soften, jive: S.settings.growth_jive }
    const saved = JSON.parse(localStorage.getItem('gridiron_save_v1') || '{}').settings || {}
    r.saved = { luck: saved.growth_luck, freq: saved.growth_freq, soften: saved.growth_soften, jive: saved.growth_jive }
    return r
  })
  ok(set.n === 4 && set.state && set.state.luck === 2 && set.state.freq === 3 && set.state.soften === 2 && set.state.jive === 0.35, 'the four growth dials write the live settings', set.state)
  ok(set.saved.luck === 2 && set.saved.freq === 3 && set.saved.soften === 2 && set.saved.jive === 0.35, '…and the save on disk', set.saved)
  await page.goto(U(), { waitUntil: 'networkidle' }); await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__); await page.waitForTimeout(1200)
  await page.evaluate(() => window.go('settings'))
  await page.waitForFunction(() => document.querySelectorAll('select[data-growth-dial]').length === 4, null, { timeout: 8000 }).catch(() => {})
  const back = await page.evaluate(() => { const S = window.__GRIDIRON_AUDIT__.getState(), v = k => (document.querySelector(`select[data-growth-dial="${k}"]`) || {}).value
    return { luck: S.settings.growth_luck, freq: S.settings.growth_freq, shown: { luck: v('luck'), freq: v('freq'), soften: v('soften'), jive: v('jive') } } })
  ok(back.luck === 2 && back.freq === 3 && back.shown.luck === '2' && back.shown.freq === '3' && back.shown.soften === '2' && back.shown.jive === '0.35', 'they survive a reload, and the dropdowns show what was picked', back)
  await ctx.close()
}

// ---------------------------------------------------------------------------------------------- 3. the declare's stakes
{
  const { ctx, page } = await boot()
  const r = await page.evaluate(() => {
    const A = window.__GRIDIRON_AUDIT__
    window.startCareer()
    const S = A.getState(), p = S.player
    p.pos = 'RB'; p.level = 3; p.seasonsAtLevel = Math.max(1, A.minSeasonsRequired()); p.age = 17
    let err = ''
    const play = () => p.weekResults.forEach(w => { if (!w.played) { w.played = true; w.perf = 95; w.us = 35; w.them = 7; w.won = true } })
    try { A.startSeasonGames(); for (let i = 0; i < 8; i++) { play(); A.ensurePlayoffs(p) } play(); window.finishSeasonGames() } catch (e) { err = String(e) }
    return { err }
  })
  await page.waitForTimeout(900)
  const vis = `el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && r.bottom <= innerHeight + 1 && r.top >= 0 }`
  const res = await page.evaluate((vs) => {
    const vis = eval(vs), d = document.getElementById('dock')
    const btn = d && [...d.querySelectorAll('button')].find(b => /declareAdvance/.test(b.getAttribute('onclick') || ''))
    const st = d && d.querySelector('.declare-stakes-v150')
    return { view: window.S.view, button: !!btn && vis(btn), stakes: !!st && vis(st), text: st ? st.innerText : '' }
  }, vis)
  ok(!r.err && res.view === 'result' && res.button, 'the report card offers the declare', { ...res, err: r.err })
  ok(res.stakes && /one shot/i.test(res.text), 'and the one-shot stakes sit ON SCREEN beside the button (not in a hidden report-card tab)', res.text)
  await page.evaluate(() => window.go('hub')); await page.waitForTimeout(800)
  const hub = await page.evaluate((vs) => { const vis = eval(vs), d = document.getElementById('dock'), btn = d && [...d.querySelectorAll('button')].find(b => /declareFromHub/.test(b.getAttribute('onclick') || '')), st = d && d.querySelector('.declare-stakes-v150')
    return { button: !!btn && vis(btn), stakes: !!st && vis(st), text: st ? st.innerText : '' } }, vis)
  ok(!hub.button || (hub.stakes && /one shot/i.test(hub.text)), 'the hub\'s declare carries the same line', hub)
  await ctx.close()
}

// ---------------------------------------------------------------------------------------------- 4. import runs the migrations
{
  const { ctx, page } = await boot()
  const code = await page.evaluate((PAY) => {
    const A = window.__GRIDIRON_AUDIT__, p = A.newPlayer()
    // a save from before most of the lazy defaults: no body, traits, identity, nemesis; the old `shop`; no challenges/hof/inventory
    delete p.body; delete p.traits; delete p.teamIdentity; delete p.nemesis; delete p.titles; delete p.declareBonus
    p.name = 'Bo "Jr" O\'Neil & <Co>'; p.pos = 'WR'   // quotes, an ampersand and brackets, but no markup (markup is refused outright)
    const old = { prestige: 2, pp: 40, shop: { genetics: 2, talent: 1 }, player: p, view: 'hub', careers: 1, settings: {} }
    return btoa(unescape(encodeURIComponent(JSON.stringify(old))))
  }, PAY)
  const before = await page.evaluate(() => localStorage.getItem('gridiron_save_v1'))
  // refused: markup inside, and the wrong shape
  const refuse = await page.evaluate(async () => {
    const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    const a = window.__V150A.checkSave({ prestige: 1, player: { name: 'x', note: '<script>alert(1)</script>' } })
    const c = window.__V150A.checkSave({ prestige: 'lots' })
    const d = window.__V150A.checkSave([1, 2])
    const r1 = await window.importSave(enc({ prestige: 1, hof: [{ name: '<img src=x onerror=alert(1)>' }] }))
    return { a, c, d, r1, open: window.ribDialog.isOpen }
  })
  const after = await page.evaluate(() => localStorage.getItem('gridiron_save_v1'))
  ok(refuse.a && refuse.c && refuse.d && refuse.r1 === false && !refuse.open && after === before, 'an import with markup inside it, or the wrong shape, is refused before it reaches storage', refuse)
  const p = page.evaluate(c => window.importSave(c), code)
  await page.waitForTimeout(250)
  const d1 = await dlg(page)
  ok(!!d1 && /import/i.test(d1.title), 'importing asks first, in the in-app dialog', d1)
  const nav = page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => null)
  await yes(page); await p.catch(() => {}); await nav
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__, null, { timeout: 30000 }); await page.waitForTimeout(1500)
  const m = await page.evaluate(() => {
    const S = window.__GRIDIRON_AUDIT__.getState(), p = S.player || {}
    return { prestige: S.prestige, tree: S.tree, shop: S.shop, hof: Array.isArray(S.hof), inv: Array.isArray(S.inventory), ch: !!S.challenges, body: !!p.body, traits: Array.isArray(p.traits), team: !!p.teamIdentity, nemesis: !!p.nemesis, name: p.name, schema: S.schemaVersion }
  })
  ok(m.prestige === 2 && m.tree && m.tree.genetics === 2 && m.tree.talent === 1 && m.shop === undefined, 'the imported save came back through boot(): the old shop → tree move ran', { tree: m.tree, shop: m.shop })
  ok(m.hof && m.inv && m.ch && m.body && m.traits && m.team && m.nemesis, 'and every lazy default was filled in (Hall, inventory, goals, body, traits, identity, nemesis)', m)
  ok(!!m.name && !/[<>"'&]/.test(m.name), 'and the name inside it was cleaned on the way in (no brackets, quotes or ampersand left)', m.name)
  await ctx.close()
}

// ---------------------------------------------------------------------------------------------- 5. a corrupt save boots from a backup
{
  const mk = () => JSON.stringify({ prestige: 6, pp: 77, tree: {}, player: null, view: 'menu', careers: 3, tutorialSeen: true })
  // (a) main save truncated, no one-deep backup: the v149 D rolling backups
  const { ctx, page } = await boot({ seed: (good) => {
    localStorage.clear()
    localStorage.setItem('gridiron_save_v1', '{"prestige":4,"pp":1,"tree":{},"play')
    localStorage.setItem('rib_backups_v149', JSON.stringify([{ id: 'broken', at: 1, reason: 'x' }, { id: 't1', at: Date.UTC(2026, 0, 2), reason: 'session' }]))
    localStorage.setItem('rib_backup_v149_broken', '{nope')
    localStorage.setItem('rib_backup_v149_t1', good)
  }, arg: mk() })
  await page.waitForTimeout(2600)
  const r = await page.evaluate(() => ({ prestige: window.__GRIDIRON_AUDIT__.getState().prestige, pp: window.__GRIDIRON_AUDIT__.getState().pp, rec: window.__V150A.recovered(), kept: (localStorage.getItem('gridiron_save_v1_corrupt') || '').slice(0, 12), toast: (document.getElementById('toast') || {}).textContent || '' }))
  ok(r.prestige === 6 && r.pp === 77 && r.rec && r.rec.from === 'rolling', 'a truncated save boots from the newest rolling backup that parses', r)
  ok(r.kept === '{"prestige":' && /damaged/i.test(r.toast), 'the damaged text is kept aside, and the player is told', { kept: r.kept, toast: r.toast })
  await ctx.close()
  // (b) the one-deep backup still wins when it is good
  const two = await boot({ seed: (good) => { localStorage.clear(); localStorage.setItem('gridiron_save_v1', 'null'); localStorage.setItem('gridiron_save_v1_backup', good) }, arg: mk() })
  const r2 = await two.page.evaluate(() => ({ prestige: window.__GRIDIRON_AUDIT__.getState().prestige, rec: window.__V150A.recovered() }))
  ok(r2.prestige === 6 && r2.rec && r2.rec.from === 'backup', 'a save that parses to the wrong shape falls back to the one-deep backup (it used to throw in migrate)', r2)
  // and a damaged main save no longer evicts the good backup on the next write
  const r3 = await two.page.evaluate(() => { localStorage.setItem('gridiron_save_v1', '{"prestige":1,'); window.GridironStorage.save(window.__GRIDIRON_AUDIT__.getState()); return JSON.parse(localStorage.getItem('gridiron_save_v1_backup')).prestige })
  ok(r3 === 6, 'a damaged main save is not copied over the good backup on the next save', r3)
  await two.ctx.close()
}

// ---------------------------------------------------------------------------------------------- 6. dialogs, not confirm/prompt
{
  const { ctx, page } = await boot()
  const shim = await page.evaluate(() => /\[native code\]/.test(Function.prototype.toString.call(window.confirm)) && /\[native code\]/.test(Function.prototype.toString.call(window.prompt)))
  ok(shim, 'the sandbox confirm auto-accept shim is gone (window.confirm / prompt are the browser\'s own again)')
  await page.evaluate(() => {
    window.__native = 0
    window.confirm = () => { window.__native++; return true }; window.prompt = () => { window.__native++; return null }
    window.open = () => { window.__native++; return null }
    window.startCareer()
    const S = window.S; S.player.totalSeasons = 1; S.player.seasonsAtLevel = 1   // an unfinished career → the reroll gate
    S.chaosUnlocked = true
  })
  const seen = {}
  const tryOne = async (name, fn, want) => {
    await page.evaluate(fn); await page.waitForTimeout(350)
    const d = await dlg(page); seen[name] = d ? d.title || d.msg.slice(0, 30) : null
    ok(!!d && want.test((d.title || '') + ' ' + (d.msg || '')), `${name} asks in the in-app dialog`, d ? { title: d.title, msg: d.msg.slice(0, 70), frame: d.frame, input: d.input } : 'no dialog')
    await no(page); await page.waitForTimeout(150)
  }
  await tryOne('confirmNew (reroll penalty)', () => { window.confirmNew() }, /REROLL PENALTY/)
  await tryOne('chaos: max all', () => { window.chaosMaxAll() }, /chaos/i)
  await tryOne('hard reset', () => { window.hardReset() }, /erase/i)
  await tryOne('import save', () => { window.importSave() }, /backup code/i)
  await tryOne('export save', () => { navigator.clipboard && (navigator.clipboard.writeText = () => Promise.reject(new Error('denied'))); window.exportSave() }, /backup code/i)
  await tryOne('leaderboard name', () => { window.__lbUI.rename() }, /leaderboard/i)
  await tryOne('uniform preview', () => { window.openTeamCreatorV153(); window.previewUniformV153() }, /uniform/i)
  await page.evaluate(() => { document.getElementById('teamModalV153')?.remove(); const p = window.S.player; p.level = 7; p.age = 31 })
  await tryOne('retire', () => { window.retireNowV147() }, /retire/i)
  // a cancelled dialog changed nothing; an accepted one did its job
  const st = await page.evaluate(() => ({ native: window.__native, view: window.S.view, player: !!window.S.player, chaos: Object.keys(window.S.chaos || {}).length }))
  ok(st.native === 0, 'the browser\'s confirm / prompt / window.open were never called', st)
  ok(st.player && st.view !== 'gameover' && !st.chaos, 'cancelling each one changed nothing', st)
  const reroll = await page.evaluate(async () => { const was = window.S.careers; window.confirmNew(); await new Promise(r => setTimeout(r, 200)); const d = document.querySelector('#ribDlgV149 button.danger-v149'); d && d.click(); await new Promise(r => setTimeout(r, 300)); return { was, now: window.S.careers, armed: !!(window.S.rerollV112 && window.S.rerollV112.active) } })
  ok(reroll.now === reroll.was + 1 && reroll.armed, 'accepting the reroll warning starts the new career, with the penalty armed', reroll)
  await ctx.close()
}

console.log('page errors:', errs.length ? '\n' + errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await b.close()
process.exit(fail || errs.length ? 1 : 0)
