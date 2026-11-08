-- ============================================================
-- Etie Deep-Question Exchange Migration — Q1
-- Run in Supabase SQL Editor on a DEV project first.
-- Do NOT run on production without testing.
-- ============================================================

-- 1. HANGOUT_QUESTIONS TABLE
-- One question per asker->answerer pair per hangout (group of up to 4 = 12 questions).
-- reveal_at = later of (hangout end + 24h) and (question created + 12h).
create table if not exists public.hangout_questions (
  id uuid primary key default gen_random_uuid(),
  hangout_id text not null, -- references hooks.id (the hook/pin)
  asker_id uuid not null references auth.users(id) on delete cascade,
  answerer_id uuid not null references auth.users(id) on delete cascade,
  question_text text not null check (length(question_text) <= 250),
  created_at timestamptz not null default now(),
  reveal_at timestamptz not null,
  status text not null default 'asked' check (status in ('asked','answered','reported')),
  constraint hq_unique_pair unique (hangout_id, asker_id, answerer_id),
  constraint hq_no_self check (asker_id <> answerer_id)
);
alter table public.hangout_questions enable row level security;

-- Asker and answerer can read the question. No one else can.
drop policy if exists "hq read participants" on public.hangout_questions;
create policy "hq read participants" on public.hangout_questions
  for select using (auth.uid() = asker_id or auth.uid() = answerer_id);

-- Only the asker can create a question (checked in function, but also enforced here).
drop policy if exists "hq insert asker" on public.hangout_questions;
create policy "hq insert asker" on public.hangout_questions
  for insert with check (auth.uid() = asker_id);

-- No update/delete for users (append-only for statuses via function).
drop policy if exists "hq update none" on public.hangout_questions;
create policy "hq update none" on public.hangout_questions
  for update with check (false);

drop policy if exists "hq delete none" on public.hangout_questions;
create policy "hq delete none" on public.hangout_questions
  for delete with check (false);

create index if not exists hq_hangout_idx on public.hangout_questions(hangout_id, status);
create index if not exists hq_answerer_idx on public.hangout_questions(answerer_id, status);
create index if not exists hq_reveal_idx on public.hangout_questions(reveal_at);

-- 2. HANGOUT_ANSWER_VERSIONS TABLE (append-only)
-- Each save creates a new row. No update or delete.
create table if not exists public.hangout_answer_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.hangout_questions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  answer_text text not null check (length(answer_text) between 1 and 600),
  created_at timestamptz not null default now()
);
alter table public.hangout_answer_versions enable row level security;

-- The author (answerer) can read their own versions. The asker has NO direct access.
drop policy if exists "hav read author" on public.hangout_answer_versions;
create policy "hav read author" on public.hangout_answer_versions
  for select using (auth.uid() = author_id);

-- Insert only while now() < reveal_at, OR once after reveal_at (final answer).
-- Enforced by the insert_answer function below.
drop policy if exists "hav insert author" on public.hangout_answer_versions;
create policy "hav insert author" on public.hangout_answer_versions
  for insert with check (auth.uid() = author_id);

-- No update or delete for users (append-only).
drop policy if exists "hav update none" on public.hangout_answer_versions;
create policy "hav update none" on public.hangout_answer_versions
  for update with check (false);

drop policy if exists "hav delete none" on public.hangout_answer_versions;
create policy "hav delete none" on public.hangout_answer_versions
  for delete with check (false);

create index if not exists hav_question_idx on public.hangout_answer_versions(question_id, created_at desc);

-- 3. FUNCTIONS

