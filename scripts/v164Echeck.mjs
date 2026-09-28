// Dev check: v164 E THE BAR IS 250, AND IT LAPS (src/07-career-app.js). At a 400x860 phone, a seeded player with stats
// 12 / 240 / 251 / 520: on the hub's SKILLS sheet, the skill sheet (upgrade) and the training board every bar is drawn
// against the 250 scale (12 → ~5%, 240 → 96%), a 251 has lapped once (the track wears the finished lap, the fill
// starts round again at ~0.4%, a ×2 tag beside the number), a 520 has lapped twice (×3); the pregame sheet's row
// helper draws the same laps; TU v164Ebars 0 draws the old scales (the hub sheet against the absolute cap); no errors.
//   node scripts/v164Echeck.mjs        (GAME_URL=http://localhost:5173/)
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = (...q) => url + (url.includes('?') ? '&' : '?') + ['stayStale', 'noFilmV114', 'noGrowV132'].concat(q).join('&')
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 } })
await ctx.addInitScript(() => { try { localStorage.setItem('rib.coachTour.v119', 'off') } catch {} setInterval(() => { document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80) })
const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message || String(e)))
await page.goto(U(), { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V164E && !!window.__HUB_V75, null, { timeout: 40000 })
await page.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') }, null, { timeout: 30000 }).catch(() => null)
await page.evaluate(() => document.getElementById('splash')?.remove()); await page.waitForTimeout(600)
const M = (fn, a) => page.evaluate(fn, a)
await M(() => { const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S); S.player = A.newPlayer(); const p = S.player; p.name = 'Bar Man'; p.pos = 'RB'; p.age = 22; p.originV11 = 'walk-on'; p._wonShown = true; p.level = 5; p.points = 20
  p.attrs.speed = 12; p.attrs.strength = 240; p.attrs.agility = 251; p.attrs.awareness = 520; p.training = 'balanced'; window.GridironStorage.save(S) })
const L = await M(() => { const V = window.__V164E; return { scale: V.scale(), l12: V.lap(12), l240: V.lap(240), l251: V.lap(251), l520: V.lap(520), cls251: V.cls(251), cls520: V.cls(520), tag520: V.tag(520), tag12: V.tag(12), pct: V.pct(260, 251) } })
console.log('laps:', JSON.stringify(L))
ok(L.scale === 250 && L.l12.pct === 4.8 && L.l240.pct === 96 && L.l251.laps === 1 && L.l251.pct === 0.4 && L.l520.laps === 2 && L.l520.pct === 8, 'the one read: 250 is the scale, 12 → 4.8%, 240 → 96%, 251 laps once (0.4% into the next), 520 twice (8%)', L)
ok(/lap1/.test(L.cls251) && /lap2/.test(L.cls520) && /×3/.test(L.tag520) && L.tag12 === '' && L.pct === 4, 'lap classes and tags; a value on the same lap as its reference lands on that lap', { cls251: L.cls251, cls520: L.cls520, tag: L.tag520, pct: L.pct })
// the hub's SKILLS sheet
const hub = await M(async () => { window.__HUB_V75.tabs.hub = 'skills'; window.go('hub'); await new Promise((r) => setTimeout(r, 900))
  const row = (name) => { const el = [...document.querySelectorAll('#screen .attr')].find((a) => new RegExp(name, 'i').test((a.querySelector('.an') || {}).textContent || '')); if (!el) return null; const t = el.querySelector('.track'), i = t && t.querySelector('i'); return { w: i ? parseFloat(i.style.width) : null, cls: t ? t.className : '', tag: (el.querySelector('.lapn-v164e') || {}).textContent || '' } }
  return { n: document.querySelectorAll('#screen .attr').length, names: [...document.querySelectorAll('#screen .attr .an')].slice(0, 4).map((a) => a.textContent), speed: row('speed'), strength: row('strength'), agility: row('agility'), awareness: row('awareness'), css: !!document.getElementById('barsV164Ecss') } })
