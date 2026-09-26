-- Etie — add missing profile columns (run once in SQL Editor)
alter table public.etie_profiles add column if not exists nationality text default 'PT';
alter table public.etie_profiles add column if not exists tier text default 'Rookie';
alter table public.etie_profiles add column if not exists hosted_count int default 0;
alter table public.etie_profiles add column if not exists avg_host_rating numeric default 0;
alter table public.etie_profiles add column if not exists "references" jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists activities jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists avail_dates jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists travel_photos jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists social_vibe int default 1;
alter table public.etie_profiles add column if not exists travel_pace int default 1;
alter table public.etie_profiles add column if not exists style_interests jsonb default '[]'::jsonb;
alter table public.etie_profiles add column if not exists traveller_nationality text default 'HK';
alter table public.etie_profiles add column if not exists district text default 'Central / Soho';