-- ============================================================
-- Etie Challenges Demo — UP migration
-- Run in Supabase SQL Editor on a DEV project first.
-- Creates a separate schema for demo isolation.
-- ============================================================

-- 1. CREATE SCHEMA
-- 2. CHALLENGES TABLE
create table if not exists demo_challenge_challenges (
  id uuid primary key default gen_random_uuid(),
  theme_title text not null,
  creator_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','active','closed')),
  voting_rules text not null default 'both' check (voting_rules in ('crew','crowd','both')),
  stakes text,
  safety_note text default 'Stay safe and don''t enter private or restricted areas.',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  demo_expires_at timestamptz
);
alter table demo_challenge_challenges enable row level security;

-- 3. CHALLENGE MEMBERS
create table if not exists demo_challenge_challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references demo_challenge_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','accepted','declined')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint cm_unique unique (challenge_id, user_id)
);
alter table demo_challenge_challenge_members enable row level security;

-- 4. CHALLENGE ENTRIES
create table if not exists demo_challenge_challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references demo_challenge_challenges(id) on delete cascade,
  memory_id uuid not null references public.hangout_logs(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  constraint ce_unique_player unique (challenge_id, player_id)
);
alter table demo_challenge_challenge_entries enable row level security;

-- 5. CHALLENGE VOTES
create table if not exists demo_challenge_challenge_votes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references demo_challenge_challenges(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references demo_challenge_challenge_entries(id) on delete cascade,
  kind text not null check (kind in ('crew','crowd')),
  created_at timestamptz not null default now(),
  constraint cv_unique unique (challenge_id, voter_id, kind)
);
alter table demo_challenge_challenge_votes enable row level security;

-- 6. ENTRY SAVES
create table if not exists demo_challenge_entry_saves (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references demo_challenge_challenge_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint es_unique unique (entry_id, user_id)
);
alter table demo_challenge_entry_saves enable row level security;

-- 7. ENTRY REACTIONS
create table if not exists demo_challenge_entry_reactions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references demo_challenge_challenge_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('fire','heart','laugh','wow','sad')),
  created_at timestamptz not null default now(),
  constraint er_unique unique (entry_id, user_id, reaction)
);
alter table demo_challenge_entry_reactions enable row level security;

-- 8. ENTRY COMMENTS
create table if not exists demo_challenge_entry_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references demo_challenge_challenge_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_text text not null check (length(comment_text) <= 500),
  created_at timestamptz not null default now()
);
alter table demo_challenge_entry_comments enable row level security;

-- 9. BEEN HERE
create table if not exists demo_challenge_been_here (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references demo_challenge_challenge_entries(id) on delete cascade,
  memory_id uuid not null references public.hangout_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint bh_unique unique (entry_id, user_id)
);
alter table demo_challenge_been_here enable row level security;

-- 10. NOMINATIONS
create table if not exists demo_challenge_nominations (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references demo_challenge_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  theme_title text not null,
  created_at timestamptz not null default now()
);
alter table demo_challenge_nominations enable row level security;

-- 11. DEMO CREATED ITEMS (for wipe)
create table if not exists demo_challenge_demo_created_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('memory','file')),
  item_id uuid, -- memory_id if type='memory'
  storage_path text, -- storage path if type='file'
  created_at timestamptz not null default now()
);
alter table demo_challenge_demo_created_items enable row level security;

-- 12. ALLOWLIST
create table if not exists demo_challenge_allowlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table demo_challenge_allowlist enable row level security;

-- 13. CONFIG (feature flag)
create table if not exists demo_challenge_config (
  key text primary key,
  value text not null
);
alter table demo_challenge_config enable row level security;

-- 14. METRICS
create table if not exists demo_challenge_metrics (
  key text primary key,
  count int not null default 0
);
alter table demo_challenge_metrics enable row level security;

-- Seed config
insert into demo_challenge_config (key, value) values ('CHALLENGES_DEMO_ENABLED', 'true') on conflict (key) do nothing;
insert into demo_challenge_metrics (key, count) values ('challenges_created', 0) on conflict (key) do nothing;
insert into demo_challenge_metrics (key, count) values ('entries', 0) on conflict (key) do nothing;
insert into demo_challenge_metrics (key, count) values ('votes', 0) on conflict (key) do nothing;

-- ============================================================
-- RLS POLICIES (3 levels: players, viewers, everyone else)
-- ============================================================

-- Helper: check if user is a player in a challenge
create or replace function demo_challenge_is_player(p_challenge_id uuid, p_user_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from demo_challenge_challenge_members
    where challenge_id = p_challenge_id and user_id = p_user_id and status = 'accepted'
  );
