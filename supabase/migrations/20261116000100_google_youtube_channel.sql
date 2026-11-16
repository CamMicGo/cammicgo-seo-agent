-- Separate Google grants for YouTube only, one per channel. A YouTube brand account (a channel owned by a Brand
-- Account) can only authorize YouTube scopes: Google answers "Service unavailable for your account" when Search
-- Console, Analytics, Gmail or Drive are requested together. Each grant is made at Google's account chooser, so a
-- user can connect several channels (brand accounts) while the main Google grant (Search Console, GA4, Drive...)
-- stays on their personal account. The assistant asks which channel to use when there are several.
-- Encrypted session, server role only.
create table if not exists public.cmg_google_youtube (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id text not null,
  channel_title text,
  encrypted_session text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);
alter table public.cmg_google_youtube enable row level security;
revoke all on public.cmg_google_youtube from anon, authenticated;
