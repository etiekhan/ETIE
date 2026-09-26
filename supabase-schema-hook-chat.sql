-- Etie hook group chat — run once in Supabase SQL Editor
create table if not exists public.etie_hook_messages (
  id uuid primary key default gen_random_uuid(),
  hook_id text not null,
  sender_id uuid references auth.users(id) on delete cascade,
  sender_nick text not null default 'Someone',
  sender_role text not null default 'traveller',
  text text not null,
  created_at timestamptz not null default now()
);
alter table public.etie_hook_messages enable row level security;
drop policy if exists "hook messages read auth" on public.etie_hook_messages;
create policy "hook messages read auth" on public.etie_hook_messages for select using (auth.uid() is not null);
drop policy if exists "hook messages insert own" on public.etie_hook_messages;
create policy "hook messages insert own" on public.etie_hook_messages for insert with check (auth.uid() = sender_id);
create index if not exists etie_hook_messages_hook_idx on public.etie_hook_messages(hook_id, created_at);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='etie_hook_messages') then
    alter publication supabase_realtime add table public.etie_hook_messages;
  end if;
end $$;
