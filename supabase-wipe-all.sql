-- ETIE full wipe for clean-run testing — paste into Supabase SQL Editor and Run.
-- Deletes ALL rows in every app table (both test logins). Auth users are kept, so the same emails can sign in again.
-- Children first (FK-safe), then parents, then photo storage.
delete from public.etie_messages;
delete from public.etie_meetups;
delete from public.etie_reviews;
delete from public.etie_reports;
delete from public.messages;
delete from public.hooks;
delete from public.etie_pins;
delete from public.etie_requests;
delete from public.etie_profiles;
delete from public.etie_states;
delete from storage.objects where bucket_id = 'etie-photos';
