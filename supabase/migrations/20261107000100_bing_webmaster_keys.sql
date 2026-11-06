-- Per-user Bing Webmaster Tools API key. Encrypted with AES-256-GCM on the server
-- (SESSION_ENCRYPTION_KEY); only the server role reads this table, never the browser or the AI assistant.
create table if not exists public.cmg_bing_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_enc text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cmg_bing_keys enable row level security;
