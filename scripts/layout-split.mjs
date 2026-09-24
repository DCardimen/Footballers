// v149 A — THE FILE BECOMES A FOLDER: the splitter. Turns a MONOLITHIC index.html (the pre-v149 layout,
// 35 <script> blocks) into index.html + src/ exactly as the v149 A split did. It is how a branch that
// still edits the one big file is ported onto the split:
//   git show <branch>:index.html > /tmp/mono.html      (a monolith based on adfd250 or earlier)
//   node scripts/layout-split.mjs /tmp/mono.html       (rewrites index.html and src/ in this tree)
//   node scripts/layoutcheck.mjs && git diff            (the branch's edits, now in the src/ files)
// Then re-apply anything this tree changed after the split (e.g. the stray-markup removal in accd794 —
// the splitter warns when it sees it). A sheet whose baked data URL differs from public/<file> is an
// error: write the new PNG into public/ by hand.
import fs from 'node:fs'
import { ROOT, strayCodeInPage, PHASER_FILE, PHASER_HEAD, PHASER_TAIL, BRIDGE_TAKE, BRIDGE_ORIG, DATA_ASSETS, assetLine } from './lib/layout.mjs'

process.chdir(ROOT)
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8')
if (html.includes('src="./src/') || [...html.matchAll(/<script\b/gi)].length < 30) throw new Error('not a monolithic index.html (already split?)')
const NAMES = {
  3: '03-splash.js', 4: '04-engine.js', 5: '05-field-renderer.js', 6: '06-phaser-launcher.js', 7: '07-career-app.js',
  8: '08-contact.js', 9: '09-rosters-v157.js', 10: '10-season-rosters-v158.js', 11: '11-pregame-v1513.js',
  12: '12-gear-overlay.js', 13: '13-dev-harness.js', 14: '14-personality.js', 15: '15-speed-through.js',
  16: '16-story-wheel.js', 17: '17-pregame-wheel.js', 18: '18-growth-wheel.js', 19: '19-score-attack.js',
  20: '20-leaderboards.js', 21: '21-daily-challenge.js', 22: '22-hub-sections.js', 23: '23-dock.js',
  24: '24-bottom-nav.js', 25: '25-shell.js',
}
const CSS = { 0: '00-app.css', 2: '02-live-sim.css' }
const FONT_IMPORT = '\n@import"./public/fonts/fonts.css";'
const VENDOR_BANNER = `/* ===== v149 A THE FILE BECOMES A FOLDER — the minified Phaser bundle, vendored =====
 * Moved byte for byte out of index.html's field-renderer block. NEVER EDIT. It used to share one
 * IIFE with the bridge (src/05-field-renderer.js), which took Phaser as \`const mt=Mt(Lt);\`; the
 * last line below publishes that one value as window.${'__RIB_PHASER_V149'} and the bridge reads it back.
 * scripts/layoutcheck.mjs proves the bundle is unchanged. */
`

const re = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi
const edits = []
let m, si = 0, st = 0
fs.mkdirSync('src/vendor', { recursive: true }); fs.mkdirSync('src/styles', { recursive: true })
while ((m = re.exec(html))) {
  const tag = m[1].toLowerCase(), attrs = m[2], body = m[3]
  const idx = tag === 'script' ? si++ : st++
  if (tag === 'script' && NAMES[idx]) {
    let rep
    if (idx === 5) {
      const head = '\n(function(){"use strict";\n'
      if (!body.startsWith(head)) throw new Error('block 5 head')
      const k = body.indexOf(BRIDGE_ORIG)
      const bundle = body.slice(head.length, k)
      if (!bundle.startsWith('function Mt(') || !bundle.endsWith('var Lt=Ft();')) throw new Error('bundle bounds')
      fs.writeFileSync(PHASER_FILE, VENDOR_BANNER + PHASER_HEAD + bundle + PHASER_TAIL)
      let bridge = head + BRIDGE_TAKE + body.slice(k + BRIDGE_ORIG.length)
      for (const a of DATA_ASSETS) {
        const r = new RegExp(`window\\.${a.global} = "data:${a.mime.replace('/', '\\/')};base64,([A-Za-z0-9+/=]+)";`)
        const mm = bridge.match(r); if (!mm) throw new Error('no data line ' + a.global)
        const buf = Buffer.from(mm[1], 'base64')
        const dest = 'public/' + a.file
        if (fs.existsSync(dest)) { if (!fs.readFileSync(dest).equals(buf)) throw new Error('differs ' + dest) }
        else fs.writeFileSync(dest, buf)
        bridge = bridge.replace(r, () => assetLine(a))
      }
      fs.writeFileSync('src/' + NAMES[5], bridge)
      rep = `<script src="./${PHASER_FILE}" vite-ignore></script><script src="./src/${NAMES[5]}" vite-ignore></script>`
    } else {
      if (attrs.includes('src=')) throw new Error('src block ' + idx)
      fs.writeFileSync('src/' + NAMES[idx], body)
      rep = `<script${attrs} src="./src/${NAMES[idx]}" vite-ignore></script>`
    }
    edits.push([m.index, m.index + m[0].length, rep])
  } else if (tag === 'style' && CSS[idx]) {
    if (attrs) throw new Error('style attrs')
    let rep
    if (idx === 0) {
      if (!body.startsWith(FONT_IMPORT)) throw new Error('font import')
      fs.writeFileSync('src/styles/' + CSS[0], body.slice(FONT_IMPORT.length))
      rep = `<style>${FONT_IMPORT}</style><link rel="stylesheet" href="./src/styles/${CSS[0]}" vite-ignore>`
    } else {
      fs.writeFileSync('src/styles/' + CSS[idx], body)
      rep = `<link rel="stylesheet" href="./src/styles/${CSS[idx]}" vite-ignore>`
    }
    edits.push([m.index, m.index + m[0].length, rep])
  }
}
let out = html
for (const [a, b, r] of edits.reverse()) out = out.slice(0, a) + r + out.slice(b)
fs.writeFileSync('index.html', out)
console.log('edits', edits.length, 'index.html', html.length, '->', out.length)
const stray = strayCodeInPage(out)
if (stray.length) console.warn('WARNING: code in the page markup (delete it — layoutcheck refuses it):', JSON.stringify(stray.slice(0, 2)))
