/* ===== v149 C THE CODE READS — rename the career app's names, and prove nothing else moved =====
 * node scripts/readable/rename.mjs [--batch <name>] [--check] [file]      (file: src/07-career-app.js)
 * Applies the name map in names.mjs (every batch in order, or one), scope-aware: a binding at the top
 * of the file's IIFE and every reference to it — never a property name, never a string, never a local
 * that shadows it. A pair already applied (old name gone, new one present) is skipped, so this is
 * also how a branch that still carries the OLD names is ported: layout-split its index.html, run
 * format.mjs, then this, and diff. Refuses (exit 2) any rename that would capture or be captured;
 * refuses (exit 3) to write unless lib.mjs proveRename passes. `window.*` names are never touched —
 * they are property names, and the checks and the other files call them. */
import fs from 'node:fs'
import { renameSource, proveRename } from './lib.mjs'
import { BATCHES } from './names.mjs'

const args = process.argv.slice(2)
const bi = args.indexOf('--batch'), only = bi >= 0 ? args[bi + 1] : null
const check = args.includes('--check')
const file = args.filter((a, i) => !a.startsWith('--') && !(bi >= 0 && i === bi + 1))[0] || 'src/07-career-app.js'
let src = fs.readFileSync(file, 'utf8'), total = 0, pending = 0
for (const [name, rows] of BATCHES) {
  if (only && name !== only) continue
  const res = renameSource(src, rows.map(r => [r[0], r[1]]))
  if (res.errors) { console.error(`[${name}] REFUSED:\n  ` + res.errors.join('\n  ')); process.exit(2) }
  if (!res.map.size) { console.log(`[${name}] already applied`); continue }
  const why = proveRename(src, res)
  if (why) { console.error(`[${name}] PROOF FAILED — ${why}`); process.exit(3) }
  console.log(`[${name}] ${res.map.size} bindings, ${res.sites} identifier sites, ${res.expanded.size} shorthand keys kept` + (res.skipped.length ? `, ${res.skipped.length} already applied` : '') + '; AST + resolution proof ✓')
  total += res.map.size; pending += res.map.size
  src = res.out
}
if (check) process.exit(pending ? 1 : 0)
if (total) fs.writeFileSync(file, src)
