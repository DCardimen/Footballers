-- ============================================================================
-- Running It Back — Score Attack leaderboards (Supabase / Postgres)
-- Run this in the Supabase SQL editor. Boards: global all-time, weekly
-- (rolling 7 days via created_at), and per-position (filter on `pos`).
-- Anti-cheat (v1) is server-side: writes go ONLY through submit_score(), which
-- validates ranges, whitelists positions, clamps the name, and rate-limits.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.leaderboard (
  id          uuid primary key default gen_random_uuid(),
  user_id     text,                         -- platform/auth identity (null for anon)
  name        text not null,
  score       integer not null,
  pos         text not null,
  streak      integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists leaderboard_score_idx      on public.leaderboard (score desc);
create index if not exists leaderboard_created_idx     on public.leaderboard (created_at desc);
create index if not exists leaderboard_pos_score_idx   on public.leaderboard (pos, score desc);
create index if not exists leaderboard_user_time_idx   on public.leaderboard (user_id, created_at desc);

-- Row Level Security: anyone may READ the board; nobody may INSERT directly.
alter table public.leaderboard enable row level security;

drop policy if exists "read leaderboard" on public.leaderboard;
create policy "read leaderboard" on public.leaderboard
  for select using (true);

-- No insert/update/delete policies => direct writes are blocked. All writes must
-- go through submit_score() below (SECURITY DEFINER bypasses RLS after validating).

-- ---- server-validated submission ------------------------------------------
create or replace function public.submit_score(
  p_name   text,
  p_score  integer,
  p_pos    text,
  p_streak integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    text := coalesce(auth.uid()::text, null);
  v_name   text := left(coalesce(nullif(trim(p_name), ''), 'Player'), 16);
  v_recent int;
begin
  -- range + whitelist sanity checks (tune the ceiling to your real max game score)
  if p_score is null or p_score < 0 or p_score > 100000 then
    raise exception 'score out of range';
  end if;
  if p_pos not in ('QB','RB','WR','TE','LB','CB','S','DL') then
    raise exception 'invalid position';
  end if;
  if p_streak is null or p_streak < 0 or p_streak > 500 then
    raise exception 'streak out of range';
  end if;

  -- rate limit: max 20 submissions per identity per hour (only enforceable when signed in)
  if v_uid is not null then
    select count(*) into v_recent
      from public.leaderboard
     where user_id = v_uid and created_at > now() - interval '1 hour';
    if v_recent >= 20 then
      raise exception 'rate limit exceeded';
    end if;
  end if;

  insert into public.leaderboard (user_id, name, score, pos, streak)
  values (v_uid, v_name, p_score, p_pos, p_streak);
end;
$$;

-- allow the anon + authenticated roles to call the RPC (read is already open)
grant execute on function public.submit_score(text, integer, text, integer) to anon, authenticated;

-- Optional hardening / fast-follows:
--  * Require sign-in: change the guard to `if v_uid is null then raise exception ...`.
--  * Keep only each user's best: add a unique index and upsert on (user_id) instead.

-- ============================================================================
-- DAILY CHALLENGE board — server-REPLAY verified (near-uncheatable)
-- The daily challenge is fully deterministic, so the client submits only
-- (day_seed, choices) and the Edge Function `verify-daily` re-runs the engine,
-- computes the score itself, and inserts here. Direct writes are blocked; the
-- Edge Function writes with the service-role key (bypasses RLS).
-- ============================================================================
create table if not exists public.daily_leaderboard (
  id          uuid primary key default gen_random_uuid(),
  user_id     text,
  name        text not null,
  day_seed    integer not null,      -- YYYYMMDD (UTC)
  score       integer not null,
  choices     text,                  -- submitted form choices, for audit
  created_at  timestamptz not null default now(),
  unique (user_id, day_seed)         -- one attempt per player per day
);

create index if not exists daily_lb_day_score_idx on public.daily_leaderboard (day_seed, score desc);

alter table public.daily_leaderboard enable row level security;

drop policy if exists "read daily" on public.daily_leaderboard;
create policy "read daily" on public.daily_leaderboard
  for select using (true);
-- no insert/update/delete policy => only the service-role Edge Function may write.

-- Server replay verification: add p_seed + p_inputs, re-run the JS engine in an
-- Edge Function, and only insert if the recomputed score matches.
-- Reference implementation: supabase/functions/verify-daily/index.ts.
