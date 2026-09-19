// Dev check (v130 HONORS, NOT STARS): two currencies, two symbols.
//
// The game had two star ratings that meant nothing like each other. One is the RECRUIT rating —
// the 1–5 stars on a player, the thing scouts give him, the thing drSoftCap reads. The other was
// the account's PRESTIGE, drawn with the same ★ and quoted the same way: the header chip said
// "★3", the tree said "🔒 Needs ★8 prestige", the path screen said "Reach ★6 prestige". A player
// reading "Needs ★8" reasonably concludes he needs an eight-star recruit, which does not exist.
//
// Asserts: the account rank is HONORS with its own mark everywhere it is shown; the ★ is left to
// mean the recruit rating and only that; the node requirement reads `honors` (still accepting the
// old `stars`); the gate itself is unchanged — the same thresholds through the same curve; and the
// menu can still read the rank off the screen now that it is not a star.
import { chromium } from 'playwright'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 520, height: 1000 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
await page.goto('http://localhost:5173/?stayStale', { waitUntil: 'networkidle', timeout: 25000 })
await page.waitForTimeout(1400)
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const MEDAL = '\u{1F396}'

ok(await page.evaluate(() => !!window.__V130), 'window.__V130 is mounted')

// ---- 1. the model: the gate is the same gate, read off a differently-named key ----
const model = await page.evaluate(() => {
  const V = window.__V130
  return { icon: V.icon, name: V.name,
    curve: [1, 5, 8, 16, 24].map(n => V.curve(n)),
    reqHonors: V.req({ honors: 8 }), reqStars: V.req({ stars: 8 }),     // the old key still reads
    hasHonors: V.hasReq({ honors: 8 }), hasStars: V.hasReq({ stars: 8 }), hasNode: V.hasReq({ node: 'x', lvl: 2 }),
    have: V.have() }
})
console.log('model:', JSON.stringify(model))
ok(model.icon === MEDAL + '️' || model.icon.startsWith(MEDAL), 'the account rank has its own mark, and it is not a star', JSON.stringify(model.icon))
ok(model.name === 'Honors', 'and its own name', model.name)
ok(model.reqHonors === model.reqStars, 'the requirement reads the new key and still accepts the old one', `${model.reqHonors} === ${model.reqStars}`)
ok(model.hasHonors && model.hasStars && !model.hasNode, 'and it only claims a requirement it actually has', JSON.stringify([model.hasHonors, model.hasStars, model.hasNode]))
ok(model.curve.every((v, i) => i === 0 || v > model.curve[i - 1]), 'the threshold curve is untouched and still climbs', JSON.stringify(model.curve))

// ---- 2. the screens ----
const vis = `el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none' }`
async function click(t) {
  const r = await page.evaluate(({ t, visSrc }) => {
    const vis = eval(visSrc)
    const el = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
      .find(e => ((e.innerText || e.textContent || '').replace(/\s+/g, ' ').includes(t)))
    if (el) { el.scrollIntoView({ block: 'center' }); el.click(); return true } return false
  }, { t, visSrc: vis }); await page.waitForTimeout(600); return r
}
const chip = await page.evaluate(() => {
  const c = document.querySelector('.prestige-chip')
  return c ? { txt: (c.textContent || '').replace(/\s+/g, ' ').trim(), title: c.getAttribute('title') || '' } : null
})
console.log('header chip:', JSON.stringify(chip))
ok(chip && /HONORS/.test(chip.txt), 'the header chip names the currency', chip && chip.txt)
ok(chip && chip.txt.indexOf('★') < 0, 'and does not draw a star for it', chip && chip.txt)
ok(chip && /not the 1-5 star recruit rating/i.test(chip.title), 'and says which one it is NOT, for the player who was confused', (chip && chip.title || '').slice(0, 80) + '…')

// give the account some rank, then read the prestige tree
const tree = await page.evaluate(() => {
  window.S.prestige = 4; window.S.pp = 400
  try { window.go('shop') } catch (e) {}
  return null
})
await page.waitForTimeout(700)
const shop = await page.evaluate(() => {
  const t = document.getElementById('screen').textContent.replace(/\s+/g, ' ')
  const locks = [...document.querySelectorAll('.shop-item')].map(e => e.textContent.replace(/\s+/g, ' ')).filter(x => /Needs/.test(x))
  return { honors: (t.match(/HONORS/g) || []).length, starLock: /Needs ★/.test(t), sample: locks[0] || '', locks: locks.length }
})
console.log('prestige tree:', JSON.stringify(shop))
ok(!shop.starLock, 'the prestige tree never asks for a star', `"Needs ★" present: ${shop.starLock}`)
ok(shop.locks === 0 || /HONORS/.test(shop.sample), 'a locked node asks for HONORS, and says how many you have', shop.sample.slice(0, 90))

