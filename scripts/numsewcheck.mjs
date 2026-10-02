// Dev check: v176 THE NUMBER IS SEWN ON (src/05-field-renderer.js `torsoV176` / `sewKeyV176` / `sewSyncV176`, src/28 `chestPixelV176`).
//   The field's numbers are printed into the shirt on the art's own pixel grid. Re-derived here from the SOURCE art, not
//   from the renderer's own numbers: every printed pixel lands on a jersey pixel (a hand, the ball or the facemask covers
//   it), a back number sits wholly under the helmet's stripe, centred on the back (within a pixel), a front number under
//   the facemask; a drawn cycle wears one face in every frame; a mirrored three-quarter view is not printed backwards; the
//   print carries the fabric's shading; a dark kit gets a white number with a trim, a light kit a dark one. Live: the
//   prints show front and back through play, and the v104 label is hidden while they do; a number font prints in its own
//   colours. The profile figure's chest is printed on the figure's own pixels, centred, under the chin. TU v176sew 0: the
//   label exactly as before, nothing printed; v176chest 0: the v159 A chest. No page errors.
//   GAME_URL=http://localhost:5173/ node scripts/numsewcheck.mjs
import { gameUrl, launch } from './lib/env.mjs'
const url = gameUrl('index.html')
const U = url + (url.includes('?') ? '&' : '?') + 'stayStale&noFilmV114&noGrowV132'
const browser = await launch()
let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); c ? pass++ : fail++ }
const errors = []
const open = async (tune, tag, nf) => {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, isMobile: true, hasTouch: true })
  await ctx.addInitScript((tune) => {
    window.RIB_TUNE = Object.assign(window.RIB_TUNE || {}, { v175pan: 0 }, tune || {})
    try { localStorage.setItem('rib.coachTour.v119', 'off'); localStorage.setItem('rib.debriefOff.v122', 'off'); localStorage.setItem('rib.sprayHint.v170', '1') } catch {}
    setInterval(() => { try { if (window.S) window.S.tutorialSeen = true } catch {} document.querySelector('.onboard')?.remove(); document.getElementById('personaV13')?.remove(); document.getElementById('growthV42')?.remove(); document.getElementById('gv139gate')?.remove() }, 80)
  }, tune || {})
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + (e.message || e)))
  await p.goto(U, { waitUntil: 'networkidle', timeout: 60000 })
  await p.waitForFunction(() => !!window.__GRIDIRON_AUDIT__ && !!window.__V176, null, { timeout: 40000 })
  await p.waitForTimeout(600); await p.evaluate(() => document.getElementById('splash')?.remove())
  await p.evaluate((nf) => {
    const A = window.__GRIDIRON_AUDIT__, S = A.freshState(); S.tutorialSeen = true; A.setState(S)
    S.player = A.newPlayer(); const pl = S.player; pl.name = 'Test Man'; pl.pos = 'WR'; pl.age = 16; pl.originV11 = 'walk-on'; pl._wonShown = true; pl.level = 3
    for (const k in pl.attrs) pl.attrs[k] = 60
    if (nf) { try { window.RIB_COSMETICS.grant(nf); window.RIB_COSMETICS.equip('numfont', nf) } catch (e) {} }
    A.startSeasonGames(); window.go('season')
  }, nf || '')
  await p.waitForTimeout(400)
  await p.evaluate(() => window.prepareWeek103(true)); await p.waitForTimeout(1200)
  await p.evaluate(() => window.__v112SkipD())
  await p.waitForFunction(() => window.S && window.S.view === 'live' && window.__gridironScene && (window.__gridironScene.markers || []).length > 20, null, { timeout: 60000 }).catch(() => null)
  return { ctx, p }
}

