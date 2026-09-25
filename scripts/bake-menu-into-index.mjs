import fs from 'node:fs'
import path from 'node:path'
import { strayCodeInPage } from './lib/layout.mjs'

const root = process.cwd()
const indexPath = path.resolve(root, 'index.html')
const version = String(process.env.RIB_MENU_VERSION || 'direct-v3')
  .replace(/[^a-zA-Z0-9._-]/g, '-')
  .slice(0, 48)

const cssFiles = [
  'rib-menu-reset.css',
  'rib-menu.css',
  'rib-menu-v89.css',
  'rib-menu-coach.css',
  'rib-vault.css',
]

const jsFiles = [
  'rib-menu-v89-runtime.js',
  'rib-menu-boot.js',
  'rib-menu.js',
  'rib-menu-howto.js',
  'rib-menu-coach.js',
  'rib-menu-navigation.js',
  'rib-vault.js',
  'rib-vault-audio.js',
  'rib-vault-bridge.js',
]

if (!fs.existsSync(indexPath)) throw new Error('index.html is missing')
for (const file of [...cssFiles, ...jsFiles]) {
  const source = path.resolve(root, 'public', file)
  if (!fs.existsSync(source)) throw new Error(`Missing menu dependency: public/${file}`)
}

let html = fs.readFileSync(indexPath, 'utf8')
// v149 A: index.html is a thin page over src/ (docs/LAYOUT.md). The menu block is the only region
// this rewrites; the game's own <script src="./src/…"> / <link href="./src/…"> tags must come through
// untouched, in the same order, or the page loses its engine.
const layoutTags = (h) => [...h.matchAll(/(?:src|href)="\.\/src\/[^"]+"/g)].map((m) => m[0]).join('\n')
const layoutBefore = layoutTags(html)

html = html
  .replace(/\s*<!-- RIB_DIRECT_MENU_HEAD_BEGIN -->[\s\S]*?<!-- RIB_DIRECT_MENU_HEAD_END -->\s*/g, '\n')
  .replace(/\s*<!-- RIB_DIRECT_MENU_BODY_BEGIN -->[\s\S]*?<!-- RIB_DIRECT_MENU_BODY_END -->\s*/g, '\n')
  .replace(/\s*<link\b[^>]*href=["'][^"']*(?:public\/)?rib-(?:menu|vault)[^"']*\.css(?:\?[^"']*)?["'][^>]*>\s*/gi, '\n')
  .replace(/\s*<script\b[^>]*src=["'][^"']*(?:public\/)?rib-(?:menu|vault)[^"']*\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi, '\n')
  .replace(/\s*<meta\b[^>]*name=["']rib-menu-build["'][^>]*>\s*/gi, '\n')

const headClose = html.lastIndexOf('</head>')
const bodyClose = html.lastIndexOf('</body>')
if (headClose < 0) throw new Error('index.html is missing </head>')
if (bodyClose < 0) throw new Error('index.html is missing </body>')

const headBlock = [
  '<!-- RIB_DIRECT_MENU_HEAD_BEGIN -->',
  `<meta name="rib-menu-build" content="${version}">`,
  ...cssFiles.map((file) => `<link rel="stylesheet" href="./public/${file}?v=${version}">`),
  '<!-- RIB_DIRECT_MENU_HEAD_END -->',
].join('')

const bodyBlock = [
  '<!-- RIB_DIRECT_MENU_BODY_BEGIN -->',
  ...jsFiles.map((file) => `<script src="./public/${file}?v=${version}"></script>`),
  '<!-- RIB_DIRECT_MENU_BODY_END -->',
].join('')

html = `${html.slice(0, headClose)}${headBlock}${html.slice(headClose)}`
// v150 A: the platform layer (src/26-platform.js) is documented to load LAST — the menu block goes in front of it,
// not after it (it used to land just before </body>, i.e. after the platform tag, on every bake)
const platformTag = html.search(/<script\b[^>]*src="\.\/src\/26-platform\.js"[^>]*><\/script>\s*<\/body>/)
const updatedBodyClose = platformTag >= 0 ? platformTag : html.lastIndexOf('</body>')
html = `${html.slice(0, updatedBodyClose)}${bodyBlock}${html.slice(updatedBodyClose)}`

for (const file of cssFiles) {
  if (!html.includes(`./public/${file}?v=${version}`)) throw new Error(`Failed to inject ${file}`)
}
for (const file of jsFiles) {
  if (!html.includes(`./public/${file}?v=${version}`)) throw new Error(`Failed to inject ${file}`)
}

if (layoutTags(html) !== layoutBefore) throw new Error('The bake disturbed the src/ layout tags (docs/LAYOUT.md)')
const stray = strayCodeInPage(html)
if (stray.length) throw new Error(`The page's markup carries code outside any <script> (a bad bake): ${JSON.stringify(stray.slice(0, 2))}`)
fs.writeFileSync(indexPath, html)
console.log(`Baked redesigned menu directly into index.html (${version})`)