-- create_question: creates a question and computes reveal_at.
-- hangout_end is passed from the client (the hook's ends_at).
create or replace function public.create_question(
  p_hangout_id text,
  p_asker_id uuid,
  p_answerer_id uuid,
  p_question_text text,
  p_hangout_end timestamptz
) returns json language plpgsql security definer as $$
declare
  v_reveal timestamptz;
  v_end_plus_24 timestamptz;
  v_created_plus_12 timestamptz;
  v_id uuid;
begin
  if p_asker_id <> auth.uid() then
    return json_build_object('ok', false, 'error', 'not asker');
  end if;
  if p_asker_id = p_answerer_id then
    return json_build_object('ok', false, 'error', 'cannot ask self');
  end if;

  -- Check block
  if public.is_blocked(p_asker_id, p_answerer_id) then
    return json_build_object('ok', false, 'error', 'blocked');
  end if;

  -- reveal_at = later of (hangout_end + 24h) and (now + 12h)
  v_end_plus_24 := p_hangout_end + interval '24 hours';
  v_created_plus_12 := now() + interval '12 hours';
  v_reveal := greatest(v_end_plus_24, v_created_plus_12);

  insert into public.hangout_questions (hangout_id, asker_id, answerer_id, question_text, reveal_at)
  values (p_hangout_id, p_asker_id, p_answerer_id, p_question_text, v_reveal)
  returning id into v_id;

  return json_build_object('ok', true, 'question_id', v_id, 'reveal_at', v_reveal);
end;
$$;

-- insert_answer: creates a version row. Checks lock state.
create or replace function public.insert_answer(
  p_question_id uuid,
  p_answer_text text
) returns json language plpgsql security definer as $$
declare
  v_answerer uuid;
  v_reveal timestamptz;
  v_status text;
  v_has_version boolean;
begin
  -- Get question details
  select answerer_id, reveal_at, status into v_answerer, v_reveal, v_status
  from public.hangout_questions where id = p_question_id;

  if v_answerer is null then return json_build_object('ok', false, 'error', 'not found'); end if;
  if v_answerer <> auth.uid() then return json_build_object('ok', false, 'error', 'not answerer'); end if;
  if v_status = 'reported' then return json_build_object('ok', false, 'error', 'reported'); end if;

  -- Check if any version already exists
  select exists(select 1 from public.hangout_answer_versions where question_id = p_question_id) into v_has_version;

  -- If reveal has passed and no version exists, allow one final answer.
  -- If reveal has passed and a version exists, it's locked.
  if now() >= v_reveal then
    if v_has_version then
      return json_build_object('ok', false, 'error', 'locked');
    end if;
    -- else: allow one final answer (late answer shows immediately and is final)
  end if;

  -- Insert version
  insert into public.hangout_answer_versions (question_id, author_id, answer_text)
  values (p_question_id, auth.uid(), p_answer_text);

  -- Update question status to answered
  update public.hangout_questions set status = 'answered' where id = p_question_id;

  return json_build_object('ok', true);
end;
$$;

-- get_latest_answer: returns the latest version text for a question.
-- Only callable by asker or answerer, and only when now() >= reveal_at.
create or replace function public.get_latest_answer(p_question_id uuid)
returns json language plpgsql security definer as $$
declare
  v_asker uuid;
  v_answerer uuid;
  v_reveal timestamptz;
  v_status text;
  v_text text;
begin
  select asker_id, answerer_id, reveal_at, status into v_asker, v_answerer, v_reveal, v_status
  from public.hangout_questions where id = p_question_id;

  if v_asker is null then return json_build_object('ok', false, 'error', 'not found'); end if;
  if auth.uid() not in (v_asker, v_answerer) then
    return json_build_object('ok', false, 'error', 'not participant');
  end if;
  if now() < v_reveal then
    return json_build_object('ok', false, 'error', 'sealed', 'reveal_at', v_reveal);
  end if;
  if v_status = 'reported' then
    return json_build_object('ok', false, 'error', 'reported');
  end if;

  -- Return latest version text (or null if no version exists)
  select answer_text into v_text from public.hangout_answer_versions
  where question_id = p_question_id order by created_at desc limit 1;

  return json_build_object('ok', true, 'answer_text', v_text, 'reveal_at', v_reveal);
end;
$$;

-- report_question: sets status to 'reported', removes obligation.
create or replace function public.report_question(p_question_id uuid)
returns boolean language plpgsql security definer as $$
begin
  update public.hangout_questions set status = 'reported'
  where id = p_question_id and answerer_id = auth.uid();
  return found;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.create_question(text, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.insert_answer(uuid, text) to authenticated;
grant execute on function public.get_latest_answer(uuid) to authenticated;
grant execute on function public.report_question(uuid) to authenticated;
