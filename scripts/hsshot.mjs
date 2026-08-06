// hsshot.mjs — screenshot the Score Attack screens for visual QA.
import { chromium } from 'playwright';
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const URL = process.env.URL || 'http://localhost:5173/';
const DIR = process.env.OUT || '/tmp/claude-0/-home-user-Footballers/de9d310d-1976-5357-a7da-ec67c8db3500/scratchpad';

const browser = await chromium.launch({ executablePath: BROWSER });
const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.GridironStorage === 'object', { timeout: 20000 });
// seed via the live state object + proper save path (keeps schema valid), then reload
await page.evaluate(() => { try { window.S.tutorialSeen = true; window.S.highScore = 4200; window.S.highStreak = 6; window.GridironStorage.save(window.S); } catch (e) {} });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof window.go === 'function' && typeof window.__hs === 'object', { timeout: 20000 });

async function shot(name) { await page.screenshot({ path: `${DIR}/hs-${name}.png` }); }

// menu (shows Score Attack button)
await page.evaluate(() => window.go('menu'));
await page.waitForTimeout(150); await shot('menu');
// intro
await page.evaluate(() => { window.go('highscore'); });
await page.waitForTimeout(150); await shot('intro');
// pick WR + start -> round
await page.evaluate(() => { window.__hs.pick('WR'); window.__hs.start(); });
await page.waitForTimeout(120); await shot('round');
// play steady rounds until we land on a survived "result" card, then screenshot
await page.evaluate(() => {
  window.__hs.start();
  for (let i = 0; i < 12; i++) {
    window.__hs.play('steady');
    if (window.S.view === 'highscore' && /Survived/i.test(document.getElementById('screen').innerHTML)) return;
    window.__hs.next();
  }
});
await page.waitForTimeout(150); await shot('result');
// force an end-of-run screen
await page.evaluate(() => { window.__hs.cashOut(); });
await page.waitForTimeout(150); await shot('over');
console.log('shots written to', DIR);
await browser.close();
