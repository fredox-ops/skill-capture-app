import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Country = "Morocco" | "India";
export type Language = "Arabic" | "English" | "French";

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  country: Country;
  language: Language;
  avatar_url: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data as Profile | null);
        setLoading(false);
      });
  }, [user]);

  const update = useCallback(
    async (patch: Partial<Pick<Profile, "country" | "language" | "display_name">>) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", user.id)
        .select()
        .single();
      if (!error && data) setProfile(data as Profile);
    },
    [user],
  );

  return { profile, loading, update };
}
