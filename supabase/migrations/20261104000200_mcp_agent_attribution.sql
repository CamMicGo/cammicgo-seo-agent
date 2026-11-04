alter table public.cmg_mcp_calls add column if not exists agent_name text not null default 'Assistant inconnu';
