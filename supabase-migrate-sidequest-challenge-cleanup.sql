-- ============================================================
-- Cleanup: Remove sidequest columns from hangout_logs
-- Run AFTER migrating to demo_challenge_* schema.
-- Run on DEV project first.
-- ============================================================

-- Remove challenge columns from hangout_logs
alter table public.hangout_logs drop column if exists is_sidequest;
alter table public.hangout_logs drop column if exists challenge_prompt;
alter table public.hangout_logs drop column if exists parent_challenge_id;
alter table public.hangout_logs drop column if exists challenge_expires_at;

-- Drop old sidequest tables (replaced by demo_challenge_* tables)
drop table if exists public.sidequest_votes cascade;
drop table if exists public.challenge_reports cascade;

-- Drop old index
drop index if exists hangout_logs_sidequest_idx;
drop index if exists hangout_logs_parent_challenge_idx;
