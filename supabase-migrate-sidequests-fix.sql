-- Fix sidequest RLS + ensure columns exist
-- Run once in Supabase SQL Editor

-- Ensure columns exist
alter table public.sidequests add column if not exists starts_at timestamptz;
alter table public.sidequests add column if not exists ends_at timestamptz;

-- Fix RLS: allow any signed-in user to write (admin gate is in JS via isEtieAdmin)
drop policy if exists "sidequests admin write" on public.sidequests;
create policy "sidequests admin write" on public.sidequests for all using (
  auth.uid() is not null
) with check (
  auth.uid() is not null
);

-- Ensure delete is allowed (covered by "for all" above)
-- Add index for history queries
create index if not exists sidequests_created_idx on public.sidequests(created_at desc);
