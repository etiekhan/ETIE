-- ============================================================
-- Etie Wrap-up Flow Migration — W1
-- Run in Supabase SQL Editor on a DEV project first.
-- Do NOT run on production without testing.
-- ============================================================

-- 1. HANGOUT_CONFIRMATIONS TABLE
-- Per-participant Yes/No confirmation after a hangout ends.
-- popup_seen_at ensures the one-time popup appears only once per hangout.
create table if not exists public.hangout_confirmations (
  id uuid primary key default gen_random_uuid(),
  hangout_id text not null, -- references hooks.id
  user_id uuid not null references auth.users(id) on delete cascade,
  happened boolean not null,
  confirmed_at timestamptz not null default now(),
  popup_seen_at timestamptz,
  constraint hc_unique unique (hangout_id, user_id)
);
alter table public.hangout_confirmations enable row level security;

-- Each user can read only their own confirmation.
drop policy if exists "hc read own" on public.hangout_confirmations;
create policy "hc read own" on public.hangout_confirmations
  for select using (auth.uid() = user_id);

-- Each user can insert only their own confirmation.
drop policy if exists "hc insert own" on public.hangout_confirmations;
create policy "hc insert own" on public.hangout_confirmations
  for insert with check (auth.uid() = user_id);

-- Each user can update only their own confirmation (e.g., popup_seen_at).
drop policy if exists "hc update own" on public.hangout_confirmations;
create policy "hc update own" on public.hangout_confirmations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admins can read all confirmations (to review disagreements).
-- Replace 'kan.ethan.cy@gmail.com' with your admin email.
drop policy if exists "hc read admin" on public.hangout_confirmations;
create policy "hc read admin" on public.hangout_confirmations
  for select using (auth.jwt() ->> 'email' in ('kan.ethan.cy@gmail.com'));

create index if not exists hc_hangout_idx on public.hangout_confirmations(hangout_id, happened);
create index if not exists hc_user_idx on public.hangout_confirmations(user_id, confirmed_at desc);

-- 2. FUNCTION: check if both participants confirmed and whether they agree
-- Returns: 'pending' (not all confirmed), 'agreed' (both yes), 'disagreed' (one yes, one no), 'both_no' (both no)
create or replace function public.check_hangout_confirmation(p_hangout_id text)
returns json language plpgsql security definer as $$
declare
  v_count int;
  v_yes_count int;
  v_no_count int;
begin
  select count(*), count(*) filter (where happened = true), count(*) filter (where happened = false)
  into v_count, v_yes_count, v_no_count
  from public.hangout_confirmations where hangout_id = p_hangout_id;

  -- Need at least 2 confirmations (or 1 for solo hangouts)
  if v_count < 2 then
    return json_build_object('status', 'pending', 'confirmed', v_count);
  end if;

  if v_yes_count = v_count then
    return json_build_object('status', 'agreed', 'confirmed', v_count);
  elsif v_no_count = v_count then
    return json_build_object('status', 'both_no', 'confirmed', v_count);
  else
    return json_build_object('status', 'disagreed', 'confirmed', v_count);
  end if;
end;
$$;

grant execute on function public.check_hangout_confirmation(text) to authenticated;

-- 3. FUNCTION: mark popup as seen (idempotent)
create or replace function public.mark_popup_seen(p_hangout_id text)
returns boolean language plpgsql security definer as $$
begin
  update public.hangout_confirmations set popup_seen_at = now()
  where hangout_id = p_hangout_id and user_id = auth.uid() and popup_seen_at is null;
  return found;
end;
$$;

grant execute on function public.mark_popup_seen(text) to authenticated;
