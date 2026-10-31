-- One publication per user confirmation (LinkedIn posts, YouTube uploads): the first confirmed call claims
-- the confirmation, a repeated call (retry after a timeout, a looping assistant) finds the claim and publishes
-- nothing again. Also a minimal record of what was published (network, link). Only the service role reads it.
create table if not exists public.cmg_publish_log (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  network text not null check (network in ('linkedin', 'youtube')),
  status text not null default 'started' check (status in ('started', 'published')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cmg_publish_log_user_idx on public.cmg_publish_log (user_id, created_at desc);
alter table public.cmg_publish_log enable row level security;
revoke all on public.cmg_publish_log from anon, authenticated;
