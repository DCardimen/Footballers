// careersim — HOW MANY CAREERS DOES IT TAKE TO WIN THE UFF, AND HOW LONG IS A RUN (F2P vs MEMBER)?
//
// A headless Playwright probe that plays WHOLE CAREERS through the game's own functions (window.go, startCareer,
// pickPos, startSeason, chooseTraining, chooseEvent, simRemainingWeeks, finishSeasonGames, declareFromHub, chooseTier,
// continueNFL, __V146B.sign, endCareer, prestigeReset, buy) — never by writing results into the save — and measures:
//
//   A. CAREERS TO THE FIRST UFF TITLE. Each RUN is a fresh account: careers are played back to back, every one with a
//      reasonable player's policy (the best-fit position, the balanced program, the game's own event answers, upgrade
//      points on the key stats, a declare when the odds are good or the seasons are gone, the cheapest affordable
//      prestige nodes bought between careers, a Path when the medals allow) until the first UFF ring (`player.nflRings`,
//      set by simSeason when the level-7+ championship is won) or --maxCareers. Every playoff round is simmed too
//      (TU v156Bplayoffs 0) — the real game watches the championship; this measures careers, not viewing.
//   B. TIME. Wall time of one Quick Play week, one season sim, and one WATCHED live game at 1x/2x/4x (the post-game card
//      is the finish line), plus the game's per-row delays (liveTickBodyV163A: 600/speed ms a header, 520/speed ms after
//      a play, the play's own animation measured through GridironPhaser.animate) so a phone estimate can be made from
//      the row counts — the headless box is slower than a phone.
//   C. A model of a run's hours for (i) F2P watching everything, (ii) F2P quick-playing with ads, (iii) a member
//      quick-playing everything but the championships, written to docs/CAREERSIM.md and printed here.
//
//   node scripts/careersim.mjs --runs 5 --maxCareers 30 --pages 3 [--declareAt 70] [--timing 0] [--out docs/CAREERSIM.md]
//   GAME_URL=http://localhost:5571/ node scripts/careersim.mjs
import fs from 'node:fs'
import path from 'node:path'
import { gameUrl, launch } from './lib/env.mjs'
import { waitLive } from './lib/live.mjs'

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2)
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d }
const RUNS = +arg('runs', 5), MAX_CAREERS = +arg('maxCareers', 30), PAGES = Math.max(1, +arg('pages', 3))
const DECLARE_AT = +arg('declareAt', 70), TRAINING = arg('training', 'balanced'), TIMING = arg('timing', '1') !== '0'
const OUT = arg('out', 'docs/CAREERSIM.md'), CAREER_MS = +arg('careerMs', 240000), VERBOSE = arg('v', '0') !== '0'
// v179: WHO plays (--policy smart = the knowledgeable player above; casual = a random fit position, a random program,
// random affordable nodes, an early declare) and HOW FAR (--until ring = the first UFF title, as before; uff = the first
// arrival in the UFF; interstellar = UFF careers ground on — chaos maxed whenever it is unlocked (smart) — until the
// Interstellar Call is answered). Every run reports the SEASONS to each milestone, and hours at --seasonMin (7) a season.
const POLICY = arg('policy', 'smart'), UNTIL = arg('until', 'ring'), SEASON_MIN = +arg('seasonMin', 7), TUNE = JSON.parse(arg('tune', '{}'))
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114', 'noGrowV132'].concat(q).join('&')

const browser = await launch()
const errors = []
async function open (tag) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
  await ctx.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v156Bplayoffs: 0, speedGateV151A: 0, v156Cspeed: 0 }, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off') } catch {}
    setInterval(() => {
      try { if (window.S) window.S.tutorialSeen = true } catch {}
      for (const s of ['.onboard', '#growthV42', '#gv139gate', '#ribDlgV149', '.lgm-v152']) document.querySelector(s)?.remove()
    }, 80)
  }, TUNE)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await page.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V156B && !!window.__V164B && !!window.__V147A, null, { timeout: 60000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
  await page.evaluate(() => document.getElementById('splash')?.remove())
  await page.evaluate(installDriver)
  return { ctx, page }
}

