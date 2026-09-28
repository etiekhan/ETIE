-- ============================================================
-- ETIE new-project setup — RUN ONCE in the new project's SQL Editor
-- (Supabase Dashboard → SQL Editor → New query → paste ALL → Run)
-- Safe to re-run. After this: Auth → Providers → Google (paste ID+secret),
-- Auth → URL Configuration (Site URL + Redirects), Storage bucket exists via §6.
-- ============================================================

-- ===== 1/6 base tables (states, profiles, requests, messages, meetups) =====
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

-- ===== 2/6 reviews + reports =====
-- Phase 2: Reviews, Reports, Photo Storage
-- Run in Supabase SQL Editor AFTER existing schema
-- Fully idempotent: safe to re-run

-- 1. Reviews (both sides, linked to request)
create table if not exists public.etie_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.etie_requests(id) on delete cascade,
  traveller_id uuid not null references auth.users(id) on delete cascade,
  local_id uuid not null references auth.users(id) on delete cascade,
  trav_rating int check (trav_rating >= 1 and trav_rating <= 5),
  trav_meet_again text check (trav_meet_again in ('Definitely', 'Maybe', 'No')),
  trav_highlights text[],
  trav_private_text text,
  local_rating int check (local_rating >= 1 and local_rating <= 5),
  local_meet_again text check (local_meet_again in ('Definitely', 'Maybe', 'No')),
  local_highlights text[],
  local_private_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Safety reports
create table if not exists public.etie_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.etie_requests(id) on delete set null,
  category text not null check (category in ('harassment', 'unsafe', 'no-show', 'fake', 'other')),
  details text not null,
  status text default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Updated_at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists etie_reviews_updated_at on public.etie_reviews;
drop trigger if exists etie_reports_updated_at on public.etie_reports;
create trigger etie_reviews_updated_at before update on public.etie_reviews
for each row execute function public.set_updated_at();
create trigger etie_reports_updated_at before update on public.etie_reports
for each row execute function public.set_updated_at();

-- 4. RLS Policies (drop first for idempotency)

-- Reviews
alter table public.etie_reviews enable row level security;

drop policy if exists review_participants_read on public.etie_reviews;
drop policy if exists traveller_write_own on public.etie_reviews;
drop policy if exists local_write_own on public.etie_reviews;
drop policy if exists traveller_update_own on public.etie_reviews;
drop policy if exists local_update_own on public.etie_reviews;

create policy "review_participants_read" on public.etie_reviews
for select using (auth.uid() = traveller_id or auth.uid() = local_id);

create policy "traveller_write_own" on public.etie_reviews
for insert with check (auth.uid() = traveller_id);

create policy "local_write_own" on public.etie_reviews
for insert with check (auth.uid() = local_id);

create policy "traveller_update_own" on public.etie_reviews
for update using (auth.uid() = traveller_id);

create policy "local_update_own" on public.etie_reviews
for update using (auth.uid() = local_id);

-- Reports
alter table public.etie_reports enable row level security;

drop policy if exists reporter_read_write on public.etie_reports;
drop policy if exists reported_read on public.etie_reports;

create policy "reporter_read_write" on public.etie_reports
for all using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);

create policy "reported_read" on public.etie_reports
for select using (auth.uid() = reported_id);

-- 5. Realtime publication (idempotent via exception handling)
do $$
begin
  alter publication supabase_realtime add table public.etie_reviews;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.etie_reports;
exception when duplicate_object then null;
end $$;

