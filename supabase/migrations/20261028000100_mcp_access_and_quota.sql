-- CamMicGo SEO Agent — dedicated database only. Do not apply to another product.
-- Private server-side schema: no public Data API endpoints, no RLS bypass through public functions.
create schema if not exists cmg_private;
revoke all on schema cmg_private from public, anon, authenticated;
create table if not exists cmg_private.accounts (
  id uuid primary key default gen_random_uuid(),
  google_subject_hash text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists cmg_private.google_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references cmg_private.accounts(id) on delete cascade,
  encrypted_credentials bytea not null,
  granted_scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table if not exists cmg_private.agent_grants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references cmg_private.accounts(id) on delete cascade,
  client_id text not null,
  token_hash text not null unique,
  allowed_sites text[] not null default '{}',
  allowed_ga4_properties text[] not null default '{}',
  granted_scopes text[] not null default '{}',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cmg_agent_grants_account_idx on cmg_private.agent_grants(account_id);
create table if not exists cmg_private.daily_usage (
  account_id uuid not null references cmg_private.accounts(id) on delete cascade,
  usage_date date not null,
  requests_used integer not null default 0 check (requests_used >= 0),
  primary key (account_id, usage_date)
);
create table if not exists cmg_private.usage_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references cmg_private.accounts(id) on delete cascade,
  event_day date not null,
  source text not null check(source in ('mcp','web')),
  category text not null,
  created_at timestamptz not null default now()
);
create index if not exists cmg_usage_events_account_day_idx on cmg_private.usage_events(account_id,event_day);
alter table cmg_private.accounts enable row level security;
alter table cmg_private.google_connections enable row level security;
alter table cmg_private.agent_grants enable row level security;
alter table cmg_private.daily_usage enable row level security;
alter table cmg_private.usage_events enable row level security;
-- No anon/authenticated RLS policies: only the dedicated trusted backend role can access data.
-- Rate limiter must perform an atomic upsert + increment in one SQL transaction,
-- refuse when requests_used >= per-account daily limit, and write the event in the same transaction.
-- No public SECURITY DEFINER function is installed by this migration.
