## Audit-driven polish for UNMAPPED submission

The app already satisfies every required bar in the brief. These three small fixes close the remaining visible gaps so judges can't ding you for them.

### Fix 1 — Multi-country client-side wage & education fallback
**Why:** `src/utils/econometricData.ts` currently hardcodes Morocco (MAD) wages and a single Wittgenstein projection. If the edge function returns partial data for a Ghana/India/Kenya user, the UI silently shows MAD — contradicting the country-agnostic claim.

**Change:**
- Restructure `iloWagesData` and `wageMajorBaseline` into `Record<countryIso3, …>` keyed by Morocco/India/Ghana/Kenya, mirroring `supabase/functions/_shared/econ-data/ilo-wages.json`.
- Restructure `wittgensteinProjections` into per-country object, mirroring `wittgenstein-2035.json`.
- Update `lookupWage(iscoCode, country)` and add `lookupEducationTrend(country)` signatures.
- Update callers in `src/routes/results.tsx` to pass the active country from `useProfile()`.

### Fix 2 — Apply `automation_calibration_factor` at lookup
**Why:** The DB column exists and the brief explicitly says "automation risk looks different in Kampala than in Kuala Lumpur". Right now we store the factor but don't visibly apply it.

**Change:**
- Extend `lookupAutomation()` to accept an optional `calibrationFactor` and clamp `probability * factor` to [0, 1].
- Pull the factor from `country_configs` via a small `useCountryConfig()` hook (cached) and pass it through on the results page.
- Show a one-line provenance note: *"Adjusted for {country} infrastructure context (factor {x})"* under the gauge so judges see the calibration is real, not cosmetic.

### Fix 3 — Reconfig demo banner
**Why:** The brief: *"show what it would take to reconfigure for a second context."* The switcher works, but there's no scripted moment that makes the reconfiguration legible during a 3-minute demo.

**Change:**
- Add a tiny dismissible banner above the results page (visible only when `?demo=1` is in the URL) reading: *"Demo: switch country in the header — wages, automation calibration, education trends, and language all reconfigure from `country_configs` with zero code changes."*
- Add a `data-demo-spotlight` attribute on the `CountrySwitcher` so the banner can highlight it with a soft pulse ring.

### Out of scope (intentionally)
- Expanding ESCO crosswalk beyond the current ~10 occupations (diminishing returns for demo).
- Adding O*NET / WB STEP — you already exceed the "≥2 signals" bar with 4 sources.
- Removing the duplicated ITU readiness data (low risk; both sources agree today).

### Files touched
- `src/utils/econometricData.ts` (restructure + signatures)
- `src/routes/results.tsx` (pass country, render calibration note + demo banner)
- `src/hooks/useCountryConfig.tsx` (new — cached fetch of active country's config row)
- `src/components/CountrySwitcher.tsx` (add `data-demo-spotlight`)

### Verification
- Manual: switch Morocco → Ghana in the header on the results page; confirm wages flip MAD→GHS, calibration note updates, education card shows Ghana trend.
- Open `/results?demo=1` and confirm banner + switcher pulse appear.