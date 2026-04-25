# Configuring a new country in Sawt-Net

> _UNMAPPED brief: "Country-specific parameters should be inputs to your system, not hardcoded assumptions."_

Sawt-Net treats every country as a row in a single Postgres table — `public.country_configs`. **No code change is needed** to add a new country: insert a row, and the country switcher, the `analyze-skills` edge function, the policymaker dashboard, and the wage / automation lookups all pick it up on the next request.

## The contract

| Column | Type | Purpose |
|---|---|---|
| `iso3` | `text PRIMARY KEY` | ISO 3166-1 alpha-3 code (`MAR`, `IND`, `GHA`, `KEN`, …). |
| `display_name` | `text` | What the user sees ("Morocco"). |
| `currency` | `text` | 3-letter currency code shown next to wages. |
| `primary_language` | `text` | First language for prompts and TTS. |
| `secondary_languages` | `text[]` | Fallback languages for prompts. |
| `automation_calibration_factor` | `numeric` | Multiplier applied to the Frey-Osborne probability per skill. `< 1` means **less automatable** than the US baseline (use for low-infrastructure LMIC contexts). Range 0–1.5. |
| `opportunity_types` | `text[]` | Subset of `formal`, `gig`, `self_employment`, `training`. The edge function only returns matches for the types listed. |
| `digital_readiness_pct` | `numeric` | ITU mobile-broadband penetration. Used to filter out remote-only suggestions when below 60%. |

## Three ways to add a country

### 1. UI (admin role required)

Sign in as an admin and visit `/admin/configs`. Fill the form, click **Add country**. Done.

### 2. SQL

```sql
INSERT INTO public.country_configs
  (iso3, display_name, currency, primary_language, secondary_languages,
   automation_calibration_factor, opportunity_types, digital_readiness_pct)
VALUES
  ('NGA', 'Nigeria', 'NGN', 'English', ARRAY['Hausa','Yoruba','Igbo'],
   0.78, ARRAY['formal','gig','self_employment','training'], 55);
```

### 3. CSV bulk-import

Drop a CSV into your data ops pipeline and `\copy` it into the table. Same columns, same effect.

## What you also need to provide (data, not code)

To get **real** signals (not LLM guesses) for a new country, drop the following JSON files into `supabase/functions/_shared/econ-data/` keyed by ISO-3:

- `ilo-wages.json` → `countries.<ISO3>` block with `currency`, `year`, `wage_by_isco_major` (1-digit ISCO → median monthly wage).
- `wittgenstein-2035.json` → `countries.<ISO3>` block with `secondary_or_higher_2025_pct`, `secondary_or_higher_2035_pct`, `narrative_en`.

Frey-Osborne automation probabilities are universal (mapped from SOC → ISCO-08) — no per-country file needed; the calibration factor handles the LMIC adjustment.

## What stays in code (and why)

- The skill-extraction prompt, because it must remain auditable.
- The shadcn UI primitives.
- The Frey-Osborne base table — universal across countries, only the calibration factor varies.

Everything else is config.
