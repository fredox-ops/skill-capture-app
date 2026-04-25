-- 1. Table for the country-agnostic infrastructure layer.
CREATE TABLE public.country_configs (
  iso3 TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  primary_language TEXT NOT NULL,
  secondary_languages TEXT[] NOT NULL DEFAULT '{}',
  automation_calibration_factor NUMERIC NOT NULL DEFAULT 1.0,
  opportunity_types TEXT[] NOT NULL DEFAULT '{formal,gig,self_employment,training}',
  digital_readiness_pct NUMERIC NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.country_configs ENABLE ROW LEVEL SECURITY;

-- Public read so the country switcher works for anonymous demo users.
CREATE POLICY "Country configs are viewable by everyone"
  ON public.country_configs
  FOR SELECT
  USING (true);

-- Admin-only writes.
CREATE POLICY "Admins can insert country configs"
  ON public.country_configs
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update country configs"
  ON public.country_configs
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete country configs"
  ON public.country_configs
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at.
CREATE TRIGGER update_country_configs_updated_at
  BEFORE UPDATE ON public.country_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Seed the 4 demo countries.
INSERT INTO public.country_configs
  (iso3, display_name, currency, primary_language, secondary_languages, automation_calibration_factor, opportunity_types, digital_readiness_pct)
VALUES
  ('MAR', 'Morocco', 'MAD', 'Arabic',  ARRAY['French','English'],          0.85, ARRAY['formal','gig','self_employment','training'], 84),
  ('IND', 'India',   'INR', 'Hindi',   ARRAY['English'],                   0.90, ARRAY['formal','gig','self_employment','training'], 67),
  ('GHA', 'Ghana',   'GHS', 'English', ARRAY['Twi','Hausa'],               0.75, ARRAY['formal','gig','self_employment','training'], 53),
  ('KEN', 'Kenya',   'KES', 'English', ARRAY['Swahili'],                   0.78, ARRAY['formal','gig','self_employment','training'], 48);