-- LinkedIn photos and logos shown in ChatGPT/Claude: chat apps only display https images, not data: URLs.
-- Each thumbnail (64 px JPEG, a few KB) gets an unguessable link, served for 24 hours, then deleted.
create table if not exists public.cmg_linkedin_thumbs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 jpeg_b64 text not null check (length(jpeg_b64) <= 16000),
 created_at timestamptz not null default now()
);
create index if not exists cmg_linkedin_thumbs_created on public.cmg_linkedin_thumbs (created_at);
alter table public.cmg_linkedin_thumbs enable row level security;
-- No policy: only the server (service role) reads and writes.
