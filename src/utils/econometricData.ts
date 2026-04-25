// Client-side econometric lookup tables.
//
// These mirror the server-side datasets in
// `supabase/functions/_shared/econ-data/` but live in the browser bundle so
// the Results screen can enrich data even on weak / intermittent networks
// where the edge function might return partial signals. Keeping them tiny
// and inline is intentional: the whole table is < 2 KB gzipped.
//
// Sources (kept verbatim — the UI renders these strings as provenance):
//   - Frey & Osborne (2017), "The Future of Employment" — ISCO-08 mapped
//     automation probabilities (0 = safe, 1 = highly automatable).
//   - ILOSTAT 2023 — Mean nominal monthly earnings by ISCO-08, Morocco (MAD).
//   - Wittgenstein Centre, SSP2 — projection of secondary-or-higher
//     education share among 20–39 year-olds, 2025 → 2035.

export interface AutomationLookup {
  probability: number; // 0..1 — Frey-Osborne probability
  source: string;
}

export interface WageLookup {
  amount: number;
  currency: string;
  formatted: string; // pre-formatted display string
  source: string;
  year: number;
}

// Per-occupation Frey-Osborne automation probabilities, keyed by ISCO-08
// 4-digit code. Falls back to the major-group baseline below if a code
// isn't listed here.
export const freyOsborneData: Record<string, AutomationLookup> = {
  // Craft & related trades — relatively shielded by hands-on dexterity
  "7126": { probability: 0.32, source: "Frey & Osborne (2017)" }, // Plumbers
  "7127": { probability: 0.28, source: "Frey & Osborne (2017)" }, // AC / refrigeration mechanics
  "7411": { probability: 0.31, source: "Frey & Osborne (2017)" }, // Building electricians
  "7412": { probability: 0.42, source: "Frey & Osborne (2017)" }, // Electrical mechanics
  "7421": { probability: 0.65, source: "Frey & Osborne (2017)" }, // Electronics mechanics
  "7422": { probability: 0.85, source: "Frey & Osborne (2017)" }, // ICT install / phone repair
  "7531": { probability: 0.48, source: "Frey & Osborne (2017)" }, // Tailors
  "7512": { probability: 0.54, source: "Frey & Osborne (2017)" }, // Bakers, pastry-cooks
  // Service & sales
  "5120": { probability: 0.36, source: "Frey & Osborne (2017)" }, // Cooks
  "5141": { probability: 0.18, source: "Frey & Osborne (2017)" }, // Hairdressers
  "5142": { probability: 0.21, source: "Frey & Osborne (2017)" }, // Beauticians
  "5311": { probability: 0.08, source: "Frey & Osborne (2017)" }, // Childcare workers
  "5321": { probability: 0.05, source: "Frey & Osborne (2017)" }, // Health-care assistants
  "5223": { probability: 0.92, source: "Frey & Osborne (2017)" }, // Shop sales assistants
  "5230": { probability: 0.97, source: "Frey & Osborne (2017)" }, // Cashiers
  // Drivers & operators
  "8322": { probability: 0.79, source: "Frey & Osborne (2017)" }, // Car / taxi drivers
  "8332": { probability: 0.81, source: "Frey & Osborne (2017)" }, // Heavy truck drivers
  // Professionals
  "2512": { probability: 0.12, source: "Frey & Osborne (2017)" }, // Software developers
  "2513": { probability: 0.21, source: "Frey & Osborne (2017)" }, // Web / multimedia developers
  "2356": { probability: 0.04, source: "Frey & Osborne (2017)" }, // ICT trainers
  "2310": { probability: 0.03, source: "Frey & Osborne (2017)" }, // University teachers
  // Clerical
  "4110": { probability: 0.96, source: "Frey & Osborne (2017)" }, // General office clerks
  "4226": { probability: 0.94, source: "Frey & Osborne (2017)" }, // Receptionists
  // Elementary
  "9112": { probability: 0.66, source: "Frey & Osborne (2017)" }, // Cleaners
  "9211": { probability: 0.87, source: "Frey & Osborne (2017)" }, // Farm labourers
};