$$;

-- Helper: check if user is the creator of a challenge
create or replace function demo_challenge_is_creator(p_challenge_id uuid, p_user_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from demo_challenge_challenges
    where id = p_challenge_id and creator_id = p_user_id
  );
$$;

-- Helper: check if user is a viewer (connection of any player)
create or replace function demo_challenge_is_viewer(p_challenge_id uuid, p_user_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from demo_challenge_challenge_members cm
    join public.connections c on (
      (c.user_low = least(cm.user_id, p_user_id) and c.user_high = greatest(cm.user_id, p_user_id))
    )
    where cm.challenge_id = p_challenge_id and cm.status = 'accepted'
      and c.status = 'accepted'
      and cm.user_id <> p_user_id
  );
$$;

-- Helper: check if user is blocked by any player
create or replace function demo_challenge_is_blocked_by_player(p_challenge_id uuid, p_user_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from demo_challenge_challenge_members cm
    where cm.challenge_id = p_challenge_id and cm.status = 'accepted'
      and public.is_blocked(cm.user_id, p_user_id)
  );
$$;

-- Helper: check if feature is enabled
create or replace function demo_challenge_is_enabled()
returns boolean language sql security definer as $$
  select coalesce(
    (select value = 'true' from demo_challenge_config where key = 'CHALLENGES_DEMO_ENABLED'),
    false
  );
$$;

-- Helper: check if user is in allowlist (or allowlist is empty)
create or replace function demo_challenge_is_allowed(p_user_id uuid)
returns boolean language sql security definer as $$
  select not exists (select 1 from demo_challenge_allowlist)
    or exists (select 1 from demo_challenge_allowlist where user_id = p_user_id);
$$;

-- CHALLENGES: players and viewers can read, creator can insert/update/delete
drop policy if exists "ch read" on demo_challenge_challenges;
create policy "ch read" on demo_challenge_challenges
  for select using (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    not demo_challenge_is_blocked_by_player(id, auth.uid()) and
    (demo_challenge_is_player(id, auth.uid()) or demo_challenge_is_viewer(id, auth.uid()) or demo_challenge_is_creator(id, auth.uid()))
  );

drop policy if exists "ch insert" on demo_challenge_challenges;
create policy "ch insert" on demo_challenge_challenges
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    auth.uid() = creator_id
  );

drop policy if exists "ch update creator" on demo_challenge_challenges;
create policy "ch update creator" on demo_challenge_challenges
  for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "ch delete creator" on demo_challenge_challenges;
create policy "ch delete creator" on demo_challenge_challenges
  for delete using (auth.uid() = creator_id);

-- CHALLENGE MEMBERS: players can read their challenge's members, creator can insert
drop policy if exists "cm read" on demo_challenge_challenge_members;
create policy "cm read" on demo_challenge_challenge_members
  for select using (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    not demo_challenge_is_blocked_by_player(challenge_id, auth.uid()) and
    (demo_challenge_is_player(challenge_id, auth.uid()) or demo_challenge_is_viewer(challenge_id, auth.uid()) or demo_challenge_is_creator(challenge_id, auth.uid()))
  );

drop policy if exists "cm insert creator" on demo_challenge_challenge_members;
create policy "cm insert creator" on demo_challenge_challenge_members
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    demo_challenge_is_creator(challenge_id, auth.uid())
  );

drop policy if exists "cm update self" on demo_challenge_challenge_members;
create policy "cm update self" on demo_challenge_challenge_members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CHALLENGE ENTRIES: players and viewers can read
drop policy if exists "ce read" on demo_challenge_challenge_entries;
create policy "ce read" on demo_challenge_challenge_entries
  for select using (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    not demo_challenge_is_blocked_by_player(challenge_id, auth.uid()) and
    (demo_challenge_is_player(challenge_id, auth.uid()) or demo_challenge_is_viewer(challenge_id, auth.uid()) or demo_challenge_is_creator(challenge_id, auth.uid()))
  );

drop policy if exists "ce insert player" on demo_challenge_challenge_entries;
create policy "ce insert player" on demo_challenge_challenge_entries
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    demo_challenge_is_player(challenge_id, auth.uid()) and
    auth.uid() = player_id
  );

drop policy if exists "ce delete player" on demo_challenge_challenge_entries;
create policy "ce delete player" on demo_challenge_challenge_entries
  for delete using (auth.uid() = player_id);

