/* v139 THE PICTURE OBEYS THE NUMBER — the broadcast must depict the yardage the box
 * score credits and the chains are set from.
 *
 * FieldSim clamps its reported gain to [-6, 80] and dampV76 can pull it down again
 * afterwards, but neither ever told the LOG. The bridge maps the carrier's own `lx`
 * straight onto the field, so a play could animate thirty yards past the number it
 * credited — and 81 snaps in 2,187 animated the ball more than 100 yards downfield,
 * further than a football field is long. The ball is then spotted on the credited
 * number, so the next snap starts somewhere the viewer did not watch the play end. */
import { chromium } from 'playwright'
import { CHROME, gameUrl } from './lib/env.mjs'
const YD = 5.88
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 412, height: 915 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
await page.goto(gameUrl('?stayStale&noFilmV114'), { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(1200)
await page.evaluate(() => { try { window.__splashDoneV94() } catch (e) {} })
await page.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__FieldSim, null, { timeout: 60000 })

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d) : '')); c ? pass++ : fail++ }

const r = await page.evaluate((YD) => {
  const FS = window.__FieldSim
  const out = { run: [], pass: [], fitted: 0, plays: 0, over100: 0,
    malformed: 0, noTackle: 0, zeroDur: 0, lengthened: 0 }
  for (let g = 0; g < 30; g++) {
    FS._Q.length = 0
    window.__simGameV2()
    for (const h of FS._Q) {
      const k = h.sig.kind
      if (k !== 'run' && k !== 'pass') continue
      const L = h.log
      if (!L || !L.events || typeof h.sig.yards !== 'number' || !isFinite(h.sig.yards)) continue
      out.plays++
      if (!L.actors || L.actors.length !== 22 || !L.ball || !L.ball.length ||
          L.actors.some(a => !a.frames || !a.frames.length)) out.malformed++
      const wasFit = L.events.some(e => e.v139)
      if (wasFit) {
        out.fitted++
        if (!(L.duration > 0)) out.zeroDur++
        if (!L.events.some(e => e.type === 'tackle')) out.noTackle++
      }
      const dead = L.events.slice().reverse().find(e => e.type === 'tackle')
      if (!dead || !isFinite(dead.x)) continue
      /* Only a play the OFFENCE carried. On a pick the dead-ball carrier is a defender
       * running it back, and `yards` is the offence's zero — the number and the picture
       * are both right and they are about different men. */
      if (typeof dead.carrier !== 'string' || dead.carrier.indexOf('off') !== 0) continue
      const shown = dead.x / YD
      if (shown > 100) out.over100++
      // a fit may only ever SHORTEN: the number is never larger than the resolution
      if (wasFit && shown > h.sig.yards + 1) out.lengthened++
      out[k].push(+(shown - h.sig.yards).toFixed(2))
    }
  }
  const over = a => a.filter(v => v >= 3).length
  return { plays: out.plays, fitted: out.fitted, malformed: out.malformed,
    over100: out.over100, noTackle: out.noTackle, zeroDur: out.zeroDur,
    lengthened: out.lengthened,
    runN: out.run.length, runOver3: over(out.run),
    passN: out.pass.length, passOver3: over(out.pass) }
}, YD)

ok(r.plays > 800, 'the probe resolved a real sample of run and pass snaps', r.plays)
ok(r.over100 === 0, 'NO play animates the carrier past 100 yards — further than the field is long', r.over100)
ok(r.runOver3 === 0, 'a RUN never animates three yards further than it credits', { n: r.runN, over: r.runOver3 })
ok(r.passOver3 === 0, 'and neither does a completed PASS', { n: r.passN, over: r.passOver3 })
ok(r.fitted > 0 && r.fitted < r.plays * 0.25,
  'the cut fires on the plays that disagree and leaves the rest alone', { fitted: r.fitted, of: r.plays })
ok(r.lengthened === 0, 'the cut only ever SHORTENS a play — it never invents ground', r.lengthened)
ok(r.malformed === 0, 'every log still has its 22 actors, its ball and frames for everyone', r.malformed)
ok(r.noTackle === 0, 'and a cut play still ends on a dead ball, so the whistle still goes', r.noTackle)
ok(r.zeroDur === 0, 'with a real duration left to play', r.zeroDur)

console.log('page errors:', errs.length ? errs.slice(0, 4) : 'none')
console.log(JSON.stringify({ pass, fail, pageErrors: errs.length }))
await browser.close()
process.exitCode = fail || errs.length ? 1 : 0
