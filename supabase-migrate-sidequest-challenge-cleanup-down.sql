-- Down migration: re-add columns (data won't be restored)
alter table public.hangout_logs add column if not exists is_sidequest boolean not null default false;
alter table public.hangout_logs add column if not exists challenge_prompt text;
alter table public.hangout_logs add column if not exists parent_challenge_id uuid references public.hangout_logs(id) on delete set null;
alter table public.hangout_logs add column if not exists challenge_expires_at timestamptz;

-- Re-create old votes table
create table if not exists public.sidequest_votes (
  id uuid primary key default gen_random_uuid(),
  entry_memory_id uuid not null references public.hangout_logs(id) on delete cascade,
  challenge_id uuid not null references public.hangout_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(entry_memory_id, user_id)
);
alter table public.sidequest_votes enable row level security;
create policy "sidequest votes read all" on public.sidequest_votes for select using (true);
create policy "sidequest votes insert own" on public.sidequest_votes for insert with check (auth.uid() = user_id);
create policy "sidequest votes delete own" on public.sidequest_votes for delete using (auth.uid() = user_id);

-- Re-create old reports table
create table if not exists public.challenge_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  entry_memory_id uuid not null references public.hangout_logs(id) on delete cascade,
  challenge_id uuid not null references public.hangout_logs(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.challenge_reports enable row level security;
create policy "challenge reports read own" on public.challenge_reports for select using (auth.uid() = reporter_id);
create policy "challenge reports insert own" on public.challenge_reports for insert with check (auth.uid() = reporter_id);
