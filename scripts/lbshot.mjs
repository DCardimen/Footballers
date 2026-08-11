// lbshot.mjs — screenshot the v47 Leaderboard screen for visual QA.
import { chromium } from 'playwright';
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const URL = process.env.URL || 'http://localhost:5173/';
const DIR = process.env.OUT || '/tmp/claude-0/-home-user-Footballers/de9d310d-1976-5357-a7da-ec67c8db3500/scratchpad';

const browser = await chromium.launch({ executablePath: BROWSER });
const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.GridironStorage === 'object', { timeout: 20000 });
await page.evaluate(() => { try { window.S.tutorialSeen = true; window.GridironStorage.save(window.S); } catch (e) {} });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__lb === 'object' && typeof window.go === 'function', { timeout: 20000 });
await page.evaluate(async () => {
  await window.__lb.setName('YOU');
  await window.__lb.submit({ score: 6120, pos: 'WR', streak: 21 });
});
await page.evaluate(() => { document.getElementById('splash') && document.getElementById('splash').classList.add('gone'); window.go('leaderboard'); });
await page.waitForTimeout(400);
await page.screenshot({ path: `${DIR}/lb-global.png` });
await page.evaluate(() => window.__lbUI.tab('position'));
await page.waitForTimeout(250);
await page.screenshot({ path: `${DIR}/lb-position.png` });
console.log('shots written to', DIR);
await browser.close();
