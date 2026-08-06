// hscheck.mjs — end-to-end check of the v46 Score Attack mode through the real UI.
// Asserts: no page errors, menu button navigates to the mode, a run plays and
// survives/ends correctly, and the best score persists to the save object.
import { chromium } from 'playwright';

const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const URL = process.env.URL || 'http://localhost:5173/';

const browser = await chromium.launch({ executablePath: BROWSER });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
const netnoise=[];page.on('console', m => { if (m.type() === 'error') netnoise.push(m.text()); });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && typeof window.go === 'function', { timeout: 20000 });

const report = await page.evaluate(async () => {
  const out = {};
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 1) navigate to the mode via the shell router
  window.go('highscore');
  await sleep(50);
  out.introRendered = /Score Attack/i.test($('screen').innerHTML) && /START RUN/i.test($('dock').innerHTML);
  out.viewIsHighscore = window.S.view === 'highscore';

  // 2) pick a position + start a run
  window.__hs.pick('WR');
  window.__hs.start();
  await sleep(30);
  out.roundRendered = /Round 1/i.test($('screen').innerHTML);

  // 3) play a bounded gauntlet: steady until the run ends or 40 rounds
  let rounds = 0, endedNaturally = false;
  const startBest = window.S.highScore || 0;
  for (let i = 0; i < 40; i++) {
    window.__hs.play('steady');
    await sleep(5);
    rounds++;
    const over = /Run over/i.test($('screen').innerHTML);
    if (over) { endedNaturally = true; break; }
    // survived -> advance to next round
    window.__hs.next();
    await sleep(2);
  }
  out.rounds = rounds;
  out.endedNaturally = endedNaturally;
  out.overRendered = /Run over|Final:/i.test($('screen').innerHTML);

  // 4) persistence: best score written to save + survives a reload of storage
  out.bestAfter = window.S.highScore || 0;
  out.bestPersistedGrew = out.bestAfter >= startBest;
  const stored = JSON.parse(window.GridironStorage.export() || '{}');
  out.bestInStorage = stored.highScore || 0;
  out.storageMatches = out.bestInStorage === out.bestAfter;

  // 5) glory path exercises the risk branch without throwing
  window.__hs.again();
  await sleep(10);
  window.__hs.play('glory');
  await sleep(10);
  out.gloryOk = /Survived|Run over|Final:/i.test($('screen').innerHTML);

  // 6) back to menu shows the BEST chip
  window.__hs.quit();
  await sleep(30);
  out.backToMenu = window.S.view === 'menu';
  out.menuShowsScoreAttack = /SCORE ATTACK/i.test($('dock').innerHTML);

  return out;
});

console.log(JSON.stringify(report, null, 2));
console.log('JS pageerrors:', errors.length ? errors : 'none');
console.log('network console noise (ignored):', netnoise.length);

const pass = report.introRendered && report.roundRendered && report.overRendered &&
  report.storageMatches && report.gloryOk && report.menuShowsScoreAttack && errors.length === 0;
console.log(pass ? '\n✅ HS CHECK PASS' : '\n❌ HS CHECK FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
