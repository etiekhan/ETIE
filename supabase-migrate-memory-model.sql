-- ============================================================
-- Etie Memory Model Migration — M2
-- Run in Supabase SQL Editor on a DEV project first.
-- Do NOT run on production without testing.
-- ============================================================

-- 1. CONNECTIONS TABLE
-- Purpose-bound: created only via hangout approval or memory tag.
-- user_low < user_high enforced by check constraint.
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_via text not null check (created_via in ('hangout','memory')),
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connections_ordered check (user_low < user_high),
  constraint connections_unique_pair unique (user_low, user_high)
);
alter table public.connections enable row level security;

-- Only the two users can see their connection row
drop policy if exists "connections read own" on public.connections;
create policy "connections read own" on public.connections
  for select using (auth.uid() = user_low or auth.uid() = user_high);

-- Only the two users can update status (accept/decline)
drop policy if exists "connections update own" on public.connections;
create policy "connections update own" on public.connections
  for update using (auth.uid() = user_low or auth.uid() = user_high)
  with check (auth.uid() = user_low or auth.uid() = user_high);

-- Insert is done via RPC functions only
drop policy if exists "connections insert none" on public.connections;
create policy "connections insert none" on public.connections
  for insert with check (false);

create index if not exists connections_user_low_idx on public.connections(user_low, status);
create index if not exists connections_user_high_idx on public.connections(user_high, status);

-- 2. MEMORY TAGS TABLE
create table if not exists public.memory_tags (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.hangout_logs(id) on delete cascade,
  tagged_user_id uuid not null references auth.users(id) on delete cascade,
  tagged_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint memory_tags_unique unique (memory_id, tagged_user_id)
);
alter table public.memory_tags enable row level security;

-- Tagged user can read their own tag
drop policy if exists "memory_tags read tagged" on public.memory_tags;
create policy "memory_tags read tagged" on public.memory_tags
  for select using (auth.uid() = tagged_user_id);

-- Owner can read all tags on their memories
drop policy if exists "memory_tags read owner" on public.memory_tags;
create policy "memory_tags read owner" on public.memory_tags
  for select using (auth.uid() = tagged_by);

-- Tagged user can update status (approve/decline)
drop policy if exists "memory_tags update tagged" on public.memory_tags;
create policy "memory_tags update tagged" on public.memory_tags
  for update using (auth.uid() = tagged_user_id)
  with check (auth.uid() = tagged_user_id);

-- Insert only via RPC
drop policy if exists "memory_tags insert none" on public.memory_tags;
create policy "memory_tags insert none" on public.memory_tags
  for insert with check (false);

create index if not exists memory_tags_tagged_idx on public.memory_tags(tagged_user_id, status);
create index if not exists memory_tags_memory_idx on public.memory_tags(memory_id);

-- 3. VISIBILITY COLUMN ON hangout_logs
alter table public.hangout_logs add column if not exists visibility text
  check (visibility in ('only_me','tagged','connections','public'));

-- Existing rows: set to 'public' (current behavior = anyone can read)
update public.hangout_logs set visibility = 'public' where visibility is null;

-- New rows default to 'tagged'
alter table public.hangout_logs alter column visibility set default 'tagged';
alter table public.hangout_logs alter column visibility set not null;

