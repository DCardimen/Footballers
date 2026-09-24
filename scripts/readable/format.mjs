/* ===== v149 C THE CODE READS — format, and prove it is the same program =====
 * node scripts/readable/format.mjs [--check] [file ...]
 * Formats each file with Prettier (the settings below are the house settings for src/) and refuses to
 * write unless the result parses to the same program (lib.mjs sameProgram). --check writes nothing and
 * exits 1 if a file would change. Default files: the two that were minified-style (docs/NAMES.md).
 * NOT for src/vendor/phaser.min.js, ever, and not for the generated one-line tables other files carry
 * (RIB_META_* in 05/18 are rewritten by the art tools by marker — leave those files alone). */
import fs from 'node:fs'
import { sameProgram, need } from './lib.mjs'
const _p = await need('prettier'), prettier = _p.format ? _p : _p.default

export const FILES = ['src/07-career-app.js', 'src/10-season-rosters-v158.js']
export const OPTIONS = {
  parser: 'babel', printWidth: 120, tabWidth: 2, semi: true, quoteProps: 'preserve', trailingComma: 'none',
  bracketSpacing: true, arrowParens: 'avoid', embeddedLanguageFormatting: 'off', endOfLine: 'lf',
}
// the file keeps the quote it was written in (07 was minifier output in double quotes, 10 hand-written in single)
const quoteOf = src => ((src.match(/'/g) || []).length > (src.match(/"/g) || []).length ? { singleQuote: true } : { singleQuote: false })

const args = process.argv.slice(2), check = args.includes('--check')
const files = args.filter(a => a !== '--check')
let bad = 0
for (const f of files.length ? files : FILES) {
  if (/vendor\//.test(f)) { console.error(`${f}: never`); process.exit(2) }
  const src = fs.readFileSync(f, 'utf8')
  const out = await prettier.format(src, { ...OPTIONS, ...quoteOf(src) })
  const diff = sameProgram(src, out)
  if (diff) { console.error(`${f}: NOT the same program after formatting — ${diff}`); process.exit(3) }
  const lines = s => s.split('\n'), longest = s => Math.max(...lines(s).map(l => l.length))
  if (out === src) { console.log(`${f}: already formatted`); continue }
  bad++
  console.log(`${f}: ${lines(src).length} → ${lines(out).length} lines, longest ${longest(src)} → ${longest(out)}; same program ✓${check ? ' (would change)' : ''}`)
  if (!check) fs.writeFileSync(f, out)
}
process.exit(check && bad ? 1 : 0)
