-- "For the Lore?" Challenge System — user-driven sidequest challenges
-- Run once in Supabase SQL Editor
--
-- Visibility on challenges uses the existing `visibility` column on hangout_logs:
--   'public'      = citywide (anyone can see/vote)
--   'connections' = friends only (connections + tagged people)
-- Root challenges: is_sidequest = true, parent_challenge_id = null
-- Entries: parent_challenge_id = root challenge id
-- Winner: computed at read time (≥1 vote required, ties by earliest submission)

-- 1. Extend hangout_logs with sidequest challenge fields
alter table public.hangout_logs add column if not exists is_sidequest boolean not null default false;
alter table public.hangout_logs add column if not exists challenge_prompt text;
alter table public.hangout_logs add column if not exists parent_challenge_id uuid references public.hangout_logs(id) on delete cascade;
alter table public.hangout_logs add column if not exists challenge_expires_at timestamptz;

create index if not exists hangout_logs_sidequest_idx on public.hangout_logs(is_sidequest, challenge_expires_at);
create index if not exists hangout_logs_parent_challenge_idx on public.hangout_logs(parent_challenge_id);

-- 2. Votes table: 1 vote per user per entry
create table if not exists public.sidequest_votes (
  id uuid primary key default gen_random_uuid(),
  entry_memory_id uuid not null references public.hangout_logs(id) on delete cascade,
  challenge_id uuid not null references public.hangout_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(entry_memory_id, user_id)
);

alter table public.sidequest_votes enable row level security;

drop policy if exists "sidequest votes read all" on public.sidequest_votes;
create policy "sidequest votes read all" on public.sidequest_votes for select using (true);

drop policy if exists "sidequest votes insert own" on public.sidequest_votes;
create policy "sidequest votes insert own" on public.sidequest_votes for insert with check (auth.uid() = user_id);

drop policy if exists "sidequest votes delete own" on public.sidequest_votes;
create policy "sidequest votes delete own" on public.sidequest_votes for delete using (auth.uid() = user_id);

create index if not exists sidequest_votes_entry_idx on public.sidequest_votes(entry_memory_id);
create index if not exists sidequest_votes_challenge_idx on public.sidequest_votes(challenge_id);

-- 3. Challenge reports (lightweight, separate from memory reports)
create table if not exists public.challenge_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  entry_memory_id uuid not null references public.hangout_logs(id) on delete cascade,
  challenge_id uuid not null references public.hangout_logs(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now()
);

alter table public.challenge_reports enable row level security;

-- Reporter reads own reports
drop policy if exists "challenge reports read own" on public.challenge_reports;
create policy "challenge reports read own" on public.challenge_reports
  for select using (auth.uid() = reporter_id);

-- Reporter inserts
drop policy if exists "challenge reports insert own" on public.challenge_reports;
create policy "challenge reports insert own" on public.challenge_reports
  for insert with check (auth.uid() = reporter_id);

-- Admin reads all (for admin panel)
drop policy if exists "challenge reports admin read" on public.challenge_reports;
create policy "challenge reports admin read" on public.challenge_reports
  for select using (
    exists (
      select 1 from auth.users
      where id = auth.uid() and email = 'kan.ethan.cy@gmail.com'
    )
  );

create index if not exists challenge_reports_challenge_idx on public.challenge_reports(challenge_id);
create index if not exists challenge_reports_status_idx on public.challenge_reports(status, created_at desc);

-- 4. Realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='sidequest_votes') then
    alter publication supabase_realtime add table public.sidequest_votes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='challenge_reports') then
    alter publication supabase_realtime add table public.challenge_reports;
  end if;
end $$;
