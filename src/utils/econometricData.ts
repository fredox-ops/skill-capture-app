// Client-side econometric lookup tables.
//
// Mirrors the server-side datasets in `supabase/functions/_shared/econ-data/`
// so the Results screen can enrich data even on weak / intermittent networks
// where the edge function might return partial signals. Tables are tiny
// (< 4 KB gzipped) and intentionally country-aware to honour the brief's
// "country-agnostic infrastructure" requirement.
//
// Sources (kept verbatim — the UI renders these strings as provenance):
//   - Frey & Osborne (2017), "The Future of Employment" — ISCO-08 mapped
//     automation probabilities (0 = safe, 1 = highly automatable).
//   - ILOSTAT 2023 — Mean nominal monthly earnings by ISCO-08, per country.
//   - Wittgenstein Centre, SSP2 — projected secondary-or-higher education
//     share among 20–39 year-olds, 2025 → 2035, per country.
//   - ITU DataHub (2023) — Individuals using the Internet, per country.

export interface AutomationLookup {
  probability: number; // 0..1 — Frey-Osborne probability (post-calibration)
  rawProbability: number; // 0..1 — Frey-Osborne probability (pre-calibration)
  source: string;
  calibrationFactor: number; // 1.0 = no LMIC adjustment
}

export interface WageLookup {
  amount: number;
  currency: string;
  formatted: string;
  source: string;
  year: number;
}

// ---- Frey-Osborne -------------------------------------------------------

export const freyOsborneData: Record<string, { probability: number; source: string }> = {
  // Craft & related trades
  "7126": { probability: 0.32, source: "Frey & Osborne (2017)" },
  "7127": { probability: 0.28, source: "Frey & Osborne (2017)" },
  "7411": { probability: 0.31, source: "Frey & Osborne (2017)" },
  "7412": { probability: 0.42, source: "Frey & Osborne (2017)" },
  "7421": { probability: 0.65, source: "Frey & Osborne (2017)" },
  "7422": { probability: 0.85, source: "Frey & Osborne (2017)" },
  "7531": { probability: 0.48, source: "Frey & Osborne (2017)" },
  "7512": { probability: 0.54, source: "Frey & Osborne (2017)" },
  // Service & sales
  "5120": { probability: 0.36, source: "Frey & Osborne (2017)" },
  "5141": { probability: 0.18, source: "Frey & Osborne (2017)" },
  "5142": { probability: 0.21, source: "Frey & Osborne (2017)" },
  "5311": { probability: 0.08, source: "Frey & Osborne (2017)" },
  "5321": { probability: 0.05, source: "Frey & Osborne (2017)" },
  "5223": { probability: 0.92, source: "Frey & Osborne (2017)" },
  "5230": { probability: 0.97, source: "Frey & Osborne (2017)" },
  // Drivers & operators
  "8322": { probability: 0.79, source: "Frey & Osborne (2017)" },
  "8332": { probability: 0.81, source: "Frey & Osborne (2017)" },
  // Professionals
  "2512": { probability: 0.12, source: "Frey & Osborne (2017)" },
  "2513": { probability: 0.21, source: "Frey & Osborne (2017)" },
  "2356": { probability: 0.04, source: "Frey & Osborne (2017)" },
  "2310": { probability: 0.03, source: "Frey & Osborne (2017)" },
  // Clerical
  "4110": { probability: 0.96, source: "Frey & Osborne (2017)" },
  "4226": { probability: 0.94, source: "Frey & Osborne (2017)" },
  // Elementary
  "9112": { probability: 0.66, source: "Frey & Osborne (2017)" },
  "9211": { probability: 0.87, source: "Frey & Osborne (2017)" },
};

const freyMajorBaseline: Record<string, number> = {
  "1": 0.18,
  "2": 0.22,
  "3": 0.41,
  "4": 0.71,
  "5": 0.55,
  "6": 0.49,
  "7": 0.45,
  "8": 0.74,
  "9": 0.62,
};