-- CHALLENGE VOTES: no one reads individual votes; only aggregated via function
drop policy if exists "cv insert" on demo_challenge_challenge_votes;
create policy "cv insert" on demo_challenge_challenge_votes
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    not demo_challenge_is_blocked_by_player(challenge_id, auth.uid()) and
    (demo_challenge_is_player(challenge_id, auth.uid()) or demo_challenge_is_viewer(challenge_id, auth.uid())) and
    auth.uid() = voter_id
  );

-- No select policy on challenge_votes (votes are hidden; totals via function)

-- ENTRY SAVES
drop policy if exists "es read" on demo_challenge_entry_saves;
create policy "es read" on demo_challenge_entry_saves
  for select using (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    demo_challenge_is_player((select challenge_id from demo_challenge_challenge_entries where id = entry_id), auth.uid()) or
    demo_challenge_is_viewer((select challenge_id from demo_challenge_challenge_entries where id = entry_id), auth.uid())
  );

drop policy if exists "es insert" on demo_challenge_entry_saves;
create policy "es insert" on demo_challenge_entry_saves
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    auth.uid() = user_id
  );

drop policy if exists "es delete own" on demo_challenge_entry_saves;
create policy "es delete own" on demo_challenge_entry_saves
  for delete using (auth.uid() = user_id);

-- ENTRY REACTIONS
drop policy if exists "er read" on demo_challenge_entry_reactions;
create policy "er read" on demo_challenge_entry_reactions
  for select using (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    (demo_challenge_is_player((select challenge_id from demo_challenge_challenge_entries where id = entry_id), auth.uid()) or
     demo_challenge_is_viewer((select challenge_id from demo_challenge_challenge_entries where id = entry_id), auth.uid()))
  );

drop policy if exists "er insert" on demo_challenge_entry_reactions;
create policy "er insert" on demo_challenge_entry_reactions
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    auth.uid() = user_id
  );

drop policy if exists "er delete own" on demo_challenge_entry_reactions;
create policy "er delete own" on demo_challenge_entry_reactions
  for delete using (auth.uid() = user_id);

-- ENTRY COMMENTS
drop policy if exists "ec read" on demo_challenge_entry_comments;
create policy "ec read" on demo_challenge_entry_comments
  for select using (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    (demo_challenge_is_player((select challenge_id from demo_challenge_challenge_entries where id = entry_id), auth.uid()) or
     demo_challenge_is_viewer((select challenge_id from demo_challenge_challenge_entries where id = entry_id), auth.uid()))
  );

drop policy if exists "ec insert" on demo_challenge_entry_comments;
create policy "ec insert" on demo_challenge_entry_comments
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    auth.uid() = user_id
  );

-- BEEN HERE
drop policy if exists "bh read" on demo_challenge_been_here;
create policy "bh read" on demo_challenge_been_here
  for select using (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    (demo_challenge_is_player((select challenge_id from demo_challenge_challenge_entries where id = entry_id), auth.uid()) or
     demo_challenge_is_viewer((select challenge_id from demo_challenge_challenge_entries where id = entry_id), auth.uid()))
  );

drop policy if exists "bh insert" on demo_challenge_been_here;
create policy "bh insert" on demo_challenge_been_here
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    auth.uid() = user_id
  );

-- NOMINATIONS
drop policy if exists "nom read" on demo_challenge_nominations;
create policy "nom read" on demo_challenge_nominations
  for select using (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    (demo_challenge_is_player(challenge_id, auth.uid()) or demo_challenge_is_viewer(challenge_id, auth.uid()) or demo_challenge_is_creator(challenge_id, auth.uid()))
  );

drop policy if exists "nom insert" on demo_challenge_nominations;
create policy "nom insert" on demo_challenge_nominations
  for insert with check (
    demo_challenge_is_enabled() and demo_challenge_is_allowed(auth.uid()) and
    auth.uid() = user_id
  );

-- DEMO CREATED ITEMS: admin only
drop policy if exists "dci read admin" on demo_challenge_demo_created_items;
create policy "dci read admin" on demo_challenge_demo_created_items
  for select using (auth.uid() = '9f2e8d41-0394-4e25-9758-e1d7c7b52a2a'::uuid);

drop policy if exists "dci insert auth" on demo_challenge_demo_created_items;
create policy "dci insert auth" on demo_challenge_demo_created_items
  for insert with check (auth.uid() is not null);

-- ALLOWLIST: admin can manage, users can read own
drop policy if exists "al read" on demo_challenge_allowlist;
create policy "al read" on demo_challenge_allowlist
  for select using (auth.uid() = user_id or auth.uid() = '9f2e8d41-0394-4e25-9758-e1d7c7b52a2a'::uuid);

