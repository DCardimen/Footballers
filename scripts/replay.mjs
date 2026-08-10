// replay.mjs — SERVER-REPLAY anti-cheat, runnable in Node.
//
// The daily challenge is fully deterministic (scripts/daily-engine.mjs), so a
// submitted score can be re-derived from (daySeed, choices) and compared. A
// forged score never matches the recompute and is rejected. This is the exact
// logic the Supabase Edge Function runs (supabase/functions/verify-daily/).
//
//   node scripts/replay.mjs                       # run the self-test
//   node scripts/replay.mjs <daySeed> <choices> <claimed>   # verify one submission
//        e.g. node scripts/replay.mjs 20260810 sgsgs 512
import { run, verify, ROUNDS, dayKey } from './daily-engine.mjs';

// parse "sgsgs" / "steady,glory,..." -> ['steady','glory',...]
function parseChoices(s) {
  if (!s) return [];
  if (s.includes(',')) return s.split(',').map(x => x.trim().toLowerCase().startsWith('g') ? 'glory' : 'steady');
  return s.split('').map(c => c.toLowerCase() === 'g' ? 'glory' : 'steady');
}

const [, , seedArg, choicesArg, claimedArg] = process.argv;

if (seedArg && choicesArg && claimedArg != null) {
  const daySeed = Number(seedArg);
  const choices = parseChoices(choicesArg);
  const claimed = Number(claimedArg);
  const v = verify(daySeed, choices, claimed);
  console.log(JSON.stringify({ daySeed, choices, claimed, recomputed: v.total, accepted: v.ok }, null, 2));
  process.exit(v.ok ? 0 : 1);
}

// ---- self-test ----
let pass = true;
const daySeed = dayKey(Date.UTC(2026, 7, 10)); // fixed date so the test is stable

// 1) an honest submission verifies
const honestChoices = ['steady', 'glory', 'steady', 'glory', 'steady'];
const honest = run(daySeed, honestChoices);
const okHonest = verify(daySeed, honestChoices, honest.total);
console.log('honest run total =', honest.total, '-> accepted:', okHonest.ok);
pass = pass && okHonest.ok;

// 2) a forged (inflated) score is rejected
const forged = verify(daySeed, honestChoices, honest.total + 500);
console.log('forged (+500) -> accepted:', forged.ok, '(expected false)');
pass = pass && forged.ok === false;

// 3) determinism: same inputs -> same total across many seeds/choice-sets
let det = true;
for (let i = 0; i < 200; i++) {
  const seed = 20260000 + i;
  const choices = Array.from({ length: ROUNDS }, (_, r) => ((i >> r) & 1) ? 'glory' : 'steady');
  if (run(seed, choices).total !== run(seed, choices).total) { det = false; break; }
}
console.log('determinism over 200 cases:', det);
pass = pass && det;

// 4) choices actually matter (the board isn't a coin-flip on identical seeds)
const allSteady = run(daySeed, Array(ROUNDS).fill('steady')).total;
const allGlory = run(daySeed, Array(ROUNDS).fill('glory')).total;
console.log('all-steady =', allSteady, '| all-glory =', allGlory, '| differ:', allSteady !== allGlory);
pass = pass && allSteady !== allGlory;

console.log(pass ? '\n✅ REPLAY SELF-TEST PASS' : '\n❌ REPLAY SELF-TEST FAIL');
process.exit(pass ? 0 : 1);
