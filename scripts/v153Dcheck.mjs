// Dev check (v153 D THE GOAL ON THE WALL) — the main menu (public/rib-menu.js + rib-menu-v89.css, baked into
// index.html), the feed's `state.goal` (07 `menuGoalV153D`) and the medal box src/31-legacy.js fills (`RIB_LEGACY.menuBox`).
//
//   1. the goal trophy: the owner's UFF CHAMPIONS art (loaded, framed, "THE GOAL") until the account has won the UFF —
//      a Hall career's champion row at level 7, or this career's own season log — then INTERSTELLAR CHAMPIONS ("NEXT");
//      spending the rings does not take it back; an Interstellar title marks it WON. Both webp exist and are <= 150 KB.
//   2. the medal box sits right under the hero's logo, shows the ledger's rank and medal (name, tier, XP bar), hovers
//      (rib9medalfloat), taps through to the profile; the v152 header chip is gone
//   3. a PROFILE tile, which routes to the profile
//   4. the PRESTIGE tile wears the vault's gold coin, not the legacy_gem crystal
//   5. the players breathe (hero art + card portrait, taller than wide) and stop under prefers-reduced-motion
//   6. the menu fits 400x860: no sideways scroll, every tile on screen and readable
//   7. no page errors
//
//   GAME_URL=http://localhost:5173/index.html node scripts/v153Dcheck.mjs      (SHOTS=<dir> for the pictures)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gameUrl, launch } from './lib/env.mjs'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114'
const SHOTS = process.env.SHOTS || '/tmp/claude-0/shots'
try { fs.mkdirSync(SHOTS, { recursive: true }) } catch {}
const W = 400, H = 860
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []

// ---- the art on disk
for (const f of ['trophy_goal_uff', 'trophy_goal_interstellar']) {
  const p = path.join(ROOT, 'public/menu', f + '.webp'), n = fs.existsSync(p) ? fs.statSync(p).size : 0
  ok(n > 10000 && n <= 150 * 1024, `${f}.webp exists and is <= 150 KB`, Math.round(n / 1024) + ' KB')
}
ok(fs.existsSync(path.join(ROOT, 'art/menu/trophy_uff_champions.png')) && fs.existsSync(path.join(ROOT, 'art/menu/trophy_interstellar_champions.png')), 'the owner\'s trophy art lives in art/menu/')

const browser = await launch()
const open = async (reduced) => {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: reduced ? 'reduce' : 'no-preference' })
  await ctx.addInitScript(() => { setInterval(() => { try { document.querySelectorAll('.onboard').forEach((e) => e.remove()) } catch {} }, 60) })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message || String(e)))
  return page
}
const boot = async (page) => {
  await page.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.RIB_LEGACY && !!window.__V152A, null, { timeout: 40000 })
  await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
}
// a fresh account on the menu with a player and a preloaded Legacy ledger
const fresh = (page, o) => page.evaluate((o) => {
  const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); A.setState(S); S.tutorialSeen = true
  S.player = A.newPlayer(); S.player.name = 'Goal Tester'; S.player.pos = 'QB'
  S.legacyV152 = { v: 1, xp: o.xp, boot: 1, got: {}, log: [], ms: 0 }
  S.view = 'menu'; window.GridironStorage.save(S)
}, o)
const menuReady = async (page) => {
  await page.waitForSelector('#rib-main-menu-v2 .rib9-hero', { timeout: 30000 })
  await page.waitForFunction(() => { const b = document.querySelector('#rib-main-menu-v2 .rib9-medalbox-v153d'); return b && !b.classList.contains('is-empty') }, null, { timeout: 15000 }).catch(() => null)
  await page.evaluate(() => { const sp = document.getElementById('splash'); if (sp) sp.remove() })
  await page.waitForTimeout(400)
}
const remount = (page) => page.evaluate(async () => { window.__RIB_MENU_V89.mountMenu(); await new Promise((r) => setTimeout(r, 150)) })
const goal = (page) => page.evaluate(async () => {
  const f = document.querySelector('#rib-main-menu-v2 .rib9-milestones .rib9-goal-v153d'), img = f && f.querySelector('img')
  if (img && !img.complete) await new Promise((r) => { img.onload = img.onerror = r })
  const r = img ? img.getBoundingClientRect() : null
  return f && { stage: f.dataset.stage, src: img.getAttribute('src'), natural: img.naturalWidth, w: r.width, h: r.height, cap: f.querySelector('figcaption').textContent.replace(/\s+/g, ' ').trim(),
    shine: getComputedStyle(f.querySelector('.rib9-goal-shine')).animationName, feed: window.__RIB_MENU_DATA_V89().state.goal, n: document.querySelectorAll('#rib-main-menu-v2 .rib9-goal-v153d').length }
})

