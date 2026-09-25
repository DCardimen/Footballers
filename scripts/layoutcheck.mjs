// Dev check: v149 A — THE FILE BECOMES A FOLDER. Pure Node, no dev server.
//
// index.html is a thin page now; the game is src/*.js + src/styles/*.css + src/vendor/phaser.min.js
// (docs/LAYOUT.md). This proves the split is a split and nothing else:
//   * every ./src/ file index.html names exists, and every file in src/ is named exactly once;
//   * the vendored Phaser bundle is byte-for-byte the bundle that shipped inline (pinned sha1),
//     and the bridge takes it back through exactly one `const mt=window.__RIB_PHASER_V149;`;
//   * every sheet that used to be a baked data URL is a file in public/ asked for through
//     window.__RIB_ASSET, and no big data URL has crept back into the page or its scripts;
//   * the reconstruction the dev checks read (scripts/lib/layout.mjs readGameHtml) puts back
//     the same number of <script> blocks the page loads, in the same order.
//   node scripts/layoutcheck.mjs                    the invariants above
//   node scripts/layoutcheck.mjs --against <ref>    ALSO: the reconstruction, with the sheets
//                                                    re-baked, is byte-identical to <ref>:index.html
//                                                    (adfd250 is the last monolithic index.html; add
//                                                    --at <commit> to rebuild THAT commit's layout — the
//                                                    split itself is byte-identical: --against adfd250 --at 703499b)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { ROOT, PHASER_FILE, BRIDGE_TAKE, DATA_ASSETS, assetLine, phaserBundle, readGameHtml, layoutFiles, strayCodeInPage } from './lib/layout.mjs'

let pass = 0, fail = 0
const ok = (c, m, d) => { console.log((c ? 'ok   ' : 'FAIL ') + m + (d !== undefined ? '  ' + d : '')); c ? pass++ : fail++ }
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex')
const PHASER_SHA1 = '7a5fcb9f86dad30a475a247304ca7dab27ac1769'   // the bundle as it shipped inline up to adfd250

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
const files = layoutFiles().slice(1)
const missing = files.filter((f) => !fs.existsSync(path.join(ROOT, f)))
ok(missing.length === 0, `every ./src/ file index.html names exists (${files.length})`, missing.join(', '))
const onDisk = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }).map((f) => 'src/' + f.split(path.sep).join('/'))
  .filter((f) => fs.statSync(path.join(ROOT, f)).isFile())
const unnamed = onDisk.filter((f) => !files.includes(f))
const twice = files.filter((f, i) => files.indexOf(f) !== i)
ok(unnamed.length === 0 && twice.length === 0, 'every file in src/ is loaded, exactly once', [...unnamed, ...twice].join(', '))
ok(/<script src="\.\/src\/vendor\/phaser\.min\.js" vite-ignore><\/script><script src="\.\/src\/05-field-renderer\.js" vite-ignore><\/script>/.test(html),
  'the vendored Phaser loads immediately before the bridge that takes it')
ok(!/<script[^>]*src="\.\/src\/[^"]*"(?![^>]*vite-ignore)[^>]*>/.test(html) && !/<link[^>]*href="\.\/src\/[^"]*"(?![^>]*vite-ignore)[^>]*>/.test(html),
  'every src/ tag says vite-ignore (vite build must not bundle a classic script)')
ok(!/<script[^>]*src="\.\/src\/[^"]*"[^>]*\b(defer|async|type=)/.test(html), 'no src/ script is defer / async / a module')

const bundle = phaserBundle()
const bsha = sha1(bundle)
ok(bsha === PHASER_SHA1 || process.env.PHASER_SHA1 === bsha, 'the vendored Phaser bundle is the one that shipped inline (never edit it)', bsha)
const bridge = fs.readFileSync(path.join(ROOT, 'src/05-field-renderer.js'), 'utf8')
ok(bridge.split(BRIDGE_TAKE).length === 2, 'the bridge takes Phaser back exactly once')

for (const a of DATA_ASSETS) {
  const hit = files.some((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').includes(assetLine(a)))
  ok(hit && fs.existsSync(path.join(ROOT, 'public', a.file)), `${a.global} is public/${a.file}, asked for through __RIB_ASSET`)
}
const big = []
for (const f of ['index.html', ...files]) {
  for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/data:[a-z]+\/[a-z0-9+.-]+;base64,[A-Za-z0-9+/=]{4096,}/g)) big.push(`${f} (${m[0].length} chars)`)
}
ok(big.length === 0, 'no data URL over 4KB is baked into the page or its scripts (sheets are files in public/)', big.join(', '))

const stray = strayCodeInPage(html)
ok(stray.length === 0, 'no code has leaked into the page\'s markup (a bad bake once left 16.8KB of mangled Phaser there)', JSON.stringify(stray.slice(0, 2)))

const game = readGameHtml()
const inlineBlocks = [...game.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].length
const tags = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].length
ok(inlineBlocks === tags - 1, `the reconstruction has one <script> block per page tag, Phaser folded back into its bridge (${inlineBlocks})`)

const i = process.argv.indexOf('--against')
if (i > 0) {
  const ref = process.argv[i + 1]
  const want = execFileSync('git', ['show', `${ref}:index.html`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  const atI = process.argv.indexOf('--at'), at_ = atI > 0 ? process.argv[atI + 1] : null
  const got = Buffer.from(readGameHtml(at_ ? { bake: true, gitRef: at_ } : { bake: true }), 'utf8')
  let at = -1
  if (!got.equals(want)) { const n = Math.min(got.length, want.length); for (at = 0; at < n && got[at] === want[at]; at++); }
  ok(got.equals(want), `the reconstruction with its sheets re-baked is byte-identical to ${ref}:index.html (${want.length} bytes)${at_ ? ' — the layout as of ' + at_ : ''}`,
    at >= 0 ? `first difference at byte ${at}: ${JSON.stringify(got.slice(at, at + 60).toString())} vs ${JSON.stringify(want.slice(at, at + 60).toString())}` : undefined)
}

console.log(JSON.stringify({ pass, fail }))
process.exit(fail ? 1 : 0)
