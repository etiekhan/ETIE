-- Add co-tagging columns if they don't exist (run this BEFORE the privacy migration)
-- Safe to run multiple times.
alter table public.hangout_logs add column if not exists tagged_user_id uuid references auth.users(id) on delete set null;
alter table public.hangout_logs add column if not exists tagged_nickname text;
alter table public.hangout_logs add column if not exists status text not null default 'pending' check (status in ('pending','confirmed','expired'));
alter table public.hangout_logs add column if not exists handshake_note text;
alter table public.hangout_logs add column if not exists confirmed_at timestamptz;
create index if not exists hangout_logs_tagged_idx on public.hangout_logs(tagged_user_id, status);