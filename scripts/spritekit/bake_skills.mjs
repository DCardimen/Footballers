// Bake public/rib_skill_v64.png into index.html as window.__RIB_SKILL_V64 (data URL)
// and refresh the inline RIB_META_SKILL cellmap from art/skill_v64.cellmap.json, so
// the training icons work in the standalone single file too, not just off the dev
// server. Idempotent: replaces any existing assignment. Re-run after every
// pack_skills.mjs change.
import fs from 'fs'
const HTML = 'index.html'
const png = fs.readFileSync('public/rib_skill_v64.png').toString('base64')
const assign = 'window.__RIB_SKILL_V64 = "data:image/png;base64,' + png + '";\n'
let html = fs.readFileSync(HTML, 'utf8')

const re = /window\.__RIB_SKILL_V64 = "data:image\/png;base64,[^"]*";\n/
if (re.test(html)) { html = html.replace(re, assign); console.log('replaced existing __RIB_SKILL_V64') }
else {
  const anchor = '\nconst RIB_META = {'
  const i = html.indexOf(anchor)
  if (i < 0) { console.error('anchor not found'); process.exit(1) }
  html = html.slice(0, i) + '\n' + assign + html.slice(i + 1)
  console.log('inserted __RIB_SKILL_V64 before RIB_META')
}

const cellmap = fs.readFileSync('art/skill_v64.cellmap.json', 'utf8').trim()
const mre = /const RIB_META_SKILL = \{.*?\};/
if (mre.test(html)) {
  html = html.replace(mre, 'const RIB_META_SKILL = ' + cellmap + ';')
  console.log('refreshed RIB_META_SKILL (' + Object.keys(JSON.parse(cellmap)).length + ' cells)')
} else console.warn('RIB_META_SKILL not found in index.html — cellmap NOT refreshed')

fs.writeFileSync(HTML, html)
console.log('baked', (png.length / 1024 | 0) + 'KB base64 into index.html')
