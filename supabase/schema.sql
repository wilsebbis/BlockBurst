-- Block Burst: optional cloud tables. The game runs fully offline without them.
-- Mirrors Cluck Crossing's, AntLink's and Bark Battle's approach: scores are only listed after a server replays
-- the move log with the same rules and tray generator.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 16),
  created_at timestamptz not null default now()
);

-- Daily Board and ranked Classic games. A server function (an Edge Function running src/engine/RunLog.ts
-- verifyRun with the same rules and generator) replays `move_log`, recomputes the SHA-256 hash chain over
-- (rules version | mode | seed | level | moves), checks score, lines and a minimum time per move, and only then
-- flips `verified`. Games with hints are stored and labelled, and never count for ranks.
create table if not exists public.runs (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.profiles on delete cascade,
  mode text not null check (mode in ('daily', 'classic')),
  seed text not null,
  day date,
  score integer not null check (score >= 0),
  lines integer not null check (lines >= 0),
  time_ms integer not null check (time_ms > 0),
  hinted boolean not null default false,
  move_log text not null check (move_log ~ '^([0-2][0-7][0-7])*$'),
  log_hash char(64) not null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  check ((mode = 'daily') = (day is not null))
);

create index if not exists runs_daily on public.runs (day, score desc) where verified and mode = 'daily';

-- Each player's best verified Daily Board score per day.
create or replace view public.daily_board as
  select distinct on (r.day, r.player_id) r.day, p.display_name, r.score, r.hinted
  from public.runs r join public.profiles p on p.id = r.player_id
  where r.verified and r.mode = 'daily'
  order by r.day, r.player_id, r.score desc;

-- Ranks: RP per player per season, moved only by verified, hint-free Classic games (src/lib/ranks.ts).
create table if not exists public.rank_seasons (
  player_id uuid not null references public.profiles on delete cascade,
  season text not null check (season ~ '^r\d+$'),
  rp integer not null default 0 check (rp >= 0),
  peak integer not null default 0 check (peak >= 0),
  primary key (player_id, season)
);

-- Weekly leagues: XP per player per ISO week. Groups of 30 are assigned server-side; nobody is ever relegated.
create table if not exists public.league_weeks (
  player_id uuid not null references public.profiles on delete cascade,
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  tier smallint not null default 0 check (tier between 0 and 6),
  group_id integer,
  xp integer not null default 0 check (xp >= 0),
  primary key (player_id, week)
);

-- Crews (clans): up to 10 members. No kick column, no roles that can remove anyone, no minimums.
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 22),
  emblem text not null,
  motto text not null default '' check (char_length(motto) <= 60),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews on delete cascade,
  player_id uuid not null references public.profiles on delete cascade unique,
  joined_at timestamptz not null default now(),
  primary key (crew_id, player_id)
);

-- The weekly pool is stored per crew only. Individual contributions are deliberately not kept, so there is
-- nothing to rank members by.
create table if not exists public.crew_pool (
  crew_id uuid not null references public.crews on delete cascade,
  week text not null check (week ~ '^\d{4}-W\d{2}$'),
  xp integer not null default 0 check (xp >= 0),
  primary key (crew_id, week)
);

-- Quick chat: a phrase index into the fixed list in src/lib/crews.ts. There is no free-text column.
create table if not exists public.crew_chat (
  id bigint generated always as identity primary key,
  crew_id uuid not null references public.crews on delete cascade,
  player_id uuid not null references public.profiles on delete cascade,
  phrase smallint not null check (phrase between 0 and 9),
  created_at timestamptz not null default now()
);

create or replace function public.enforce_crew_size() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.crew_members where crew_id = new.crew_id) >= 10 then
    raise exception 'This crew is full (10 members).';
  end if;
  return new;
end $$;

drop trigger if exists crew_size on public.crew_members;
create trigger crew_size before insert on public.crew_members for each row execute function public.enforce_crew_size();

-- Mirror a share of XP into the caller's crew pool. Clamped, and only for the caller's own crew.
create or replace function public.crew_contribute(p_crew uuid, p_week text, p_xp integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from crew_members where crew_id = p_crew and player_id = auth.uid()) then
    raise exception 'not a member';
  end if;
  insert into crew_pool (crew_id, week, xp) values (p_crew, p_week, least(greatest(p_xp, 0), 500))
  on conflict (crew_id, week) do update set xp = crew_pool.xp + excluded.xp;
end $$;

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.rank_seasons enable row level security;
alter table public.league_weeks enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_pool enable row level security;
alter table public.crew_chat enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "verified runs are public" on public.runs for select using (verified or auth.uid() = player_id);
create policy "submit own run" on public.runs for insert with check (auth.uid() = player_id and verified = false);
create policy "ranks are readable" on public.rank_seasons for select using (true);
create policy "leagues are readable" on public.league_weeks for select using (true);
create policy "crews are readable" on public.crews for select using (true);
create policy "anyone can start a crew" on public.crews for insert with check (auth.uid() is not null);
create policy "members are readable" on public.crew_members for select using (true);
create policy "join for yourself" on public.crew_members for insert with check (auth.uid() = player_id);
-- Leaving is the only delete, and only of yourself: nobody can remove anyone else.
create policy "leave for yourself" on public.crew_members for delete using (auth.uid() = player_id);
create policy "pools are readable" on public.crew_pool for select using (true);
create policy "members read chat" on public.crew_chat for select using (exists (select 1 from public.crew_members m where m.crew_id = crew_chat.crew_id and m.player_id = auth.uid()));
create policy "members post phrases" on public.crew_chat for insert with check (auth.uid() = player_id and exists (select 1 from public.crew_members m where m.crew_id = crew_chat.crew_id and m.player_id = auth.uid()));
