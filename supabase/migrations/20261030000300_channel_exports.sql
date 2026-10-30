-- Batch transcripts of a YouTube channel, assembled into one document (e.g. one NotebookLM source).
-- One row per user, channel and language; re-running the batch refreshes the video list and keeps the export URL.
create table if not exists public.cmg_channel_exports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  channel_id     text not null check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  channel_title  text,
  language       text not null default 'original' check (char_length(language) between 2 and 12),
  videos         jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, channel_id, language)
);
alter table public.cmg_channel_exports enable row level security;
revoke all on public.cmg_channel_exports from anon, authenticated;
create index if not exists cmg_transcript_jobs_user_video_idx on public.cmg_transcript_jobs(user_id, video_id, status);

-- Interactive requests (10-minute expiry) are handed out before batch requests (2-hour expiry).
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
      order by q.expires_at, q.created_at
      limit 1
      for update skip locked)
  returning j.id, j.video_id, j.language;
end $$;
revoke all on function public.cmg_claim_transcript_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cmg_claim_transcript_job(uuid, uuid) to service_role;
