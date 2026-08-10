// ============================================================================
// Daily Challenge — CANONICAL deterministic engine.
//
// This is the single source of truth for the daily challenge resolution. It is
// pure and fully deterministic: given (daySeed, choices) it always returns the
// same result, in any JS runtime. That is what makes the daily leaderboard both
// FAIR (everyone plays the same seed each day) and CHEAT-PROOF (the server
// re-runs this exact logic to verify a submitted score — see scripts/replay.mjs
// and supabase/functions/verify-daily/).
//
// A byte-identical mirror is inlined in index.html (the `v48 DAILY CHALLENGE`
// block) so the game works without loading an external file; scripts/dailycheck.mjs
// cross-checks the browser copy against this one so they can never drift.
// If you change the algorithm here, change it there too.
// ============================================================================

export const ROUNDS = 5;

// mulberry32 — tiny, fast, seedable PRNG. Deterministic for a given 32-bit seed.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a hash over the string-joined args -> a 32-bit seed.
export function hashSeed(...args) {
  let h = 2166136261 >>> 0;
  const s = args.join("|");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// UTC calendar day as an integer YYYYMMDD — the shared per-day seed.
export function dayKey(ts) {
  const d = (ts == null) ? new Date() : new Date(ts);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// Rising "bar" shown as round context/flavor (r = 0..ROUNDS-1).
export function bar(r) { return 40 + r * 26; }

// Deterministic base game-score for a round (position-agnostic, band ~55..175).
export function roundBase(daySeed, r) {
  return Math.round(55 + mulberry32(hashSeed("base", daySeed, r))() * 120);
}

// Deterministic glory outcome roll for a round.
export function gloryRoll(daySeed, r) {
  return mulberry32(hashSeed("glory", daySeed, r))();
}

// Resolve a full daily run. `choices` is an array of "steady" | "glory".
// No elimination: everyone plays all ROUNDS so totals are directly comparable.
// Steady banks the base; Glory busts (0) on a bad roll, else pays 1.9x.
export function run(daySeed, choices) {
  let total = 0; const rounds = [];
  for (let r = 0; r < ROUNDS; r++) {
    const base = roundBase(daySeed, r);
    const form = (choices && choices[r] === "glory") ? "glory" : "steady";
    let sc;
    if (form === "glory") { sc = gloryRoll(daySeed, r) < 0.42 ? 0 : Math.round(base * 1.9); }
    else { sc = base; }
    total += sc;
    rounds.push({ r, bar: bar(r), base, form, sc, bust: form === "glory" && sc === 0 });
  }
  return { daySeed, total, rounds };
}

// Server-side check: does `claimed` match the deterministic recompute?
export function verify(daySeed, choices, claimed) {
  const res = run(daySeed, choices);
  return { ok: res.total === claimed, total: res.total };
}

export default { ROUNDS, mulberry32, hashSeed, dayKey, bar, roundBase, gloryRoll, run, verify };
