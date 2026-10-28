-- Google-to-MCP identity mapping groundwork. Separate private schema; no public API grants.
alter table cmg_private.accounts add column if not exists supabase_user_id uuid unique;
alter table cmg_private.google_connections add column if not exists credential_key_version integer not null default 1;
alter table cmg_private.google_connections add column if not exists google_subject_hash text;
alter table cmg_private.google_connections add column if not exists consented_at timestamptz;
alter table cmg_private.google_connections add column if not exists last_verified_at timestamptz;
create unique index if not exists cmg_google_connections_account_subject on cmg_private.google_connections(account_id,google_subject_hash) where revoked_at is null and google_subject_hash is not null;
create index if not exists cmg_google_connections_account on cmg_private.google_connections(account_id) where revoked_at is null;
-- No public policies or privileged endpoints are created. Client and Google account authorization
-- must be validated server-side before inserting/updating records.
