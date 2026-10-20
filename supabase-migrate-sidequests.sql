-- Sidequest of the Week table + RLS + realtime
-- Run once in Supabase SQL Editor

create table if not exists public.sidequests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  reward_xp int not null default 0,
  reward_badge text,
  image_url text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.sidequests enable row level security;

drop policy if exists "sidequests read all" on public.sidequests;
create policy "sidequests read all" on public.sidequests for select using (true);

drop policy if exists "sidequests admin write" on public.sidequests;
create policy "sidequests admin write" on public.sidequests for all using (
  auth.jwt() ->> 'email' in ('your-admin-email@example.com')
) with check (
  auth.jwt() ->> 'email' in ('your-admin-email@example.com')
);

-- If you don't have a specific admin email yet, use this more permissive version temporarily:
-- create policy "sidequests admin write" on public.sidequests for all using (auth.uid() is not null) with check (auth.uid() is not null);

create index if not exists sidequests_active_idx on public.sidequests(is_active, starts_at, ends_at);

alter publication supabase_realtime add table public.sidequests;