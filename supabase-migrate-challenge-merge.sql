-- ============================================================
-- Merge: "For the Lore?" Challenge System on demo_challenge_* schema
-- Run in Supabase SQL Editor on a DEV project first.
-- ============================================================

-- 1. EXTEND demo_challenge_challenges with new columns
alter table public.demo_challenge_challenges add column if not exists challenge_prompt text;
alter table public.demo_challenge_challenges add column if not exists visibility text not null default 'public' check (visibility in ('public','friends'));
alter table public.demo_challenge_challenges add column if not exists expires_at timestamptz;
alter table public.demo_challenge_challenges add column if not exists winner_entry_id uuid references public.demo_challenge_challenge_entries(id) on delete set null;
alter table public.demo_challenge_challenges add column if not exists lat double precision;
alter table public.demo_challenge_challenges add column if not exists lng double precision;
alter table public.demo_challenge_challenges add column if not exists location text;
alter table public.demo_challenge_challenges add column if not exists photo_url text;
alter table public.demo_challenge_challenges add column if not exists creator_nickname text;

-- 2. EXTEND demo_challenge_challenge_entries with photo/location for map rendering
alter table public.demo_challenge_challenge_entries add column if not exists photo_url text;
alter table public.demo_challenge_challenge_entries add column if not exists location text;
alter table public.demo_challenge_challenge_entries add column if not exists lat double precision;
alter table public.demo_challenge_challenge_entries add column if not exists lng double precision;
alter table public.demo_challenge_challenge_entries add column if not exists caption text;

-- 3. CREATE challenge_reports table
create table if not exists public.demo_challenge_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.demo_challenge_challenge_entries(id) on delete cascade,
  challenge_id uuid not null references public.demo_challenge_challenges(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.demo_challenge_reports enable row level security;
drop policy if exists "challenge reports read own" on public.demo_challenge_reports;
create policy "challenge reports read own" on public.demo_challenge_reports for select using (auth.uid() = reporter_id);
drop policy if exists "challenge reports insert own" on public.demo_challenge_reports;
create policy "challenge reports insert own" on public.demo_challenge_reports for insert with check (auth.uid() = reporter_id);
create index if not exists demo_challenge_reports_challenge_idx on public.demo_challenge_reports(challenge_id);

-- 4. INDEXES for active challenges and entries
create index if not exists demo_challenge_challenges_active_idx on public.demo_challenge_challenges(status, expires_at);
create index if not exists demo_challenge_entries_challenge_idx on public.demo_challenge_challenge_entries(challenge_id);

-- 5. REALTIME for votes and reports
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='demo_challenge_reports') then
    alter publication supabase_realtime add table public.demo_challenge_reports;
  end if;
end $$;

-- 6. RLS for challenges (public read, insert own, update own)
drop policy if exists "ch read" on public.demo_challenge_challenges;
create policy "ch read" on public.demo_challenge_challenges for select using (true);

drop policy if exists "ch insert" on public.demo_challenge_challenges;
create policy "ch insert" on public.demo_challenge_challenges for insert with check (auth.uid() = creator_id);

drop policy if exists "ch update" on public.demo_challenge_challenges;
create policy "ch update" on public.demo_challenge_challenges for update using (auth.uid() = creator_id);

drop policy if exists "ch delete" on public.demo_challenge_challenges;
create policy "ch delete" on public.demo_challenge_challenges for delete using (auth.uid() = creator_id);

-- 7. RLS for entries (public read, insert own, delete own)
drop policy if exists "ce read" on public.demo_challenge_challenge_entries;
create policy "ce read" on public.demo_challenge_challenge_entries for select using (true);

drop policy if exists "ce insert" on public.demo_challenge_challenge_entries;
create policy "ce insert" on public.demo_challenge_challenge_entries for insert with check (auth.uid() = player_id);

drop policy if exists "ce delete" on public.demo_challenge_challenge_entries;
create policy "ce delete" on public.demo_challenge_challenge_entries for delete using (auth.uid() = player_id);

-- 8. RLS for votes (public read, insert/delete own)
drop policy if exists "cv read" on public.demo_challenge_challenge_votes;
create policy "cv read" on public.demo_challenge_challenge_votes for select using (true);

drop policy if exists "cv insert" on public.demo_challenge_challenge_votes;
create policy "cv insert" on public.demo_challenge_challenge_votes for insert with check (auth.uid() = voter_id);

drop policy if exists "cv delete" on public.demo_challenge_challenge_votes;
create policy "cv delete" on public.demo_challenge_challenge_votes for delete using (auth.uid() = voter_id);

-- 9. RLS for challenge_members (public read, insert/update own)
drop policy if exists "cm read" on public.demo_challenge_challenge_members;
create policy "cm read" on public.demo_challenge_challenge_members for select using (true);

drop policy if exists "cm insert" on public.demo_challenge_challenge_members;
create policy "cm insert" on public.demo_challenge_challenge_members for insert with check (auth.uid() = user_id);

drop policy if exists "cm update" on public.demo_challenge_challenge_members;
create policy "cm update" on public.demo_challenge_challenge_members for update using (auth.uid() = user_id);
