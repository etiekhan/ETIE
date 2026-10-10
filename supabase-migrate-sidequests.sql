-- ETIE sidequest of the week (safe to run repeatedly)
-- Run once in Supabase Dashboard → SQL Editor.
-- Admin publishes one live quest from the Admin panel; the app reads it.
create table if not exists public.sidequests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  descr text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.sidequests enable row level security;
drop policy if exists "sidequests read all" on public.sidequests;
create policy "sidequests read all" on public.sidequests for select using (true);
drop policy if exists "sidequests write auth" on public.sidequests;
create policy "sidequests write auth" on public.sidequests for insert with check (auth.uid() is not null);
drop policy if exists "sidequests update auth" on public.sidequests;
create policy "sidequests update auth" on public.sidequests for update using (auth.uid() is not null) with check (auth.uid() is not null);
create index if not exists sidequests_active_idx on public.sidequests(is_active, created_at desc);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='sidequests') then
    alter publication supabase_realtime add table public.sidequests;
  end if;
end $$;