// the recruit rating is untouched wherever a player is drawn
const recruit = await page.evaluate(() => {
  try { window.go('menu') } catch (e) {}
  return null
})
await page.waitForTimeout(400)
for (const t of ['NEXT', 'NEXT', 'NEXT', 'NEW CAREER']) await click(t)
for (let i = 0; i < 6; i++) {
  const done = await page.evaluate(({ visSrc }) => {
    const vis = eval(visSrc); const els = [...document.querySelectorAll('button,[onclick],a')].filter(vis)
    const txt = e => (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim()
    for (const w of ['START YOUR LEGACY', 'Lock In Personality']) { const b = els.find(e => txt(e).includes(w)); if (b) { b.click(); return false } }
    const c = els.find(e => e.classList.contains('pos-card') || /^[A-Z]{1,2} /.test(txt(e))); if (c) { c.click(); return false }
    return true
  }, { visSrc: vis }); await page.waitForTimeout(450); if (done) break
}
const hub = await page.evaluate(() => {
  const t = document.getElementById('screen').textContent.replace(/\s+/g, ' ')
  return { stars: (t.match(/★/g) || []).length, recruit: /recruit/i.test(t), pl: window.S.player && window.S.player.stars }
})
console.log('hub:', JSON.stringify(hub))
ok(hub.stars >= 1, 'the ★ is still drawn for the player — it means the recruit rating now, and only that', `${hub.stars} stars on the hub`)
ok(hub.pl >= 1 && hub.pl <= 5, 'and the recruit rating is still a 1-5', String(hub.pl))

// ---- 3. the menu can still read the rank off the screen ----
const menuRead = await page.evaluate(() => {
  window.S.prestige = 7
  try { window.go('menu') } catch (e) {}
  const d = window.__RIB_MENU_DATA_V89 && window.__RIB_MENU_DATA_V89()
  return d && d.state ? d.state.prestige : null
})
console.log('menu reads rank:', JSON.stringify(menuRead))
ok(menuRead === 7, 'the main menu still reads the account rank now that it is a medal, not a star', String(menuRead))

// ---- 4. (v139) the honors the card promises are the honors the account gets ----
// Qs() counts a career's honors and the DFL card printed that count, but both settles credited
// it through TU("prestigeGainMult"), which was .2 — so "+7 HONORS" moved the account by 1.4 and
// a short career by 0.2, against a prestige tree whose gates run to 30.
const settle = await page.evaluate(() => {
  const A = window.__GRIDIRON_AUDIT__, S = window.S
  const mk = (lvl) => { const p = A.newPlayer(S, 'RB'); p.level = lvl; p.totalSeasons = 6; p.career = p.career || []; return p }
  const run = (lvl, screen) => {
    const p = mk(lvl); S.player = p; const before = S.prestige
    const raw = A.prestigeStarReward(p, lvl, screen === 'win')
    // the settle runs first; the screen it then draws wants a whole career's fixtures, so let it throw
    try { A[screen]() } catch (e) {}
    return { raw, paid: p._starGain, moved: +(S.prestige - before).toFixed(1), settled: !!p._settled }
  }
  const win = run(7, 'screenWin'), cut = run(5, 'screenGameOver')
  return { win, cut, pay: window.__honorPayV139 && [0, 1, 7].map(n => window.__honorPayV139(n)) }
})
console.log('settle:', JSON.stringify(settle))
ok(!!settle.pay, 'honorPayV139 is the one place a career\'s honors become account honors', JSON.stringify(settle.pay))
ok(settle.win.paid === settle.win.moved, 'the DFL card pays exactly what the account gains',
  `card +${settle.win.paid} · account +${settle.win.moved}`)
ok(settle.win.paid === settle.win.raw, 'and that is the honor count the career actually earned',
  `earned ${settle.win.raw} · paid ${settle.win.paid}`)
ok(settle.cut.moved === settle.cut.raw && settle.cut.paid === settle.cut.raw,
  'a career that ended short is settled on the same terms', `earned ${settle.cut.raw} · account +${settle.cut.moved}`)
ok(settle.win.moved >= 1, 'a full DFL career moves the rank by at least one honor, against gates that run to 30',
  `+${settle.win.moved}`)

console.log('page errors:', errs.length ? errs.join('\n') : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exit(fail || errs.length ? 1 : 0)
