/* ===== v149 C THE CODE READS — the proof tools =====
 * Shared by format.mjs and rename.mjs. Two promises, both checked by machine rather than by eye:
 *   format:  the file parses to the SAME program before and after (positions, comments and
 *            parentheses ignored; see sameProgram for the three spellings that are normalised);
 *   rename:  (1) the old tree with exactly the renamed identifiers swapped IS the new tree, and
 *            (2) every identifier in the new file resolves to the same binding it did before.
 * Needs three packages the game itself does not: acorn, eslint-scope, prettier —
 *   npm i --no-save acorn eslint-scope prettier
 * (kept out of package.json on purpose: nothing in the game or the checks depends on them). */
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// READABLE_DEPS=<dir> resolves the three from <dir>/node_modules instead (a scratch install)
export async function need(name) {
  try {
    if (process.env.READABLE_DEPS) return await import(pathToFileURL(createRequire(process.env.READABLE_DEPS + '/').resolve(name)).href)
    return await import(name)
  } catch {
    console.error(`scripts/readable needs \`${name}\`: npm i --no-save acorn eslint-scope prettier (or READABLE_DEPS=<dir with them>)`)
    process.exit(4)
  }
}
const acorn = await need('acorn')
const eslintScope = await need('eslint-scope')

export const read = f => fs.readFileSync(f, 'utf8')

export function parse(src, ranges = false) {
  return acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, ranges })
}

/* The three spellings Prettier changes that are not behaviour, normalised on BOTH sides:
 *  - a||(b||c) vs (a||b)||c: same value, same short-circuit order — a same-operator chain compares flat;
 *  - a stray `;` in a statement list (`try{…}catch(e){};`) is an EmptyStatement that does nothing;
 *  - a string/number literal's raw spelling ('x' vs "x", .5 vs 0.5) — the VALUE is compared.
 * Template literals keep their raw text in the comparison (whitespace inside them is output). */
export function normalise(n) {
  if (!n || typeof n !== 'object') return n
  if (Array.isArray(n)) { for (let i = 0; i < n.length; i++) n[i] = normalise(n[i]); return n.filter(x => !(x && x.type === 'EmptyStatement')) }
  for (const k of Object.keys(n)) if (n[k] && typeof n[k] === 'object' && !(n[k] instanceof RegExp)) n[k] = normalise(n[k])
  if (n.type === 'LogicalExpression') {
    const ops = [], op = n.operator
    const walk = x => { if (x.type === 'LogicalExpression' && x.operator === op) { walk(x.left); walk(x.right) } else if (x.type === 'LogicalChain' && x.operator === op) ops.push(...x.operands); else ops.push(x) }
    walk(n)
    return { type: 'LogicalChain', operator: op, operands: ops }
  }
  return n
}

