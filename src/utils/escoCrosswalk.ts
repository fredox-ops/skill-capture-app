// ISCO-08 → ESCO (European Skills/Competences/Occupations) crosswalk.
//
// This is a curated subset that covers every ISCO code we surface in the
// analyze-skills + econometric layer. Keeping it client-side keeps the
// app fast on weak networks (no roundtrip needed) and makes the profile
// fully portable: a downloaded JSON profile carries both ISCO and ESCO
// codes so it can be plugged into any EU-aligned matching system.
//
// Source: ESCO v1.2 occupation directory (https://esco.ec.europa.eu/)
// Mapping logic: each ISCO-08 4-digit unit group maps to its primary
// ESCO occupation. ESCO URIs are stable identifiers.

export interface EscoMapping {
  isco_code: string;
  esco_code: string;        // ESCO occupation code (e.g. "7126.1")
  esco_label_en: string;    // Human-readable English label
  esco_uri: string;         // Stable ESCO URI
}

const CROSSWALK: Record<string, Omit<EscoMapping, "isco_code">> = {
  // Plumbers and pipe fitters
  "7126": {
    esco_code: "7126.1",
    esco_label_en: "Plumber",
    esco_uri: "http://data.europa.eu/esco/occupation/plumber",
  },
  // Electrical mechanics and fitters
  "7412": {
    esco_code: "7412.1",
    esco_label_en: "Electrical mechanic",
    esco_uri: "http://data.europa.eu/esco/occupation/electrical-mechanic",
  },
  // ICT installers and servicers
  "7422": {
    esco_code: "7422.1",
    esco_label_en: "ICT hardware repair technician",
    esco_uri: "http://data.europa.eu/esco/occupation/ict-hardware-repair-technician",
  },
  // Cooks
  "5120": {
    esco_code: "5120.1",
    esco_label_en: "Cook",
    esco_uri: "http://data.europa.eu/esco/occupation/cook",
  },
  // Hairdressers
  "5141": {
    esco_code: "5141.1",
    esco_label_en: "Hairdresser",
    esco_uri: "http://data.europa.eu/esco/occupation/hairdresser",
  },
  // Tailors, dressmakers, furriers and hatters
  "7531": {
    esco_code: "7531.1",
    esco_label_en: "Tailor",
    esco_uri: "http://data.europa.eu/esco/occupation/tailor",
  },
  // Bricklayers and related
  "7112": {
    esco_code: "7112.1",
    esco_label_en: "Bricklayer",
    esco_uri: "http://data.europa.eu/esco/occupation/bricklayer",
  },
  // Carpenters and joiners
  "7115": {
    esco_code: "7115.1",
    esco_label_en: "Carpenter",
    esco_uri: "http://data.europa.eu/esco/occupation/carpenter",
  },
  // Painters and related (construction)
  "7131": {
    esco_code: "7131.1",
    esco_label_en: "Painter and decorator",
    esco_uri: "http://data.europa.eu/esco/occupation/painter-decorator",
  },
  // Motor vehicle mechanics and repairers
  "7231": {
    esco_code: "7231.1",
    esco_label_en: "Motor vehicle mechanic",
    esco_uri: "http://data.europa.eu/esco/occupation/motor-vehicle-mechanic",
  },
  // Software developers
  "2512": {
    esco_code: "2512.1",
    esco_label_en: "Software developer",
    esco_uri: "http://data.europa.eu/esco/occupation/software-developer",
  },
  // Web and multimedia developers
  "2513": {
    esco_code: "2513.1",
    esco_label_en: "Web developer",
    esco_uri: "http://data.europa.eu/esco/occupation/web-developer",
  },
  // Graphic and multimedia designers
  "2166": {
    esco_code: "2166.1",
    esco_label_en: "Graphic designer",
    esco_uri: "http://data.europa.eu/esco/occupation/graphic-designer",
  },
  // Shop salespersons
  "5223": {
    esco_code: "5223.1",
    esco_label_en: "Shop sales assistant",
    esco_uri: "http://data.europa.eu/esco/occupation/shop-sales-assistant",
  },
  // Street and market salespersons
  "5211": {
    esco_code: "5211.1",
    esco_label_en: "Stall and market salesperson",
    esco_uri: "http://data.europa.eu/esco/occupation/stall-market-salesperson",
  },
  // Domestic cleaners and helpers
  "9111": {
    esco_code: "9111.1",
    esco_label_en: "Domestic cleaner",
    esco_uri: "http://data.europa.eu/esco/occupation/domestic-cleaner",
  },
  // Childcare workers
  "5311": {
    esco_code: "5311.1",
    esco_label_en: "Childcare worker",
    esco_uri: "http://data.europa.eu/esco/occupation/childcare-worker",
  },
  // Nursing professionals
  "2221": {
    esco_code: "2221.1",
    esco_label_en: "Nurse",
    esco_uri: "http://data.europa.eu/esco/occupation/nurse",
  },
  // Primary school teachers
  "2341": {
    esco_code: "2341.1",
    esco_label_en: "Primary school teacher",
    esco_uri: "http://data.europa.eu/esco/occupation/primary-school-teacher",
  },
  // Crop farm labourers
  "9211": {
    esco_code: "9211.1",
    esco_label_en: "Crop farm labourer",
    esco_uri: "http://data.europa.eu/esco/occupation/crop-farm-labourer",
  },
  // Drivers (heavy truck and lorry)
  "8332": {
    esco_code: "8332.1",
    esco_label_en: "Heavy truck driver",
    esco_uri: "http://data.europa.eu/esco/occupation/heavy-truck-driver",
  },
  // Accounting and bookkeeping clerks
  "4311": {
    esco_code: "4311.1",
    esco_label_en: "Accounting clerk",
    esco_uri: "http://data.europa.eu/esco/occupation/accounting-clerk",
  },
};

