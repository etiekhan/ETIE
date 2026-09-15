-- Etie Phase 8 — minimal Supabase schema (one row per user, mirrors localStorage etie-v1)
-- Plain English: each logged-in user gets one JSON row. No per-message tables yet (keeps MVP simple).
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create table if not exists public.etie_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.etie_states enable row level security;

-- Users can only read/write their own row
drop policy if exists "own row read" on public.etie_states;
create policy "own row read" on public.etie_states
  for select using (auth.uid() = user_id);

drop policy if exists "own row write" on public.etie_states;
create policy "own row write" on public.etie_states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================
-- Etie Phase 8b — shared live tables (TWO PHONES see each other)
-- Plain English: requests/messages/meetups are now SHARED rows, not per-user JSON.
-- Run this whole file again in Supabase → SQL Editor → Run. Safe to re-run (if not exists).
-- After this, Phase 8's etie_states stays as backup; 8b adds live collaboration.
-- ==========================================

-- 1) Profiles: one row per user so travellers can discover REAL locals (not just mocks)
create table if not exists public.etie_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  age int,
  interests jsonb default '[]'::jsonb,
  personality jsonb default '{}'::jsonb,
  offer text,
  offer_tags jsonb default '[]'::jsonb,
  availability jsonb default '[]'::jsonb,
  verification jsonb default '{}'::jsonb,
  stats jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.etie_profiles enable row level security;
drop policy if exists "profiles read all auth" on public.etie_profiles;
create policy "profiles read all auth" on public.etie_profiles for select using (auth.uid() is not null);
drop policy if exists "profiles write own" on public.etie_profiles;
create policy "profiles write own" on public.etie_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Requests: the marketplace transaction (Send → Pending → Accepted/Declined)
-- local_mock_id keeps compatibility with current mock locals (local-marta etc.)
-- local_id is set when a REAL local user is the target (future: discover real locals)
create table if not exists public.etie_requests (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid not null references auth.users(id) on delete cascade,
  local_mock_id text not null,
  local_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('pending','accepted','declined','cancelled')),
  message text,
  destination text,
  dates text,
  traveller_name text,
  local_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(traveller_id, local_mock_id)
);
alter table public.etie_requests enable row level security;
drop policy if exists "requests read auth" on public.etie_requests;
create policy "requests read auth" on public.etie_requests for select using (auth.uid() is not null);
drop policy if exists "requests insert own traveller" on public.etie_requests;
create policy "requests insert own traveller" on public.etie_requests for insert with check (auth.uid() = traveller_id);
drop policy if exists "requests update participant" on public.etie_requests;
create policy "requests update participant" on public.etie_requests for update using (auth.uid() = traveller_id or auth.uid() = local_id or local_id is null) with check (auth.uid() = traveller_id or auth.uid() = local_id or local_id is null);
drop policy if exists "requests delete own" on public.etie_requests;
create policy "requests delete own" on public.etie_requests for delete using (auth.uid() = traveller_id);

-- 3) Messages: chat is per-request, unlocked only after accepted (enforced in app, not DB for demo)
create table if not exists public.etie_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.etie_requests(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('traveller','local')),
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.etie_messages enable row level security;
drop policy if exists "messages read auth" on public.etie_messages;
create policy "messages read auth" on public.etie_messages for select using (auth.uid() is not null);
drop policy if exists "messages insert auth" on public.etie_messages;
create policy "messages insert auth" on public.etie_messages for insert with check (auth.uid() = sender_id);
drop policy if exists "messages delete own" on public.etie_messages;
create policy "messages delete own" on public.etie_messages for delete using (auth.uid() = sender_id);

-- 4) Meetups: planned → completed (shared, both sides see same meetup)
create table if not exists public.etie_meetups (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.etie_requests(id) on delete cascade unique,
  activity text not null,
  when_text text not null,
  where_text text not null,
  status text not null check (status in ('planned','completed','cancelled')),
  with_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.etie_meetups enable row level security;
drop policy if exists "meetups read auth" on public.etie_meetups;
create policy "meetups read auth" on public.etie_meetups for select using (auth.uid() is not null);
drop policy if exists "meetups write auth" on public.etie_meetups;
create policy "meetups write auth" on public.etie_meetups for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- 5) Realtime: enable live updates for 8b tables (safe to re-run)
do $$ begin
  alter publication supabase_realtime add table public.etie_requests;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.etie_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.etie_meetups;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.etie_profiles;
exception when duplicate_object then null; end $$;

-- 6) Helper: auto-update updated_at
create or replace function public.etie_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists trg_etie_requests_touch on public.etie_requests;
create trigger trg_etie_requests_touch before update on public.etie_requests for each row execute function public.etie_touch_updated_at();
drop trigger if exists trg_etie_meetups_touch on public.etie_meetups;
create trigger trg_etie_meetups_touch before update on public.etie_meetups for each row execute function public.etie_touch_updated_at();
drop trigger if exists trg_etie_profiles_touch on public.etie_profiles;
create trigger trg_etie_profiles_touch before update on public.etie_profiles for each row execute function public.etie_touch_updated_at();

-- Later (Phase 9): tighten RLS from "auth is not null" to participant-only (traveller_id/local_id check with join)
-- Do this only after 2-phone demo is stable with open auth read.
