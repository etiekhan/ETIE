-- ============================================================
-- Fix: chat_participants RLS infinite recursion
-- The original policy queried chat_participants from within
-- chat_participants, causing infinite recursion.
-- Fix: use a security definer function instead.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Helper function: check if user is a participant in a thread
create or replace function public.is_thread_participant(p_thread_id uuid, p_user_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.chat_participants
    where thread_id = p_thread_id and user_id = p_user_id
  );
$$;

-- Fix chat_threads read policy (was self-referential via chat_participants)
drop policy if exists "threads read participant" on public.chat_threads;
create policy "threads read participant" on public.chat_threads
  for select using (
    public.is_thread_participant(id, auth.uid())
  );

-- Fix chat_participants read policy (was self-referential)
drop policy if exists "participants read own thread" on public.chat_participants;
create policy "participants read own thread" on public.chat_participants
  for select using (
    public.is_thread_participant(thread_id, auth.uid())
  );

-- Fix etie_messages read policy (was self-referential via chat_participants)
drop policy if exists "messages read participant" on public.etie_messages;
create policy "messages read participant" on public.etie_messages
  for select using (
    thread_id is null or
    public.is_thread_participant(thread_id, auth.uid())
  );

-- Fix etie_messages insert policy
drop policy if exists "messages insert participant" on public.etie_messages;
create policy "messages insert participant" on public.etie_messages
  for insert with check (
    auth.uid() = sender_id and
    (thread_id is null or public.is_thread_participant(thread_id, auth.uid()))
  );

grant execute on function public.is_thread_participant(uuid, uuid) to authenticated;
