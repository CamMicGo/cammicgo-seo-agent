-- CamMicGo SEO Agent — device transcript relay.
-- The remote MCP (Vercel) cannot fetch YouTube captions: YouTube answers LOGIN_REQUIRED
-- ("confirm you're not a bot") to cloud IPs. A paired device (Android app) running on a
-- residential connection claims transcript jobs, fetches the captions and posts them back.
--
-- Accessed only by the backend with the Supabase secret key (service role), like
-- mcp_google_connections. RLS is enabled with no policies, and anon/authenticated get nothing.

create table if not exists public.cmg_pairing_codes (
  code_hash   text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index if not exists cmg_pairing_codes_user_idx on public.cmg_pairing_codes(user_id);

create table if not exists public.cmg_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null default 'Android' check (char_length(name) <= 80),
  token_hash    text not null unique,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  revoked_at    timestamptz
);
create index if not exists cmg_devices_user_idx on public.cmg_devices(user_id) where revoked_at is null;

create table if not exists public.cmg_transcript_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  video_id      text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  language      text not null default 'en' check (char_length(language) between 2 and 12),
  status        text not null default 'pending' check (status in ('pending','claimed','done','error')),
  device_id     uuid references public.cmg_devices(id) on delete set null,
  result        jsonb,
  error         text check (error is null or char_length(error) <= 2000),
  created_at    timestamptz not null default now(),
  claimed_at    timestamptz,
  completed_at  timestamptz,
  expires_at    timestamptz not null default now() + interval '10 minutes'
);
create index if not exists cmg_transcript_jobs_queue_idx on public.cmg_transcript_jobs(user_id, status, created_at);
create index if not exists cmg_transcript_jobs_cache_idx on public.cmg_transcript_jobs(video_id, language, completed_at desc) where status = 'done';

alter table public.cmg_pairing_codes   enable row level security;
alter table public.cmg_devices         enable row level security;
alter table public.cmg_transcript_jobs enable row level security;
revoke all on public.cmg_pairing_codes, public.cmg_devices, public.cmg_transcript_jobs from anon, authenticated;

-- Atomically hand the oldest pending, unexpired job of this user to one device.
-- A job claimed more than 90 seconds ago without an answer is handed out again.
create or replace function public.cmg_claim_transcript_job(p_user_id uuid, p_device_id uuid)
returns table(id uuid, video_id text, language text)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  update public.cmg_transcript_jobs j
     set status = 'claimed', device_id = p_device_id, claimed_at = now()
   where j.id = (
     select q.id from public.cmg_transcript_jobs q
      where q.user_id = p_user_id
        and q.expires_at > now()
        and (q.status = 'pending' or (q.status = 'claimed' and q.claimed_at < now() - interval '90 seconds'))
      order by q.created_at
      limit 1
      for update skip locked)
  returning j.id, j.video_id, j.language;
end $$;
revoke all on function public.cmg_claim_transcript_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cmg_claim_transcript_job(uuid, uuid) to service_role;