const page = await open(false)
await page.goto(U, { waitUntil: 'domcontentloaded' }); await page.evaluate(() => localStorage.clear())
await boot(page)
const XP = 30000
await fresh(page, { xp: XP }); await boot(page); await menuReady(page)

// ============================== 1. the goal trophy ==============================
{
  let g = await goal(page)
  ok(g && g.n === 1 && g.stage === 'uff' && /trophy_goal_uff\.webp/.test(g.src) && g.natural === 480, 'no UFF title yet: the UFF CHAMPIONS trophy is the goal (loaded)', g)
  ok(g && /THE GOAL/.test(g.cap) && /UFF CHAMPIONS/.test(g.cap) && !/INTERSTELLAR/.test(g.cap), 'labelled THE GOAL · UFF CHAMPIONS', g && g.cap)
  ok(g && g.w >= 110 && Math.abs(g.h / g.w - 1.25) < 0.03, 'framed whole as a 4:5 card, not a sliver', g && [g.w, g.h])
  ok(g && g.shine !== 'none', 'a shine sweeps the frame', g && g.shine)
  await page.locator('#rib-main-menu-v2 .rib9-milestones').scrollIntoViewIfNeeded(); await page.waitForTimeout(250)
  await page.locator('#rib-main-menu-v2 .rib9-milestones').screenshot({ path: SHOTS + '/v153D_goal_uff.png' }).catch(() => null)
  // this career wins the UFF: a champion row at level 7 in its own season log
  await page.evaluate(() => { const S = window.__GRIDIRON_AUDIT__.getState(); S.player.seasonLogV77 = [{ level: 7, champion: true }]; S.player.nflRings = 1; S.rings = 1 })
  await remount(page); g = await goal(page)
  ok(g && g.stage === 'isl' && /trophy_goal_interstellar\.webp/.test(g.src) && g.natural === 480 && /NEXT/.test(g.cap) && /INTERSTELLAR CHAMPIONS/.test(g.cap), 'after a UFF title: NEXT · INTERSTELLAR CHAMPIONS', g)
  await page.locator('#rib-main-menu-v2 .rib9-milestones').screenshot({ path: SHOTS + '/v153D_goal_interstellar.png' }).catch(() => null)
  // the rings are spent on mastery and the player retires into the Hall: the title stays won
  await page.evaluate(() => { const S = window.__GRIDIRON_AUDIT__.getState(); S.rings = 0; S.player.seasonLogV77 = []; S.player.nflRings = 0
    S.hof = [{ name: 'Old Champ', pos: 'QB', peak: 90, rings: 0, reached: 7, goat: 40, box: { log: [{ level: 6, champion: true }, { level: 7, champion: true }] } }] })
  await remount(page); g = await goal(page)
  ok(g && g.stage === 'isl' && g.feed.uff === 1, 'the rings spent, a Hall career\'s UFF title still counts (never read off `rings`)', g && g.feed)
  await page.evaluate(() => { const S = window.__GRIDIRON_AUDIT__.getState(); S.hof[0].box.log.push({ level: 8, champion: true }) })
  await remount(page); g = await goal(page)
  ok(g && g.stage === 'done' && /WON/.test(g.cap) && /INTERSTELLAR/.test(g.cap), 'an Interstellar title marks it WON', g && g.cap)
  await page.evaluate(() => { const S = window.__GRIDIRON_AUDIT__.getState(); S.hof = [] })
  await remount(page); g = await goal(page)
  ok(g && g.stage === 'uff', 'an account with no title is back on the UFF goal', g && g.stage)
}

