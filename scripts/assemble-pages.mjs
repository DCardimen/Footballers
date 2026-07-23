import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outputDir = path.resolve(root, process.argv[2] || '_site')
const version = String(process.env.RIB_BUILD_VERSION || process.env.GITHUB_SHA || 'local')
  .replace(/[^a-zA-Z0-9._-]/g, '-')
  .slice(0, 40)

const menuCss = [
  'rib-menu-reset.css',
  'rib-menu.css',
  'rib-menu-mobile.css',
  'rib-menu-final.css',
  'rib-menu-assets.css',
]

const menuJs = [
  'rib-menu-asset-runtime.js',
  'rib-menu-boot.js',
  'rib-menu.js',
  'rib-menu-navigation.js',
]

const generatedAssets = [
  'a_clean_high_resolution_game_ui_asset_sheet_on_a_1_batch_1.png',
  'a_clean_ui_graphic_assets_sprite_sheet_mockup_im_2_batch_2.png',
  'a_clean_graphic_artwork_ui_icon_sheet_on_a_trans_3_batch_3.png',
]

function requireFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Required Pages file is missing: ${path.relative(root, filePath)}`)
  }
}

function copyFile(relativeSource, relativeDestination = relativeSource) {
  const source = path.resolve(root, relativeSource)
  const destination = path.resolve(outputDir, relativeDestination)
  requireFile(source)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
}

function removeOldMenuInjection(html) {
  const headBlock = /\s*<!-- RIB_MENU_HEAD_BEGIN -->[\s\S]*?<!-- RIB_MENU_HEAD_END -->\s*/g
  const bodyBlock = /\s*<!-- RIB_MENU_BODY_BEGIN -->[\s\S]*?<!-- RIB_MENU_BODY_END -->\s*/g
  const oldStyles = /\s*<link\b[^>]*href=["'][^"']*rib-menu[^"']*\.css(?:\?[^"']*)?["'][^>]*>\s*/gi
  const oldScripts = /\s*<script\b[^>]*src=["'][^"']*rib-menu[^"']*\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi
  const oldBuildMeta = /\s*<meta\b[^>]*name=["']rib-menu-build["'][^>]*>\s*/gi
  return html
    .replace(headBlock, '\n')
    .replace(bodyBlock, '\n')
    .replace(oldStyles, '\n')
    .replace(oldScripts, '\n')
    .replace(oldBuildMeta, '\n')
}

fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })

copyFile('index.html')
if (fs.existsSync(path.resolve(root, 'menu-preview.html'))) copyFile('menu-preview.html')

const publicDir = path.resolve(root, 'public')
if (!fs.existsSync(publicDir)) throw new Error('Required public directory is missing')
fs.cpSync(publicDir, outputDir, { recursive: true })

for (const asset of generatedAssets) copyFile(asset)
fs.writeFileSync(path.resolve(outputDir, '.nojekyll'), '')

const indexPath = path.resolve(outputDir, 'index.html')
let html = removeOldMenuInjection(fs.readFileSync(indexPath, 'utf8'))

const headMarkup = [
  '<!-- RIB_MENU_HEAD_BEGIN -->',
  `<meta name="rib-menu-build" content="${version}">`,
  '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">',
  ...menuCss.map((file) => `<link rel="stylesheet" href="./${file}?v=${version}">`),
  '<!-- RIB_MENU_HEAD_END -->',
].join('')

const bodyMarkup = [
  '<!-- RIB_MENU_BODY_BEGIN -->',
  ...menuJs.map((file) => `<script defer src="./${file}?v=${version}"></script>`),
  '<!-- RIB_MENU_BODY_END -->',
].join('')

const headIndex = html.lastIndexOf('</head>')
const bodyIndex = html.lastIndexOf('</body>')
if (headIndex < 0) throw new Error('index.html is missing </head>')
if (bodyIndex < 0) throw new Error('index.html is missing </body>')

html = `${html.slice(0, headIndex)}${headMarkup}${html.slice(headIndex)}`
const updatedBodyIndex = html.lastIndexOf('</body>')
html = `${html.slice(0, updatedBodyIndex)}${bodyMarkup}${html.slice(updatedBodyIndex)}`
fs.writeFileSync(indexPath, html)

for (const file of [...menuCss, ...menuJs, ...generatedAssets]) {
  requireFile(path.resolve(outputDir, file))
}

for (const file of menuCss) {
  if (!html.includes(`./${file}?v=${version}`)) throw new Error(`Missing stylesheet injection: ${file}`)
}
for (const file of menuJs) {
  if (!html.includes(`./${file}?v=${version}`)) throw new Error(`Missing script injection: ${file}`)
}
if (!html.includes('RIB_MENU_HEAD_BEGIN') || !html.includes('RIB_MENU_BODY_BEGIN')) {
  throw new Error('Menu injection markers were not written')
}

fs.writeFileSync(
  path.resolve(outputDir, 'rib-build.json'),
  `${JSON.stringify({ version, generatedAt: new Date().toISOString(), menuCss, menuJs, generatedAssets }, null, 2)}\n`,
)

console.log(`Assembled GitHub Pages site in ${path.relative(root, outputDir)} with menu build ${version}`)
