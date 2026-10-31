-- Bring-your-own social app credentials (LinkedIn) and the resulting member connections.
-- Secrets and tokens are encrypted by the server (AES-256-GCM); only the service role reads these tables.
create table if not exists public.cmg_social_clients (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('linkedin')),
  client_id text not null,
  client_secret_enc text not null,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
create table if not exists public.cmg_social_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('linkedin')),
  encrypted_session text not null,
  account_name text,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.cmg_social_clients enable row level security;
alter table public.cmg_social_connections enable row level security;
revoke all on public.cmg_social_clients from anon, authenticated;
revoke all on public.cmg_social_connections from anon, authenticated;
