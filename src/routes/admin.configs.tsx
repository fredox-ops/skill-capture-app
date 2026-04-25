import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/configs")({
  head: () => ({
    meta: [
      { title: "Country Configs — Sawt-Net Admin" },
      {
        name: "description",
        content:
          "Live-configure new country contexts (currency, language, automation calibration, digital readiness) without redeploying — UNMAPPED infrastructure layer.",
      },
    ],
  }),
  component: AdminConfigsPage,
});

interface CountryConfigRow {
  iso3: string;
  display_name: string;
  currency: string;
  primary_language: string;
  secondary_languages: string[];
  automation_calibration_factor: number;
  opportunity_types: string[];
  digital_readiness_pct: number;
}

const EMPTY: CountryConfigRow = {
  iso3: "",
  display_name: "",
  currency: "",
  primary_language: "English",
  secondary_languages: [],
  automation_calibration_factor: 1,
  opportunity_types: ["formal", "gig", "self_employment", "training"],
  digital_readiness_pct: 50,
};

function AdminConfigsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [rows, setRows] = useState<CountryConfigRow[]>([]);
  const [draft, setDraft] = useState<CountryConfigRow>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) navigate({ to: "/login" });
  }, [user, authLoading, roleLoading, navigate]);

  useEffect(() => {
    supabase
      .from("country_configs")
      .select("*")
      .order("display_name")
      .then(({ data }) => {
        if (data) setRows(data as CountryConfigRow[]);
      });
  }, []);

  const reload = async () => {
    const { data } = await supabase
      .from("country_configs")
      .select("*")
      .order("display_name");
    if (data) setRows(data as CountryConfigRow[]);
  };

  const handleAdd = async () => {
    setError(null);
    setSaving(true);
    const { error: insErr } = await supabase.from("country_configs").insert(draft);
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setDraft(EMPTY);
    await reload();
  };

  const handleDelete = async (iso3: string) => {
    if (!confirm(`Delete ${iso3}?`)) return;
    await supabase.from("country_configs").delete().eq("iso3", iso3);
    await reload();
  };

  if (authLoading || roleLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Country configs can only be edited by users with the <code>admin</code> role.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-primary underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-card shadow"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Country Configurations</h1>
          <p className="text-xs text-muted-foreground">
            Localizable infrastructure layer — add a new country in &lt;60 seconds.
          </p>
        </div>
      </div>

      <section className="mb-8 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 text-sm font-bold">Add a new country</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Input label="ISO-3 code" value={draft.iso3} onChange={(v) => setDraft({ ...draft, iso3: v.toUpperCase() })} />
          <Input label="Display name" value={draft.display_name} onChange={(v) => setDraft({ ...draft, display_name: v })} />
          <Input label="Currency (3-letter)" value={draft.currency} onChange={(v) => setDraft({ ...draft, currency: v.toUpperCase() })} />
          <Input label="Primary language" value={draft.primary_language} onChange={(v) => setDraft({ ...draft, primary_language: v })} />
          <Input
            label="Calibration factor (0–1)"
            value={String(draft.automation_calibration_factor)}
            onChange={(v) => setDraft({ ...draft, automation_calibration_factor: Number(v) || 1 })}
          />
          <Input
            label="ITU digital readiness %"
            value={String(draft.digital_readiness_pct)}
            onChange={(v) => setDraft({ ...draft, digital_readiness_pct: Number(v) || 0 })}
          />
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={saving || !draft.iso3 || !draft.display_name}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Add country"}
        </button>
      </section>

      <h2 className="mb-2 text-sm font-bold">Existing</h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.iso3}
            className="flex items-center justify-between rounded-xl bg-card p-3 text-sm shadow-[var(--shadow-card)]"
          >
            <div>
              <div className="font-bold">
                {r.display_name} <span className="text-xs text-muted-foreground">({r.iso3})</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {r.currency} · {r.primary_language} · calibration {r.automation_calibration_factor} ·
                ITU {r.digital_readiness_pct}%
              </div>
            </div>
            <button
              onClick={() => handleDelete(r.iso3)}
              className="rounded-full p-2 text-destructive hover:bg-destructive/10"
              aria-label={`Delete ${r.display_name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[11px] text-muted-foreground">
        See <code>docs/CONFIGURING_A_NEW_COUNTRY.md</code> for the full contract.
      </p>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-xs"
      />
    </label>
  );
}
