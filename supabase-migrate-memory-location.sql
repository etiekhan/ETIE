-- Memories need coordinates + a place name to live on the Memory Map,
-- and must not be forced to belong to a hook (Door 2: hangouts that
-- happened off the app). Run once in Supabase SQL Editor.
--
-- Why: hangout_logs had no lat/lng/title/location columns at all, while the
-- Memory Map renderer filters on `lat != null && lng != null`. So every memory
-- was invisible on the map, no matter how it was logged. hook_id was also
-- NOT NULL, which made hook-less memories impossible to store cleanly.

alter table public.hangout_logs add column if not exists lat double precision;
alter table public.hangout_logs add column if not exists lng double precision;
alter table public.hangout_logs add column if not exists title text;
alter table public.hangout_logs add column if not exists location text;

-- Standalone memories have no hook. Drop NOT NULL so 'no hook' is null, not ''.
update public.hangout_logs set hook_id = '' where hook_id is null;
alter table public.hangout_logs alter column hook_id drop not null;

create index if not exists hangout_logs_taken_idx on public.hangout_logs(taken_at desc);
create index if not exists hangout_logs_loc_idx on public.hangout_logs(lat, lng);