// ---------------------------------------------------------------- the in-page driver (serialised into the page)
function installDriver () {
  const A = window.__GRIDIRON_AUDIT__
  const S = () => A.getState()
  const P = () => S().player
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const L = () => A.LEVELS
  const CS = (window.__CS = { log: [], stuck: null })

  // the account: a fresh save (one RUN)
  CS.freshAccount = () => { const s = A.freshState(); s.tutorialSeen = true; A.setState(s); window.GridironStorage.save(s); return true }

  // between careers: the cheapest affordable prestige node, again and again; then a Path when the medals allow
  CS.spendPP = () => {
    const bought = []
    for (let g = 0; g < 200; g++) {
      const s = S(), nodes = Object.values(A.TREE_NODES)
        .filter((n) => A.nodeLvl(n.key) < n.max && A.nodeUnlocked(n) && A.nodeCost(n) <= s.pp)
        .sort((a, b) => A.nodeCost(a) - A.nodeCost(b))
      if (!nodes.length) break
      // v179: good = the power nodes first (growth, ceilings, starting attributes, the climb); bad = everything else first
      const POWER = /^(genetics|fastTwitch|frame|iron|nimble|lungs|motor|explosive|freak|primeGenes|superhuman|springs|anchor|engine|juggernaut|evolution|talent|coachable|filmrat|clutch|handsy|cannon|wrap|quickstudy|vet|prodigy|genius|mastermind|zen|silverTongue|visionary|bigStage|recruited|goodProgram|gym|headstart|spotlight|combineKing|phenom|unstoppable|boosters|iron_sched|dynastyTeam|camp[A-Z].*|privateCoach|allStarCamp|megaCamp|proDay|etGrowth|etCeiling|etForm|trashTalk|legendAura|primetime|perfectFrame|idealBody)$/
      const pref = CS.policy === 'good' ? nodes.filter((x) => POWER.test(x.key)) : CS.policy === 'bad' ? nodes.filter((x) => !POWER.test(x.key)) : []
      const n = pref.length ? pref[0] : CS.casual ? nodes[Math.floor(Math.random() * Math.min(nodes.length, 12))] : nodes[0], pp0 = s.pp
      try { window.buy(n.key) } catch (e) { break }
      if (S().pp >= pp0) break
      bought.push(n.key + ':' + A.nodeLvl(n.key) + '@' + (pp0 - S().pp))
    }
    let path = null
    try { if (!S().path && typeof window.choosePath === 'function') { window.choosePath(CS.casual ? ['prodigy', 'magnate', 'grinder'][Math.floor(Math.random() * 3)] : 'prodigy'); path = S().path || null } } catch (e) {}
    return { bought, path, ppLeft: S().pp, tree: Object.assign({}, S().tree) }
  }

  const bestOffer = (O) => { let bi = 0, bs = -1e9; (O.list || []).forEach((c, i) => { const v = (c.rating || 0) + (c.security || 0) * 0.5 + (c.role === 'starter' ? 8 : c.role === 'rotation' ? 3 : 0); if (v > bs) { bs = v; bi = i } }); return bi }
  const unplayed = (p) => (p.weekResults || []).filter((w) => !w.played)
  const seasonCounts = (p) => { const ws = (p.weekResults || []).filter((w) => w.played); const po = ws.filter((w) => w.playoff); return { games: ws.filter((w) => !w.satOut).length, reg: ws.filter((w) => !w.playoff).length, po: po.length, champ: po.filter((w) => /CHAMPIONSHIP/i.test(w.round || '')).length, sat: ws.filter((w) => w.satOut).length } }

  // one career, from the menu to the career-end screen (or the first ring). Returns the record.
  CS.runCareer = async (o) => {
    o = o || {}
    const casual = o.policy === 'casual', until = o.until || 'ring'
    CS.casual = casual; CS.policy = o.policy
    const declareAt = o.declareAt == null ? 70 : o.declareAt, budget = o.ms || 240000
    const progs = Object.keys(A.TRAINING || { balanced: 1 }), training = casual ? progs[Math.floor(Math.random() * progs.length)] : o.training || 'balanced'
    const t0 = Date.now(), rec = { seasons: [], level: 0, maxLevel: 0, title: false, end: null, views: [], steps: 0, ms: 0, pos: null, uffSeasons: 0, skips: null }
    const trail = (v) => { if (rec.views[rec.views.length - 1] !== v) rec.views.push(v); if (rec.views.length > 400) rec.views.splice(0, 100) }
    const dump = (why) => { const s = S(), p = s.player; rec.end = why; rec.stuck = { view: s.view, level: p && p.level, weeks: p && p.weekResults ? p.weekResults.map((w) => (w.played ? 'P' : '.') + (w.playoff ? 'p' : '')).join('') : null, lastSim: (window.__V147A && window.__V147A.lastSim) || (window.__V164B && window.__V164B.lastSim) || null, offers: !!(p && p.offersV146B), cutOut: !!(p && p.cutOutV146B), pending: p && p.pendingEvent, screen: ((document.getElementById('screen') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 160) }; return rec }
    // the account's menu → a new player
    if (S().player) { if (!S().player._settled) return dump('a live player was still on the account') ; window.prestigeReset() }
    rec.skips = (() => { try { const k = window.__V156B.skips(); return { allowed: k.allowed, medals: k.medals } } catch (e) { return null } })()
    window.startCareer(true)
    await sleep(30)
    if (S().view !== 'choosePos') return dump('startCareer did not reach choosePos')
    {
      // the rolled personality is locked as rolled (the overlay's own button: __personaConfirmV13, which also sets the
      // career's origin the way the shipped game does), then the best-fit position
      const p = P(); for (let i = 0; i < 20 && !document.getElementById('personaV13'); i++) await sleep(60)
      try { window.__personaConfirmV13 && window.__personaConfirmV13() } catch (e) {}
      if (!p.originV11) { try { window.chooseOriginV11((p.originOptionsV11 || [])[0] || 'walk-on') } catch (e) {} }
      if (!p.originV11) p.originV11 = 'walk-on'
      const sug = A.suggestPositions(p.attrs, p.body), best = casual ? sug[Math.floor(Math.random() * Math.min(4, sug.length))] : sug[0]; rec.pos = best.pos; rec.origin = p.originV11; window.pickPos(best.pos); await sleep(20)
      if (S().view === 'choosePos') return dump('pickPos did not leave choosePos')
    }
    let sameView = 0, lastView = null, lastKey = ''
    try {
    for (let step = 0; step < 3000; step++) {
      rec.steps = step
      if (Date.now() - t0 > budget) return dump('watchdog: career over ' + budget + ' ms')
      const s = S(), p = s.player, v = s.view
      if (!p) return dump('no player')
      trail(v)
      rec.level = p.level; rec.maxLevel = Math.max(rec.maxLevel, p.level)
      if (p.level >= 7 && rec.uffAt == null) rec.uffAt = p.totalSeasons
      if ((p.nflRings || 0) > 0 && rec.ringAt == null) rec.ringAt = p.totalSeasons
      if (p.level >= 8 && rec.istAt == null) { rec.istAt = p.totalSeasons; rec.end = 'interstellar'; break }
      if (until === 'uff' && p.level >= 7) { rec.end = 'uff'; break }
      const key = v + '|' + p.totalSeasons + '|' + unplayed(p).length + '|' + (p.pendingEvent || '') + '|' + !!p.offersV146B
      if (key === lastKey) { if (++sameView > 12) return dump('stuck on ' + v) } else { sameView = 0; lastKey = key }
      lastView = v
      // a ring: the first UFF title
      if (until === 'ring' && ((p.nflRings || 0) > 0 || (S().uffTitleV156C && p.level >= 7))) { rec.title = true; rec.end = 'title'; break }
      if (p.cutOutV146B && !p._settled) { p.pendingEvent = null; document.querySelectorAll('.decision-overlay,.life-event-overlay-v12').forEach((x) => x.remove()); window.go('gameover'); await sleep(10); if (S().view !== 'gameover') { try { window.screenGameOver && window.screenGameOver() } catch (e) {} } continue }
      if (v === 'gameover') { if (!p._settled) { window.go('gameover'); await sleep(10) } rec.end = rec.end || 'cut'; break }
      if (v === 'declineResult') { rec.end = 'declare failed'; window.endCareer(); await sleep(10); continue }
      if (v === 'win') { window.continueNFL(); await sleep(10); continue }
      if (v === 'club') { const O = p.offersV146B; if (!O) { window.go('hub'); continue } window.__V146B.sign(bestOffer(O)); await sleep(10); continue }
      if (v === 'tier') { const T = window.__TIER_V139.tiers(L()[p.level].key); if (T && T.length) window.chooseTier(T[0].key); else window.go('hub'); await sleep(10); continue }
      if (v === 'hub' || v === 'menu' || v === 'shop' || v === 'upgrade' || v === 'stats' || v === 'profile' || v === 'life' || v === 'challenges') {
        if (p.retirementPending) { window.endCareer(); await sleep(10); continue }
        try { p.points > 0 && window.autoAllocKey() } catch (e) {}
        const lv = p.level, nfl = lv >= 7
        // v179: the smart player keeps chaos at its cap the moment it is unlocked (the PP and the eras are there)
        if (!casual && s.chaosUnlocked && window.__chaosMaxV179) { try { if (window.__chaosTotalV179() < (s.chaosCap || 0)) window.__chaosMaxV179() } catch (e) {} }
        // v179: the Interstellar Call — answered when its odds clear the bar (it ends the career if it fails)
        if (until === 'interstellar' && lv === 7 && (p.nflRings || 0) >= 1 && p.seasonsAtLevel >= A.minSeasonsRequired()) {
          let ch = 0, ok = true
          try { ok = !window.__istGateV179 || window.__istGateV179(p).ok; ch = ok ? window.__V88.declareChance(p) : 0 } catch (e) {}
          if (ok && ch >= (casual ? 30 : declareAt)) { rec.declares = (rec.declares || []).concat([lv + ':' + Math.round(ch)]); window.declareFromHub(); await sleep(10); continue }
        }
        if (!nfl) {
          const min = A.minSeasonsRequired(), max = A.maxSeasonsAllowed(), left = max - p.seasonsAtLevel
          if (p.seasonsAtLevel >= min) {
            const ch = window.__V88.declareChance(p)
            if (left <= 0 || ch >= (casual ? Math.min(declareAt, 35) : declareAt) || lv === 6) { rec.declares = (rec.declares || []).concat([lv + ':' + Math.round(ch)]); window.declareFromHub(); await sleep(10); continue }
          }
        }
        window.startSeason(); await sleep(10); continue
      }
      if (v === 'training') { window.chooseTraining(training in A.TRAINING ? training : 'balanced'); await sleep(10); continue }
      if (v === 'event') {
        const ev = A.EVENTS.find((z) => z.id === p.pendingEvent)
        if (!ev) { p.pendingEvent = null; window.go('sim'); continue }
        if (ev.id === 'bigGame' && typeof window.rivalDeferV136 === 'function') { window.rivalDeferV136(); await sleep(10); if (S().view === 'event') { p.pendingEvent = null; window.go('sim') } continue }
        const i = window.__V147A.pickEvent(p, ev)
        rec.events = (rec.events || 0) + 1
        if (i < 0) { p.pendingEvent = null; window.go('sim') } else window.chooseEvent(i)
        await sleep(10); continue
      }
      if (v === 'sim') { window.go('sim'); await sleep(10); continue }
      if (v === 'result') {
        if (p.retirementPending) { window.endCareer(); await sleep(10); continue }
        window.go('hub'); await sleep(10); continue
      }
      if (v === 'season') {
        if (!p.weekResults) { window.go('hub'); continue }
        if (!unplayed(p).length) {
          const c = seasonCounts(p); c.level = p.level; c.n = p.totalSeasons + 1
          c.won = !!(p.playoffState && p.playoffState.champion); c.qualified = !!(p.playoffState && p.playoffState.qualified)
          rec.seasons.push(c); if (p.level >= 7) rec.uffSeasons++
          window.finishSeasonGames(); await sleep(10); continue
        }
        window.RIB_TUNE.v156Bplayoffs = 0
        const n0 = unplayed(p).length
        window.simRemainingWeeks(); await sleep(10)
        if (S().view === 'season' && unplayed(P()).length === n0 && !P().offersV146B) {
          if (P().cutOutV146B || P().retirementPending) continue // v179: cut mid-season — the top of the loop settles it
          // nothing moved: the season sims are spent, a stale offer list, or a stuck silent week — Quick Play week by week
          for (let k = 0; k < 30 && S().view === 'season' && unplayed(P()).length && !P().cutOutV146B; k++) {
            const m0 = unplayed(P()).length
            window.playWeek(false); await sleep(10)
            if (unplayed(P()).length === m0) break
          }
          if (P().cutOutV146B || P().retirementPending) continue
          if (S().view === 'season' && unplayed(P()).length === n0) return dump('the season sim cannot play the next week')
        }
        continue
      }
      // anything else: back to the hub
      window.go('hub'); await sleep(10)
    }
    if (!rec.end) dump('step budget')
    } catch (e) { dump('threw: ' + (e && e.message)); rec.stack = String(e && e.stack).split('\n').slice(0, 7).join(' | ') }
    rec.ms = Date.now() - t0
    const p = P(); rec.level = p ? p.level : rec.level; rec.maxLevel = Math.max(rec.maxLevel, rec.level)
    rec.totalSeasons = p ? p.totalSeasons : rec.seasons.length; rec.age = p && p.age; rec.ovr = p ? A.playerOVR(p) : null
    rec.games = rec.seasons.reduce((a, c) => a + c.games, 0)
    // settle it (the ring's career is settled through the life screen's retire so the account gets its PP)
    if (rec.title && p && !p._settled) { try { p.retirementPending = true; window.endCareer(); await sleep(10) } catch (e) {} }
    rec.settled = !!(P() && P()._settled); rec.pp = S().pp; rec.chaos = (() => { try { return window.__chaosTotalV179 ? window.__chaosTotalV179() : null } catch (e) { return null } })(); rec.medals2 = (() => { try { return window.__V156B.medals() } catch (e) { return null } })(); rec.era = S().era || 0; rec.medals = (() => { try { return window.__V156B.medals() } catch (e) { return null } })()
    return rec
  }

  // ---- timing probes
  CS.seed = (level, pos) => {
    const s = A.freshState(); s.tutorialSeen = true; A.setState(s)
    s.player = A.newPlayer(); const p = s.player; p.name = 'Time Man'; p.pos = pos || 'QB'; p.age = 22; p.originV11 = p.originV11 || 'walk-on'; p._wonShown = true
    if (level >= 7) { p.level = 6; p.totalSeasons = 12; p.career = []; s.view = 'hub'; A.advance(); window.__V146B.sign(2); for (const k in p.attrs) p.attrs[k] = 280; p.age = 27; if (p.nflStateV11) { p.nflStateV11.security = 90; p.nflStateV11.status = 'starter' } }
    else p.level = level
    p.training = 'balanced'; A.startSeasonGames(); window.go('season'); window.GridironStorage.save(s)
    return { level: p.level, weeks: (p.weekResults || []).length }
  }
  CS.quickWeek = async () => { const p = P(), n0 = unplayed(p).length, t0 = performance.now(); window.playWeek(false); for (let i = 0; i < 400 && (unplayed(P()).length === n0 || S().view !== 'season'); i++) await sleep(25); return { ms: performance.now() - t0, played: n0 - unplayed(P()).length, view: S().view } }
  CS.seasonSim = async () => { const p = P(), n0 = unplayed(p).length, t0 = performance.now(); window.RIB_TUNE.v156Bplayoffs = 0; window.simRemainingWeeks(); for (let i = 0; i < 400 && S().view === 'live'; i++) await sleep(25); return { ms: performance.now() - t0, played: n0 - unplayed(P()).length, left: unplayed(P()).length, view: S().view } }
  CS.startLive = () => { const p = P(); const a = p.weekResults.findIndex((w) => !w.played); p.currentWeek = a; window.playWeek(true); return { week: a, view: S().view } }
  CS.liveInfo = () => { const g = S()._liveGame; if (!g) return null; const rows = g.plays, hdr = rows.filter((t) => t.header || t.event === 'drive').length; let shown = 0, shownHdr = 0, shownPlay = 0; try { for (const t of rows) { if (!window.__V156D || !window.__V156D.skip ? true : !window.__V156D.skip(t)) { shown++; (t.header || t.event === 'drive') ? shownHdr++ : shownPlay++ } } } catch (e) { shown = -1 } return { rows: rows.length, headers: hdr, plays: rows.length - hdr, shown, shownHdr, shownPlay, settings: Object.assign({}, S().settings) } }
  CS.instrumentAnim = () => { const G = window.GridironPhaser; if (!G || G.__csWrapped) return false; const a0 = G.animate; G.__csWrapped = true; CS.anim = []; G.animate = function (play, done) { const t0 = performance.now(); return a0.call(this, play, function () { CS.anim.push(performance.now() - t0); return done && done.apply(this, arguments) }) }; return true }
  CS.liveDone = () => !!document.getElementById('pgOverlayV13') || S().view !== 'live'
  CS.liveProgress = () => { const c = window.__liveCtlV163A; try { const L = window.__V156D && window.__V156D.log(); return { rows: L ? L.length : -1, view: S().view, card: !!document.getElementById('pgOverlayV13') } } catch (e) { return { rows: -1, view: S().view } } }
}

// ---------------------------------------------------------------- part A: the careers
const runs = []
async function playRun (page, runNo) {
  const out = { run: runNo, careers: [], title: false }
  await page.evaluate((pol) => { window.__CS.freshAccount(); window.__CS.policy = pol; window.__CS.casual = pol === 'casual' }, POLICY)
  for (let c = 1; c <= MAX_CAREERS; c++) {
    const spend = await page.evaluate(() => window.__CS.spendPP())
    let rec
    try {
      rec = await page.evaluate((o) => window.__CS.runCareer(o), { declareAt: DECLARE_AT, training: TRAINING, ms: CAREER_MS, policy: POLICY, until: UNTIL })
    } catch (e) { rec = { end: 'evaluate threw: ' + (e.message || e).slice(0, 160), seasons: [], level: -1, maxLevel: -1, games: 0 } }
    rec.no = c; rec.spend = spend
    out.careers.push(rec)
    const lvName = rec.maxLevel >= 0 ? ['PeeWee', 'Youth', 'Middle', 'JV', 'Varsity', 'College', 'Combine', 'UFF', 'Inter'][rec.maxLevel] : '?'
    console.log(`run ${runNo} career ${c}: ${rec.pos || '?'} → ${lvName} · ${rec.totalSeasons || 0} seasons · ${rec.games || 0} games · ${rec.end}${rec.uffSeasons ? ' · UFF seasons ' + rec.uffSeasons : ''} · ${((rec.ms || 0) / 1000).toFixed(1)}s · pp ${rec.pp} · medals ${rec.medals} · sims ${rec.skips && rec.skips.allowed}${rec.declares ? ' · declares ' + rec.declares.join(',') : ''}${spend.bought.length ? ' · bought ' + spend.bought.length + ' nodes (' + spend.bought.slice(-3).join(',') + ')' : ''}${VERBOSE && spend.bought.length ? ' · bought ' + spend.bought.join(',') : ''}${VERBOSE ? ' · views ' + (rec.views || []).slice(-12).join('>') : ''}`)
    if (rec.stuck) console.log('   stuck:', JSON.stringify(rec.stuck))
    if (rec.stack) console.log('   stack:', rec.stack)
    // v179: the seasons to each milestone, counted across the whole account
    const before = out.careers.slice(0, -1).reduce((a, x) => a + (x.totalSeasons || 0), 0)
    if (rec.uffAt != null && out.seasonsToUff == null) out.seasonsToUff = before + rec.uffAt
    if (rec.ringAt != null && out.seasonsToRing == null) out.seasonsToRing = before + rec.ringAt
    if (rec.istAt != null && out.seasonsToIst == null) out.seasonsToIst = before + rec.istAt
    const hrs = (n) => (n == null ? '—' : n + ' seasons (' + ((n * SEASON_MIN) / 60).toFixed(1) + ' h)')
    out.traj = (out.traj || []).concat([[before + (rec.totalSeasons || 0), rec.medals2 != null ? rec.medals2 : rec.medals, rec.maxLevel]])
    console.log(`   traj: seasons ${before + (rec.totalSeasons || 0)} medals ${rec.medals2 != null ? rec.medals2 : rec.medals} level ${rec.maxLevel}`)
    console.log(`   milestones: UFF ${hrs(out.seasonsToUff)} · ring ${hrs(out.seasonsToRing)} · Interstellar ${hrs(out.seasonsToIst)} · pp ${rec.pp} · chaos ${rec.chaos || 0} · era ${rec.era || 0}`)
    if (rec.title) { out.title = true; break }
    if (UNTIL === 'uff' && out.seasonsToUff != null) { out.title = true; break }
    if (UNTIL === 'interstellar' && out.seasonsToIst != null) { out.title = true; break }
    if (/evaluate threw|watchdog/.test(rec.end)) { /* a page that cannot go on: reload it and continue on the same save */ try { await page.reload({ waitUntil: 'networkidle', timeout: 60000 }); await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V164B, null, { timeout: 60000 }); await page.evaluate(() => document.getElementById('splash')?.remove()); await page.evaluate(installDriver); await page.evaluate(() => { const A = window.__GRIDIRON_AUDIT__, S = A.getState(); if (S.player && !S.player._settled) { S.player._settled = true; S.player = null; window.GridironStorage.save(S) } }) } catch (e) { console.log('   reload failed: ' + e.message) } }
  }
  out.careersToTitle = out.title ? out.careers.length : null
  out.seasons = out.careers.reduce((a, c) => a + (c.totalSeasons || 0), 0)
  out.games = out.careers.reduce((a, c) => a + (c.games || 0), 0)
  return out
}

