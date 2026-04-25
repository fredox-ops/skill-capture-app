## Context

I audited `src/routes/results.tsx` against your Phase 1 spec. **All four UI provenance elements are already in place** with the premium SaaS aesthetic and voice-first UX preserved:

- ✅ AI Risk Gauge → "Source: Frey & Osborne (2017)" (with database icon)
- ✅ Job Wages → "Source: ILOSTAT 2023, National Median" (chip on every job card)
- ✅ Education Trend card → 2025 → 2035 share, delta pill, "Source: Wittgenstein Centre, SSP2"
- ✅ "Honest Limits" footer rendered as the last section above modals

## The one gap: disclaimer wording

Your spec asks the footer to read **exactly**:

> *Disclaimer: Wages are national medians. Automation scores are based on Frey-Osborne and may differ in informal LMIC contexts.*

The current English copy in `src/lib/results-i18n.ts` (and its Arabic / French / Hindi parallels) is longer and slightly different. Voice playback (TTS) reads this same string, so updating the copy also updates what non-readers hear.

## Proposed change (single file, ~12 lines)

**File:** `src/lib/results-i18n.ts`

Replace `honestLimitsBody` in all four locales with translations of the exact spec line:

| Locale | New `honestLimitsBody` |
|---|---|
| **en** | "Disclaimer: Wages are national medians. Automation scores are based on Frey-Osborne and may differ in informal LMIC contexts." |
| **ar (Darija)** | "تنبيه: الأجور هي المعدل الوطني. سكور الأتمتة مبني على Frey-Osborne وقد يختلف في السياقات غير الرسمية للدول النامية." |
| **fr** | "Avertissement : Les salaires sont des médianes nationales. Les scores d'automatisation sont basés sur Frey-Osborne et peuvent différer dans les contextes informels des pays à revenu faible et intermédiaire." |
| **hi** | "अस्वीकरण: वेतन राष्ट्रीय औसत हैं। स्वचालन स्कोर Frey-Osborne पर आधारित हैं और निम्न/मध्यम-आय देशों के अनौपचारिक संदर्भों में भिन्न हो सकते हैं।" |

I will keep `honestLimitsTitle` as-is in each locale ("What we don't know", "آش ما كنعرفوش", etc.) so the section heading still feels human and voice-friendly, while the body matches the spec verbatim in English.

## Out of scope (no changes needed)

- No changes to `results.tsx` — the layout, source labels, icons, and order are already correct.
- No changes to `econometricData.ts` — already supplies the values the cards render.
- No changes to `analyze-skills` edge function — already returns only `isco_code` + `skill_name`; risk/wage/education are looked up client-side.

## Verification after the edit

1. Open `/results` after running an analysis and confirm the bottom "Honest Limits" section reads the new English line.
2. Switch country/locale via the header switcher; confirm the Arabic, French, and Hindi variants render correctly RTL/LTR.
3. Tap the section's TTS playback (existing voice-first behavior) and confirm the new line is read aloud.
