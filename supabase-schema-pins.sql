-- Etie map-first hooks — run once in Supabase SQL Editor
create table if not exists public.etie_pins (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  nickname text not null default 'Someone',
  verified boolean not null default false,
  role text not null default 'traveller',
  category text not null default 'Food',
  location text not null default 'Hong Kong',
  lat double precision not null,
  lng double precision not null,
  hook text not null default '',
  members jsonb not null default '[]'::jsonb,
  pending jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.etie_pins enable row level security;
drop policy if exists "pins read all" on public.etie_pins;
create policy "pins read all" on public.etie_pins for select using (true);
drop policy if exists "pins insert auth" on public.etie_pins;
create policy "pins insert auth" on public.etie_pins for insert with check (auth.uid() is not null);
drop policy if exists "pins update own" on public.etie_pins;
create policy "pins update own" on public.etie_pins for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "pins delete own" on public.etie_pins;
create policy "pins delete own" on public.etie_pins for delete using (auth.uid() = user_id);
create index if not exists etie_pins_updated_idx on public.etie_pins(updated_at desc);
create index if not exists etie_pins_role_idx on public.etie_pins(role);
create index if not exists etie_pins_category_idx on public.etie_pins(category);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='etie_pins') then
    alter publication supabase_realtime add table public.etie_pins;
  end if;
end $$;
