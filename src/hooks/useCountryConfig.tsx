import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CountryConfig {
  iso3: string;
  display_name: string;
  currency: string;
  primary_language: string;
  digital_readiness_pct: number;
  automation_calibration_factor: number;
  opportunity_types: string[];
}

// Tiny in-memory cache so multiple components on the same page share the
// row without re-querying. The table changes rarely (admin-only edits).
const cache = new Map<string, CountryConfig>();

/**
 * Fetch the active `country_configs` row by display_name (e.g. "Morocco").
 * Returns `null` while loading or if the country isn't configured.
 */
export function useCountryConfig(country: string | undefined | null): CountryConfig | null {
  const key = (country ?? "").trim();
  const [config, setConfig] = useState<CountryConfig | null>(
    key ? (cache.get(key) ?? null) : null,
  );

  useEffect(() => {
    if (!key) {
      setConfig(null);
      return;
    }
    const cached = cache.get(key);
    if (cached) {
      setConfig(cached);
      return;
    }
    let cancelled = false;
    supabase
      .from("country_configs")
      .select(
        "iso3,display_name,currency,primary_language,digital_readiness_pct,automation_calibration_factor,opportunity_types",
      )
      .eq("display_name", key)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as CountryConfig;
        cache.set(key, row);
        setConfig(row);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return config;
}