// Major-group fallback so unknown ISCO codes still map to *something* useful.
const MAJOR_GROUP_FALLBACK: Record<string, Omit<EscoMapping, "isco_code">> = {
  "1": { esco_code: "1.0", esco_label_en: "Manager", esco_uri: "http://data.europa.eu/esco/isco/C1" },
  "2": { esco_code: "2.0", esco_label_en: "Professional", esco_uri: "http://data.europa.eu/esco/isco/C2" },
  "3": { esco_code: "3.0", esco_label_en: "Technician / associate professional", esco_uri: "http://data.europa.eu/esco/isco/C3" },
  "4": { esco_code: "4.0", esco_label_en: "Clerical support worker", esco_uri: "http://data.europa.eu/esco/isco/C4" },
  "5": { esco_code: "5.0", esco_label_en: "Service or sales worker", esco_uri: "http://data.europa.eu/esco/isco/C5" },
  "6": { esco_code: "6.0", esco_label_en: "Skilled agricultural worker", esco_uri: "http://data.europa.eu/esco/isco/C6" },
  "7": { esco_code: "7.0", esco_label_en: "Craft and related trades worker", esco_uri: "http://data.europa.eu/esco/isco/C7" },
  "8": { esco_code: "8.0", esco_label_en: "Plant and machine operator", esco_uri: "http://data.europa.eu/esco/isco/C8" },
  "9": { esco_code: "9.0", esco_label_en: "Elementary occupation", esco_uri: "http://data.europa.eu/esco/isco/C9" },
};

export function lookupEsco(iscoCode: string): EscoMapping {
  const normalized = (iscoCode ?? "").trim();
  const direct = CROSSWALK[normalized];
  if (direct) return { isco_code: normalized, ...direct };

  const major = normalized.charAt(0);
  const fallback = MAJOR_GROUP_FALLBACK[major];
  if (fallback) return { isco_code: normalized, ...fallback };

  return {
    isco_code: normalized,
    esco_code: "0.0",
    esco_label_en: "Occupation (unmapped)",
    esco_uri: "http://data.europa.eu/esco/occupation/unknown",
  };
}
