-- Optional per-user API keys for scientific sources (Semantic Scholar, OpenAlex, NCBI/PubMed).
-- Keys are encrypted with AES-256-GCM on the server (SESSION_ENCRYPTION_KEY); only the server role reads this table.
create table if not exists public.cmg_science_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('semanticscholar','openalex','pubmed')),
  key_enc text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.cmg_science_keys enable row level security;
