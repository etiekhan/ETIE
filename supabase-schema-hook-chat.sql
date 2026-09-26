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