const tA = Date.now()
const workers = []
let nextRun = 1
for (let w = 0; w < Math.min(PAGES, RUNS); w++) {
  workers.push((async () => {
    const { ctx, page } = await open('page' + w)
    while (nextRun <= RUNS) { const r = nextRun++; const out = await playRun(page, r); runs[r - 1] = out; console.log(`RUN ${r} done: ${out.title ? out.careersToTitle + ' careers' : 'no title in ' + MAX_CAREERS} · ${out.seasons} seasons · ${out.games} games`) }
    await ctx.close()
  })())
}

// ---------------------------------------------------------------- part B: the clock (on its own page, alongside)
let timing = null
const timingJob = (async () => {
  if (!TIMING) return
  const { ctx, page } = await open('timing')
  const T = { quick: [], seasonSim: {}, live: [] }
  // quick play: a College season (12 games), then a UFF season
  for (const lv of [5, 7]) {
    await page.evaluate((lv) => window.__CS.seed(lv), lv)
    const q = []; for (let i = 0; i < 4; i++) q.push(await page.evaluate(() => window.__CS.quickWeek()))
    T.quick.push({ level: lv, ms: q.map((x) => Math.round(x.ms)), played: q.map((x) => x.played) })
    await page.evaluate((lv) => window.__CS.seed(lv), lv)
    T.seasonSim[lv] = await page.evaluate(() => window.__CS.seasonSim())
  }
  // a watched UFF game at 1x, 2x, 4x — kickoff (men on the grass) to the post-game card
  for (const spd of [1, 2, 4]) {
    await page.evaluate(() => window.__CS.seed(7))
    await page.evaluate(() => window.__CS.startLive())
    const up = await waitLive(page, 90000)
    if (!up) { T.live.push({ speed: spd, error: 'the live field never came up' }); continue }
    await page.evaluate((spd) => { window.__CS.instrumentAnim(); window.setSpeed(spd) }, spd)
    const info = await page.evaluate(() => window.__CS.liveInfo())
    const t0 = Date.now(); let prog = null
    while (Date.now() - t0 < 15 * 60000) { await page.waitForTimeout(500); prog = await page.evaluate(() => ({ done: window.__CS.liveDone(), p: window.__CS.liveProgress() })); if (prog.done) break }
    const ms = Date.now() - t0
    const anim = await page.evaluate(() => { const a = window.__CS.anim || []; const s = a.slice().sort((x, y) => x - y); return { n: a.length, mean: a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, median: s.length ? s[s.length >> 1] : 0 } })
    const spdNow = await page.evaluate(() => (window.__liveSpeedV163A || null))
    T.live.push({ speed: spd, ms, done: prog && prog.done, rowsReached: prog && prog.p.rows, info, anim })
    console.log(`live ${spd}x: ${(ms / 1000).toFixed(0)} s · rows ${info && info.rows} (${info && info.headers} headers, ${info && info.plays} plays; shown ${info && info.shown}: ${info && info.shownHdr} h + ${info && info.shownPlay} p) · anim ${anim.n} plays, mean ${anim.mean.toFixed(0)} ms, median ${anim.median.toFixed(0)} ms · ${prog && prog.done ? 'post-game card' : 'TIMED OUT'}`)
    await page.evaluate(() => { try { window.__pgContinueV13 && window.__pgContinueV13() } catch (e) {} })
  }
  timing = T
  await ctx.close()
})()

