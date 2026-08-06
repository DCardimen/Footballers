// hsprobe.mjs — calibrate the Score-Attack scoring formula against the live engine.
// Runs the SHIP scoring function over many resolved games and prints percentile
// bands per position + overall, so the survival-threshold ramp can be tuned.
import { chromium } from 'playwright';

const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const URL = process.env.URL || 'http://localhost:5173/';

const browser = await chromium.launch({ executablePath: BROWSER });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__simGameV2 === 'function', { timeout: 20000 });

const out = await page.evaluate(() => {
  // ==== SHIP SCORING FORMULA (keep identical to the one baked into index.html) ====
  function hsScore(stat, us, them, pos) {
    const s = stat || {};
    const DEF = /^(LB|MLB|OLB|CB|S|SS|FS|DL|DE|DT|EDGE|NT|DB)$/.test(pos);
    const yards = (s.pass || 0) + (s.rush || 0) + (s.rec || 0);
    let pts = 0;
    pts += yards * 0.5;
    pts += (s.td || 0) * 70;
    pts += (s.comp || 0) * 1.5;
    pts += (s.rec_c || 0) * 4;
    pts += (s.carries || 0) * 1.2;
    pts += (s.tackle || 0) * 9;
    pts += (s.tfl || 0) * 16;
    pts += (s.qbhit || 0) * 9;
    pts += (s.sack || 0) * 32;
    pts += (s.pd || 0) * 16;
    pts += (s.ff || 0) * 28;
    pts += (s.pick6 || 0) * 110;
    pts += (s.pancake || 0) * 6;
    pts += (s.int || 0) * (DEF ? 65 : -55);
    pts += (s.fum || 0) * -25;
    pts += (s.sackAllowed || 0) * -6;
    if ((s.longest || 0) >= 60) pts += 60; else if ((s.longest || 0) >= 40) pts += 25;
    const margin = (us || 0) - (them || 0);
    if (margin > 0) pts += 40 + Math.min(60, margin * 3);
    else if (margin < 0) pts += Math.max(-30, margin * 1.5);
    return Math.max(0, Math.round(pts));
  }
  // ================================================================================
  const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a[Math.floor((a.length - 1) * p)]; };
  const positions = ['QB', 'RB', 'WR', 'TE', 'LB', 'CB', 'S', 'DL'];
  const rows = [], all = [];
  for (const pos of positions) {
    const scores = [];
    for (let i = 0; i < 50; i++) {
      const perf = 52 + Math.floor(Math.random() * 22); // steady band 52-73
      let g; try { g = window.__simGameV2(perf, pos); } catch (e) { return { fatal: String(e), pos }; }
      const sc = hsScore(g.stat, g.usScore, g.themScore, pos);
      scores.push(sc); all.push(sc);
    }
    rows.push({ pos, p10: pct(scores, .1), p25: pct(scores, .25), p50: pct(scores, .5), p75: pct(scores, .75), p90: pct(scores, .9), max: Math.max(...scores) });
  }
  return {
    perPos: rows,
    overall: { p10: pct(all, .1), p25: pct(all, .25), p50: pct(all, .5), p75: pct(all, .75), p90: pct(all, .9), max: Math.max(...all) },
  };
});

console.log(JSON.stringify(out, null, 2));
console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
