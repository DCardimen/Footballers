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
  'rib-menu-v89.css',
]

const menuJs = [
  'rib-menu-v89-runtime.js',
  'rib-menu-boot.js',
  'rib-menu.js',
  'rib-menu-navigation.js',
]

// v89: the menu's pictures ship as public/menu/*.webp. The three source sprite
// sheets the old blob-URL runtime decoded are no longer loaded by anything, so
// they stay out of the deploy (they live in art/ui/ for reference).
const menuArt = [
  'menu/hero_tunnel.webp',
  'menu/portrait_helmet.webp',
  'menu/card_continue.webp',
  'menu/card_trophy.webp',
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

fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(outputDir, { recursive: true })

copyFile('index.html')
if (fs.existsSync(path.resolve(root, 'menu-preview.html'))) copyFile('menu-preview.html')

const publicDir = path.resolve(root, 'public')
if (!fs.existsSync(publicDir)) throw new Error('Required public directory is missing')
fs.cpSync(publicDir, path.resolve(outputDir, 'public'), { recursive: true })

fs.writeFileSync(path.resolve(outputDir, '.nojekyll'), '')

const indexPath = path.resolve(outputDir, 'index.html')
const html = fs.readFileSync(indexPath, 'utf8')

if (!html.includes('RIB_DIRECT_MENU_HEAD_BEGIN') || !html.includes('RIB_DIRECT_MENU_BODY_BEGIN')) {
  throw new Error('Root index.html does not contain the directly baked redesigned menu')
}

for (const file of menuCss) {
  requireFile(path.resolve(outputDir, 'public', file))
  if (!html.includes(`./public/${file}?v=`)) throw new Error(`Missing direct stylesheet reference: ${file}`)
}
for (const file of menuJs) {
  requireFile(path.resolve(outputDir, 'public', file))
  if (!html.includes(`./public/${file}?v=`)) throw new Error(`Missing direct script reference: ${file}`)
}
for (const asset of menuArt) requireFile(path.resolve(outputDir, 'public', asset))

fs.writeFileSync(
  path.resolve(outputDir, 'rib-build.json'),
  `${JSON.stringify({ version, generatedAt: new Date().toISOString(), directIndexMenu: true, menuCss, menuJs, menuArt }, null, 2)}\n`,
)

console.log(`Assembled direct-index GitHub Pages site in ${path.relative(root, outputDir)} (${version})`)
