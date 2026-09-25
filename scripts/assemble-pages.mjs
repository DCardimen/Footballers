import fs from 'node:fs'
import path from 'node:path'
import { stampLayoutRefs, layoutFiles } from './lib/layout.mjs'
import { writeServiceWorker } from './lib/pwa.mjs'

const root = process.cwd()
const outputDir = path.resolve(root, process.argv[2] || '_site')
const version = String(process.env.RIB_BUILD_VERSION || process.env.GITHUB_SHA || 'local')
  .replace(/[^a-zA-Z0-9._-]/g, '-')
  .slice(0, 40)

const menuCss = [
  'rib-menu-reset.css',
  'rib-menu.css',
  'rib-menu-v89.css',
  'rib-vault.css',
]

const menuJs = [
  'rib-menu-v89-runtime.js',
  'rib-menu-boot.js',
  'rib-menu.js',
  'rib-menu-howto.js',
  'rib-menu-navigation.js',
  'rib-vault.js',
  'rib-vault-audio.js',
  'rib-vault-bridge.js',
]

// v89: the menu's pictures ship as public/menu/*.webp. The three source sprite
// sheets the old blob-URL runtime decoded are no longer loaded by anything, so
// they stay out of the deploy (they live in art/ui/ for reference).
const menuArt = [
  'menu/hero_tunnel.webp',
  'menu/portrait_helmet.webp',
  'menu/card_continue.webp',
  'menu/trophy_goal_uff.webp',   // v153 D (v147 B shipped card_trophy_uff.webp)
  'menu/trophy_goal_interstellar.webp',
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

// v149 A: the game's scripts and styles are classic files in src/ (docs/LAYOUT.md). Ship the folder,
// and stamp every reference with the file's content hash — Pages caches for ten minutes, and the
// one reload v106.1 makes must not come back to a fresh index.html over yesterday's scripts.
const layout = layoutFiles(root).slice(1)
if (layout.length < 20) throw new Error(`index.html names only ${layout.length} src/ files`)
for (const file of layout) copyFile(file)

fs.writeFileSync(path.resolve(outputDir, '.nojekyll'), '')

const indexPath = path.resolve(outputDir, 'index.html')
let html = stampLayoutRefs(fs.readFileSync(indexPath, 'utf8'), root)
for (const file of layout) if (!html.includes(`./${file}?v=`)) throw new Error(`Missing stamped layout reference: ${file}`)

// v106.1: the page carries the build it was published with, so it can ask rib-build.json whether
// the site has moved on (public/rib-menu.js, freshV106) — the browser keeps index.html for ten
// minutes after a deploy, and every menu file and kit mask is stamped by that page
html = html.replace(/\s*<meta\b[^>]*name=["']rib-build["'][^>]*>/gi, '')
if (!html.includes('<meta name="rib-menu-build"')) throw new Error('Root index.html has no rib-menu-build meta to sit the build meta beside')
html = html.replace('<meta name="rib-menu-build"', `<meta name="rib-build" content="${version}"><meta name="rib-menu-build"`)
fs.writeFileSync(indexPath, html)
if (!html.includes(`<meta name="rib-build" content="${version}">`)) throw new Error('The build meta did not land in index.html')

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

// v137: the vault's sprites. Shipping its code without them is a black room, so the
// manifest is read and every file it names is required to exist in the output.
{
  const manifestPath = path.resolve(outputDir, 'public', 'vault', 'manifest.json')
  requireFile(manifestPath)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const names = Object.keys(manifest.sprites || {})
  if (names.length < 40) throw new Error(`The vault manifest lists only ${names.length} sprites`)
  for (const name of names) requireFile(path.resolve(outputDir, 'public', manifest.sprites[name].file))
}

// v149 D: the offline worker — <meta name="rib-sw"> into the page, sw.js with a content-hashed precache beside it
// (scripts/lib/pwa.mjs; the worker is pwa/sw.js). Its version IS the build's, so a deploy is a new worker.
const sw = writeServiceWorker(outputDir, { version })
if (!fs.readFileSync(indexPath, 'utf8').includes('name="rib-sw"')) throw new Error('The service-worker meta did not land in index.html')
for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) requireFile(path.resolve(outputDir, 'public', f))

fs.writeFileSync(
  path.resolve(outputDir, 'rib-build.json'),
  `${JSON.stringify({ version, generatedAt: new Date().toISOString(), directIndexMenu: true, menuCss, menuJs, menuArt, layout, sw: { entries: sw.entries, required: sw.required, bytes: sw.bytes } }, null, 2)}\n`,
)

console.log(`Assembled direct-index GitHub Pages site in ${path.relative(root, outputDir)} (${version})`)