// ============================== 2. the medal box ==============================
{
  const want = await page.evaluate((xp) => { const R = window.__V152A.rank(xp); return { rank: R.rank, medal: R.medal, name: window.RIB_LEGACY.name(R.medal), tier: window.RIB_LEGACY.tierName(R.medal), pct: R.into / R.need * 100 } }, XP)
  const b = await page.evaluate(() => {
    const box = document.querySelector('#rib-main-menu-v2 .rib9-medalbox-v153d'), hero = document.querySelector('#rib-main-menu-v2 .rib9-hero'), logo = hero.querySelector('.rib9-hero-copy h1 img')
    if (!box) return null
    const r = box.getBoundingClientRect(), hr = hero.getBoundingClientRect(), lr = logo.getBoundingClientRect(), m = box.querySelector('.lgbox-medal .lg-medal-v152')
    const card = document.querySelector('#rib-main-menu-v2 .rib9-player')
    return { rank: +box.dataset.rank, medal: m ? +m.dataset.rank : 0, size: m ? m.getBoundingClientRect().width : 0, text: box.textContent.replace(/\s+/g, ' ').trim(),
      bar: parseFloat((box.querySelector('.lgbox-bar > i') || {}).style?.width || 'NaN'), top: r.top, bottom: r.bottom, left: r.left, right: r.right, heroBottom: hr.bottom, logoBottom: lr.bottom, logoLeft: lr.left,
      nextIsCard: box.nextElementSibling === card, prevIsHero: box.previousElementSibling === hero, action: box.dataset.ribAction,
      float: getComputedStyle(box.querySelector('.lgbox-medal')).animationName, halo: getComputedStyle(box.querySelector('.lgbox-halo')).animationName,
      chip: document.querySelectorAll('.legacy-chip-v152.menu').length, inHeader: !!document.querySelector('#rib-main-menu-v2 .rib9-topbar .legacy-chip-v152') }
  })
  ok(b && b.rank === want.rank && b.medal === want.medal, 'the box shows the ledger\'s rank and medal', { box: b && [b.rank, b.medal], want })
  ok(b && b.text.includes(String(want.rank)) && b.text.includes(want.name) && b.text.includes(want.tier) && Math.abs(b.bar - want.pct) < 0.2, 'rank, medal name, tier and the XP bar', b && { text: b.text, bar: b.bar })
  ok(b && b.size >= 70, 'a big medal (>= 70px)', b && b.size)
  ok(b && b.prevIsHero && b.nextIsCard && b.top > b.logoBottom && b.top < b.heroBottom + 4 && b.left <= b.logoLeft + 16, 'right below the RUNNING IT BACK logo, before the player card', b && { top: b.top, logoBottom: b.logoBottom, heroBottom: b.heroBottom, left: b.left, logoLeft: b.logoLeft })
  ok(b && b.float === 'rib9medalfloat' && b.halo === 'rib9medalhalo', 'the medal hovers in its tier glow', b && [b.float, b.halo])
  ok(b && b.chip === 0 && !b.inHeader, 'the v152 header chip is gone (the box replaces it)', b && b.chip)
  await page.evaluate(() => document.getElementById('rib-main-menu-v2').scrollTo(0, 0)); await page.waitForTimeout(200)
  await page.screenshot({ path: SHOTS + '/v153D_menu_top.png' }).catch(() => null)
  // the rank climbs while the menu is up: the box follows
  await page.evaluate(() => { const S = window.__GRIDIRON_AUDIT__.getState(); S.legacyV152.xp = window.__V152A.xpAt(120) + 5 })
  await page.waitForFunction(() => +(document.querySelector('#rib-main-menu-v2 .rib9-medalbox-v153d') || {}).dataset?.rank === 120, null, { timeout: 5000 }).catch(() => null)
  const r2 = await page.evaluate(() => +document.querySelector('#rib-main-menu-v2 .rib9-medalbox-v153d').dataset.rank)
  ok(r2 === 120, 'a climbed rank refreshes the box', r2)
  ok(b && b.action === 'view:profile', 'the box routes to the profile', b && b.action)
  await page.click('#rib-main-menu-v2 .rib9-medalbox-v153d')
  await page.waitForFunction(() => window.__GRIDIRON_AUDIT__.getState().view === 'profile', null, { timeout: 5000 }).catch(() => null)
  ok(await page.evaluate(() => window.__GRIDIRON_AUDIT__.getState().view) === 'profile', 'tapping the medal box opens the profile')
  await page.evaluate(() => window.go('menu')); await menuReady(page)
}

// ============================== 3 + 4. the tiles ==============================
{
  const t = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#rib-main-menu-v2 .rib9-tiles .rib9-tile')]
    const find = (re) => tiles.find((x) => re.test(x.querySelector('b')?.textContent || ''))
    const prof = find(/^PROFILE$/), pres = find(/^PRESTIGE$/)
    return { prof: prof && { action: prof.dataset.ribAction, w: prof.getBoundingClientRect().width }, presSrc: pres && pres.querySelector('img').getAttribute('src'), presNat: pres ? pres.querySelector('img').naturalWidth : 0,
      gem: tiles.some((x) => /legacy_gem/.test(x.querySelector('img')?.getAttribute('src') || '')) }
  })
  ok(t.prof && t.prof.action === 'view:profile', 'a PROFILE tile on the menu', t.prof)
  ok(/vault\/coin_gold_face\.webp/.test(t.presSrc || '') && !t.gem, 'PRESTIGE wears the vault\'s gold coin, not the crystal', t.presSrc)
  await page.locator('#rib-main-menu-v2 .rib9-tiles').screenshot({ path: SHOTS + '/v153D_tiles.png' }).catch(() => null)
  await page.evaluate(() => { const el = [...document.querySelectorAll('#rib-main-menu-v2 .rib9-tile')].find((x) => /^PROFILE$/.test(x.querySelector('b')?.textContent || '')); el.scrollIntoView({ block: 'center' }) })
  await page.waitForTimeout(200)
  await page.click('#rib-main-menu-v2 .rib9-tile-profile-v153d')
  await page.waitForFunction(() => window.__GRIDIRON_AUDIT__.getState().view === 'profile', null, { timeout: 5000 }).catch(() => null)
  ok(await page.evaluate(() => window.__GRIDIRON_AUDIT__.getState().view) === 'profile', 'the PROFILE tile opens the profile')
  await page.evaluate(() => window.go('menu')); await menuReady(page)
}