await Promise.all(workers.concat([timingJob]))
const msA = Date.now() - tA
await browser.close()

// ---------------------------------------------------------------- the numbers
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null }
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const fmt = (x, d = 1) => (x == null ? '—' : (+x).toFixed(d))
const LV = ['Pee Wee', 'Youth', 'Middle', 'JV', 'Varsity', 'College', 'Combine', 'UFF', 'Interstellar']
const titled = runs.filter((r) => r.title)
const careersTo = titled.map((r) => r.careersToTitle), seasonsTo = titled.map((r) => r.seasons), gamesTo = titled.map((r) => r.games)
const allCareers = runs.flatMap((r) => r.careers)
const stall = LV.map((n, i) => allCareers.filter((c) => c.maxLevel === i).length)
const perCareerSeasons = allCareers.map((c) => c.totalSeasons || 0)
// the median run: the run whose careers-to-title is the median (ties: the first)
const medRun = titled.length ? titled.slice().sort((a, b) => a.careersToTitle - b.careersToTitle)[Math.floor((titled.length - 1) / 2)] : null
// per-level game counts in the median run (regular / playoff / championship games, seasons)
const levelTotals = (run) => { const t = LV.map(() => ({ seasons: 0, reg: 0, po: 0, champ: 0, games: 0 })); for (const c of run.careers) for (const s of c.seasons || []) { const k = t[s.level]; k.seasons++; k.reg += s.reg; k.po += s.po; k.champ += s.champ; k.games += s.games } return t }

