-- Separate Google grant for YouTube only. A YouTube brand account (a channel owned by a Brand Account) can only
-- authorize YouTube scopes: Google answers "Service unavailable for your account" when Search Console, Analytics,
-- Gmail or Drive are requested together. This grant lets the user pick the brand channel at Google's account chooser,
-- while the main Google grant (Search Console, GA4, Drive...) stays on their personal account.
-- Encrypted session, server role only.
create table if not exists public.cmg_google_youtube (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_session text not null,
  channel_id text,
  channel_title text,
  updated_at timestamptz not null default now()
);
alter table public.cmg_google_youtube enable row level security;
revoke all on public.cmg_google_youtube from anon, authenticated;
