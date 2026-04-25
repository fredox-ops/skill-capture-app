# Sawt-Net hackathon flow — final wiring

Most of the stack you asked for is already built and working on **Lovable Cloud** (no migration needed):

✅ Tables `profiles`, `voice_sessions`, `analyses` exist with full RLS (`auth.uid() = user_id` on every operation)
✅ `handle_new_user()` trigger auto-creates a profile on signup
✅ Web Speech API capture (`src/hooks/useSpeechRecognition.tsx`) + transcript saved to `voice_sessions`
✅ Edge function `analyze-skills` deployed, JWT-protected, calls Lovable AI Gateway
✅ Email/password + Google login wired (`src/routes/login.tsx`)
✅ Loading state on the "Analyze My Skills" button

**What's actually missing vs your spec:**

1. The edge function returns the wrong JSON shape. You want `{skills:[{name,isco_code}], ai_risk_score, ai_risk_level, opportunities:[{job_title,match_percent,local_wage}]}` — currently it returns `{skills:string[], ai_score, risk_level, jobs:[{title,match,salary}]}`.
2. The Results dashboard reads the old shape and must be updated to the new one (skills become chips with ISCO-08 codes underneath, etc.).
3. No "history" view — users can only see one analysis at a time via URL. Adding a `/history` list of past analyses gives the hackathon judges proof of persistence on reload.

---

## Plan

### 1. Edge function: lock the new structured JSON shape (`supabase/functions/analyze-skills/index.ts`)
Update the AI tool-calling schema and system prompt so the function returns **exactly** the format you specified:

```json
{
  "skills": [{"name": "Hardware Repair", "isco_code": "7422"}],
  "ai_risk_score": 45,
  "ai_risk_level": "Medium Risk",
  "opportunities": [
    {"job_title": "IT Support Technician", "match_percent": 85, "local_wage": "4500 MAD"}
  ]
}
```

- Tool schema: `skills` becomes array of objects with `name` (string) + `isco_code` (4-digit string), `ai_risk_score` (0–100), `ai_risk_level` enum (`"Low Risk"|"Medium Risk"|"High Risk"`), `opportunities` array of 3 with `job_title`, `match_percent` (60–95), `local_wage` (string with local currency — MAD for Morocco, INR for India).
- System prompt updated: explicitly mention ISCO-08 4-digit codes, local currency wages, and the risk-level mapping (>=70 Low, 40–69 Medium, <40 High).
- Keep current error handling (429 / 402 / fallback messages) and `verify_jwt = true`.

### 2. Persist the new shape (no schema change)
The `analyses` table stores `skills` and `jobs` as **`jsonb`** and `ai_score` as `integer` / `risk_level` as `text` — flexible enough that we don't need a migration. We'll just store:
- `skills` ← `result.skills` (array of `{name, isco_code}`)
- `ai_score` ← `result.ai_risk_score`
- `risk_level` ← `result.ai_risk_level` ("Low Risk" / "Medium Risk" / "High Risk")
- `jobs` ← `result.opportunities`

Update `src/routes/index.tsx` `startAnalysis` to map the new field names into the insert.

### 3. Results dashboard refactor (`src/routes/results.tsx`)
- Update the `Analysis` TypeScript type to the new shape.
- **Skills card**: each chip now shows the skill name with the ISCO-08 code as a small subscript (e.g. "Hardware Repair · ISCO-08 7422"). Reinforces the "real econometric engine" framing for judges.
- **AI Readiness card**: read `ai_risk_score` (0–100) and map `ai_risk_level` strings to color (Low → success green, Medium → warning amber, High → destructive red). Same animated progress bar.
- **Opportunities card**: render `job_title`, `match_percent`, `local_wage` (already includes currency, so no "/ month" suffix needed — it'll come from the AI).
- Skeleton + EmptyState unchanged.

### 4. Auth + History — visible past-analyses list
You said "the user should be able to see their past analyses if they reload the page". To make this rock-solid for the demo:

- **Already covered**: `/results?id=xxx` reloads any specific analysis (RLS guarantees only that user can read it).
- **New**: add a **History** view at `/history` (route file `src/routes/history.tsx`):
  - Fetches all `analyses` for the current user, ordered by `created_at desc`.
  - Each row shows date, top 2–3 skills, and the AI risk score badge.
  - Clicking a row navigates to `/results?id=xxx` to see the full dashboard.
  - Auth-guarded the same way as `/` and `/results` (redirect to `/login` if no session).
- **Entry point**: add a "History" button in the chat header (next to Settings) and a small "View past analyses" link on the empty Results state.

### 5. Loading-state polish (already partially there)
- Chat screen "Analyze My Skills" button already shows a spinning sparkle + "Analyzing your skills…" while the edge function runs. Keep it.
- Add a tiny "Saving transcript…" → "Calling AI…" → "Saving results…" sub-text under the button so judges *see* the multi-step backend work happening. Pure UX polish, no backend change.

---

## Files I'll touch

| File | Change |
|---|---|
| `supabase/functions/analyze-skills/index.ts` | New tool schema + prompt for ISCO-08 / risk_level / opportunities |
| `src/routes/index.tsx` | Map new edge-function field names into `analyses` insert; multi-step loading sub-text; History button in header |
| `src/routes/results.tsx` | New `Analysis` type; skills with ISCO codes; risk-level color mapping; updated opportunity card fields |
| `src/routes/history.tsx` | **NEW** — list of past analyses, auth-guarded, links to `/results?id=...` |

## What I will NOT change
- Database schema (no migration needed — `jsonb` columns are flexible)
- RLS policies (already correct)
- Auth flow (login.tsx, useAuth, useProfile — all working)
- `useSpeechRecognition` hook
- MobileShell / SettingsModal / styles

## Smoke test after build
1. Sign in (or use the already-signed-in account from your replay logs).
2. Tap mic → speak ~10s of skills (e.g. "I fix phones and motorcycle engines, and I tutor kids in math").
3. Tap "Analyze My Skills" → watch the multi-step loading text → land on Results dashboard.
4. Verify chips show ISCO-08 codes, risk score animates, 3 opportunities render with local wages.
5. Tap History → see the new analysis at the top → tap it → reload → still there.
6. Sign out, sign back in → History still shows it (proves RLS persistence).

Ready to build when you approve.