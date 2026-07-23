import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const indexPath = path.resolve(root, 'index.html')
const version = String(process.env.RIB_MENU_VERSION || 'direct-v3')
  .replace(/[^a-zA-Z0-9._-]/g, '-')
  .slice(0, 48)

const cssFiles = [
  'rib-menu-reset.css',
  'rib-menu.css',
  'rib-menu-mobile.css',
  'rib-menu-final.css',
  'rib-menu-assets.css',
]

const jsFiles = [
  'rib-menu-asset-runtime.js',
  'rib-menu-boot.js',
  'rib-menu.js',
  'rib-menu-navigation.js',
]

if (!fs.existsSync(indexPath)) throw new Error('index.html is missing')
for (const file of [...cssFiles, ...jsFiles]) {
  const source = path.resolve(root, 'public', file)
  if (!fs.existsSync(source)) throw new Error(`Missing menu dependency: public/${file}`)
}

let html = fs.readFileSync(indexPath, 'utf8')

html = html
  .replace(/\s*<!-- RIB_DIRECT_MENU_HEAD_BEGIN -->[\s\S]*?<!-- RIB_DIRECT_MENU_HEAD_END -->\s*/g, '\n')
  .replace(/\s*<!-- RIB_DIRECT_MENU_BODY_BEGIN -->[\s\S]*?<!-- RIB_DIRECT_MENU_BODY_END -->\s*/g, '\n')
  .replace(/\s*<link\b[^>]*href=["'][^"']*(?:public\/)?rib-menu[^"']*\.css(?:\?[^"']*)?["'][^>]*>\s*/gi, '\n')
  .replace(/\s*<script\b[^>]*src=["'][^"']*(?:public\/)?rib-menu[^"']*\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi, '\n')
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
const updatedBodyClose = html.lastIndexOf('</body>')
html = `${html.slice(0, updatedBodyClose)}${bodyBlock}${html.slice(updatedBodyClose)}`

for (const file of cssFiles) {
  if (!html.includes(`./public/${file}?v=${version}`)) throw new Error(`Failed to inject ${file}`)
}
for (const file of jsFiles) {
  if (!html.includes(`./public/${file}?v=${version}`)) throw new Error(`Failed to inject ${file}`)
}

fs.writeFileSync(indexPath, html)
console.log(`Baked redesigned menu directly into index.html (${version})`)
