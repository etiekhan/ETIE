-- Etie hard wall: onboarding flag + invite codes — run once in SQL Editor
alter table public.etie_profiles add column if not exists is_onboarded boolean not null default false;
create table if not exists public.invite_codes (
  code text primary key,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  note text default '',
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
drop policy if exists "invite codes read auth" on public.invite_codes;
create policy "invite codes read auth" on public.invite_codes for select using (auth.uid() is not null);
drop policy if exists "invite codes claim own" on public.invite_codes;
create policy "invite codes claim own" on public.invite_codes for update using (auth.uid() is not null) with check (auth.uid() is not null);
-- seed founder codes (share privately; add more rows as needed)
insert into public.invite_codes (code, note) values
  ('ETIE-HK-A7Q2','founder batch 1'),
  ('ETIE-HK-M9D4','founder batch 1'),
  ('ETIE-HK-Z3P8','founder batch 1'),
  ('ETIE-HK-K6W2','founder batch 1'),
  ('ETIE-HK-T5N9','founder batch 1')
on conflict (code) do nothing;
