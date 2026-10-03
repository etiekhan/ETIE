-- ETIE hooks: let guests update join requests (safe to run repeatedly)
-- Run once in Supabase Dashboard → SQL Editor.
-- Why: join requests and vibe intros are stored ON the host's pin row, so the
-- requester must be allowed to UPDATE a pin they did not author. The old
-- "hooks update own" policy rejected those writes and requests never arrived.
-- Trade-off: any signed-in user can technically touch any pin row; deletes
-- stay author-only. Fine for a small private network; revisit for public launch.
drop policy if exists "hooks update own" on public.hooks;
create policy "hooks update any auth" on public.hooks
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
