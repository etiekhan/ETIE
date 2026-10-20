-- etie_requests table for shared requests/meetups
-- Run once in Supabase SQL Editor

create table if not exists public.etie_requests (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid not null references auth.users(id) on delete cascade,
  local_mock_id text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.etie_requests enable row level security;

drop policy if exists "requests read own" on public.etie_requests;
create policy "requests read own" on public.etie_requests for select using (auth.uid() = traveller_id);

drop policy if exists "requests write own" on public.etie_requests;
create policy "requests write own" on public.etie_requests for all using (auth.uid() = traveller_id) with check (auth.uid() = traveller_id);

create unique index if not exists etie_requests_unique on public.etie_requests(traveller_id, local_mock_id);

-- Idempotent realtime add
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='etie_requests') then
    alter publication supabase_realtime add table public.etie_requests;
  end if;
end $$;
