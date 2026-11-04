-- Record the client identity alongside MCP tool audit events.
-- Values are advisory: clients may omit or spoof their user agent.
alter table if exists public.cmg_mcp_calls
  add column if not exists agent_name text not null default 'Assistant inconnu';
create index if not exists cmg_mcp_calls_user_agent_idx
  on public.cmg_mcp_calls (user_id, agent_name);