-- 4. REPORTS TABLE
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null references public.hangout_logs(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

-- Reporter reads own reports
drop policy if exists "reports read own" on public.reports;
create policy "reports read own" on public.reports
  for select using (auth.uid() = reporter_id);

-- Insert by reporter
drop policy if exists "reports insert auth" on public.reports;
create policy "reports insert auth" on public.reports
  for insert with check (auth.uid() = reporter_id);

create index if not exists reports_status_idx on public.reports(status, created_at desc);

-- 5. BLOCKS TABLE
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blocks_unique unique (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

-- Only blocker sees their blocks
drop policy if exists "blocks read own" on public.blocks;
create policy "blocks read own" on public.blocks
  for select using (auth.uid() = blocker_id);

-- Only blocker creates blocks
drop policy if exists "blocks insert own" on public.blocks;
create policy "blocks insert own" on public.blocks
  for insert with check (auth.uid() = blocker_id);

-- Only blocker removes blocks
drop policy if exists "blocks delete own" on public.blocks;
create policy "blocks delete own" on public.blocks
  for delete using (auth.uid() = blocker_id);

-- Helper: check if user is a participant in a thread (avoids RLS recursion)
create or replace function public.is_thread_participant(p_thread_id uuid, p_user_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.chat_participants
    where thread_id = p_thread_id and user_id = p_user_id
  );
$$;

-- 6. CHAT THREADS + PARTICIPANTS
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  context_type text not null check (context_type in ('hangout','direct')),
  context_id text,
  created_at timestamptz not null default now()
);
alter table public.chat_threads enable row level security;

create table if not exists public.chat_participants (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
alter table public.chat_participants enable row level security;

-- Participants read own threads
drop policy if exists "threads read participant" on public.chat_threads;
create policy "threads read participant" on public.chat_threads
  for select using (
    public.is_thread_participant(id, auth.uid())
  );

-- Participants read participant lists for their threads
drop policy if exists "participants read own thread" on public.chat_participants;
create policy "participants read own thread" on public.chat_participants
  for select using (
    public.is_thread_participant(thread_id, auth.uid())
  );

-- 7. ADD thread_id + memory_id TO etie_messages
alter table public.etie_messages add column if not exists thread_id uuid references public.chat_threads(id) on delete cascade;
alter table public.etie_messages add column if not exists memory_id uuid references public.hangout_logs(id) on delete set null;

-- 8. REPLACE etie_messages RLS with participant-based policies
drop policy if exists "messages read auth" on public.etie_messages;
drop policy if exists "messages read participant" on public.etie_messages;
create policy "messages read participant" on public.etie_messages
  for select using (
    thread_id is null or
    public.is_thread_participant(thread_id, auth.uid())
  );

drop policy if exists "messages insert auth" on public.etie_messages;
drop policy if exists "messages insert participant" on public.etie_messages;
create policy "messages insert participant" on public.etie_messages
  for insert with check (
    auth.uid() = sender_id and
    (thread_id is null or public.is_thread_participant(thread_id, auth.uid()))
  );

create index if not exists etie_messages_thread_idx on public.etie_messages(thread_id, created_at);

-- 9. APP CONFIG
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
drop policy if exists "app_config read auth" on public.app_config;
create policy "app_config read auth" on public.app_config
  for select using (auth.uid() is not null);
insert into public.app_config (key, value) values ('TAG_COOLDOWN_HOURS', '72') on conflict (key) do nothing;

-- 10. FUNCTIONS

-- Helper: check if two users are blocked (either direction)
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- Helper: get connection status between two users
create or replace function public.get_connection_status(a uuid, b uuid)
returns text language plpgsql security definer as $$
declare
  lo uuid; hi uuid; st text;
begin
  if a < b then lo := a; hi := b; else lo := b; hi := a; end if;
  select status into st from public.connections where user_low = lo and user_high = hi;
  return coalesce(st, 'none');
end;
$$;

-- tag_user: enforces owner-only, block check, cooldown, creates pending connection + tag
create or replace function public.tag_user(p_memory_id uuid, p_tagged_user_id uuid)
returns json language plpgsql security definer as $$
declare
  v_owner uuid;
  v_last_decline timestamptz;
  v_cooldown_hours int;
  v_low uuid; v_high uuid;
begin
  select user_id into v_owner from public.hangout_logs where id = p_memory_id;
  if v_owner is null then return json_build_object('ok', false, 'error', 'memory not found'); end if;
  if v_owner <> auth.uid() then return json_build_object('ok', false, 'error', 'not owner'); end if;
  if p_tagged_user_id = auth.uid() then return json_build_object('ok', false, 'error', 'cannot tag self'); end if;

  if public.is_blocked(auth.uid(), p_tagged_user_id) then
    return json_build_object('ok', false, 'error', 'blocked');
  end if;

  select coalesce((select value::int from public.app_config where key = 'TAG_COOLDOWN_HOURS'), 72) into v_cooldown_hours;

  select responded_at into v_last_decline
  from public.memory_tags mt
  join public.hangout_logs hl on hl.id = mt.memory_id
  where hl.user_id = auth.uid()
    and mt.tagged_user_id = p_tagged_user_id
    and mt.status = 'declined'
    and mt.responded_at > now() - (v_cooldown_hours || ' hours')::interval
  order by mt.responded_at desc limit 1;

  if v_last_decline is not null then
    return json_build_object('ok', false, 'error', 'cooldown',
      'hours_remaining', extract(epoch from (v_last_decline + (v_cooldown_hours || ' hours')::interval - now())) / 3600);
  end if;

  if auth.uid() < p_tagged_user_id then v_low := auth.uid(); v_high := p_tagged_user_id;
  else v_low := p_tagged_user_id; v_high := auth.uid(); end if;

  if not exists (select 1 from public.connections where user_low = v_low and user_high = v_high) then
    insert into public.connections (user_low, user_high, status, created_via, requested_by)
    values (v_low, v_high, 'pending', 'memory', auth.uid());
  end if;

  insert into public.memory_tags (memory_id, tagged_user_id, tagged_by, status)
  values (p_memory_id, p_tagged_user_id, auth.uid(), 'pending')
  on conflict (memory_id, tagged_user_id) do nothing;

  return json_build_object('ok', true);
end;
$$;

-- respond_to_tag: approve or decline
create or replace function public.respond_to_tag(p_memory_id uuid, p_action text)
returns json language plpgsql security definer as $$
declare
  v_tag_id uuid;
  v_tagged_by uuid;
  v_low uuid; v_high uuid;
begin
  if p_action not in ('approve','decline') then
    return json_build_object('ok', false, 'error', 'invalid action');
  end if;

  select id, tagged_by into v_tag_id, v_tagged_by
  from public.memory_tags
  where memory_id = p_memory_id and tagged_user_id = auth.uid() and status = 'pending';

  if v_tag_id is null then
    return json_build_object('ok', false, 'error', 'no pending tag');
  end if;

  if p_action = 'approve' then
    update public.memory_tags set status = 'approved', responded_at = now() where id = v_tag_id;
    if auth.uid() < v_tagged_by then v_low := auth.uid(); v_high := v_tagged_by;
    else v_low := v_tagged_by; v_high := auth.uid(); end if;
    update public.connections set status = 'accepted', responded_at = now()
      where user_low = v_low and user_high = v_high and status = 'pending';
  else
    update public.memory_tags set status = 'declined', responded_at = now() where id = v_tag_id;
    if auth.uid() < v_tagged_by then v_low := auth.uid(); v_high := v_tagged_by;
    else v_low := v_tagged_by; v_high := auth.uid(); end if;
    update public.connections set status = 'declined', responded_at = now()
      where user_low = v_low and user_high = v_high and status = 'pending';
  end if;

  return json_build_object('ok', true, 'action', p_action);
end;
$$;

-- accept_hook_connection: called after host approves a join request
create or replace function public.accept_hook_connection(p_host_id uuid, p_requester_id uuid)
returns json language plpgsql security definer as $$
declare
  v_low uuid; v_high uuid;
begin
  if auth.uid() <> p_host_id then
    return json_build_object('ok', false, 'error', 'not host');
  end if;
  if p_host_id = p_requester_id then
    return json_build_object('ok', false, 'error', 'self');
  end if;
  if public.is_blocked(p_host_id, p_requester_id) then
    return json_build_object('ok', false, 'error', 'blocked');
  end if;

  if p_host_id < p_requester_id then v_low := p_host_id; v_high := p_requester_id;
  else v_low := p_requester_id; v_high := p_host_id; end if;

  insert into public.connections (user_low, user_high, status, created_via, requested_by)
  values (v_low, v_high, 'accepted', 'hangout', p_requester_id)
  on conflict (user_low, user_high) do update set status = 'accepted', responded_at = now()
    where connections.status = 'pending';

  return json_build_object('ok', true);
end;
$$;

-- Grant execute on helper function
grant execute on function public.is_thread_participant(uuid, uuid) to authenticated;

-- Grant execute on functions to authenticated users
grant execute on function public.tag_user(uuid, uuid) to authenticated;
grant execute on function public.respond_to_tag(uuid, text) to authenticated;
grant execute on function public.accept_hook_connection(uuid, uuid) to authenticated;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;
grant execute on function public.get_connection_status(uuid, uuid) to authenticated;
