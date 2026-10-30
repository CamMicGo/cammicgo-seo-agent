-- Failed pairing attempts per hashed client IP, used to rate-limit POST /api/devices/pair.
create table if not exists public.cmg_pairing_attempts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists cmg_pairing_attempts_ip_idx on public.cmg_pairing_attempts(ip_hash, created_at desc);
alter table public.cmg_pairing_attempts enable row level security;
revoke all on public.cmg_pairing_attempts from anon, authenticated;
