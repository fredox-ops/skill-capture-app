import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "policymaker" | "user";

interface UseUserRoleResult {
  roles: AppRole[];
  isPolicymaker: boolean;
  isAdmin: boolean;
  loading: boolean;
}

export function useUserRole(): UseUserRoleResult {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // user_roles table not yet in generated types (Lovable Cloud rebuilds types
    // on next deploy). Cast through `any` strictly for this read.
    (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }: { data: { role: AppRole }[] | null }) => {
        if (cancelled) return;
        setRoles((data ?? []).map((r) => r.role));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return {
    roles,
    isPolicymaker: roles.includes("policymaker") || roles.includes("admin"),
    isAdmin: roles.includes("admin"),
    loading,
  };
}