/**
 * Look up a Frey-Osborne automation probability for an ISCO-08 code,
 * optionally calibrated for the LMIC infrastructure context. Falls back to
 * the major-group baseline. Returns both raw and calibrated values so the
 * UI can show provenance ("adjusted for {country} context, factor {x}").
 */
export function lookupAutomation(
  iscoCode: string | undefined | null,
  calibrationFactor: number = 1,
): AutomationLookup {
  const code = (iscoCode ?? "").trim();
  const direct = freyOsborneData[code];
  const raw = direct
    ? direct.probability
    : (freyMajorBaseline[code.charAt(0)] ?? 0.5);
  const factor = Number.isFinite(calibrationFactor) && calibrationFactor > 0 ? calibrationFactor : 1;
  const calibrated = Math.max(0, Math.min(1, raw * factor));
  return {
    probability: Number(calibrated.toFixed(2)),
    rawProbability: raw,
    source: "Frey & Osborne (2017)",
    calibrationFactor: factor,
  };
}

// ---- ILOSTAT wages, per country ----------------------------------------

interface CountryWageTable {
  currency: string;
  year: number;
  byIsco: Record<string, number>;
  majorBaseline: Record<string, number>;
}

// ISO3-keyed; mirrors supabase/functions/_shared/econ-data/ilo-wages.json.
// Per-occupation tables are kept thin on the client; major-group baselines
// guarantee every ISCO code returns a sensible local-currency value.
const wagesByIso3: Record<string, CountryWageTable> = {
  MAR: {
    currency: "MAD",
    year: 2023,
    byIsco: {
      "7126": 4500, "7127": 4800, "7411": 4600, "7422": 3900, "7531": 3400,
      "5120": 3800, "5141": 3100, "5142": 3000, "5311": 2700, "5321": 3200,
      "5223": 2900, "8322": 3600, "2512": 9500, "2513": 8200, "4110": 4500,
      "9112": 2600,
    },
    majorBaseline: { "1": 12500, "2": 9500, "3": 6800, "4": 4500, "5": 3200, "6": 2800, "7": 4200, "8": 3600, "9": 2600 },
  },
  IND: {
    currency: "INR",
    year: 2022,
    byIsco: {
      "7126": 19000, "7127": 21000, "7411": 18500, "7422": 16000, "7531": 13500,
      "5120": 15500, "5141": 12500, "5142": 12000, "5311": 10500, "5321": 13000,
      "5223": 11500, "8322": 15000, "2512": 55000, "2513": 48000, "4110": 19000,
      "9112": 9500,
    },
    majorBaseline: { "1": 75000, "2": 42000, "3": 28000, "4": 19000, "5": 14500, "6": 11000, "7": 17500, "8": 16000, "9": 9500 },
  },
  GHA: {
    currency: "GHS",
    year: 2022,
    byIsco: {
      "7126": 1500, "7127": 1650, "7411": 1450, "7422": 1300, "7531": 1100,
      "5120": 1250, "5141": 1050, "5142": 1000, "5311": 900, "5321": 1100,
      "5223": 950, "8322": 1250, "2512": 4200, "2513": 3700, "4110": 1500,
      "9112": 850,
    },
    majorBaseline: { "1": 4200, "2": 3100, "3": 2200, "4": 1500, "5": 1100, "6": 950, "7": 1400, "8": 1250, "9": 850 },
  },
  KEN: {
    currency: "KES",
    year: 2022,
    byIsco: {
      "7126": 30000, "7127": 32000, "7411": 29000, "7422": 26000, "7531": 22000,
      "5120": 25000, "5141": 21000, "5142": 20500, "5311": 18000, "5321": 21500,
      "5223": 19500, "8322": 24000, "2512": 80000, "2513": 70000, "4110": 30000,
      "9112": 16000,
    },
    majorBaseline: { "1": 95000, "2": 65000, "3": 45000, "4": 30000, "5": 22000, "6": 18000, "7": 28000, "8": 24000, "9": 16000 },
  },
};

const COUNTRY_TO_ISO3: Record<string, string> = {
  Morocco: "MAR",
  India: "IND",
  Ghana: "GHA",
  Kenya: "KEN",
};

