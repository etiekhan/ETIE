-- Etie hangout photo logs with time-window verification + co-tagging — run once in SQL Editor
create table if not exists public.hangout_logs (
  id uuid primary key default gen_random_uuid(),
  hook_id text not null,
  user_id uuid references auth.users(id) on delete cascade,
  nickname text not null default 'Someone',
  photo_url text not null default '',
  activity text not null default '',
  taken_at timestamptz not null default now(),
  is_live_verified boolean not null default false,
  -- Co-tagging fields
  tagged_user_id uuid references auth.users(id) on delete set null,
  tagged_nickname text,
  status text not null default 'pending' check (status in ('pending','confirmed','expired')),
  handshake_note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.hangout_logs enable row level security;
drop policy if exists "hangout logs read all" on public.hangout_logs;
create policy "hangout logs read all" on public.hangout_logs for select using (true);
drop policy if exists "hangout logs insert auth" on public.hangout_logs;
create policy "hangout logs insert auth" on public.hangout_logs for insert with check (auth.uid() is not null);
drop policy if exists "hangout logs delete own" on public.hangout_logs;
create policy "hangout logs delete own" on public.hangout_logs for delete using (auth.uid() = user_id);
create index if not exists hangout_logs_hook_idx on public.hangout_logs(hook_id, taken_at desc);
create index if not exists hangout_logs_user_idx on public.hangout_logs(user_id, taken_at desc);
create index if not exists hangout_logs_tagged_idx on public.hangout_logs(tagged_user_id, status);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='hangout_logs') then
    alter publication supabase_realtime add table public.hangout_logs;
  end if;
end $$;

-- Add co-tagging columns to existing table
alter table public.hangout_logs add column if not exists tagged_user_id uuid references auth.users(id) on delete set null;
alter table public.hangout_logs add column if not exists tagged_nickname text;
alter table public.hangout_logs add column if not exists status text not null default 'pending' check (status in ('pending','confirmed','expired'));
alter table public.hangout_logs add column if not exists handshake_note text;
alter table public.hangout_logs add column if not exists confirmed_at timestamptz;
create index if not exists hangout_logs_tagged_idx on public.hangout_logs(tagged_user_id, status);