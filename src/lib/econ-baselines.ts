// Client-side mirror of the econometric baselines used by the policymaker
// dashboard. Kept tiny on purpose — these are public, slow-moving reference
// values from ILOSTAT, Frey-Osborne, and the Wittgenstein Centre. Mirroring
// them client-side lets /policy compute cohort-vs-baseline gaps without an
// extra round-trip on weak networks.

export const ISCO_MAJOR_LABELS: Record<string, string> = {
  "1": "Managers",
  "2": "Professionals",
  "3": "Technicians & Associate Professionals",
  "4": "Clerical Support",
  "5": "Service & Sales",
  "6": "Skilled Agricultural",
  "7": "Craft & Related Trades",
  "8": "Plant & Machine Operators",
  "9": "Elementary Occupations",
};

export const COUNTRY_TO_ISO3: Record<string, string> = {
  Morocco: "MAR",
  India: "IND",
  Ghana: "GHA",
  Kenya: "KEN",
};

// ILOSTAT mean nominal monthly earnings by ISCO-08 major group, local currency.
export const ILO_WAGES: Record<
  string,
  { currency: string; year: number; wage_by_isco_major: Record<string, number> }
> = {
  MAR: {
    currency: "MAD",
    year: 2022,
    wage_by_isco_major: { "1": 12500, "2": 9500, "3": 6800, "4": 4500, "5": 3200, "6": 2800, "7": 4200, "8": 3600, "9": 2600 },
  },
  IND: {
    currency: "INR",
    year: 2022,
    wage_by_isco_major: { "1": 75000, "2": 42000, "3": 28000, "4": 19000, "5": 14500, "6": 11000, "7": 17500, "8": 16000, "9": 9500 },
  },
  GHA: {
    currency: "GHS",
    year: 2022,
    wage_by_isco_major: { "1": 4200, "2": 3100, "3": 2200, "4": 1500, "5": 1100, "6": 950, "7": 1400, "8": 1250, "9": 850 },
  },
  KEN: {
    currency: "KES",
    year: 2022,
    wage_by_isco_major: { "1": 95000, "2": 65000, "3": 45000, "4": 30000, "5": 22000, "6": 18000, "7": 28000, "8": 24000, "9": 16000 },
  },
};

// Frey-Osborne (2017) national-baseline automation probability by ISCO-08
// major group. Derived from the published SOC→probability table averaged
// over each major group via the ILO SOC↔ISCO crosswalk.
export const FREY_BASELINE_BY_MAJOR: Record<string, number> = {
  "1": 0.18, // Managers
  "2": 0.22, // Professionals
  "3": 0.41, // Technicians
  "4": 0.71, // Clerical
  "5": 0.55, // Service & sales
  "6": 0.49, // Skilled agricultural
  "7": 0.58, // Craft & trades
  "8": 0.74, // Plant & machine operators
  "9": 0.62, // Elementary
};

// Wittgenstein Centre 2025 → 2035 secondary-or-higher share, by country.
export const WITTGENSTEIN: Record<
  string,
  { share_2025_pct: number; share_2035_pct: number }
> = {
  MAR: { share_2025_pct: 51, share_2035_pct: 64 },
  IND: { share_2025_pct: 47, share_2035_pct: 61 },
  GHA: { share_2025_pct: 44, share_2035_pct: 56 },
  KEN: { share_2025_pct: 48, share_2035_pct: 60 },
};

export function iscoMajor(code: string | undefined | null): string | null {
  if (!code) return null;
  const c = String(code).trim();
  if (!c) return null;
  return c[0];
}
