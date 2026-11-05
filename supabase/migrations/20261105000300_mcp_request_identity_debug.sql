alter table if exists public.cmg_mcp_calls add column if not exists request_debug jsonb;
comment on column public.cmg_mcp_calls.request_debug is 'Sanitized MCP request identity diagnostics; no authorization headers, cookies, tool arguments or message bodies.';