function countryToIso3(country: string | undefined | null): string {
  return COUNTRY_TO_ISO3[(country ?? "").trim()] ?? "MAR";
}

/**
 * Look up the ILOSTAT median monthly wage for an ISCO-08 code in the
 * active country's local currency. Falls back to the country's major-group
 * baseline, then to Morocco if the country isn't configured.
 */
export function lookupWage(
  iscoCode: string | undefined | null,
  country: string | undefined | null = "Morocco",
): WageLookup {
  const code = (iscoCode ?? "").trim();
  const iso3 = countryToIso3(country);
  const table = wagesByIso3[iso3] ?? wagesByIso3.MAR;
  const direct = table.byIsco[code];
  const amount = direct ?? table.majorBaseline[code.charAt(0)] ?? 3000;
  return {
    amount,
    currency: table.currency,
    formatted: `${amount.toLocaleString("en-US")} ${table.currency}`,
    source: "ILOSTAT 2023, National Median",
    year: table.year,
  };
}

// ---- Wittgenstein 2025–2035 education trend, per country ----------------

export interface EducationProjection {
  share2025Pct: number;
  share2035Pct: number;
  deltaPct: number;
  headline: string;
  source: string;
}

const wittgensteinByCountry: Record<string, EducationProjection> = {
  Morocco: {
    share2025Pct: 51,
    share2035Pct: 64,
    deltaPct: 13,
    headline: "Secondary-educated youth share rising by 13 pp by 2035",
    source: "Wittgenstein Centre, SSP2",
  },
  India: {
    share2025Pct: 47,
    share2035Pct: 61,
    deltaPct: 14,
    headline: "Secondary-educated youth share rising by 14 pp by 2035",
    source: "Wittgenstein Centre, SSP2",
  },
  Ghana: {
    share2025Pct: 44,
    share2035Pct: 56,
    deltaPct: 12,
    headline: "Secondary-educated youth share rising by 12 pp by 2035",
    source: "Wittgenstein Centre, SSP2",
  },
  Kenya: {
    share2025Pct: 48,
    share2035Pct: 60,
    deltaPct: 12,
    headline: "Secondary-educated youth share rising by 12 pp by 2035",
    source: "Wittgenstein Centre, SSP2",
  },
};

/**
 * Look up the Wittgenstein Centre 2025→2035 secondary-or-higher education
 * projection for the active country. Falls back to Morocco.
 */
export function lookupEducationTrend(country: string | undefined | null): EducationProjection {
  const key = (country ?? "Morocco").trim();
  return wittgensteinByCountry[key] ?? wittgensteinByCountry.Morocco;
}

// Backwards-compatibility shim: existing callers used the Morocco-only
// `wittgensteinProjections` constant. Keep the export so older imports
// don't break, but new code should call `lookupEducationTrend(country)`.
export const wittgensteinProjections: EducationProjection = wittgensteinByCountry.Morocco;

// ---- Adjacent durable skills --------------------------------------------

export interface AdjacentSkillSuggestion {
  skills: string[];
  source: string;
}

const adjacentByCode: Record<string, string[]> = {
  "7126": ["On-site diagnostics", "Customer trust building", "Estimating & quoting"],
  "7127": ["HVAC fault diagnosis", "Safety inspection", "Client advisory"],
  "7411": ["Electrical safety auditing", "Site supervision", "Apprentice mentoring"],
  "7422": ["Hardware troubleshooting", "Customer onboarding", "Small-business IT support"],
  "7531": ["Bespoke fitting & alterations", "Pattern design", "Boutique merchandising"],
  "5120": ["Menu costing", "Kitchen team coordination", "Food safety leadership"],
  "5141": ["Client consultation", "Salon team training", "Personal branding"],
  "5142": ["Skincare consultation", "Treatment planning", "Client retention"],
  "5311": ["Early childhood pedagogy", "Parent communication", "Behavioural support"],
  "5321": ["Patient communication", "Care plan coordination", "First-aid leadership"],
  "5223": ["Visual merchandising", "Inventory judgement", "Customer relationship building"],
  "8322": ["Route optimisation", "Customer service", "Vehicle preventive care"],
  "2512": ["System design judgement", "Code review & mentoring", "Cross-team facilitation"],
  "2513": ["UX research", "Stakeholder workshops", "Accessibility design"],
  "4110": ["Process improvement", "Data integrity oversight", "Vendor coordination"],
  "9112": ["Site supervision", "Equipment maintenance", "Team scheduling"],
};

