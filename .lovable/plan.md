
# UNMAPPED Hackathon — Honest Audit of Sawt-Net

I went through the brief line by line and matched it to what's actually in your codebase (`analyze-skills`, `chat-followup`, `cover-letter`, `tts` edge functions; `OnboardingFlow`, `results.tsx`, `CvModal`, `SmartApplyModal`, `results-i18n`). Here is the truth — no fluff.

---

## ✅ What you already do well (keep)

| Requirement | Status | Where |
|---|---|---|
| **Voice-first UX for low-literacy users** | ✅ Strong | `OnboardingFlow`, mic-only chat, TTS auto-play, audio error cues |
| **Multilingual / localizable UI** (Arabic/Darija, French, English, Hindi + RTL) | ✅ Strong | `results-i18n.ts`, `getRecognitionLang`, per-language greetings |
| **ISCO-08 skills mapping** (Module 1 backbone) | ✅ Done | `analyze-skills` returns `{name, isco_code}` per skill |
| **AI displacement risk score + level** (Module 2 core) | ✅ Done | `ai_risk_score`, `ai_risk_level` (Low/Med/High), color-coded |
| **Opportunity matching with local wage + live listings** (Module 3 core) | ✅ Done | `opportunities[]` + Tavily-enriched real job listings |
| **Country switching (Morocco / India)** | ✅ Partial | wage currency + country prompt vary |
| **CV generator + Smart Apply cover letter** | ✅ Bonus | `CvModal`, `cover-letter` function |
| **Low-bandwidth resilience** | ✅ Strong | retry loop, audio-visual fallbacks, no text input required |

You're already ahead of most generic "youth dashboard" submissions.

---

## ❌ What the brief explicitly requires that you DON'T do yet

These are the gaps the judges will mark you down for. Ranked by how badly they hurt your score.

### 🔴 CRITICAL — required by the brief, currently missing

1. **No real econometric data sources surfaced to the user** *(Required: "Must surface at least two real econometric signals visibly to the user — not buried in the algorithm")*
   - You show an AI-guessed `ai_risk_score` and an AI-guessed `local_wage`. Both are **LLM hallucinations**, not real data.
   - Brief demands ≥2 signals from named sources: ILOSTAT, World Bank WDI/HCI, Frey-Osborne, ILO task indices, World Bank STEP, Wittgenstein Centre.
   - **This alone can disqualify you from the "strong submission" tier.**

2. **No real automation exposure dataset** *(Required: "at least one real automation exposure dataset (e.g. Frey-Osborne, ILO task indices, World Bank STEP)")*
   - Your AI-risk score is currently vibes-based. It must be calibrated against a real dataset keyed by ISCO-08 code.

3. **Country-agnostic / pluggable infrastructure** *(Required: "must not be hardcoded to one country", config-driven)*
   - Country list, currency, language, automation calibration, and wage data are all hardcoded in TS strings & prompts.
   - Brief explicitly asks: *"show your tool configured for one context, then show what it would take to reconfigure for a second"*. You cannot do this today without editing source.

4. **No Wittgenstein Centre 2025–2035 education projections** *(Required for Module 2)*
   - Brief: *"Use the Wittgenstein Centre 2025–2035 education projections to show how the landscape is shifting, not just where it stands today."*

5. **No policymaker / aggregate dashboard** *(Required for Module 3: "dual interface — one for the youth user, one for a policymaker")*
   - You only have the youth view.

### 🟠 HIGH — strongly implied, missing

6. **Portable / shareable skills profile** *(Required for Module 1: "portable across borders & sectors")*
   - Profile lives in your DB only. No export (JSON/QR/shareable URL) so Amara can carry it to a new employer.

7. **No "adjacent skills to increase resilience" recommendation** *(Required for Module 2)*
   - You report risk but don't tell the user *which durable skills to add next*.

8. **No "honest about limits" disclosure** *(Brief explicitly rewards this)*
   - Strong submissions "are honest about what they don't know." You currently present AI guesses as facts.

### 🟡 MEDIUM — would clearly differentiate vs MIT teams

9. **No ESCO / O*NET cross-mapping** alongside ISCO (brief lists all three as the taxonomy backbone)
10. **No ITU digital readiness signal** to calibrate digital-skills suggestions per country
11. **No demonstration of reconfiguring for a second country** in the demo flow itself

---

## 🏆 Plan to close the gaps and win

I'll do this in **5 focused phases**. Each is shippable on its own; even phases 1–3 alone would move you from "nice voice app" to "strong UNMAPPED submission".

### Phase 1 — Real econometric signals (kills gaps #1, #2, #4, #8)
**Single biggest scoring win.** Stop hallucinating, start citing.

- Add `supabase/functions/_shared/econ-data/` with three small JSON datasets bundled into the function (no external API calls at runtime — works on weak 3G):
  - `frey-osborne.json` — automation probability (0–1) keyed by ISCO-08 4-digit code (derived from the published Frey-Osborne SOC→probability table, mapped to ISCO via the ILO crosswalk).
  - `ilo-wages.json` — median monthly wage by ISCO-08 + country (ISO-3) from ILOSTAT mean-nominal-wage tables. Cover the demo countries (MAR, IND, GHA, KEN to start).
  - `wittgenstein-2035.json` — projected % of population with secondary+ education by country, 2025 vs 2035 (Wittgenstein SSP2 scenario, trimmed to demo countries).