{
  const { ctx, p } = await open({}, 'on')
  // 1. the prints, re-derived from the source art
  const A = await p.evaluate(() => {
    const sc = window.__gridironScene, V = window.__V176, SRC = V.src(), N = 48
    const cls = (d, i) => {   // the kit bands ribRecolor keys on: 1 jersey (navy), 2 the second colour (gold), 3 outline, 0 other
      if (d[i + 3] < 40) return 0
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, sat = mx ? (mx - mn) / mx : 0
      if (L < 38) return 3
      let hue = 0; if (mx !== mn) { if (mx === r) hue = (60 * ((g - b) / (mx - mn)) + 360) % 360; else if (mx === g) hue = 60 * ((b - r) / (mx - mn)) + 120; else hue = 60 * ((r - g) / (mx - mn)) + 240 }
      return hue >= 190 && hue <= 265 && sat > 0.15 ? 1 : hue >= 33 && hue <= 62 && sat > 0.3 && L > 60 ? 2 : 5
    }
    const px = (key) => { const im = sc.textures.get(key).getSourceImage(); return im.getContext('2d').getImageData(0, 0, N, N).data }
    const res = { prints: 0, offShirt: [], helm: [], cent: [], ups: 0, fronts: 0, frontHelm: [], flat: 0, shadeVar: 0, cyc: {}, mirror: null }
    for (const suf in SRC) {
      const m = /^(up|dn)_(idle|run\d|block\d)$/.exec(suf); if (!m) continue
      const n = SRC[suf], tex = 'spr_off_' + suf; if (!sc.textures.exists(tex)) continue
      const cell = V.cell(n); if (!cell) continue
      const sd = cell.getContext('2d').getImageData(0, 0, N, N).data
      for (const num of ['88', '7']) {
        const key = V.bake(sc, tex, num, false, m[1]); if (!key) { if (num === '88') (res.cyc[m[1] + '_' + m[2].replace(/\d/, '')] = res.cyc[m[1] + '_' + m[2].replace(/\d/, '')] || []).push('-'); continue }
        const pd = px(key); res.prints++
        let y0 = N, y1 = -1, x0 = N, x1 = -1; const ls = []
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; if (pd[i + 3] < 128) continue
          if (cls(sd, i) !== 1) res.offShirt.push(suf + '@' + x + ',' + y)
          y0 = Math.min(y0, y); y1 = Math.max(y1, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x)
          if (Math.max(pd[i], pd[i + 1], pd[i + 2]) - Math.min(pd[i], pd[i + 1], pd[i + 2]) < 14 && pd[i] > 140) ls.push([0.299 * pd[i] + 0.587 * pd[i + 1] + 0.114 * pd[i + 2], (sd[i] + sd[i + 1] + sd[i + 2]) / 3]) }
        if (num === '88') { const P = V.place(n, num, m[1]); (res.cyc[m[1] + '_' + m[2].replace(/\d/, '')] = res.cyc[m[1] + '_' + m[2].replace(/\d/, '')] || []).push(P ? P.face + (P.trim ? 't' : '') : '-') }
        // the helmet, read off the source: its crown, and the stripe's last row down the crown's middle
        let ht = -1, hc = 24
        for (let y = 0; y < N && ht < 0; y++) { let run = 0, best = 0, be = 0; for (let x = 0; x <= N; x++) { if (x < N && sd[(y * N + x) * 4 + 3] >= 40) { run++; if (run > best) { best = run; be = x } } else run = 0 } if (best >= 5) { ht = y; hc = Math.round(be - (best - 1) / 2) } }
        let stripe = -1; for (let y = ht; y < ht + 20; y++) { let g = 0; for (let x = hc - 2; x <= hc + 2; x++) if (cls(sd, (y * N + x) * 4) === 2) g++; if (g) stripe = y; else if (stripe >= 0 && y > stripe + 1) break }
        if (m[1] === 'up') {
          res.ups++
          if (!(y0 > stripe)) res.helm.push(suf + ' top ' + y0 + ' stripe ' + stripe)
          // the back's middle at the print's rows: the jersey run under the print's centre, row by row
          const pc = (x0 + x1) / 2, mids = []
          for (let y = y0; y <= y1; y++) { let a = Math.round(pc), z = a; if (cls(sd, (y * N + a) * 4) !== 1) continue; while (a > 0 && [1, 2].includes(cls(sd, (y * N + a - 1) * 4))) a--; while (z < N - 1 && [1, 2].includes(cls(sd, (y * N + z + 1) * 4))) z++; mids.push((a + z) / 2) }
          mids.sort((p, q) => p - q); const mid = mids[mids.length >> 1]
          if (/^(idle|run\d)$/.test(m[2]) && mid != null) res.cent.push(+(pc - mid).toFixed(2))
        } else {
          res.fronts++
          // the facemask and the face: the lowest row under the crown, down its middle, that is neither shirt nor outline
          let fb = -1, clear = 0; for (let y = ht + 1; y < ht + 22; y++) { let mk = 0; for (let x = hc - 3; x <= hc + 3; x++) { const c = cls(sd, (y * N + x) * 4); if (c === 2 || c === 5) mk++ } if (mk) { fb = y; clear = 0 } else if (++clear >= 2 && y > ht + 8) break }
          if (!(y0 > fb)) res.frontHelm.push(suf + ' top ' + y0 + ' face ' + fb)
        }
        const L = ls.map((q) => q[0]), S = ls.map((q) => q[1]), mL = L.reduce((a, b) => a + b, 0) / L.length, mS = S.reduce((a, b) => a + b, 0) / S.length
        let cov = 0, vl = 0, vs = 0; for (let k = 0; k < L.length; k++) { cov += (L[k] - mL) * (S[k] - mS); vl += (L[k] - mL) ** 2; vs += (S[k] - mS) ** 2 }
        const r = vl && vs ? cov / Math.sqrt(vl * vs) : 0; if (r > 0.3) res.shadeVar++; else res.flat++
      }
    }
    // a mirrored quarter view is printed the right way round: "17" keeps its narrow 1 on the left either way
    const q = Object.keys(SRC).find((s) => /^ur_run\d$/.test(s) && V.bake(sc, 'spr_off_' + s, '17', false, 'ur') && V.bake(sc, 'spr_off_' + s, '17', true, 'ur'))
    if (q) {
      const firstW = (key) => { const d = px(key); const col = []; for (let x = 0; x < N; x++) { let f = 0; for (let y = 0; y < N; y++) { const i = (y * N + x) * 4; if (d[i + 3] > 128 && d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) f = 1 } col.push(f) } let a = col.indexOf(1), z = a; while (z < N && col[z]) z++; return z - a }
      res.mirror = { q, plain: firstW(V.bake(sc, 'spr_off_' + q, '17', false, 'ur')), flip: firstW(V.bake(sc, 'spr_off_' + q, '17', true, 'ur')) }
    }
    return res
  })
  ok(A.prints > 25 && A.ups > 10 && A.fronts >= 1, 'the prints are baked on the shirts (backs and chests, idle, running and blocking)', { prints: A.prints, ups: A.ups, fronts: A.fronts })
  ok(A.offShirt.length === 0, 'every printed pixel lands on a jersey pixel of the drawn cell — nothing on a hand, the ball, the facemask, the pants', A.offShirt.slice(0, 6))
  ok(A.helm.length === 0, 'a back number sits wholly under the helmet (below the last row of its stripe)', A.helm.slice(0, 6))
  ok(A.frontHelm.length === 0, 'a chest number sits wholly under the facemask and the face', A.frontHelm.slice(0, 6))
  const off = A.cent.filter((d) => Math.abs(d) > 1.01)
  ok(A.cent.length > 8 && off.length === 0, 'a back number is centred on the back, within a pixel, standing and running', { n: A.cent.length, off: off.slice(0, 6), all: A.cent.slice(0, 12) })
  const cyc = Object.entries(A.cyc).filter(([k, v]) => /_(run|block)$/.test(k)).map(([k, v]) => [k, [...new Set(v)]])
  ok(cyc.length >= 3 && cyc.every(([, v]) => v.length === 1), 'a drawn cycle wears ONE face in every frame (a run never pulses between sizes or blinks the number)', cyc)
  ok(A.mirror && A.mirror.plain === 2 && A.mirror.flip === 2, 'a mirrored three-quarter view is printed the right way round ("17" keeps its narrow 1 on the left)', A.mirror)
  ok(A.shadeVar > A.flat * 3, 'the print carries the fabric: its lightness follows the shirt\'s shading under it (not a flat sticker)', { shaded: A.shadeVar, flat: A.flat })
  // 2. the ink: a dark kit gets a white number with a trim, a light kit a dark one
  const I = await p.evaluate(() => {
    const sc = window.__gridironScene, V = window.__V176
    V.dress(sc, 'chk176a', '#1a2a5a', '#e8b030'); V.dress(sc, 'chk176b', '#f2f2ee', '#b01c2e')
    const a = V.ink(sc, 'spr_chk176a_up_idle'), b = V.ink(sc, 'spr_chk176b_up_idle'), lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
    return { dark: a && { fill: a.fill, trim: a.trim, j: lum(a.jersey) }, light: b && { fill: b.fill, trim: b.trim, j: lum(b.jersey), Lf: lum(b.fill) } }
  })
  ok(I.dark && I.dark.fill.join() === '255,255,255' && I.dark.trim[0] > I.dark.trim[2] + 60, 'a dark kit: a white number trimmed in the kit\'s second colour', I.dark)
  ok(I.light && I.light.Lf < 100 && I.light.fill.join() !== '255,255,255', 'a light kit: a dark number (the kit\'s second colour when it is dark enough)', I.light)
  // 3. live: prints front and back through play, the label hidden while they show
  const live = { back: 0, front: 0, labelOn: 0, maxSize: 0 }
  for (let i = 0; i < 40; i++) {
    const s = await p.evaluate(() => { const sc = window.__gridironScene; let back = 0, front = 0, labelOn = 0
      for (const m of sc.markers || []) { if (!m || !m.sew || !m.root.visible) continue; if (m.sew.visible) { if (/^u/.test(m.dirKey)) back++; else front++; if (m.label && m.label.visible) labelOn++ } }
      return { back, front, labelOn, size: window.__V176.size() } })
    live.back += s.back; live.front += s.front; live.labelOn += s.labelOn; live.maxSize = Math.max(live.maxSize, s.size)
    await p.waitForTimeout(500)
  }
  ok(live.back > 20 && live.front > 5, 'through live play the numbers show printed, on backs and on chests', live)
  ok(live.labelOn === 0, 'the v104 label is hidden on every man whose number is printed', live)
  ok(live.maxSize > 0 && live.maxSize <= 1200, 'the printed layers are kept to their cap', live)
  await ctx.close()
}