// ---- the time model (every number here is an assumption or a measured value; the report lists them)
const M = {
  // a watched game's wall time at speed s, from the row counts and the game's own delays:
  //   headers: max(150, 600/s) ms each · plays: animation(s) + max(90, 520/s) ms each — the animation is measured per speed
  // the phone estimate assumes the animation scales 1/speed from the measured 1x mean (the box is slower; stated below)
  humanTapS: 4,          // a Quick Play week: the tap, the wheel, a glance at the score
  screenS: 25,           // per season: training pick, an event, the report card, the hub
  careerS: 90,           // per career: position, prestige shop, the career-end screen
  adS: 30,               // one rewarded ad (30 min of Quick Play while the store is ON)
  adMin: 30,             // minutes of Quick Play one ad buys (gameSims, v158 B)
  memberSimMult: 1.5,    // the Club's season sims (v159 B)
  simBase: 1             // season sims a career, a fresh account (simBaseV156B)
}
const live = timing && timing.live ? timing.live.filter((l) => !l.error && l.info) : []
const liveAt = (s) => live.find((l) => l.speed === s)
const animMean1 = liveAt(1) && liveAt(1).anim.n ? liveAt(1).anim.mean : null
const rowsShown = live.length ? mean(live.map((l) => l.info.shownPlay)) : null, hdrShown = live.length ? mean(live.map((l) => l.info.shownHdr)) : null
function watchS (speed) {
  // the game's own delays + the measured animation at that speed (fallback: 1x mean / speed)
  const l = liveAt(speed), anim = l && l.anim.n ? l.anim.mean : animMean1 ? animMean1 / speed : 2500 / speed
  const plays = rowsShown == null ? 70 : rowsShown, hdr = hdrShown == null ? 30 : hdrShown
  return (hdr * Math.max(150, 600 / speed) + plays * (anim + Math.max(90, 520 / speed))) / 1000 + 20 /* kickoff + the post-game card */
}
const quickS = timing && timing.quick.length ? mean(timing.quick.flatMap((q) => q.ms)) / 1000 : 1.5
const simS = timing && timing.seasonSim[7] ? timing.seasonSim[7].ms / 1000 : 8
function modelRun (run, mode) {
  // mode: 'watch' (F2P, everything watched at his best speed), 'ads' (F2P, ads for Quick Play), 'member'
  let s = 0, uffSeasonsDone = 0, title = false, ads = 0, quickMin = 0
  for (const c of run.careers) {
    s += M.careerS
    let simsLeft = mode === 'member' ? Math.round(M.simBase * M.memberSimMult) : M.simBase
    // v156 B: +1 per completed medal group from the second career on is ignored below the bronze group (the sim's runs
    // finished BRONZE only late) — the record's `skips.allowed` is used when the sim recorded it
    if (c.skips && c.skips.allowed) simsLeft = mode === 'member' ? Math.round(c.skips.allowed * M.memberSimMult) : c.skips.allowed
    const seasons = (c.seasons || []).slice().sort((a, b) => b.games - a.games) // the sims go on the longest seasons
    const simmed = new Set(seasons.slice(0, simsLeft).map((x) => x.n))
    for (const sea of c.seasons || []) {
      s += M.screenS
      const speed = mode === 'member' ? 4 : title ? 4 : uffSeasonsDone >= 1 ? 3 : 2
      const champ = sea.champ, other = sea.games - champ
      if (mode === 'watch') s += sea.games * watchS(speed)
      else {
        s += champ * watchS(speed)
        if (simmed.has(sea.n)) s += simS + M.humanTapS
        else { s += other * (quickS + M.humanTapS); if (mode === 'ads') quickMin += (other * (quickS + M.humanTapS)) / 60 }
      }
      if (sea.level >= 7) uffSeasonsDone++
      if (sea.won && sea.level >= 7) title = true
    }
  }
  if (mode === 'ads') { ads = Math.ceil(quickMin / M.adMin); s += ads * M.adS }
  return { hours: s / 3600, ads, careers: run.careers.length }
}
const modes = ['watch', 'ads', 'member']
const modelled = medRun ? Object.fromEntries(modes.map((m) => [m, modelRun(medRun, m)])) : null
const perCareerHours = medRun ? Object.fromEntries(modes.map((m) => [m, modelled[m].hours / medRun.careers.length])) : null

