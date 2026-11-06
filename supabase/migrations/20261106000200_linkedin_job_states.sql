-- LinkedIn jobs: know whether the phone's LinkedIn control is really polling (not only the background
-- transcript relay), and give queued jobs 10 minutes (the user often confirms from another app).
alter table public.cmg_devices add column if not exists linkedin_seen_at timestamptz;
alter table public.cmg_linkedin_jobs alter column expires_at set default now()+interval '10 minutes';
