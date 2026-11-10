-- Explicit transcription engine and authorized direct media URL for paired Android jobs.
ALTER TABLE public.cmg_transcript_jobs
  ADD COLUMN IF NOT EXISTS transcription_mode text NOT NULL DEFAULT 'auto'
    CHECK (transcription_mode IN ('auto','youtube','qwen')),
  ADD COLUMN IF NOT EXISTS authorized_audio_url text,
  ADD COLUMN IF NOT EXISTS audio_authorized boolean NOT NULL DEFAULT false;
-- URL is a short-lived job input; it is deleted with the existing job expiry cleanup.
