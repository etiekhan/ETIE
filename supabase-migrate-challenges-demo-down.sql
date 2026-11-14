-- ============================================================
-- Etie Challenges Demo — DOWN migration
-- Removes all demo_challenge_ tables completely.
-- Run after "Reset demo data" wipe.
-- ============================================================

drop table if exists public.demo_challenge_been_here cascade;
drop table if exists public.demo_challenge_entry_comments cascade;
drop table if exists public.demo_challenge_entry_reactions cascade;
drop table if exists public.demo_challenge_entry_saves cascade;
drop table if exists public.demo_challenge_challenge_votes cascade;
drop table if exists public.demo_challenge_challenge_entries cascade;
drop table if exists public.demo_challenge_nominations cascade;
drop table if exists public.demo_challenge_challenge_members cascade;
drop table if exists public.demo_challenge_challenges cascade;
drop table if exists public.demo_challenge_demo_created_items cascade;
drop table if exists public.demo_challenge_allowlist cascade;
drop table if exists public.demo_challenge_config cascade;
drop table if exists public.demo_challenge_metrics cascade;
drop view if exists public.demo_challenge_entry_memories cascade;
drop function if exists public.demo_challenge_is_player(uuid, uuid);
drop function if exists public.demo_challenge_is_creator(uuid, uuid);
drop function if exists public.demo_challenge_is_viewer(uuid, uuid);
drop function if exists public.demo_challenge_is_blocked_by_player(uuid, uuid);
drop function if exists public.demo_challenge_is_enabled();
drop function if exists public.demo_challenge_is_allowed(uuid);
drop function if exists public.demo_challenge_get_challenge_results(uuid);
drop function if exists public.demo_challenge_is_challenge_viewer(uuid, uuid);
