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
  activity_hook text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  title text not null default '',
  capacity int not null default 3,
  expires_at timestamptz,
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
alter table public.hooks add column if not exists activity_hook text not null default '';
alter table public.hooks add column if not exists starts_at timestamptz;
alter table public.hooks add column if not exists ends_at timestamptz;
alter table public.hooks add column if not exists title text not null default '';
alter table public.hooks add column if not exists capacity int not null default 3;
alter table public.hooks add column if not exists expires_at timestamptz;
create index if not exists hooks_updated_idx on public.hooks(updated_at desc);
create index if not exists hooks_role_idx on public.hooks(role);
create index if not exists hooks_category_idx on public.hooks(category);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='hooks') then
    alter publication supabase_realtime add table public.hooks;
  end if;
end $$;
