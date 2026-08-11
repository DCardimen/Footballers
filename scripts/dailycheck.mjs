// dailycheck.mjs — end-to-end check of the v48 Daily Challenge + daily board.
// Asserts: browser engine == canonical Node engine (parity, no drift),
// determinism, the full play flow, one-attempt-per-day lock, board submission,
// and that a tampered score is rejected. Runs against the dev server (the daily
// engine is inlined in index.html, so no production build is needed).
import { chromium } from 'playwright';
import { run as nodeRun, dayKey as nodeDayKey, ROUNDS } from './daily-engine.mjs';

const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const URL = process.env.URL || 'http://localhost:5173/';

// build a parity matrix in Node
const seeds = [20260810, 20260811, 20260812, 20260101, 20251231];
const patterns = [];
for (let m = 0; m < (1 << ROUNDS); m++) patterns.push(Array.from({ length: ROUNDS }, (_, r) => ((m >> r) & 1) ? 'glory' : 'steady'));
const nodeMatrix = [];
for (const s of seeds) for (const c of patterns) nodeMatrix.push({ seed: s, choices: c, total: nodeRun(s, c).total });

const browser = await chromium.launch({ executablePath: BROWSER });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.DailyEngine && window.__daily && typeof window.go === 'function' && window.__lb, { timeout: 20000 });

const report = await page.evaluate(async (matrix) => {
  const out = {};
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 1) parity: browser engine reproduces the Node engine exactly
  out.parityCount = matrix.length;
  out.parityAllMatch = matrix.every(m => window.DailyEngine.run(m.seed, m.choices).total === m.total);

  // 2) determinism inside the browser
  out.deterministic = window.DailyEngine.run(20260810, ['glory','steady','glory','steady','glory']).total
                    === window.DailyEngine.run(20260810, ['glory','steady','glory','steady','glory']).total;

  // fresh state: clear today's lock so we can play
  const seed = window.DailyEngine.dayKey();
  try { localStorage.removeItem('rib_daily_' + seed); } catch (e) {}
  await window.__lb.setName('ZDAILYTESTER');

  // 3) full play flow through the UI
  window.go('daily'); await sleep(60);
  out.introRendered = /Daily Challenge/i.test($('screen').innerHTML);
  window.__daily.start(); await sleep(40);
  out.roundRendered = /Round 1 of/i.test($('screen').innerHTML);
  const choices = [];
  for (let r = 0; r < 5; r++) {
    const form = r % 2 === 0 ? 'steady' : 'glory'; choices.push(form);
    window.__daily.play(form); await sleep(20);
    if (r < 4) { window.__daily.next(); await sleep(15); }
  }
  await sleep(120); // allow submit
  out.doneRendered = /Final:/i.test($('screen').innerHTML);

  // the score shown must equal the deterministic recompute of the exact choices played
  const expected = window.DailyEngine.run(seed, choices).total;
  out.scoreMatchesEngine = new RegExp('Final: ' + expected.toLocaleString()).test($('screen').innerHTML) ||
                           $('screen').innerHTML.indexOf(expected.toLocaleString()) !== -1;

  // 4) one attempt per day: lock persisted, re-start is a no-op
  const lock = JSON.parse(localStorage.getItem('rib_daily_' + seed) || 'null');
  out.lockSaved = !!lock && lock.total === expected;
  window.__daily.start(); await sleep(30);
  out.reentryLocked = /You’ve played|Final:/i.test($('screen').innerHTML) || !/Round 1 of/i.test($('screen').innerHTML);

  // 5) appears on the daily board (mock verifies the score before storing)
  const board = await window.__lb.top({ board: 'daily', daySeed: seed, limit: 100 });
  out.onDailyBoard = board.some(e => e.name === 'ZDAILYTESTER' && e.score === expected);
  out.boardSortedDesc = board.every((r, i) => i === 0 || board[i - 1].score >= r.score);

  // 6) anti-cheat: a tampered score is rejected by the verify step
  const forged = await window.__lb.submitDaily({ daySeed: seed, choices: choices, score: expected + 999 });
  out.forgedRejected = forged && forged.ok === false;

  return out;
}, nodeMatrix);

console.log(JSON.stringify(report, null, 2));
console.log('JS pageerrors:', errors.length ? errors : 'none');

const keys = ['parityAllMatch','deterministic','introRendered','roundRendered','doneRendered','scoreMatchesEngine','lockSaved','reentryLocked','onDailyBoard','boardSortedDesc','forgedRejected'];
const pass = keys.every(k => report[k]) && errors.length === 0;
for (const k of keys) if (!report[k]) console.log('  ✗ failed:', k);
console.log(`parity matrix: ${report.parityCount} cases`);
console.log(pass ? '\n✅ DAILY CHECK PASS' : '\n❌ DAILY CHECK FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
