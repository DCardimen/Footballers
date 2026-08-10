// lbcheck.mjs — end-to-end check of the v47 Leaderboards layer (mock backend).
// Asserts: no JS errors, the board screen renders seeded rows, tabs switch,
// a Score Attack run submits and appears on the board, and the name persists.
import { chromium } from 'playwright';

const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const URL = process.env.URL || 'http://localhost:5173/';

const browser = await chromium.launch({ executablePath: BROWSER });
const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__lb === 'object' && typeof window.go === 'function' && typeof window.__simGameV2 === 'function', { timeout: 20000 });

const report = await page.evaluate(async () => {
  const out = {};
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const screenHas = re => re.test($('screen').innerHTML);

  out.usingMock = window.__lb.isMock === true;

  // set a known name, then submit a score directly through the public API
  await window.__lb.setName('ZTESTPLAYER');
  await window.__lb.submit({ score: 91234, pos: 'WR', streak: 12 }); // score under the 100000 cap
  const globalTop = await window.__lb.top({ board: 'global', limit: 100 });
  out.myScoreOnGlobal = globalTop.some(r => r.name === 'ZTESTPLAYER' && r.score === 91234);
  out.globalSortedDesc = globalTop.every((r, i) => i === 0 || globalTop[i - 1].score >= r.score);
  out.myScoreIsTop = globalTop[0] && globalTop[0].name === 'ZTESTPLAYER'; // 91234 should top the seeds

  const posTop = await window.__lb.top({ board: 'position', pos: 'WR', limit: 100 });
  out.positionFiltered = posTop.length > 0 && posTop.every(r => r.pos === 'WR');
  const weeklyTop = await window.__lb.top({ board: 'weekly', limit: 100 });
  out.weeklyHasMine = weeklyTop.some(r => r.name === 'ZTESTPLAYER'); // just-submitted => this week

  // drive the UI: open the board screen and confirm it renders rows
  window.go('leaderboard');
  await sleep(120);
  out.boardScreenRendered = screenHas(/Leaderboard/i);
  out.rowsVisible = /lb-row/.test($('screen').innerHTML);
  out.mockWarningShown = /Local demo board/i.test($('screen').innerHTML);

  // switch tabs via the UI handlers
  window.__lbUI.tab('weekly'); await sleep(80);
  out.weeklyTabOk = /lb-tab on/.test($('screen').innerHTML) && !/Couldn.t load/i.test($('screen').innerHTML);
  window.__lbUI.tab('position'); await sleep(80);
  out.positionTabShowsPosbar = /lb-posbar/.test($('screen').innerHTML);
  window.__lbUI.pos('WR'); await sleep(80);
  out.positionTabOk = /lb-row/.test($('screen').innerHTML);

  // name persisted in storage
  out.namePersisted = (localStorage.getItem('rib_lb_handle') === 'ZTESTPLAYER');

  // Score Attack run submits automatically on run end (via persistBest)
  const before = (await window.__lb.top({ board: 'global', limit: 500 })).length;
  window.go('highscore'); await sleep(40);
  window.__hs.pick('LB'); window.__hs.start();
  window.__hs.play('steady'); await sleep(20);   // one round
  window.__hs.cashOut(); await sleep(60);         // ends run -> persistBest -> submit
  const after = (await window.__lb.top({ board: 'global', limit: 500 })).length;
  out.runAutoSubmitted = after >= before + 1;

  return out;
});

console.log(JSON.stringify(report, null, 2));
console.log('JS pageerrors:', errors.length ? errors : 'none');

const keys = ['usingMock','myScoreOnGlobal','globalSortedDesc','myScoreIsTop','positionFiltered','weeklyHasMine','boardScreenRendered','rowsVisible','mockWarningShown','weeklyTabOk','positionTabShowsPosbar','positionTabOk','namePersisted','runAutoSubmitted'];
const pass = keys.every(k => report[k]) && errors.length === 0;
for (const k of keys) if (!report[k]) console.log('  ✗ failed:', k);
console.log(pass ? '\n✅ LB CHECK PASS' : '\n❌ LB CHECK FAIL');
await browser.close();
process.exit(pass ? 0 : 1);
