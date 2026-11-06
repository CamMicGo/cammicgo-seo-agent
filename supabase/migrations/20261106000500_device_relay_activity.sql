-- Separates "the app is open" (any poll, e.g. LinkedIn control) from "the transcript/NotebookLM
-- relay is running" and "it is allowed to take a YouTube job" (not in a YouTube 429 pause).
alter table public.cmg_devices
  add column if not exists relay_seen_at timestamptz,
  add column if not exists relay_claim_at timestamptz;

-- When the app pauses YouTube after an HTTP 429, it reports when it will resume.
alter table public.cmg_devices add column if not exists relay_paused_until timestamptz;
