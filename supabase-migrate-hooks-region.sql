-- ETIE hooks: add region + photos columns (idempotent)
alter table public.hooks add column if not exists region text default 'HK';
alter table public.hooks add column if not exists photos jsonb not null default '[]'::jsonb;
update public.hooks set user_id='9f2e8d41-0394-4e25-9758-e1d7c7b52a2a' where location ilike '%fleming%' and user_id is null;