drop policy if exists "al insert admin" on demo_challenge_allowlist;
create policy "al insert admin" on demo_challenge_allowlist
  for insert with check (auth.uid() = '9f2e8d41-0394-4e25-9758-e1d7c7b52a2a'::uuid);

drop policy if exists "al delete admin" on demo_challenge_allowlist;
create policy "al delete admin" on demo_challenge_allowlist
  for delete using (auth.uid() = '9f2e8d41-0394-4e25-9758-e1d7c7b52a2a'::uuid);

-- CONFIG: everyone can read, admin can write
drop policy if exists "cfg read" on demo_challenge_config;
create policy "cfg read" on demo_challenge_config
  for select using (true);

drop policy if exists "cfg write admin" on demo_challenge_config;
create policy "cfg write admin" on demo_challenge_config
  for all using (auth.uid() = '9f2e8d41-0394-4e25-9758-e1d7c7b52a2a'::uuid)
  with check (auth.uid() = '9f2e8d41-0394-4e25-9758-e1d7c7b52a2a'::uuid);

-- METRICS: everyone can read, admin can write
drop policy if exists "met read" on demo_challenge_metrics;
create policy "met read" on demo_challenge_metrics
  for select using (true);

drop policy if exists "met write admin" on demo_challenge_metrics;
create policy "met write admin" on demo_challenge_metrics
  for all using (auth.uid() = '9f2e8d41-0394-4e25-9758-e1d7c7b52a2a'::uuid)
  with check (auth.uid() = '9f2e8d41-0394-4e25-9758-e1d7c7b52a2a'::uuid);

-- ============================================================
-- VIEWS
-- ============================================================

-- Challenge entry memories: exposes memory fields without owner's other data
create or replace view demo_challenge_challenge_entry_memories as
select
  ce.id as entry_id,
  ce.challenge_id,
  ce.player_id,
  ce.note,
  ce.created_at as entry_created_at,
  hl.id as memory_id,
  hl.photo_url,
  hl.lat,
  hl.lng,
  hl.title as caption,
  hl.location,
  hl.taken_at
from demo_challenge_challenge_entries ce
join public.hangout_logs hl on hl.id = ce.memory_id;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- get_challenge_results: returns aggregated vote data only after close
create or replace function demo_challenge_get_challenge_results(p_challenge_id uuid)
returns json language plpgsql security definer as $$
declare
  v_status text;
  v_crew_winner uuid;
  v_crowd_winner uuid;
  v_crew_scores json;
  v_crowd_scores json;
begin
  select status into v_status from demo_challenge_challenges where id = p_challenge_id;
  if v_status is null then return json_build_object('ok', false, 'error', 'not found'); end if;
  if v_status <> 'closed' then return json_build_object('ok', false, 'error', 'not closed'); end if;

  -- Crew scores: count votes per entry
  select json_agg(json_build_object('entry_id', entry_id, 'votes', vote_count)) into v_crew_scores
  from (
    select entry_id, count(*) as vote_count
    from demo_challenge_challenge_votes
    where challenge_id = p_challenge_id and kind = 'crew'
    group by entry_id
  ) t;

  -- Crowd scores
  select json_agg(json_build_object('entry_id', entry_id, 'votes', vote_count)) into v_crowd_scores
  from (
    select entry_id, count(*) as vote_count
    from demo_challenge_challenge_votes
    where challenge_id = p_challenge_id and kind = 'crowd'
    group by entry_id
  ) t;

  return json_build_object('ok', true, 'crew_scores', v_crew_scores, 'crowd_scores', v_crowd_scores);
end;
$$;

-- is_challenge_viewer: checks if user can view a challenge
create or replace function demo_challenge_is_challenge_viewer(p_challenge_id uuid, p_user_id uuid)
returns boolean language sql security definer as $$
  select demo_challenge_is_player(p_challenge_id, p_user_id)
    or demo_challenge_is_viewer(p_challenge_id, p_user_id)
    or demo_challenge_is_creator(p_challenge_id, p_user_id);
$$;

grant execute on function demo_challenge_is_player(uuid, uuid) to authenticated;
grant execute on function demo_challenge_is_creator(uuid, uuid) to authenticated;
grant execute on function demo_challenge_is_viewer(uuid, uuid) to authenticated;
grant execute on function demo_challenge_is_blocked_by_player(uuid, uuid) to authenticated;
grant execute on function demo_challenge_is_enabled() to authenticated;
grant execute on function demo_challenge_is_allowed(uuid) to authenticated;
grant execute on function demo_challenge_get_challenge_results(uuid) to authenticated;
grant execute on function demo_challenge_is_challenge_viewer(uuid, uuid) to authenticated;

-- Grant schema usage
