# Plan — Close the remaining UNMAPPED brief gaps

You've already shipped the hard stuff (real Frey-Osborne + ILOSTAT + Wittgenstein signals, voice-first UX, policymaker dashboard, ISCO-08 mapping). This plan covers the **7 remaining items the brief explicitly asks for** that aren't in the code yet.

I'll do this in 4 phases. Each is independently shippable. Phases A + B alone clear the "country-agnostic infrastructure" requirement, which is the single biggest gap.

---

## Phase A — Country-agnostic config layer (gaps G1, G5)

**Why:** The brief says *"Country-specific parameters should be inputs to your system, not hardcoded assumptions"* and asks you to *"show what it would take to reconfigure for a second context"*. Today, country names, currencies, languages, and prompts are hardcoded TS strings.

**Database**
- New table `country_configs` with columns: `iso3` (PK), `display_name`, `currency`, `primary_language`, `secondary_languages` (text[]), `automation_calibration_factor` (numeric, default 1.0), `opportunity_types` (text[], e.g. `['formal','gig','self_employment','training']`), `digital_readiness_pct` (numeric, ITU mobile-broadband %), `created_at`.
- RLS: read = public (anon allowed for the demo switcher); write = admin only.
- Seed rows for **Morocco, India, Ghana, Kenya** using values from your existing JSON datasets.

**Edge function refactor**
- `analyze-skills` reads country config from the DB instead of `country === "India"` literals. Pass `automation_calibration_factor` into the resilience-score formula so LMIC contexts can be tuned (brief: *"automation risk looks different in Kampala than in Kuala Lumpur"*).
- `chat-followup` and `cover-letter` read `primary_language` / `secondary_languages` the same way.

**UI**
- New header dropdown (visible on `/`, `/results`, `/policy`) that lists all `country_configs` rows. Selecting one updates `profiles.country` + `profiles.language` and triggers a soft reload of any displayed signals. **This is the live demo moment.**
- New route `/admin/configs` (gated by `admin` role you already have) that lists all configs and lets you add a new country in <60 seconds.
- Add `docs/CONFIGURING_A_NEW_COUNTRY.md` so judges can read the contract.

**Files touched:** new migration; `supabase/functions/analyze-skills/index.ts`; `supabase/functions/_shared/econ-data/lookup.ts` (reads calibration); new `src/components/CountrySwitcher.tsx`; new `src/routes/admin.configs.tsx`; new doc.

---

## Phase B — Portable skills profile + ESCO mapping (gaps G2, G4)

**Why:** Module 1 explicitly requires *"portable across borders & sectors"*. Today the profile only lives behind auth in your DB. The brief also lists **ESCO** alongside ISCO as a required taxonomy.

**Portable profile**
- Add `analyses.share_id` (text, unique, default `gen_random_uuid()::text`) so each profile gets a stable public URL.
- New public route `/p/$shareId` rendering a read-only, printable profile card: name, ISCO + ESCO codes per skill, AI-resilience score with source, top 3 opportunities, QR code (use `qrcode.react` — pure JS, Worker-safe).
- New RLS policy: anyone (anon) can `SELECT` an `analyses` row when querying by `share_id` (without exposing `user_id` — fetched via a security-definer function `get_public_analysis(share_id)`).
- "Download as JSON" + "Copy share link" buttons on `/results` next to "Download CV".

**ESCO mapping**
- Bundle a trimmed ISCO-08 → ESCO occupation crosswalk (~100 KB JSON, just the codes you actually surface) at `supabase/functions/_shared/econ-data/isco-esco.json`.
- `lookup.ts` gets `lookupEsco(iscoCode)` returning `{ esco_uri, esco_label_en }`.
- `analyze-skills` returns `esco_uri` per skill; UI shows ISCO + ESCO chips side-by-side on the portable profile (and on `/results` in a small expander).

**Files touched:** new migration; new JSON; `lookup.ts`; `analyze-skills`; new `src/routes/p.$shareId.tsx`; `src/routes/results.tsx` (share buttons + ESCO chips); `bun add qrcode.react`.

---

## Phase C — Adjacent durable skills + ITU digital readiness (gaps G3, G6)

**Why:** Module 2 requires *"what adjacent skills would increase resilience"*. ITU digital-readiness was listed as a calibration source. Both are currently absent.

**Adjacent skills**
- New `supabase/functions/_shared/econ-data/adjacent-skills.json`: for each ISCO major group, 3 ESCO skills with **lower** Frey-Osborne probability (e.g. for `7422 ICT install` → `digital troubleshooting`, `customer onboarding`, `network basics`).
- `analyze-skills` appends a `resilience_skills[]` block per skill.
- New "Build resilience next" card on `/results`: shows the 3 adjacent skills as teal pill tags + a one-line "why this is more durable" footnote per skill.

**ITU digital readiness**
- Add `digital_readiness_pct` per country (Phase A column). Bundle ITU mobile-broadband-penetration values for the 4 demo countries.
- Render an honest banner on `/results`: *"Mobile broadband reach in {country}: {pct}% — we filter out remote-only roles below 60%."*
- Filter `opportunities` server-side: skip remote-only suggestions when penetration < 60%.

**Files touched:** new JSON; `lookup.ts`; `analyze-skills`; `src/routes/results.tsx` (resilience card + ITU banner); seed update for `country_configs`.

---

## Phase D — Configurable opportunity types + demo polish (gap G7)

**Why:** Brief lists *"formal employment, self-employment, gig, training pathways"* as configurable opportunity types. Today only formal jobs are surfaced.

- `country_configs.opportunity_types` already added in Phase A. Use it now.
- `analyze-skills` returns 1 opportunity per type listed in the country's config (not always 3 formal). Each opportunity gets a `type` field.
- Results UI groups opportunities under tabs/sections per type with localized labels and matching icons (briefcase / handshake / wrench / graduation cap).
- Add a small "What we don't know" panel on `/results` (judges explicitly reward honesty) listing the limits: national medians, Frey-Osborne LMIC caveats, no real-time wage data, ESCO crosswalk coverage gaps.

**Files touched:** `analyze-skills`; `src/routes/results.tsx`; `src/lib/results-i18n.ts` (new labels).

---

## What this delivers vs the brief

| Brief criterion | Today | After A+B | After all 4 |
|---|---|---|---|
| Module 1 — portable, explainable | Strong | **Excellent** (ESCO + share URL + JSON) | Excellent |
| Module 2 — incl. adjacent skills | Strong (no adjacent) | Strong | **Excellent** |
| Module 3 — incl. configurable opp types | Strong | Strong | **Excellent** |
| Country-agnostic infrastructure | ❌ | ✅ + live switcher | ✅ + admin UI + docs |
| ≥2 real econometric signals visible | ✅ | ✅ | ✅ |
| Honest about limits | ✅ | ✅ | ✅ + dedicated panel |
| ITU digital readiness | ❌ | ❌ | ✅ |
| Demo: reconfigure for a second country live | ❌ | ✅ (header dropdown) | ✅ |

---

## Recommended order if time is tight

- **Half-day budget:** Phase A only. Single biggest remaining scoring win — turns "an app" into "infrastructure" (the literal brief word).
- **Full-day budget:** A → B → C → D in order. Phase B's public share URL is what Amara would actually carry to a new employer; Phase C is the resilience story the judges will ask about.

After approval I'll start with **Phase A** (DB migration + `country_configs` table + edge-function refactor + header switcher + admin route). I'll come back for sign-off before each subsequent phase so you stay in control.
