-- A LinkedIn app shared by every CamMicGo user (the simple way to connect): an administrator promotes the app
-- saved in their own account. Each user still authorizes with their own LinkedIn account, and every token only
-- lets that user post on their own profile. Users can keep bringing their own app instead.
-- The secret is encrypted by the server (AES-256-GCM); only the service role reads this table.
create table if not exists public.cmg_shared_social_apps (
  provider text primary key check (provider in ('linkedin')),
  client_id text not null,
  client_secret_enc text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.cmg_shared_social_apps enable row level security;
revoke all on public.cmg_shared_social_apps from anon, authenticated;
