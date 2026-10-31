-- Separate Google grant for Drive writing (drive.file / drive): Google refuses to request drive.file together with
-- YouTube scopes in one authorization, so the write grant gets its own token. Encrypted, server role only.
create table if not exists public.cmg_google_drive_write (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_session text not null,
  updated_at timestamptz not null default now()
);
alter table public.cmg_google_drive_write enable row level security;
revoke all on public.cmg_google_drive_write from anon, authenticated;
