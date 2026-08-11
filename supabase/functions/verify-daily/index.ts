// Supabase Edge Function: verify-daily
// Server-replay anti-cheat for the daily challenge. The client sends ONLY
// (day_seed, choices, name) — never a score. This function re-runs the SAME
// deterministic engine, computes the score itself, and inserts the result. A
// forged/tampered client can't inflate anything because the score is never
// trusted from the client.
//
// The engine below is a Deno/TS mirror of scripts/daily-engine.mjs (and the copy
// inlined in index.html). Keep all three in sync — scripts/dailycheck.mjs and
// scripts/replay.mjs guard the JS copies; if you change the algorithm, change it
// here too.
//
// Deploy:
//   supabase functions deploy verify-daily --no-verify-jwt=false
// (uses the project's SERVICE_ROLE key from the function env to write, bypassing
//  RLS; reads the caller's auth from the Authorization header to attribute user_id.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ROUNDS = 5;

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(...args: (string | number)[]) {
  let h = 2166136261 >>> 0;
  const s = args.join("|");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function roundBase(daySeed: number, r: number) {
  return Math.round(55 + mulberry32(hashSeed("base", daySeed, r))() * 120);
}
function gloryRoll(daySeed: number, r: number) {
  return mulberry32(hashSeed("glory", daySeed, r))();
}
function runDaily(daySeed: number, choices: string[]) {
  let total = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const base = roundBase(daySeed, r);
    const form = choices && choices[r] === "glory" ? "glory" : "steady";
    total += form === "glory" ? (gloryRoll(daySeed, r) < 0.42 ? 0 : Math.round(base * 1.9)) : base;
  }
  return total;
}

function utcDayKey(): number {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  try {
    const { day_seed, choices, name } = await req.json();

    // --- validate shape ---
    if (!Array.isArray(choices) || choices.length !== ROUNDS) return json({ ok: false, error: "bad choices" }, 400);
    if (typeof day_seed !== "number") return json({ ok: false, error: "bad seed" }, 400);
    // only accept submissions for TODAY's seed (no back-dating old boards)
    if (day_seed !== utcDayKey()) return json({ ok: false, error: "stale seed" }, 400);

    // --- server computes the score (client value, if any, is ignored) ---
    const score = runDaily(day_seed, choices);

    // --- identity from the caller's JWT (platform sign-in bridged to Supabase) ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let userId: string | null = null;
    const jwt = authHeader.replace("Bearer ", "");
    if (jwt) { const { data } = await admin.auth.getUser(jwt); userId = data.user?.id ?? null; }
    if (!userId) return json({ ok: false, error: "sign-in required" }, 401); // require identity for one-per-day + rate limit

    const cleanName = String(name ?? "Player").trim().slice(0, 16) || "Player";

    // --- one attempt per user per day: insert, ignore if it already exists ---
    const { error } = await admin.from("daily_leaderboard")
      .upsert({ user_id: userId, name: cleanName, day_seed, score, choices: choices.join("") },
              { onConflict: "user_id,day_seed", ignoreDuplicates: true });
    if (error) return json({ ok: false, error: error.message }, 500);

    return json({ ok: true, score });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
