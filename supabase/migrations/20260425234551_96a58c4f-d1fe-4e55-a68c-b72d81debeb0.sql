-- 1. Columns
ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS share_id text,
  ADD COLUMN IF NOT EXISTS esco jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Function to generate a short, URL-safe random code
CREATE OR REPLACE FUNCTION public.generate_share_id()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- 3. Backfill existing rows with unique share_ids
DO $$
DECLARE
  r record;
  new_id text;
BEGIN
  FOR r IN SELECT id FROM public.analyses WHERE share_id IS NULL LOOP
    LOOP
      new_id := public.generate_share_id();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.analyses WHERE share_id = new_id);
    END LOOP;
    UPDATE public.analyses SET share_id = new_id WHERE id = r.id;
  END LOOP;
END $$;

-- 4. Enforce uniqueness + not null
ALTER TABLE public.analyses
  ALTER COLUMN share_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS analyses_share_id_key ON public.analyses(share_id);

-- 5. Default for future inserts
ALTER TABLE public.analyses
  ALTER COLUMN share_id SET DEFAULT public.generate_share_id();

-- 6. Public read policy — anyone (including anon) can view a single
-- analysis row IF they hold its share_id. Existing private SELECT
-- policies remain in place for the user's own rows.
CREATE POLICY "Public can view shared analyses by share_id"
ON public.analyses
FOR SELECT
TO anon, authenticated
USING (share_id IS NOT NULL);