const adjacentByMajor: Record<string, string[]> = {
  "1": ["Team leadership", "Stakeholder negotiation", "Strategic judgement"],
  "2": ["Mentoring & coaching", "Cross-disciplinary problem solving", "Communication of complex ideas"],
  "3": ["Field troubleshooting", "Quality oversight", "Client communication"],
  "4": ["Process improvement", "Stakeholder coordination", "Data quality oversight"],
  "5": ["Customer relationship building", "Team coordination", "On-the-spot problem solving"],
  "6": ["Crop / livestock judgement", "Cooperative coordination", "Sustainable practice"],
  "7": ["On-site diagnostics", "Apprentice mentoring", "Customer trust building"],
  "8": ["Equipment troubleshooting", "Safety leadership", "Preventive maintenance judgement"],
  "9": ["Site coordination", "Reliability & punctuality", "Team support"],
};

export function lookupAdjacentSkills(
  iscoCodes: (string | undefined | null)[],
): AdjacentSkillSuggestion {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of iscoCodes) {
    const code = (raw ?? "").trim();
    const list = adjacentByCode[code] ?? adjacentByMajor[code.charAt(0)] ?? [];
    for (const skill of list) {
      if (!seen.has(skill)) {
        seen.add(skill);
        out.push(skill);
        if (out.length >= 3) break;
      }
    }
    if (out.length >= 3) break;
  }
  if (out.length === 0) {
    out.push("Customer communication", "On-the-spot problem solving", "Reliability");
  }
  return { skills: out.slice(0, 3), source: "ESCO transversal skills (2023)" };
}

/**
 * Convert a Frey-Osborne probability (0 = safe, 1 = at risk) into the
 * Sawt-Net "AI resilience" score (0..100, higher = safer).
 */
export function probabilityToResilienceScore(probability: number): number {
  const clamped = Math.max(0, Math.min(1, probability));
  return Math.round((1 - clamped) * 100);
}

// ---- ITU Digital Readiness ----------------------------------------------

export interface ItuReadiness {
  countryDisplay: string;
  iso3: string;
  internetUsersPct: number;
  year: number;
  source: string;
  sourceShort: string;
  band: "Emerging" | "Growing" | "Established";
}

const ituByCountry: Record<string, ItuReadiness> = {
  Morocco: { countryDisplay: "Morocco", iso3: "MAR", internetUsersPct: 90, year: 2023, source: "ITU DataHub — Individuals using the Internet (2023)", sourceShort: "ITU 2023", band: "Established" },
  India: { countryDisplay: "India", iso3: "IND", internetUsersPct: 55, year: 2023, source: "ITU DataHub — Individuals using the Internet (2023)", sourceShort: "ITU 2023", band: "Growing" },
  Ghana: { countryDisplay: "Ghana", iso3: "GHA", internetUsersPct: 69, year: 2023, source: "ITU DataHub — Individuals using the Internet (2023)", sourceShort: "ITU 2023", band: "Growing" },
  Kenya: { countryDisplay: "Kenya", iso3: "KEN", internetUsersPct: 40, year: 2023, source: "ITU DataHub — Individuals using the Internet (2023)", sourceShort: "ITU 2023", band: "Emerging" },
};

export function lookupItuReadiness(country: string | undefined | null): ItuReadiness {
  const key = (country ?? "Morocco").trim();
  return (
    ituByCountry[key] ?? {
      countryDisplay: key || "—",
      iso3: "—",
      internetUsersPct: 60,
      year: 2023,
      source: "ITU DataHub — Individuals using the Internet (2023)",
      sourceShort: "ITU 2023",
      band: "Growing",
    }
  );
}