- Rewrite `analyze-skills` so the LLM only extracts `{name, isco_code}` — **all numeric signals come from the JSON lookups**, not from the model.
- For each ISCO code, return:
  - `automation_probability` + source: "Frey & Osborne (2017)"
  - `local_wage_median` + source: "ILOSTAT mean nominal wage, 2023"
  - `education_trend_2025_2035` + source: "Wittgenstein Centre, SSP2"
- Show **source citations under every number** in the Results UI ("source: ILOSTAT 2023"). This single change is what "strong submissions surface the data" means.
- Add a tiny "honest limits" footer: *"Wages are national medians, not local offers. Automation scores are derived from Frey-Osborne and may understate manual-task resilience in LMIC contexts."*

### Phase 2 — Country-agnostic config layer (kills gap #3)
Make localizability a **design feature**, not a slide.

- New table `country_configs` with columns: `iso3, display_name, currency, primary_language, secondary_languages[], wage_source_id, automation_calibration_factor, opportunity_types[]`.
- New table `taxonomy_overrides` so a country admin can map a local credential ("Bac+2 Maroc") to an ISCO code.
- Refactor `analyze-skills` and the chat prompts to read from `country_configs` instead of `if (country === "India")` literals.
- Add an admin route `/admin/configure` (gated) that shows all current configs and lets you add a new country in <60 seconds. **This is the demo moment**: live-add Ghana on stage.
- Document the contract in a `CONFIGURING_A_NEW_COUNTRY.md` so judges can read it.

### Phase 3 — Policymaker dashboard ✅ SHIPPED (kills gap #5)
Required by Module 3. Without it, Module 3 is incomplete.

- New route `/policy` with aggregate, anonymised views of all `analyses` rows:
  - Skill-supply heatmap by ISCO-08 2-digit group
  - Average automation exposure of analyzed cohort vs national Frey-Osborne baseline
  - Wage gap: median LLM-extracted opportunity wage vs ILOSTAT median for matched ISCO code
  - Education-projection overlay (Wittgenstein 2025 vs 2035) so policymakers see where the cohort sits relative to the country's trajectory
- Add a `policymaker` role in `user_roles` (you already have the auth/role infra patterns); RLS so only that role sees aggregates, never PII or individual transcripts.
- Export-as-CSV button so an NGO can pull the data into their own tools.

### Phase 4 — Portable & resilient skills profile (kills gaps #6, #7, #9)
Make Amara *own* her profile.

- Add a `/profile/:share_id` public read-only route that renders her skills card with ISCO + ESCO codes side-by-side and a QR code. She can show it on any phone, in any office.
- Add ESCO mapping: bundle the official ISCO-08 → ESCO occupation crosswalk JSON (~1MB, ships in the function) and append `esco_uri` to each skill.
- Add an "adjacent durable skills" block: for each detected ISCO code, suggest 2 ESCO skills from the same occupation cluster with **lower** Frey-Osborne automation probability. This is the *resilience* recommendation the brief asks for.
- Add a "Download as JSON" button next to "Download CV" — the portable profile, machine-readable, the brief's Module 1 spirit.

### Phase 5 — Demo polish to beat MIT (kills gap #11)
Judges remember the demo, not the README.

- Live country switcher in the header: Morocco → Ghana mid-demo, watch wages, automation scores, language, and currency all reload from `country_configs`. **This is your "infrastructure not app" proof point.**
- Add an ITU digital-penetration footnote per country ("48% mobile broadband — we will not suggest remote-only roles") so suggestions are calibrated, not aspirational.
- Replace the Tavily generic search with a query that includes the ISCO code + country wage band so listings match Amara's *realistic* range, not aspirational ones.
- Add a 30-second on-page "What we don't know" panel listing the limits — judges explicitly reward this.

---

## What this looks like score-wise

| Brief criterion | Today | After phases 1–3 | After all 5 |
|---|---|---|---|
| Module 1 — Skills Signal Engine | Partial | Strong | **Excellent** |
| Module 2 — AI Readiness Lens | Partial (no real data) | Strong | **Excellent** |
| Module 3 — Opportunity + Econometric | Weak (no policymaker view) | Strong | **Excellent** |
| Country-agnostic infrastructure | ❌ | ✅ | ✅ + live demo |
| ≥2 real econometric signals visible | ❌ | ✅ | ✅ |
| ≥1 real automation dataset | ❌ | ✅ (Frey-Osborne) | ✅ |
| Wittgenstein projections | ❌ | ✅ | ✅ |
| Honest about limits | ❌ | ✅ | ✅ |
| Designed for constraint | ✅ | ✅ | ✅ |

---

## My recommendation

If you have **limited time before judging**: do Phase 1 + Phase 3 only. Phase 1 gives you the two real econometric signals + automation dataset (kills the disqualifier). Phase 3 gives you the policymaker view (completes Module 3). That alone clears the "strong submission" bar.

If you have **a full day**: do Phases 1 → 5 in order. Phase 5's live country switch is what beats MIT — it turns your project from "an app" into "infrastructure," which is the literal word the brief uses.

---

**Want me to start?** Approve this plan and I'll begin with Phase 1 (real econometric signals) — the single highest-impact change. I'll come back for sign-off before each subsequent phase so you stay in control.
