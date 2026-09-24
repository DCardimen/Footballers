// v149 B — ONE URL SOURCE. Every dev check asks here for the game's address and the browser.
//
//   GAME_URL   process.env.GAME_URL, else http://localhost:${PORT || 5173}/
//              (so `npm run dev` + `node scripts/<check>.mjs` works exactly as it always did,
//              and `GAME_URL=http://localhost:5401/ node scripts/<check>.mjs` points it elsewhere
//              without a port-swapped copy of the script)
//   gameUrl(p) GAME_URL with a path / query resolved against it: gameUrl('?stayStale'),
//              gameUrl('index.html'), gameUrl('menu-preview.html?menuPreview=1'). Works whether
//              GAME_URL ends in '/' or in 'index.html'.
//   CHROME     the Chromium binary: CHROME_PATH, PLAYWRIGHT_CHROMIUM, /opt/pw-browsers/chromium,
//              else undefined (Playwright's own).
//   launch(o)  chromium.launch({ executablePath: CHROME, ...o }) — a fresh throwaway profile
//              every call, so parallel checks never share localStorage.
import fs from 'node:fs'

const PORT = process.env.PORT || 5173
export const GAME_URL = process.env.GAME_URL || `http://localhost:${PORT}/`
export function gameUrl (p = '') { return p ? new globalThis.URL(p, GAME_URL).href : GAME_URL }

const PW = '/opt/pw-browsers/chromium'
export const CHROME = process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync(PW) ? PW : undefined)

export async function launch (opts = {}) {
  const { chromium } = await import('playwright')
  return chromium.launch({ executablePath: CHROME, ...opts })
}
