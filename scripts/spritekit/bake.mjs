// Bake public/rib_atlas_v22.png into index.html as window.__RIB_ATLAS_V22 (data
// URL) so the v22 sprite overlay works in the standalone single file too, not
// just the dev server. Idempotent: replaces any existing assignment. Re-run
// after every pack.mjs change.
import fs from 'fs'
const HTML = 'index.html'
const png = fs.readFileSync('public/rib_atlas_v22.png').toString('base64')
const assign = 'window.__RIB_ATLAS_V22 = "data:image/png;base64,' + png + '";\n'
let html = fs.readFileSync(HTML, 'utf8')
const re = /window\.__RIB_ATLAS_V22 = "data:image\/png;base64,[^"]*";\n/
if (re.test(html)) { html = html.replace(re, assign); console.log('replaced existing __RIB_ATLAS_V22') }
else {
  const anchor = '\nconst RIB_META = {'
  const i = html.indexOf(anchor)
  if (i < 0) { console.error('anchor not found'); process.exit(1) }
  html = html.slice(0, i) + '\n' + assign + html.slice(i + 1)
  console.log('inserted __RIB_ATLAS_V22 before RIB_META')
}
fs.writeFileSync(HTML, html)
console.log('baked', (png.length / 1024 | 0) + 'KB base64 into index.html')