console.log('hub sheet:', JSON.stringify(hub))
ok(hub.css && hub.speed && Math.abs(hub.speed.w - 4.8) < 0.2 && hub.strength && Math.abs(hub.strength.w - 96) < 0.2, 'the hub sheet draws against 250: a 12 is a sliver, a 240 nearly full', { speed: hub.speed, strength: hub.strength })
ok(hub.agility && /lap1/.test(hub.agility.cls) && hub.agility.w < 1 && hub.agility.tag === '×2' && hub.awareness && /lap2/.test(hub.awareness.cls) && Math.abs(hub.awareness.w - 8) < 0.2 && hub.awareness.tag === '×3', 'a 251 has lapped once (the track wears the finished lap, ×2), a 520 twice (×3)', { agility: hub.agility, awareness: hub.awareness })
// the skill sheet
const up = await M(async () => { window.__upGroupV97 = null; window.go('upgrade'); await new Promise((r) => setTimeout(r, 900))
  const bar = (k) => { const b = document.getElementById('bar-' + k), i = b && b.firstElementChild; const uv = document.getElementById('uv-' + k); return b ? { w: i ? parseFloat(i.style.width) : null, cls: b.className, tag: uv && uv.parentElement ? ((uv.parentElement.querySelector('.lapn-v164e') || {}).textContent || '') : '' } : null }
  return { speed: bar('speed'), strength: bar('strength'), agility: bar('agility'), awareness: bar('awareness') } })
console.log('skill sheet:', JSON.stringify(up))
ok(up.speed && Math.abs(up.speed.w - 4.8) < 0.2 && up.strength && Math.abs(up.strength.w - 96) < 0.2, 'the skill sheet draws against 250 too', { speed: up.speed, strength: up.strength })
ok(up.agility && /lap1/.test(up.agility.cls) && up.agility.tag === '×2' && up.awareness && /lap2/.test(up.awareness.cls) && Math.abs(up.awareness.w - 8) < 0.2, 'and laps with the tag beside the number', { agility: up.agility, awareness: up.awareness })
// the training board's preview rows
const tp = await M(async () => { window.go('training'); await new Promise((r) => setTimeout(r, 900)); try { window.previewTraining('balanced') } catch (e) {} await new Promise((r) => setTimeout(r, 500))
  const row = (name) => { const el = [...document.querySelectorAll('#screen .tp-row-v113')].find((a) => new RegExp(name, 'i').test((a.querySelector('.tp-rn-v113') || {}).textContent || '')); if (!el) return null; const t = el.querySelector('.track'), i = t && t.querySelector('i'); return { w: i ? parseFloat(i.style.width) : null, cls: t ? t.className : '' } }
  return { n: document.querySelectorAll('#screen .tp-row-v113').length, strength: row('strength'), awareness: row('awareness') } })
console.log('training board:', JSON.stringify(tp))
ok(tp.n > 0 && tp.strength && Math.abs(tp.strength.w - 96) < 0.2 && tp.awareness && /lap2/.test(tp.awareness.cls) && Math.abs(tp.awareness.w - 8) < 0.2, 'the training board\'s rows draw against 250 and lap', tp)
// the kill switch
const ks = await M(async () => { window.RIB_TUNE.v164Ebars = 0; window.__HUB_V75.tabs.hub = 'skills'; window.go('hub'); await new Promise((r) => setTimeout(r, 900))
  const el = [...document.querySelectorAll('#screen .attr')].find((a) => /strength/i.test((a.querySelector('.an') || {}).textContent || '')); const i = el && el.querySelector('.track i'); const out = { w: i ? parseFloat(i.style.width) : null, laps: document.querySelectorAll('#screen .lap-v164e').length, scale: window.__V164E.scale() }; delete window.RIB_TUNE.v164Ebars; return out })
ok(ks.scale === 0 && ks.laps === 0 && ks.w != null && ks.w < 96, 'TU v164Ebars 0: the old scale (a 240 against the absolute cap), no laps', ks)
console.log(JSON.stringify({ pass, fail, pageErrors: errors.length }))
console.log('page errors:', errors.length ? errors.slice(0, 6) : 'none')
await browser.close()
process.exit(fail || errors.length ? 1 : 0)
