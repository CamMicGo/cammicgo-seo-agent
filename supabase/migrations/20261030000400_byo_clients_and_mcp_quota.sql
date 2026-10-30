-- Bring-your-own Google Cloud OAuth client per user, administrators allowed to use the shared
-- CamMicGo project, and per-user MCP call quotas (protects the free Vercel/Supabase hosting).

create table if not exists public.cmg_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.cmg_google_clients (
  user_id uuid primary key references auth.users(id) on delete cascade,
  project_id text,
  client_id text not null,
  client_secret_enc text not null,      -- AES-256-GCM, key only on the server (SESSION_ENCRYPTION_KEY)
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cmg_mcp_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  calls integer not null default 0,     -- counted (costly) tool calls today
  minute_start timestamptz,
  minute_calls integer not null default 0,
  minute_costly integer not null default 0,
  primary key (user_id, usage_date)
);

alter table public.cmg_admins enable row level security;
alter table public.cmg_google_clients enable row level security;
alter table public.cmg_mcp_usage enable row level security;
-- No policies: only the server (service role) reads or writes these tables.

/**
 * Records one MCP tool call. p_cost = 1 for calls that count against the daily allowance.
 * Returns {ok, reason, used, limit}. reason: daily | minute | global.
 */
create or replace function public.cmg_consume_mcp_call(
  p_user_id uuid, p_cost integer, p_daily integer, p_minute_costly integer, p_minute_total integer, p_global integer)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  this_minute timestamptz := date_trunc('minute', now());
  r public.cmg_mcp_usage;
  global_used integer;
begin
  insert into public.cmg_mcp_usage(user_id, usage_date, minute_start) values (p_user_id, today, this_minute)
  on conflict (user_id, usage_date) do nothing;
  select * into r from public.cmg_mcp_usage where user_id = p_user_id and usage_date = today for update;
  if r.minute_start is distinct from this_minute then
    r.minute_start := this_minute; r.minute_calls := 0; r.minute_costly := 0;
  end if;
  if r.minute_calls >= p_minute_total or (p_cost > 0 and r.minute_costly >= p_minute_costly) then
    update public.cmg_mcp_usage set minute_start = r.minute_start, minute_calls = r.minute_calls, minute_costly = r.minute_costly
     where user_id = p_user_id and usage_date = today;
    return jsonb_build_object('ok', false, 'reason', 'minute', 'used', r.calls, 'limit', p_daily);
  end if;
  if p_cost > 0 and r.calls >= p_daily then
    return jsonb_build_object('ok', false, 'reason', 'daily', 'used', r.calls, 'limit', p_daily);
  end if;
  if p_cost > 0 then
    select coalesce(sum(calls), 0) into global_used from public.cmg_mcp_usage where usage_date = today;
    if global_used >= p_global then
      return jsonb_build_object('ok', false, 'reason', 'global', 'used', r.calls, 'limit', p_daily);
    end if;
  end if;
  update public.cmg_mcp_usage
     set calls = r.calls + p_cost, minute_start = r.minute_start,
         minute_calls = r.minute_calls + 1, minute_costly = r.minute_costly + p_cost
   where user_id = p_user_id and usage_date = today;
  return jsonb_build_object('ok', true, 'reason', null, 'used', r.calls + p_cost, 'limit', p_daily);
end $$;

revoke all on function public.cmg_consume_mcp_call(uuid, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.cmg_consume_mcp_call(uuid, integer, integer, integer, integer, integer) to service_role;
