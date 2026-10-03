-- ETIE hooks table — bring any older version up to date (safe to run repeatedly)
-- Run once in Supabase Dashboard → SQL Editor on the v2 project, then drop a new pin.
alter table public.hooks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.hooks add column if not exists nickname text not null default 'Someone';
alter table public.hooks add column if not exists verified boolean not null default false;
alter table public.hooks add column if not exists role text not null default 'traveller';
alter table public.hooks add column if not exists derived_role text not null default 'traveller';
alter table public.hooks add column if not exists category text not null default 'Food';
alter table public.hooks add column if not exists location text not null default 'Hong Kong';
alter table public.hooks add column if not exists lat double precision;
alter table public.hooks add column if not exists lng double precision;
alter table public.hooks add column if not exists content text not null default '';
alter table public.hooks add column if not exists activity_hook text not null default '';
alter table public.hooks add column if not exists starts_at timestamptz;
alter table public.hooks add column if not exists ends_at timestamptz;
alter table public.hooks add column if not exists title text not null default '';
alter table public.hooks add column if not exists capacity int not null default 3;
alter table public.hooks add column if not exists expires_at timestamptz;
alter table public.hooks add column if not exists members jsonb not null default '[]'::jsonb;
alter table public.hooks add column if not exists pending jsonb not null default '[]'::jsonb;
alter table public.hooks add column if not exists requests jsonb not null default '[]'::jsonb;
alter table public.hooks add column if not exists spots_available int;
alter table public.hooks add column if not exists status text not null default 'open';
alter table public.hooks add column if not exists created_at timestamptz not null default now();
alter table public.hooks add column if not exists updated_at timestamptz not null default now();
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
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='hooks') then
    alter publication supabase_realtime add table public.hooks;
  end if;
end $$;
