ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS signals jsonb NOT NULL DEFAULT '{}'::jsonb;