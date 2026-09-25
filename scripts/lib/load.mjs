// v150 B — how contended the box is, as one number a wall-clock budget can be scaled by.
//
// A handful of checks hold the game to millisecond budgets (v112Acheck: the first animated
// frame inside 700ms, the splash door inside 250ms, a second scene inside 150ms). Those
// numbers were measured on a quiet machine, and they are right there: a regression that
// doubles the cold path must fail. But the suite runs at --jobs 3-4 on a 4-core box beside
// other agents, at a 1-minute load of 15-45, and there the same code takes 3-10x as long
// because it is waiting for a core, not because it got slower.
//
// loadScale() is the 1-minute load average per core, floored at 1 and capped at `cap`:
//   * on a quiet box (load <= cores) it is exactly 1, and every budget is the strict one;
//   * on a contended box the budget stretches by how many runnable tasks share each core.
// The scale is printed next to every budget that used it, so a pass under load says so.
// LOAD_SCALE=1 forces the strict budgets whatever the load; LOAD_SCALE=<n> pins a factor.
import os from 'node:os'
export function loadScale (cap = 8) {
  if (process.env.LOAD_SCALE) return Math.max(1, Number(process.env.LOAD_SCALE) || 1)
  const perCore = os.loadavg()[0] / Math.max(1, os.cpus().length)
  return +Math.min(cap, Math.max(1, perCore)).toFixed(2)
}