const SKIP = new Set(['start', 'end', 'loc', 'range'])
export function firstDiff(a, b, path = '$') {
  if (a === b) return null
  if (typeof a !== typeof b) return `${path} type ${typeof a} vs ${typeof b}`
  if (a === null || b === null || typeof a !== 'object') {
    if (typeof a === 'bigint' || (typeof a === 'number' && Number.isNaN(a) && Number.isNaN(b))) return a == b ? null : path
    return `${path} ${JSON.stringify(a)} vs ${JSON.stringify(b)}`
  }
  if (a instanceof RegExp || b instanceof RegExp) return String(a) === String(b) ? null : `${path} regex`
  if (Array.isArray(a) !== Array.isArray(b)) return `${path} array-ness`
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path} length ${a.length} vs ${b.length}`
    for (let i = 0; i < a.length; i++) { const d = firstDiff(a[i], b[i], `${path}[${i}]`); if (d) return d }
    return null
  }
  const skipRaw = a.type === 'Literal' && (typeof a.value === 'number' || typeof a.value === 'string')
  const keep = k => !SKIP.has(k) && !(skipRaw && k === 'raw')
  const ka = Object.keys(a).filter(keep), kb = Object.keys(b).filter(keep)
  if (ka.join() !== kb.join()) return `${path} keys ${ka} vs ${kb}`
  for (const k of ka) { const d = firstDiff(a[k], b[k], `${path}.${k}`); if (d) return d }
  return null
}

/** null when the two sources are the same program, else the path of the first difference */
export const sameProgram = (a, b) => firstDiff(normalise(parse(a)), normalise(parse(b)))

/* ---------------------------------------------------------------- scopes */
export function analyse(src) {
  const ast = parse(src, true)
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2024, sourceType: 'script' })
  const iife = sm.globalScope.childScopes.find(s => s.type === 'function')   // the file is one (function(){…})()
  return { ast, sm, iife }
}
// a top-level class has a second binding of its name inside the class scope
export function innerVars(v, sm) {
  const out = [v]
  for (const d of v.defs) if (d.type === 'ClassName') { const cs = sm.acquire(d.node); const inner = cs && cs.set.get(v.name); if (inner && inner !== v) out.push(inner) }
  return out
}
export function idsOf(v, sm) {
  const ids = new Set()
  for (const vv of innerVars(v, sm)) { for (const d of vv.defs) ids.add(d.name); for (const r of vv.references) ids.add(r.identifier) }
  return [...ids]
}

const RESERVED = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public await arguments eval undefined NaN Infinity'.split(' '))

/** rename top-level bindings of the file's IIFE; pairs already applied (old gone, new present) are skipped */
export function renameSource(src, pairs) {
  const { ast, sm, iife } = analyse(src)
  const globals = new Set(sm.globalScope.through.map(r => r.identifier.name))   // names that resolve to NO declaration
  const map = new Map(), errors = [], skipped = [], targets = new Set()
  for (const [from, to] of pairs) {
    if (!iife.set.has(from) && iife.set.has(to)) { skipped.push(from); continue }
    if (map.has(from)) { errors.push(`${from}: listed twice`); continue }
    if (targets.has(to)) { errors.push(`${to}: target used twice`); continue }
    if (!/^[A-Za-z_$][\w$]*$/.test(to) || RESERVED.has(to)) { errors.push(`${from}->${to}: not a usable identifier`); continue }
    const v = iife.set.get(from)
    if (!v) { errors.push(`${from}: not a top-level binding of the IIFE`); continue }
    if (iife.set.has(to)) { errors.push(`${from}->${to}: ${to} is already a top-level binding`); continue }
    if (globals.has(to)) { errors.push(`${from}->${to}: ${to} is read as a global in this file`); continue }
    let bad = null   // capture: a reference to v from inside a scope (below v's own) that declares `to`
    for (const vv of innerVars(v, sm)) {
      for (const r of vv.references) { for (let s = r.from; s && s !== vv.scope; s = s.upper) if (s.set.has(to)) { bad = s; break } if (bad) break }
      if (vv !== v && vv.scope.set.has(to)) bad = vv.scope
      if (bad) break
    }
    if (bad) { errors.push(`${from}->${to}: would be captured by a local \`${to}\` (scope at offset ${bad.block.start})`); continue }
    map.set(from, to); targets.add(to)
  }
  if (errors.length) return { errors }
  const parent = new Map()
  ;(function walk(n, p) {
    if (!n || typeof n.type !== 'string') return
    parent.set(n, p)
    for (const k of Object.keys(n)) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'range') continue
      const c = n[k]
      if (Array.isArray(c)) c.forEach(x => x && typeof x.type === 'string' && walk(x, n))
      else if (c && typeof c.type === 'string') walk(c, n)
    }
  })(ast, null)
  const edits = [], renamed = new Map(), expanded = new Set()
  for (const [from, to] of map) for (const id of idsOf(iife.set.get(from), sm)) {
    renamed.set(id.start, to)
    const p = parent.get(id), pp = p && parent.get(p)
    const prop = p && p.type === 'Property' ? p : (p && p.type === 'AssignmentPattern' && pp && pp.type === 'Property' && pp.value === p ? pp : null)
    let text = to
    if (prop && prop.shorthand && (prop.value === id || (prop.value.type === 'AssignmentPattern' && prop.value.left === id))) { text = `${from}: ${to}`; expanded.add(prop.start) }   // `{o}` keeps its key
    edits.push([id.start, id.end, text])
  }
  edits.sort((a, b) => b[0] - a[0])
  let out = src
  for (let i = 0; i < edits.length; i++) {
    if (i && edits[i][1] > edits[i - 1][0]) throw new Error('overlapping edits')
    out = out.slice(0, edits[i][0]) + edits[i][2] + out.slice(edits[i][1])
  }
  return { out, map, skipped, sites: edits.length, renamed, expanded, sm, iife }
}

function signature(sm, canon) {
  const idx = new Map(sm.scopes.map((s, i) => [s, i]))
  const refs = []
  for (const s of sm.scopes) for (const r of s.references) { const v = r.resolved; refs.push([r.identifier.start, v ? `${idx.get(v.scope)}:${canon(v)}` : `global:${r.identifier.name}`]) }
  return refs.sort((a, b) => a[0] - b[0]).map(r => r[1])
}

/** null when the rename is proven, else what failed */
export function proveRename(src, res) {
  const { out, map, renamed, expanded, sm, iife } = res
  const oldAst = parse(src), newAst = parse(out)
  ;(function walk(n) {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) return n.forEach(walk)
    if (n.type === 'Identifier' && renamed.has(n.start)) n.name = renamed.get(n.start)
    if (n.type === 'Property' && expanded.has(n.start)) n.shorthand = false
    const skipKey = (n.type === 'Property' || n.type === 'MethodDefinition' || n.type === 'PropertyDefinition') && !n.computed
    const skipProp = n.type === 'MemberExpression' && !n.computed
    for (const k of Object.keys(n)) {
      if ((skipKey && k === 'key') || (skipProp && k === 'property')) continue   // names, never references
      if (n[k] && typeof n[k] === 'object' && !(n[k] instanceof RegExp)) walk(n[k])
    }
  })(oldAst)
  const d = firstDiff(oldAst, newAst)
  if (d) return 'AST: ' + d
  const moved = new Set()
  for (const from of map.keys()) for (const vv of innerVars(iife.set.get(from), sm)) moved.add(vv)
  const A = signature(sm, v => (moved.has(v) ? map.get(v.name) : v.name))
  const B = signature(analyse(out).sm, v => v.name)
  if (A.length !== B.length) return `resolution: ${A.length} references before, ${B.length} after`
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return `resolution: reference #${i} bound to ${A[i]} before, ${B[i]} after`
  return null
}
