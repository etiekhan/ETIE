-- Add missing columns to etie_profiles that the app expects
-- Run once in Supabase SQL Editor

alter table public.etie_profiles add column if not exists display_name text;
alter table public.etie_profiles add column if not exists photo_url text;
alter table public.etie_profiles add column if not exists city text;
alter table public.etie_profiles add column if not exists nationality text;
alter table public.etie_profiles add column if not exists verification jsonb default '{}'::jsonb;
alter table public.etie_profiles add column if not exists memories jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists featured_memories jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists style_interests jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists personal_hook text;
alter table public.etie_profiles add column if not exists is_onboarded boolean default false;
alter table public.etie_profiles add column if not exists verification jsonb default '{}'::jsonb;
alter table public.etie_profiles add column if not exists memories jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists featured_memories jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists style_interests jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists personal_hook text;
alter table public.etie_profiles add column if not exists is_onboarded boolean default false;
