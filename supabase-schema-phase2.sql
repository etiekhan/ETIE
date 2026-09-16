-- Phase 2: Reviews, Reports, Photo Storage
-- Run in Supabase SQL Editor AFTER existing schema

-- 1. Reviews (both sides, linked to request)
create table if not exists public.etie_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.etie_requests(id) on delete cascade,
  traveller_id uuid not null references auth.users(id) on delete cascade,
  local_id uuid not null references auth.users(id) on delete cascade,
  -- Traveller's review of local
  trav_rating int check (trav_rating >= 1 and trav_rating <= 5),
  trav_meet_again text check (trav_meet_again in ('Definitely', 'Maybe', 'No')),
  trav_highlights text[],
  trav_private_text text,
  -- Local's review of traveller
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

create trigger etie_reviews_updated_at before update on public.etie_reviews
for each row execute function public.set_updated_at();

create trigger etie_reports_updated_at before update on public.etie_reports
for each row execute function public.set_updated_at();

-- 4. RLS Policies

-- Reviews: participants can read/write their own review
alter table public.etie_reviews enable row level security;

create policy "review_participants_read" on public.etie_reviews
for select using (
  auth.uid() = traveller_id or auth.uid() = local_id
);

create policy "traveller_write_own" on public.etie_reviews
for insert with check (auth.uid() = traveller_id);

create policy "local_write_own" on public.etie_reviews
for insert with check (auth.uid() = local_id);

create policy "traveller_update_own" on public.etie_reviews
for update using (auth.uid() = traveller_id);

create policy "local_update_own" on public.etie_reviews
for update using (auth.uid() = local_id);

-- Reports: reporter can read/write, reported can read, admins (service role) can do everything
alter table public.etie_reports enable row level security;

create policy "reporter_read_write" on public.etie_reports
for all using (auth.uid() = reporter_id) with check (auth.uid() = reporter_id);

create policy "reported_read" on public.etie_reports
for select using (auth.uid() = reported_id);

-- 5. Realtime publication
alter publication supabase_realtime add table public.etie_reviews, public.etie_reports;

-- 6. Indexes for common queries
create index if not exists etie_reviews_request_idx on public.etie_reviews(request_id);
create index if not exists etie_reviews_traveller_idx on public.etie_reviews(traveller_id);
create index if not exists etie_reviews_local_idx on public.etie_reviews(local_id);
create index if not exists etie_reports_request_idx on public.etie_reports(request_id);
create index if not exists etie_reports_reporter_idx on public.etie_reports(reporter_id);
create index if not exists etie_reports_reported_idx on public.etie_reports(reported_id);