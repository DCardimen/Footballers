// Bake public/rib_plan_v66.png into index.html as window.__RIB_PLAN_V66 (data URL)
// and refresh the inline RIB_META_PLAN cellmap from art/plan_v66.cellmap.json, so
// the pregame plan icons work in the standalone single file too, not just off the
// dev server. Idempotent: replaces any existing assignment. Re-run after every
// pack_plans.mjs change.
import fs from 'fs'
const HTML = 'index.html'
const png = fs.readFileSync('public/rib_plan_v66.png').toString('base64')
const assign = 'window.__RIB_PLAN_V66 = "data:image/png;base64,' + png + '";\n'
let html = fs.readFileSync(HTML, 'utf8')

const re = /window\.__RIB_PLAN_V66 = "data:image\/png;base64,[^"]*";\n/
if (re.test(html)) { html = html.replace(re, assign); console.log('replaced existing __RIB_PLAN_V66') }
else {
  const anchor = 'window.__RIB_SKILL_V64 = "data:image/png;base64,'
  const i = html.indexOf(anchor)
  if (i < 0) { console.error('anchor not found (expected the v64 skill assignment)'); process.exit(1) }
  html = html.slice(0, i) + assign + html.slice(i)
  console.log('inserted __RIB_PLAN_V66 before __RIB_SKILL_V64')
}

const cellmap = fs.readFileSync('art/plan_v66.cellmap.json', 'utf8').trim()
const mre = /const RIB_META_PLAN = \{.*?\};/
if (mre.test(html)) {
  html = html.replace(mre, 'const RIB_META_PLAN = ' + cellmap + ';')
  console.log('refreshed RIB_META_PLAN (' + Object.keys(JSON.parse(cellmap)).length + ' cells)')
} else console.warn('RIB_META_PLAN not found in index.html — cellmap NOT refreshed')

fs.writeFileSync(HTML, html)
console.log('baked', (png.length / 1024 | 0) + 'KB base64 into index.html')