-- 6. Indexes
create index if not exists etie_reviews_request_idx on public.etie_reviews(request_id);
create index if not exists etie_reviews_traveller_idx on public.etie_reviews(traveller_id);
create index if not exists etie_reviews_local_idx on public.etie_reviews(local_id);
create index if not exists etie_reports_request_idx on public.etie_reports(request_id);
create index if not exists etie_reports_reporter_idx on public.etie_reports(reporter_id);
create index if not exists etie_reports_reported_idx on public.etie_reports(reported_id);
-- ===== 3/6 profile columns =====
-- Etie — add missing profile columns (run once in SQL Editor)
alter table public.etie_profiles add column if not exists nationality text default 'PT';
alter table public.etie_profiles add column if not exists tier text default 'Rookie';
alter table public.etie_profiles add column if not exists hosted_count int default 0;
alter table public.etie_profiles add column if not exists avg_host_rating numeric default 0;
alter table public.etie_profiles add column if not exists "references" jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists activities jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists avail_dates jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists travel_photos jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists social_vibe int default 1;
alter table public.etie_profiles add column if not exists travel_pace int default 1;
alter table public.etie_profiles add column if not exists style_interests jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists traveller_nationality text default 'HK';
alter table public.etie_profiles add column if not exists district text default 'Central / Soho';
-- ===== 4/6 hooks table =====
-- Etie map-first hooks table — run once in Supabase SQL Editor
-- Replaces etie_pins (leave that table in place; it holds no live data).
create table if not exists public.hooks (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  nickname text not null default 'Someone',
  verified boolean not null default false,
  role text not null default 'traveller',
  derived_role text not null default 'traveller',
  category text not null default 'Food',
  location text not null default 'Hong Kong',
  lat double precision not null,
  lng double precision not null,
  content text not null default '',
  members jsonb not null default '[]'::jsonb,
  pending jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.hooks enable row level security;
drop policy if exists "hooks read all" on public.hooks;
create policy "hooks read all" on public.hooks for select using (true);
drop policy if exists "hooks insert auth" on public.hooks;
create policy "hooks insert auth" on public.hooks for insert with check (auth.uid() is not null);
drop policy if exists "hooks update own" on public.hooks;
create policy "hooks update own" on public.hooks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "hooks delete own" on public.hooks;
create policy "hooks delete own" on public.hooks for delete using (auth.uid() = user_id);
create index if not exists hooks_updated_idx on public.hooks(updated_at desc);
create index if not exists hooks_role_idx on public.hooks(role);
create index if not exists hooks_category_idx on public.hooks(category);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='hooks') then
    alter publication supabase_realtime add table public.hooks;
  end if;
end $$;

-- ===== 5/6 hook chat messages table =====
-- Etie hook group chat — run once in Supabase SQL Editor
-- Creates the `messages` table for per-hook chat (hook_id) with realtime.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  hook_id text not null,
  sender_id uuid references auth.users(id) on delete cascade,
  sender_nick text not null default 'Someone',
  sender_role text not null default 'traveller',
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "hook messages read auth" on public.messages;
create policy "hook messages read auth" on public.messages for select using (auth.uid() is not null);
drop policy if exists "hook messages insert own" on public.messages;
create policy "hook messages insert own" on public.messages for insert with check (auth.uid() = sender_id);
create index if not exists messages_hook_idx on public.messages(hook_id, created_at);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- ===== 6/6 photo storage (bucket + policies) =====
insert into storage.buckets (id, name, public) values ('etie-photos','etie-photos',false) on conflict (id) do nothing;
drop policy if exists "users_upload_own_photos" on storage.objects;
drop policy if exists "users_read_own_photos" on storage.objects;
drop policy if exists "matched_users_read_photos" on storage.objects;
-- Policy: users can upload to their own folder
create policy "users_upload_own_photos" on storage.objects
for insert with check (
  bucket_id = 'etie-photos' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: users can read their own photos
create policy "users_read_own_photos" on storage.objects
for select using (
  bucket_id = 'etie-photos' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: users can read photos of users they have a match with
-- (requires a function to check match, simplified for now)
create policy "matched_users_read_photos" on storage.objects
for select using (
  bucket_id = 'etie-photos' and
  exists (
    select 1 from public.etie_requests r
    where r.id::text = (storage.foldername(name))[1]
    and (r.traveller_id = auth.uid() or r.local_id = auth.uid())
    and r.status = 'accepted'
  )
);