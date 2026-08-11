# Leaderboards — setup & architecture

Score Attack has online leaderboards behind a **pluggable backend**. The whole UI
and submit flow work offline against a local *mock* board today; you flip it to a
real online board by adding your Supabase keys. No engine/language change is
needed — the game (HTML/JS) just calls an API over HTTPS.

Chosen configuration: **Supabase** backend · **platform sign-in** (Game Center /
Play Games) identity · boards for **Global / Weekly / Per-position** ·
**server-side sanity-check** anti-cheat.

## How it's wired in the game (`v47 LEADERBOARDS` block in `index.html`)

- `window.__lb.submit({score,pos,streak})` — called from Score Attack's
  `persistBest()` when a run ends. Stamps the player's identity, sends to backend.
- `window.__lb.top({board,pos,limit})` — reads a board (`global` | `weekly` |
  `position`).
- `window.__lbRender(o)` — the Leaderboard screen (router `o.view === "leaderboard"`;
  reached from the menu and the Score Attack over-screen).
- **Backend is chosen at load:** if `window.__LB_CONFIG.url` is set → Supabase,
  else the local mock. **Identity** is `window.__LB_IDENTITY` if present (platform
  sign-in), else a local device id + handle.

## 1. Create the Supabase project + schema

1. Create a free project at supabase.com. Copy the **Project URL** and the
   **anon public** key (Settings → API). The anon key is safe to ship — Row
   Level Security protects the data.
2. Open the SQL editor and run [`supabase/schema.sql`](../supabase/schema.sql).
   It creates the `leaderboard` table, RLS (public read, no direct writes), and
   the validated `submit_score()` RPC.

## 2. Point the game at it

Add this **in `<head>` of `index.html`** (before the leaderboard block runs), or
serve it as `public/lb-config.js` and include it in `<head>`:

```html
<script>
  window.__LB_CONFIG = {
    url: "https://YOUR-PROJECT.supabase.co",
    anonKey: "YOUR-ANON-PUBLIC-KEY",
    // when signed in, return the user's Supabase access token so submits are attributed:
    getAuthToken: async () => window.__supabaseSession?.access_token || null
  };
</script>
```

With that present, the board goes online automatically and the "Local demo
board" warning disappears. (Leave it out to keep using the offline mock — handy
for development.)

## 3. Platform sign-in → Supabase bridge (identity)

Supabase doesn't natively speak Game Center / Play Games, so you sign in
natively and hand that identity to Supabase:

1. Add a Capacitor sign-in plugin (e.g. a Game Center plugin on iOS and
   `@codetrix-studio/capacitor-google-auth` / Play Games on Android).
2. In an **Edge Function**, verify the platform token and mint a Supabase session
   (or use Supabase Auth's OIDC/native flows). Store the session so
   `getAuthToken()` above can return `access_token`.
3. Expose the signed-in identity to the game:

```js
window.__LB_IDENTITY = async () => {
  const u = window.__supabaseUser;              // set after your sign-in flow
  return { id: u.id, name: u.user_metadata?.display_name || "Player" };
};
```

Until this is wired, the game falls back to a local device id + a handle the
player sets on the Leaderboard screen — fully functional for testing.

## 4. Anti-cheat

**v1 (shipped in `submit_score`)**: server rejects impossible scores, whitelists
positions, clamps names, and rate-limits per signed-in user. Good enough to
launch. Note: rate-limiting only bites when players are signed in — another
reason to require platform sign-in before writing to the board.

**Daily Challenge — server replay verification (near-uncheatable, SHIPPED in v48).**
The endless mode's live engine is non-deterministic, so it can't be replayed. The
**Daily Challenge** solves this with a purpose-built deterministic engine
(`scripts/daily-engine.mjs`, mirrored inline in `index.html`): everyone gets the
same UTC-day seed and the only input is the player's Steady/Glory choices. The
client submits only `(day_seed, choices)` — never a score. The
[`verify-daily`](../supabase/functions/verify-daily/index.ts) Edge Function
re-runs the identical engine, computes the score itself, and inserts to
`daily_leaderboard`. A forged client can't inflate anything.

- Run the anti-cheat locally: `node scripts/replay.mjs` (self-test) or
  `node scripts/replay.mjs <seed> <choices> <claimed>` to verify one submission.
- Deploy the function: `supabase functions deploy verify-daily`. It needs
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in the function env (writes bypass
  RLS; the caller's JWT attributes `user_id` and enforces one-attempt-per-day).
- **Keep the three engine copies in sync** (`daily-engine.mjs`, the inline mirror
  in `index.html`, and the TS port in the Edge Function). `scripts/dailycheck.mjs`
  guards browser↔Node parity across a 160-case matrix.

The same pattern can later verify endless Score Attack too — but only if the core
`__simGameV2` engine is made seed-deterministic (a larger change, deliberately
avoided for now).

## Testing locally

- `node scripts/lbcheck.mjs` — drives the mock board end-to-end: a Score Attack
  run submits, the board shows it, tabs (Global/Weekly/Position) switch, name
  change persists, no JS errors.
- The mock board seeds ~24 believable entries on first use so it looks alive in
  screenshots/demos. Clear it with `localStorage.removeItem('rib_lb_entries')`.