// ============================== 5. breathing ==============================
const breath = (p) => p.evaluate(() => {
  const art = document.querySelector('#rib-main-menu-v2 .rib9-hero-art'), por = document.querySelector('#rib-main-menu-v2 .rib9-portrait img')
  const kf = {}
  for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules } catch { continue } for (const r of rules || []) if (r.type === 7 && /^rib9breathe2?$/.test(r.name)) kf[r.name] = r.cssText }
  const a = art && getComputedStyle(art), q = por && getComputedStyle(por)
  return { art: a && a.animationName, artDur: a && parseFloat(a.animationDuration), por: q && q.animationName, porDur: q && parseFloat(q.animationDuration), kf }
})
{
  const s = await breath(page)
  const tall = (txt) => { const m = String(txt || '').match(/scale\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g) || []; return m.some((x) => { const [, a, b] = x.match(/([\d.]+)\s*,\s*([\d.]+)/); return +b > +a && +b - 1 <= 0.035 }) }
  ok(s.art === 'rib9breathe' && s.artDur >= 4 && s.artDur <= 5 && s.por === 'rib9breathe2' && s.porDur >= 4 && s.porDur <= 5, 'the hero and the card portrait breathe on a 4-5s loop', s)
  ok(tall(s.kf.rib9breathe) && tall(s.kf.rib9breathe2), 'a breath, taller than wide (the shoulders rise), within ~3%', s.kf)
  const rp = await open(true)
  await rp.goto(U, { waitUntil: 'networkidle', timeout: 60000 }); await menuReady(rp)
  const r = await breath(rp)
  const rm = await rp.evaluate(() => [...document.querySelectorAll('#rib-main-menu-v2 .lgbox-medal, #rib-main-menu-v2 .rib9-goal-shine')].map((e) => getComputedStyle(e).animationName))
  ok(r.art === 'none' && r.por === 'none' && rm.length >= 2 && rm.every((x) => x === 'none'), 'prefers-reduced-motion: no breath, no hover, no shine', { art: r.art, por: r.por, rm })
  await rp.context().close()
}

// ============================== 6. fits 400x860 ==============================
{
  const f = await page.evaluate(() => {
    const menu = document.getElementById('rib-main-menu-v2')
    const tiles = [...menu.querySelectorAll('.rib9-tiles .rib9-tile')].map((t) => { const r = t.getBoundingClientRect(), b = t.querySelector('b'); return { l: (b && b.textContent) || '', x0: r.left, x1: r.right, w: r.width, fs: b ? parseFloat(getComputedStyle(b).fontSize) : 0 } })
    const box = menu.querySelector('.rib9-medalbox-v153d').getBoundingClientRect(), goal = menu.querySelector('.rib9-goal-v153d').getBoundingClientRect()
    return { docW: document.documentElement.scrollWidth, menuW: menu.scrollWidth, cw: menu.clientWidth, tiles, box: [box.left, box.right], goal: [goal.left, goal.right] }
  })
  ok(f.docW <= W && f.menuW <= f.cw, 'no sideways scroll at 400 wide', { docW: f.docW, menuW: f.menuW })
  ok(f.tiles.every((t) => t.x0 >= 0 && t.x1 <= W && t.w >= 100 && t.fs >= 13), 'every tile on screen, >= 100px wide, a >= 13px label', f.tiles.filter((t) => !(t.x0 >= 0 && t.x1 <= W && t.w >= 100 && t.fs >= 13)))
  ok(f.box[0] >= 0 && f.box[1] <= W && f.goal[0] >= 0 && f.goal[1] <= W, 'the medal box and the goal card sit inside the screen', { box: f.box, goal: f.goal })
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 5))
console.log(`\nv153Dcheck: ${pass} ok, ${fail} failed  (shots in ${SHOTS})`)
await browser.close()
process.exit(fail ? 1 : 0)