// ---------------------------------------------------------------- the report
const lines = []
const say = (s = '') => lines.push(s)
say('# CAREERSIM — how many careers to a UFF title, and how long a run takes (F2P vs member)')
say()
say(`Generated by \`node scripts/careersim.mjs --runs ${RUNS} --maxCareers ${MAX_CAREERS} --pages ${PAGES} --declareAt ${DECLARE_AT}\` on ${new Date().toISOString().slice(0, 10)} against \`${url}\` in ${(msA / 60000).toFixed(1)} min. Re-run it to refresh every number here.`)
say()
say('## 1. Method')
say()
say('- **Whole careers, by the game\'s own functions.** Each run is a fresh account. A career: `startCareer` → the best-fit position (`suggestPositions`) → each season `startSeason` → the **balanced** program → the season event answered by the game\'s own v147 A scorer (`__V147A.pickEvent`; Rivalry Week deferred to game week) → `simRemainingWeeks` (every week by `silentWeekV85`, the same engine games Quick Play books) with **`TU v156Bplayoffs 0` so the playoffs sim too** (the real game watches the championship — this measures careers, not viewing) → `finishSeasonGames` → upgrade points on the key stats (`autoAllocKey`) → at the hub: **declare** when the level\'s minimum is played and the declare odds are ≥ ' + DECLARE_AT + '% or the seasons are gone (the combine year always declares) → `declareFromHub`; a failed declare or a UFF cut-out ends the career (`endCareer`), the UFF arrival continues (`continueNFL`) and signs the best of the three entry offers (team rating + security, starters first); a program tier picks the powerhouse.')
say('- **A UFF title** = `player.nflRings > 0` (set by `simSeason` when the level ≥ 7 championship is won) or `state.uffTitleV156C`. The run stops at the first ring; that career is then retired so the account is paid.')
say('- **Between careers** the account buys the **cheapest affordable, unlocked prestige node**, again and again (`window.buy`), and takes the **Prodigy** path (+8 declare odds) the moment the medals open a Path. Nothing else is bought.')
say('- **Nothing is written into results.** No week is marked played by hand, no attribute set; the only tunes are `v156Bplayoffs 0` (sim the playoffs) and, for the timing page only, the speed gates off so 4× can be timed.')
say('- Randomness is the game\'s `Math.random`; runs are independent by construction (a fresh save each).')
say()
say('## 2. Careers to the first UFF title')
say()
say('| run | careers to the title | seasons | games | the careers (position → level reached · seasons) |')
say('|---|---|---|---|---|')
for (const r of runs) say(`| ${r.run} | ${r.title ? r.careersToTitle : 'none in ' + MAX_CAREERS} | ${r.seasons} | ${r.games} | ${r.careers.map((c) => `${c.pos || '?'}→${LV[c.maxLevel] || '?'}·${c.totalSeasons || 0}${c.title ? ' 🏆' : ''}`).join(', ')} |`)
say()
say(`**Careers to the title** (${titled.length} of ${runs.length} runs reached it): median **${fmt(med(careersTo), 0)}** · mean ${fmt(mean(careersTo))} · min ${titled.length ? Math.min(...careersTo) : '—'} · max ${titled.length ? Math.max(...careersTo) : '—'}.  `)
say(`**Seasons to the title**: median ${fmt(med(seasonsTo), 0)} · mean ${fmt(mean(seasonsTo))} · min ${titled.length ? Math.min(...seasonsTo) : '—'} · max ${titled.length ? Math.max(...seasonsTo) : '—'}.  `)
say(`**Games to the title**: median ${fmt(med(gamesTo), 0)} · mean ${fmt(mean(gamesTo))}.  `)
say(`Per career: ${fmt(mean(perCareerSeasons))} seasons on average (median ${fmt(med(perCareerSeasons), 0)}), ${fmt(mean(allCareers.map((c) => c.games || 0)))} games.`)
say()
say('### Where a career stalls (level reached, all careers in all runs)')
say()
say('| level | ' + LV.join(' | ') + ' |')
say('|---|' + LV.map(() => '---').join('|') + '|')
say('| careers ending there | ' + stall.join(' | ') + ' |')
say(`| share | ${stall.map((n) => (allCareers.length ? Math.round((100 * n) / allCareers.length) + '%' : '—')).join(' | ')} |`)
say()
const ends = {}; for (const c of allCareers) ends[c.end] = (ends[c.end] || 0) + 1
say('How they ended: ' + Object.entries(ends).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(' · ') + '.')
const uffC = allCareers.filter((c) => c.maxLevel >= 7)
say(`Careers that reached the UFF: ${uffC.length} of ${allCareers.length}; those played ${fmt(mean(uffC.map((c) => c.uffSeasons || 0)))} UFF seasons on average and ${uffC.filter((c) => c.title).length} won a ring.`)
say()
if (timing) {
  say('## 3. The clock (headless Chromium on this box — slower than a phone)')
  say()
  say('| what | measured |')
  say('|---|---|')
  for (const q of timing.quick) say(`| one Quick Play week, ${LV[q.level]} (\`playWeek(false)\`, tap to the season screen) | ${q.ms.join(' / ')} ms |`)
  for (const lv of Object.keys(timing.seasonSim)) { const t = timing.seasonSim[lv]; say(`| one season sim, ${LV[lv]} (\`simRemainingWeeks\`, ${t.played} weeks incl. the playoffs) | ${Math.round(t.ms)} ms |`) }
  for (const l of timing.live) say(l.error ? `| a watched UFF game at ${l.speed}× | ${l.error} |` : `| a watched UFF game at ${l.speed}× (men on the grass → the post-game card) | **${(l.ms / 60000).toFixed(1)} min** · ${l.info.rows} rows (${l.info.headers} headers + ${l.info.plays} plays), ${l.info.shown} shown with the default *your side of the ball* (${l.info.shownHdr} h + ${l.info.shownPlay} p) · animation mean ${l.anim.mean.toFixed(0)} ms / play (${l.anim.n} plays)${l.done ? '' : ' · TIMED OUT'} |`)
  say()
  say('**The per-row model** (src/07 `liveTickBodyV163A`): a header row waits `max(150, 600/speed)` ms, a play row runs its animation and then waits `max(90, 520/speed)` ms; rows filtered by *your side of the ball* (on by default) cost one frame. A game\'s wall time ≈ headers × 600/s + plays × (animation(s) + 520/s) + ~20 s (kickoff, the post-game card). With the measured animation means that gives, per watched game: ' + [1, 2, 3, 4].map((s) => `**${s}×: ${(watchS(s) / 60).toFixed(1)} min**`).join(' · ') + '. (3× is interpolated from the 1× animation ÷ 3.)')
  say()
}
say('## 4. Hours per run — the model')
say()
say('Assumptions (every one is a knob at the top of `modelRun` in the script):')
say()
say(`- The median run above (${medRun ? medRun.careersToTitle + ' careers, ' + medRun.seasons + ' seasons, ' + medRun.games + ' games' : 'none reached a title'}) is the run that is timed; each of its seasons is charged by level, with the games it actually had (regular + playoff + championship).`)
say(`- Speed: a **free** player watches at **2×** until he has finished a whole UFF season, **3×** after that, **4×** after a title (v156 C); a **member** has 4× from the start.`)
say(`- **Season sims**: a free player has ${M.simBase} a career (+1 per completed Legacy medal group — the sim recorded ${allCareers.some((c) => c.skips && c.skips.allowed > 1) ? 'up to ' + Math.max(...allCareers.map((c) => (c.skips && c.skips.allowed) || 1)) : 'no extra'} in these runs); a member has ×${M.memberSimMult} (1 → 2). The model spends them on the longest seasons of each career. A season sim costs ${fmt(simS)} s (measured) + ${M.humanTapS} s.`)
say(`- **Quick Play**: ${fmt(quickS)} s measured per week + ${M.humanTapS} s of human time (the tap, the wheel, the score). Free while the store is OFF; with the store ON (the shipped F2P design) it needs a rewarded ad: ${M.adS} s per ${M.adMin} min of quick play (\`gameSims\`, v158 B) — the daily cap of 4 ads (\`adsPerDayV151A\`) is NOT modelled as wall time, but it caps a free player at 2 h of quick play a day, so a run stretches over more calendar days than the hours below suggest.`)
say(`- **The championship is always watched** (v156 B / v164 B): the title game of every level he reaches is charged as a watched game at his speed, even for the member and the ad user; the earlier playoff rounds sim (v164 B).`)
say(`- **Screens**: ${M.screenS} s a season (training, event, report card, hub) and ${M.careerS} s a career (position, the prestige shop, the career-end screen).`)
say('- Not modelled: injuries sitting a week out (the sim counts those weeks as not played), the Score Attack / Daily side modes, reading the coach, the wheels\' own animations, loading times.')
say()
if (modelled) {
  say('| player | hours per career (median run) | hours to the first UFF title (median run) | ads watched |')
  say('|---|---|---|---|')
  say(`| (i) F2P, watches every game at his best speed | ${fmt(perCareerHours.watch)} | **${fmt(modelled.watch.hours)}** | 0 |`)
  say(`| (ii) F2P, Quick Play through ads (store ON), championships watched | ${fmt(perCareerHours.ads)} | **${fmt(modelled.ads.hours)}** | ${modelled.ads.ads} |`)
  say(`| (iii) Member, Quick Play everything but the championships, 4× | ${fmt(perCareerHours.member)} | **${fmt(modelled.member.hours)}** | 0 |`)
  say()
  const lt = levelTotals(medRun)
  say('The median run by level (what the hours are made of):')
  say()
  say('| level | seasons | regular-season games | playoff games | championship games |')
  say('|---|---|---|---|---|')
  lt.forEach((k, i) => { if (k.seasons) say(`| ${LV[i]} | ${k.seasons} | ${k.reg} | ${k.po} | ${k.champ} |`) })
  say()
}
say('## 5. Caveats')
say()
say('- **The greedy prestige policy** (cheapest node first, Prodigy path) is one reasonable player, not the best one; a player who saves for the advance-odds or extra-seasons nodes may need fewer careers. The starting tree is empty (a fresh account).')
say('- **The playoffs are simmed** (`TU v156Bplayoffs 0`), including every championship the real game makes you watch. A watched game is the same engine game (`simGameV2`), so the outcome distribution is the same; the difference is only the viewing time, which §4 charges.')
say('- **Decisions are auto-answered** the way the game answers them for a pro (v147 A\'s scorer), at every level; a human picking differently changes growth a little, not the shape of the result. The declare policy (≥ ' + DECLARE_AT + '% or forced) is a knob (`--declareAt`).')
say('- **The balanced program** every season, as asked; the game\'s own recommendation (`recommendTraining`) is often a focused program and might grow the player faster.')
say('- **Watching pays** (v164 C): a season simmed from the sofa earns ×0.85 of the Legacy XP and a ×1.3 cut roll at the UFF; the runs here sim everything, so the medals come a little slower and UFF cuts a little faster than a watching player would see. That favours the member\'s hours slightly less than reality and the F2P watcher\'s careers slightly more.')
say(`- **Sample size**: ${runs.length} runs × up to ${MAX_CAREERS} careers; the median is the number to quote, the min/max show the spread.`)
say(`- **The clock** is headless Chromium under a parallel sim load; the per-row model in §3 is what the phone estimate rests on. A stuck career is reported by its screen and dropped, never faked: ${allCareers.filter((c) => c.stuck).length} of ${allCareers.length} careers were stuck (${allCareers.filter((c) => c.stuck).map((c) => c.stuck.view).join(', ') || 'none'}).`)
say(`- Page errors during the run: ${errors.length ? errors.slice(0, 5).join(' | ') : 'none'}.`)
say()
const md = lines.join('\n') + '\n'
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, md)
fs.writeFileSync(OUT.replace(/\.md$/, '.json'), JSON.stringify({ runs, timing, errors }, null, 1))
console.log('\n' + md)
console.log(`wrote ${OUT} (+ .json) in ${(msA / 60000).toFixed(1)} min`)