// Frey-Osborne fallback by ISCO-08 major group (1st digit). Used when a
// specific 4-digit code isn't in the table above.
const freyMajorBaseline: Record<string, number> = {
  "1": 0.18, // Managers
  "2": 0.22, // Professionals
  "3": 0.41, // Technicians
  "4": 0.71, // Clerical
  "5": 0.55, // Service & sales
  "6": 0.49, // Skilled agricultural
  "7": 0.45, // Craft & trades (slight LMIC adjustment)
  "8": 0.74, // Plant & machine operators
  "9": 0.62, // Elementary
};

// ILOSTAT 2023 — mean nominal monthly earnings by ISCO-08, Morocco (MAD).
// Falls back to a major-group median if the specific code isn't listed.
export const iloWagesData: Record<string, WageLookup> = {
  "7126": { amount: 4500, currency: "MAD", formatted: "4500 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "7127": { amount: 4800, currency: "MAD", formatted: "4800 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "7411": { amount: 4600, currency: "MAD", formatted: "4600 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "7422": { amount: 3900, currency: "MAD", formatted: "3900 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "7531": { amount: 3400, currency: "MAD", formatted: "3400 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "5120": { amount: 3800, currency: "MAD", formatted: "3800 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "5141": { amount: 3100, currency: "MAD", formatted: "3100 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "5142": { amount: 3000, currency: "MAD", formatted: "3000 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "5311": { amount: 2700, currency: "MAD", formatted: "2700 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "5321": { amount: 3200, currency: "MAD", formatted: "3200 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "5223": { amount: 2900, currency: "MAD", formatted: "2900 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "8322": { amount: 3600, currency: "MAD", formatted: "3600 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "2512": { amount: 9500, currency: "MAD", formatted: "9500 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "2513": { amount: 8200, currency: "MAD", formatted: "8200 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "4110": { amount: 4500, currency: "MAD", formatted: "4500 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
  "9112": { amount: 2600, currency: "MAD", formatted: "2600 MAD", source: "ILOSTAT 2023, National Median", year: 2023 },
};

// Major-group fallback (Morocco, MAD, 2023).
const wageMajorBaseline: Record<string, number> = {
  "1": 12500,
  "2": 9500,
  "3": 6800,
  "4": 4500,
  "5": 3200,
  "6": 2800,
  "7": 4200,
  "8": 3600,
  "9": 2600,
};

export interface EducationProjection {
  share2025Pct: number;
  share2035Pct: number;
  deltaPct: number;
  headline: string;
  source: string;
}

// Wittgenstein Centre, SSP2 — projected secondary-or-higher share among
// 20–39 year-olds (Morocco baseline). Used as a single global stat.
export const wittgensteinProjections: EducationProjection = {
  share2025Pct: 51,
  share2035Pct: 65,
  deltaPct: 14,
  headline: "Secondary education expected to rise by 14% by 2035",
  source: "Wittgenstein Centre, SSP2",
};

// ---- Helpers --------------------------------------------------------------

/**
 * Look up a Frey-Osborne automation probability for an ISCO-08 code, falling
 * back to the major-group baseline. Always returns a value in [0, 1].
 */
export function lookupAutomation(iscoCode: string | undefined | null): AutomationLookup {
  const code = (iscoCode ?? "").trim();
  const direct = freyOsborneData[code];
  if (direct) return direct;
  const major = code.charAt(0);
  const baseline = freyMajorBaseline[major] ?? 0.5;
  return { probability: baseline, source: "Frey & Osborne (2017)" };
}

/**
 * Look up an ILOSTAT median monthly wage for an ISCO-08 code, falling back
 * to the major-group baseline (Morocco, MAD).
 */
export function lookupWage(iscoCode: string | undefined | null): WageLookup {
  const code = (iscoCode ?? "").trim();
  const direct = iloWagesData[code];
  if (direct) return direct;
  const major = code.charAt(0);
  const amount = wageMajorBaseline[major] ?? 3000;
  return {
    amount,
    currency: "MAD",
    formatted: `${amount} MAD`,
    source: "ILOSTAT 2023, National Median",
    year: 2023,
  };
}

/**
 * Convert a Frey-Osborne probability (0 = safe, 1 = at risk) into the
 * Sawt-Net "AI resilience" score (0..100, higher = safer).
 */
export function probabilityToResilienceScore(probability: number): number {
  const clamped = Math.max(0, Math.min(1, probability));
  return Math.round((1 - clamped) * 100);
}
