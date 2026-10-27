-- Private-by-default memories. Run once in Supabase SQL Editor.
--
-- Before this: "hangout logs read all" was `using (true)`, so ANY signed-in
-- user could read EVERY memory anyone logged -- including people who were
-- tagged and never consented, or never knew. A memory is now visible only to
-- the person who logged it and to the people tagged in it. Untagged = private.
--
-- Also adds UPDATE, which was missing entirely: editing your own caption and
-- handshake confirmation were both calling updateHangoutLog() and being
-- silently rejected by RLS.
--
-- Deliberately NOT adding a public/highlight flag yet. When that gets built it
-- must gate on every tagged person consenting, not just the logger.

alter table public.hangout_logs enable row level security;

drop policy if exists "hangout logs read all" on public.hangout_logs;
drop policy if exists "hangout logs read participants" on public.hangout_logs;
create policy "hangout logs read participants" on public.hangout_logs
  for select using (auth.uid() = user_id or auth.uid() = tagged_user_id);

drop policy if exists "hangout logs update own or tagged" on public.hangout_logs;
drop policy if exists "hangout logs update own or tagged" on public.hangout_logs;
create policy "hangout logs update own or tagged" on public.hangout_logs
  for update using (auth.uid() = user_id or auth.uid() = tagged_user_id);

-- Verify afterwards: these two should return zero rows for a stranger's memories.
-- select * from public.hangout_logs;