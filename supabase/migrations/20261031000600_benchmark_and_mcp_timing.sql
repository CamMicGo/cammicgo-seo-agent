-- Benchmark runs (web-only vs CamMicGo) and per-call timing of MCP tools, readable only by the server role.
create table if not exists public.cmg_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  mode text not null check (mode in ('web','cammicgo')),
  assistant text not null,
  duration_ms integer not null check (duration_ms >= 0),
  started_at timestamptz,
  answer text not null,
  metrics jsonb not null default '{}'::jsonb,
  mcp_calls jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cmg_benchmark_runs_user_idx on public.cmg_benchmark_runs (user_id, created_at desc);
alter table public.cmg_benchmark_runs enable row level security;

create table if not exists public.cmg_mcp_calls (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  ms integer not null,
  ok boolean not null default true,
  at timestamptz not null default now()
);
create index if not exists cmg_mcp_calls_user_at_idx on public.cmg_mcp_calls (user_id, at desc);
alter table public.cmg_mcp_calls enable row level security;
