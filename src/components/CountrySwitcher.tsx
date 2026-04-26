import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

interface CountryConfig {
  iso3: string;
  display_name: string;
  currency: string;
  primary_language: string;
  digital_readiness_pct: number;
}

const LANG_TO_PROFILE: Record<string, "Arabic" | "English" | "French" | "Hindi"> = {
  Arabic: "Arabic",
  English: "English",
  French: "French",
  Hindi: "Hindi",
};

/**
 * Header dropdown that lets users (and the demo audience) switch the active
 * country at any time. Reads from the public.country_configs table — adding
 * a new country in that table makes it appear here without a code change.
 * This is the "infrastructure not app" demo moment for the UNMAPPED brief.
 */
export function CountrySwitcher() {
  const { user } = useAuth();
  const { profile, update } = useProfile();
  const [configs, setConfigs] = useState<CountryConfig[]>([]);

  useEffect(() => {
    supabase
      .from("country_configs")
      .select("iso3,display_name,currency,primary_language,digital_readiness_pct")
      .order("display_name")
      .then(({ data }) => {
        if (data) setConfigs(data as CountryConfig[]);
      });
  }, []);

  if (configs.length === 0) return null;

  const current = configs.find((c) => c.display_name === profile?.country) ?? configs[0];

  const handleChange = async (iso3: string) => {
    const next = configs.find((c) => c.iso3 === iso3);
    if (!next) return;
    if (user && profile) {
      const lang = LANG_TO_PROFILE[next.primary_language] ?? "English";
      await update({
        country: next.display_name as "Morocco" | "India" | "Ghana" | "Kenya",
        language: lang,
      });
      // Reload so signals re-fetch with the new calibration / wage table.
      window.location.reload();
    }
  };

  return (
    <label className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-[var(--shadow-card)]">
      <Globe className="h-3.5 w-3.5 text-[color:var(--primary-deep)]" />
      <span className="sr-only">Country</span>
      <select
        value={current.iso3}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent text-xs font-bold tracking-wide outline-none"
        aria-label="Switch country"
      >
        {configs.map((c) => (
          <option key={c.iso3} value={c.iso3}>
            {c.display_name} · {c.currency}
          </option>
        ))}
      </select>
      <span className="rounded-full bg-[color:var(--primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--primary-deep)]">
        ITU {current.digital_readiness_pct}%
      </span>
    </label>
  );
}
