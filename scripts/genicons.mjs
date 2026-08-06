// genicons.mjs — rasterize public/icon.svg into the PNG sizes the manifest,
// iOS home screen, and app stores expect. Placeholder art; re-run after
// dropping in a final public/icon.svg (or replace the PNGs directly).
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(ROOT, 'public', 'icon.svg'), 'utf8');
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';

// [filename, pixel size, pad fraction] — maskable variants get transparent-safe padding baked by the SVG safe zone.
const TARGETS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['icon-1024.png', 1024],
];

const browser = await chromium.launch({ executablePath: BROWSER });
for (const [name, size] of TARGETS) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;padding:0">
     <div style="width:${size}px;height:${size}px">${svg.replace(/width="1024"/, `width="${size}"`).replace(/height="1024"/, `height="${size}"`)}</div>
     </body></html>`, { waitUntil: 'load' });
  await page.locator('svg').screenshot({ path: join(ROOT, 'public', name), omitBackground: false });
  await page.close();
  console.log('wrote public/' + name + ' (' + size + 'px)');
}
await browser.close();
