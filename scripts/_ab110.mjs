// v150 B probe (not a check): FieldSim pass plays, before (git HEAD) vs after (worktree), same seeds.
// Proves the v150 B credit change spends no random draw and moves no outcome: every play's result
// and log must be identical; only who is credited may differ, and only where the ball man had no
// roster player (which never happens with full rosters).
import vm from 'node:vm'
import crypto from 'node:crypto'
import { readGameHtml } from './lib/layout.mjs'
const engineOf = (html) => { const a = html.indexOf('/* ===== RIB_TUNE'), o = html.lastIndexOf('<script>', a), c = html.indexOf('</script>', a); return html.slice(o + 8, c) }
const SRC = { before: engineOf(readGameHtml({ gitRef: process.env.REF || 'HEAD' })), after: engineOf(readGameHtml()) }
function mulberry32 (seed) { return function () { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const POS_OFF = ['WR', 'WR', 'TE', 'OL', 'OL', 'OL', 'OL', 'OL', 'QB', 'RB', 'WR'], POS_DEF = ['CB', 'CB', 'S', 'S', 'LB', 'LB', 'LB', 'DL', 'DL', 'DL', 'DL']
const SK = ['speed', 'quickness', 'acceleration', 'burst', 'strength', 'blocking', 'tackling', 'coverage', 'agility', 'awareness', 'catching', 'jumping', 'throwing', 'vision', 'stamina', 'grit', 'discipline', 'ballControl']
const att = (p, k) => Number(p?.attrs?.[k] ?? 55)
function run (which, seed, n) {
  const M = Object.create(Math); M.random = mulberry32(seed)
  const ctx = vm.createContext({ console: { log () {}, warn () {}, error () {} }, Math: M }); ctx.window = ctx; ctx.globalThis = ctx
  vm.runInContext(SRC[which], ctx); ctx.__getGridironState = () => ({ player: { level: 5 } })
  const h = crypto.createHash('sha1'); let picks = 0, swats = 0, cred = 0
  for (let i = 0; i < n; i++) {
    const mk = (pos, j, side) => ({ name: side + pos + j, pos, attrs: Object.fromEntries(SK.map(k => [k, 50 + ((j * 7 + i) % 25)])) })
    const off = POS_OFF.map((p, j) => mk(p, j, 'o')), def = POS_DEF.map((p, j) => mk(p, j, 'd'))
    const tgt = off[[0, 1, 10, 2, 9][i % 5]], cov = def[i % 7]
    const X = ctx.__FieldSim.pass(true, { off }, { def }, off[8], tgt, cov, att, ['dropback', 'quick', 'shot'][i % 3], { fieldPos: 30 + (i % 50), down: 1 + (i % 3), toGo: 10 })
    const log = ctx.__FieldSim._Q[ctx.__FieldSim._Q.length - 1].log
    const ev = log.events.map(e => e.type + ':' + (e.by || e.who || e.tackler || '') + ':' + Math.round(e.t)).join(',')
    h.update(JSON.stringify([X.yards, X.complete, X.intercepted, X.swat, X.sack, X.air, X.yac, X.tackler && X.tackler.name, ev, log.duration]))
    if (X.intercepted) picks++; if (X.swat) swats++
    if (X.intercepted || X.swat) cred++
  }
  return { hash: h.digest('hex'), picks, swats }
}
let same = 0, diff = 0
for (let s = 1; s <= +(process.env.SEEDS || 12); s++) {
  const a = run('before', s * 104729, +(process.env.N || 400)), b = run('after', s * 104729, +(process.env.N || 400))
  const eq = a.hash === b.hash; eq ? same++ : diff++
  console.log('seed', s, eq ? 'IDENTICAL' : 'DIFFERENT', a.hash.slice(0, 12), b.hash.slice(0, 12), 'picks', a.picks, b.picks, 'swats', a.swats, b.swats)
}
console.log(JSON.stringify({ same, diff }))