{
  // 4. a number font: his number prints in the font's own colours
  const { ctx, p } = await open({}, 'font', 'nf_gold')
  let seen = null
  for (let i = 0; i < 80 && !seen; i++) {
    seen = await p.evaluate(() => { const m = (window.__gridironScene.markers || []).find((mm) => mm && mm.team === 'you' && mm.sew && mm.sew.visible); return m ? { key: m._sewKeyV176, spec: m._sewNfV176, label: m.label.visible, img: !!(m._nfImgV158A && m._nfImgV158A.visible) } : null })
    if (!seen) await p.waitForTimeout(500)
  }
  ok(seen && /_nfgold$/.test(seen.key) && seen.spec && seen.spec.grad && !seen.label && !seen.img, 'wearing Gold Foil, his number is printed in the foil (a gold run, light to dark), the label and the drawn image stood down', seen)
  // 5. the profile figure's chest: on the figure's own pixels, centred, under the chin
  await p.evaluate(() => window.go('profile')); await p.waitForTimeout(2200)
  const C = await p.evaluate(() => window.__V176C || null)
  ok(C && C.v176 && C.nf === 'gold' && Math.abs(C.cx - C.chestCx) <= 1 && C.top > C.clear && C.kept > 100, 'the profile chest is printed on the figure\'s own pixels in his font, centred, under the facemask\'s chin', C)
  await ctx.close()
}

{
  // 6. the off switches: the label exactly as before; the v159 A chest
  const { ctx, p } = await open({ v176sew: 0, v176chest: 0 }, 'off')
  await p.waitForTimeout(6000)
  const O = await p.evaluate(() => { const sc = window.__gridironScene; let sew = 0, lbl = 0; for (const m of sc.markers || []) { if (!m || !m.root.visible) continue; if (m.sew && m.sew.visible) sew++; if (m.label && m.label.visible) lbl++ } return { sew, lbl, baked: window.__V176.baked } })
  ok(O.sew === 0 && O.baked === 0 && O.lbl > 4, 'TU v176sew 0: nothing printed, the v104 label shows as before', O)
  await p.evaluate(() => window.go('profile')); await p.waitForTimeout(2200)
  const C0 = await p.evaluate(() => ({ c176: window.__V176C || null, c159: !!(window.__V159A && window.__V159A.chest) }))
  ok(!C0.c176 && C0.c159, 'TU v176chest 0: the profile chest is the v159 A print', C0)
  await ctx.close()
}

ok(errors.length === 0, 'no page errors', errors.slice(0, 4))
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
