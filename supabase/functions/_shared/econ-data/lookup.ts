// Real-data lookup layer for analyze-skills.
// All values come from published datasets bundled into the function — NOT from the LLM.
// This is what makes Sawt-Net a "strong submission" per the UNMAPPED brief
// ("Must surface at least two real econometric signals visibly to the user").

import freyOsborne from "./frey-osborne.json" with { type: "json" };
import iloWages from "./ilo-wages.json" with { type: "json" };
import wittgenstein from "./wittgenstein-2035.json" with { type: "json" };

// ---------- Country mapping --------------------------------------------------

const COUNTRY_TO_ISO3: Record<string, string> = {
  Morocco: "MAR",
  India: "IND",
  Ghana: "GHA",
  Kenya: "KEN",
};

export function countryToIso3(country: string): string {
  return COUNTRY_TO_ISO3[country] ?? "MAR";
}

// ---------- Frey-Osborne automation lookup ----------------------------------

export interface AutomationSignal {
  isco_code: string;
  automation_probability: number; // 0..1
  source: string;
  source_short: string;
}

const FREY_TABLE = (freyOsborne as { isco: Record<string, { automation_probability: number }> }).isco;

/**
 * Look up Frey-Osborne automation probability for an ISCO-08 4-digit code.
 * Falls back to the 1-digit major-group average when the exact code is not in the table.
 */
export function lookupAutomation(iscoCode: string): AutomationSignal {
  const exact = FREY_TABLE[iscoCode];
  if (exact) {
    return {
      isco_code: iscoCode,
      automation_probability: exact.automation_probability,
      source: "Frey & Osborne (2017), The Future of Employment — mapped to ISCO-08",
      source_short: "Frey-Osborne 2017",
    };
  }
  // Fallback: average over the same major group (first digit).
  const major = iscoCode[0];
  const sameGroup = Object.entries(FREY_TABLE).filter(([k]) => k.startsWith(major));
  const avg =
    sameGroup.length > 0
      ? sameGroup.reduce((s, [, v]) => s + v.automation_probability, 0) / sameGroup.length
      : 0.5;
  return {
    isco_code: iscoCode,
    automation_probability: Number(avg.toFixed(2)),
    source: "Frey & Osborne (2017), major-group average (exact ISCO not in table)",
    source_short: "Frey-Osborne 2017 (group avg)",
  };
}

/**
 * Convert an automation probability (0..1) into the 0–100 RESILIENCE score
 * the UI already shows: lower probability = higher resilience.
 */
export function probabilityToResilienceScore(p: number): number {
  return Math.round((1 - p) * 100);
}

export function resilienceLevel(score: number): "Low Risk" | "Medium Risk" | "High Risk" {
  if (score >= 70) return "Low Risk";
  if (score >= 40) return "Medium Risk";
  return "High Risk";
}

// ---------- ILOSTAT wage lookup ---------------------------------------------

export interface WageSignal {
  amount: number;
  currency: string;
  formatted: string; // e.g. "4 200 MAD"
  year: number;
  isco_major: string;
  source: string;
  source_short: string;
}

const ILO_DATA = (iloWages as {
  countries: Record<
    string,
    {
      currency: string;
      year: number;
      wage_by_isco_major: Record<string, number>;
    }
  >;
}).countries;

export function lookupWage(iscoCode: string, country: string): WageSignal | null {
  const iso3 = countryToIso3(country);
  const row = ILO_DATA[iso3];
  if (!row) return null;
  const major = iscoCode[0];
  const amount = row.wage_by_isco_major[major];
  if (typeof amount !== "number") return null;
  return {
    amount,
    currency: row.currency,
    formatted: `${amount.toLocaleString("en-US")} ${row.currency}`,
    year: row.year,
    isco_major: major,
    source: `ILOSTAT mean nominal monthly earnings, ${row.currency}, ${row.year}`,
    source_short: `ILOSTAT ${row.year}`,
  };
}

// ---------- Wittgenstein education-trend lookup -----------------------------

export interface EducationTrendSignal {
  country: string;
  iso3: string;
  share_2025_pct: number;
  share_2035_pct: number;
  delta_pct: number;
  narrative_en: string;
  source: string;
  source_short: string;
}

const WITT_DATA = (wittgenstein as {
  countries: Record<
    string,
    { secondary_or_higher_2025_pct: number; secondary_or_higher_2035_pct: number; narrative_en: string }
  >;
}).countries;

export function lookupEducationTrend(country: string): EducationTrendSignal | null {
  const iso3 = countryToIso3(country);
  const row = WITT_DATA[iso3];
  if (!row) return null;
  return {
    country,
    iso3,
    share_2025_pct: row.secondary_or_higher_2025_pct,
    share_2035_pct: row.secondary_or_higher_2035_pct,
    delta_pct: row.secondary_or_higher_2035_pct - row.secondary_or_higher_2025_pct,
    narrative_en: row.narrative_en,
    source: "Wittgenstein Centre Human Capital Data Explorer v2.0, SSP2 scenario",
    source_short: "Wittgenstein 2025–2035",
  };
}
