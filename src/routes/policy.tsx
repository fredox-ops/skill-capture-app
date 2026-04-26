import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Database,
  Download,
  GraduationCap,
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  COUNTRY_TO_ISO3,
  FREY_BASELINE_BY_MAJOR,
  ILO_WAGES,
  ISCO_MAJOR_LABELS,
  WITTGENSTEIN,
  iscoMajor,
} from "@/lib/econ-baselines";
import { GrainientHero } from "@/components/policy/GrainientHero";
import { AutomationRiskChart } from "@/components/policy/AutomationRiskChart";

export const Route = createFileRoute("/policy")({
  head: () => ({
    meta: [
      { title: "Policymaker Dashboard — Sawt-Net" },
      {
        name: "description",
        content:
          "Aggregate, anonymised view of youth skills supply, automation exposure and wage gaps for policymakers and program officers.",
      },
    ],
  }),
  component: PolicyDashboard,
});

// ---------- Types ----------

interface AnalysisRow {
  id: string;
  user_id: string;
  ai_score: number;
  risk_level: string;
  skills: { name?: string; isco_code?: string; automation_probability?: number }[];
  jobs: { job_title?: string; isco_code?: string; local_wage?: string }[];
  signals: Record<string, unknown> | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  country: string;
  language: string;
}

// ---------- Component ----------

function PolicyDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isPolicymaker, loading: roleLoading } = useUserRole();

  const [analyses, setAnalyses] = useState<AnalysisRow[] | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [country, setCountry] = useState<string>("All");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
  }, [user, authLoading, roleLoading, navigate]);

  // Data fetch
  useEffect(() => {
    if (!user || !isPolicymaker) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [aRes, pRes] = await Promise.all([
        supabase
          .from("analyses")
          .select("id, user_id, ai_score, risk_level, skills, jobs, signals, created_at")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("profiles").select("user_id, country, language"),
      ]);
      if (cancelled) return;
      if (aRes.error) {
        setError(aRes.error.message);
        setLoading(false);
        return;
      }
      setAnalyses((aRes.data ?? []) as unknown as AnalysisRow[]);
      setProfiles((pRes.data ?? []) as unknown as ProfileRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isPolicymaker]);

  // ---------- Derived aggregates ----------

  const profileByUser = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    profiles.forEach((p) => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    if (!analyses) return [];
    if (country === "All") return analyses;
    return analyses.filter((a) => profileByUser.get(a.user_id)?.country === country);
  }, [analyses, country, profileByUser]);

  const countriesPresent = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((p) => set.add(p.country));
    return ["All", ...Array.from(set).sort()];
  }, [profiles]);

  const iso3 = country === "All" ? null : COUNTRY_TO_ISO3[country] ?? null;

  // Skill-supply heatmap by ISCO major group
  const skillHeatmap = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    filtered.forEach((a) =>
      a.skills?.forEach((s) => {
        const m = iscoMajor(s.isco_code);
        if (!m) return;
        counts[m] = (counts[m] ?? 0) + 1;
        total += 1;
      }),
    );
    return Object.keys(ISCO_MAJOR_LABELS).map((k) => ({
      major: k,
      label: ISCO_MAJOR_LABELS[k],
      count: counts[k] ?? 0,
      pct: total > 0 ? ((counts[k] ?? 0) / total) * 100 : 0,
    }));
  }, [filtered]);

  // Cohort automation exposure vs Frey-Osborne national baseline
  const automationByMajor = useMemo(() => {
    const sums: Record<string, { sum: number; n: number }> = {};
    filtered.forEach((a) =>
      a.skills?.forEach((s) => {
        const m = iscoMajor(s.isco_code);
        if (!m || typeof s.automation_probability !== "number") return;
        if (!sums[m]) sums[m] = { sum: 0, n: 0 };
        sums[m].sum += s.automation_probability;
        sums[m].n += 1;
      }),
    );
    return Object.keys(ISCO_MAJOR_LABELS).map((k) => ({
      major: k,
      label: ISCO_MAJOR_LABELS[k],
      cohort: sums[k] && sums[k].n > 0 ? sums[k].sum / sums[k].n : null,
      baseline: FREY_BASELINE_BY_MAJOR[k] ?? null,
      n: sums[k]?.n ?? 0,
    }));
  }, [filtered]);

  // Wage gap: cohort opportunity wage vs ILOSTAT median (only when single country)
  const wageGap = useMemo(() => {
    if (!iso3 || !ILO_WAGES[iso3]) return null;
    const ref = ILO_WAGES[iso3];
    const sums: Record<string, { sum: number; n: number }> = {};
    filtered.forEach((a) =>
      a.jobs?.forEach((j) => {
        const m = iscoMajor(j.isco_code);
        if (!m) return;
        const num = parseFirstNumber(j.local_wage);
        if (num == null) return;
        if (!sums[m]) sums[m] = { sum: 0, n: 0 };
        sums[m].sum += num;
        sums[m].n += 1;
      }),
    );
    return {
      currency: ref.currency,
      year: ref.year,
      rows: Object.keys(ISCO_MAJOR_LABELS).map((k) => ({
        major: k,
        label: ISCO_MAJOR_LABELS[k],
        cohortMedian: sums[k] && sums[k].n > 0 ? sums[k].sum / sums[k].n : null,
        iloMedian: ref.wage_by_isco_major[k] ?? null,
        n: sums[k]?.n ?? 0,
      })),
    };
  }, [filtered, iso3]);

  const wittgenstein = iso3 ? WITTGENSTEIN[iso3] : null;

  // Headline KPIs
  const kpis = useMemo(() => {
    const n = filtered.length;
    const avgScore =
      n > 0 ? Math.round(filtered.reduce((s, a) => s + (a.ai_score || 0), 0) / n) : 0;
    const riskCounts = { High: 0, Medium: 0, Low: 0 } as Record<string, number>;
    filtered.forEach((a) => {
      const lvl = (a.risk_level || "").toLowerCase();
      if (lvl.includes("high")) riskCounts.High += 1;
      else if (lvl.includes("low")) riskCounts.Low += 1;
      else riskCounts.Medium += 1;
    });
    return { n, avgScore, riskCounts };
  }, [filtered]);

  // ---------- Export ----------

  function downloadCsv() {
    if (!filtered.length) return;
    const rows: string[][] = [
      [
        "analysis_id",
        "created_at",
        "country",
        "language",
        "ai_score",
        "risk_level",
        "skill_name",
        "isco_code",
        "isco_major",
        "automation_probability",
      ],
    ];
    filtered.forEach((a) => {
      const p = profileByUser.get(a.user_id);
      a.skills?.forEach((s) => {
        rows.push([
          a.id,
          a.created_at,
          p?.country ?? "",
          p?.language ?? "",
          String(a.ai_score ?? ""),
          a.risk_level ?? "",
          s.name ?? "",
          s.isco_code ?? "",
          iscoMajor(s.isco_code) ?? "",
          s.automation_probability != null ? String(s.automation_probability) : "",
        ]);
      });
    });
    const csv = rows
      .map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sawtnet-policy-${country.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ---------- Render ----------

  if (authLoading || roleLoading) {
    return <FullScreenSpinner label="Checking access…" />;
  }

  if (!user) return null;

  if (!isPolicymaker) {
    return <AccessDenied userId={user.id} />;
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
              aria-label="Back to app"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h1 className="text-lg font-semibold tracking-tight">
                  Policymaker Dashboard
                </h1>
              </div>
              <p className="text-xs text-slate-500">
                Aggregate, anonymised view across {kpis.n} analysed youth profiles.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {countriesPresent.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              onClick={downloadCsv}
              disabled={!filtered.length}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <GrainientHero
          badge="Open Infrastructure · Live cohort"
          title={`${kpis.n.toLocaleString()} youth profiles, mapped to real economic signals`}
          subtitle={`Aggregate, anonymised view of skill supply, automation exposure (Frey-Osborne) and wage gaps (ILOSTAT) for ${
            country === "All" ? "all configured countries" : country
          }.`}
        />

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <FullScreenSpinner label="Loading aggregate signals…" inline />
        ) : (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Profiles analysed" value={kpis.n.toLocaleString()} />
              <KpiCard
                label="Avg AI-resilience score"
                value={`${kpis.avgScore} / 100`}
                hint="Higher = more durable to automation"
              />
              <KpiCard
                label="High-risk share"
                value={
                  kpis.n
                    ? `${Math.round((kpis.riskCounts.High / kpis.n) * 100)}%`
                    : "—"
                }
                tone="red"
              />
              <KpiCard
                label="Low-risk share"
                value={
                  kpis.n
                    ? `${Math.round((kpis.riskCounts.Low / kpis.n) * 100)}%`
                    : "—"
                }
                tone="green"
              />
            </section>

            {/* Skill supply heatmap */}
            <Card
              title="Skill supply by ISCO-08 major group"
              icon={<BarChart3 className="h-4 w-4" />}
              source="ISCO-08 (ILO) — taxonomy. Cohort skills mapped via Sawt-Net analyse-skills."
            >
              <div className="space-y-2">
                {skillHeatmap.map((row) => (
                  <div key={row.major} className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-5 text-sm text-slate-700">
                      <span className="mr-2 inline-block w-6 rounded bg-slate-100 px-1.5 py-0.5 text-center text-xs font-mono text-slate-500">
                        {row.major}
                      </span>
                      {row.label}
                    </div>
                    <div className="col-span-6">
                      <div className="h-3 w-full rounded-full bg-slate-100">
                        <div
                          className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                          style={{ width: `${Math.max(2, row.pct)}%` }}
                        />
                      </div>
                    </div>
                    <div className="col-span-1 text-right text-xs text-slate-500">
                      {row.count}
                    </div>
                  </div>
                ))}
                {skillHeatmap.every((r) => r.count === 0) && (
                  <p className="text-sm text-slate-500">
                    No skills with ISCO codes yet for this filter.
                  </p>
                )}
              </div>
            </Card>

            {/* Automation cohort vs Frey-Osborne baseline */}
            <Card
              title="Automation exposure: cohort vs Frey-Osborne baseline"
              icon={<TrendingDown className="h-4 w-4" />}
              source="Frey & Osborne (2017), The Future of Employment — major-group averages mapped via SOC↔ISCO crosswalk."
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">ISCO major group</th>
                      <th className="py-2 pr-4">Cohort avg</th>
                      <th className="py-2 pr-4">Frey-Osborne baseline</th>
                      <th className="py-2 pr-4">Gap</th>
                      <th className="py-2 pr-4">Skills (n)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {automationByMajor.map((row) => {
                      const gap =
                        row.cohort != null && row.baseline != null
                          ? row.cohort - row.baseline
                          : null;
                      return (
                        <tr key={row.major} className="border-b border-slate-100">
                          <td className="py-2 pr-4 text-slate-700">
                            <span className="mr-2 inline-block w-6 rounded bg-slate-100 px-1.5 py-0.5 text-center text-xs font-mono text-slate-500">
                              {row.major}
                            </span>
                            {row.label}
                          </td>
                          <td className="py-2 pr-4">{fmtPct(row.cohort)}</td>
                          <td className="py-2 pr-4 text-slate-500">
                            {fmtPct(row.baseline)}
                          </td>
                          <td
                            className={`py-2 pr-4 font-medium ${
                              gap == null
                                ? "text-slate-400"
                                : gap > 0.05
                                  ? "text-red-600"
                                  : gap < -0.05
                                    ? "text-emerald-600"
                                    : "text-slate-600"
                            }`}
                          >
                            {gap == null
                              ? "—"
                              : `${gap > 0 ? "+" : ""}${(gap * 100).toFixed(1)} pp`}
                          </td>
                          <td className="py-2 pr-4 text-slate-500">{row.n}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Positive gap = cohort skills are <strong>more</strong> exposed to
                automation than the national Frey-Osborne baseline for that group.
              </p>
            </Card>

            {/* Wage gap (single country only) */}
            <Card
              title={`Wage gap: cohort opportunities vs ILOSTAT median${
                iso3 ? ` (${country})` : ""
              }`}
              icon={<TrendingUp className="h-4 w-4" />}
              source={
                wageGap
                  ? `ILOSTAT mean nominal monthly earnings, ${wageGap.currency}, ${wageGap.year}.`
                  : "Select a single country to compare against ILOSTAT national medians."
              }
            >
              {!wageGap ? (
                <p className="text-sm text-slate-500">
                  Pick a country in the filter above to see a wage-gap comparison.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-4">ISCO major group</th>
                        <th className="py-2 pr-4">Cohort opportunity median</th>
                        <th className="py-2 pr-4">ILOSTAT median</th>
                        <th className="py-2 pr-4">Gap</th>
                        <th className="py-2 pr-4">Listings (n)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wageGap.rows.map((row) => {
                        const gap =
                          row.cohortMedian != null && row.iloMedian
                            ? (row.cohortMedian - row.iloMedian) / row.iloMedian
                            : null;
                        return (
                          <tr key={row.major} className="border-b border-slate-100">
                            <td className="py-2 pr-4 text-slate-700">
                              <span className="mr-2 inline-block w-6 rounded bg-slate-100 px-1.5 py-0.5 text-center text-xs font-mono text-slate-500">
                                {row.major}
                              </span>
                              {row.label}
                            </td>
                            <td className="py-2 pr-4">
                              {row.cohortMedian != null
                                ? `${Math.round(row.cohortMedian).toLocaleString()} ${
                                    wageGap.currency
                                  }`
                                : "—"}
                            </td>
                            <td className="py-2 pr-4 text-slate-500">
                              {row.iloMedian != null
                                ? `${row.iloMedian.toLocaleString()} ${wageGap.currency}`
                                : "—"}
                            </td>
                            <td
                              className={`py-2 pr-4 font-medium ${
                                gap == null
                                  ? "text-slate-400"
                                  : gap < -0.1
                                    ? "text-red-600"
                                    : gap > 0.1
                                      ? "text-emerald-600"
                                      : "text-slate-600"
                              }`}
                            >
                              {gap == null ? "—" : `${gap > 0 ? "+" : ""}${(gap * 100).toFixed(0)}%`}
                            </td>
                            <td className="py-2 pr-4 text-slate-500">{row.n}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Wittgenstein overlay */}
            <Card
              title="Education trajectory: Wittgenstein 2025 → 2035"
              icon={<GraduationCap className="h-4 w-4" />}
              source="Wittgenstein Centre Human Capital Data Explorer v2.0, SSP2 scenario."
            >
              {!wittgenstein ? (
                <p className="text-sm text-slate-500">
                  Pick a country in the filter above to see its education projection.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-end gap-6">
                    <Stat label="2025" value={`${wittgenstein.share_2025_pct}%`} />
                    <div className="text-2xl text-slate-300">→</div>
                    <Stat
                      label="2035"
                      value={`${wittgenstein.share_2035_pct}%`}
                      tone="green"
                    />
                    <Stat
                      label="Δ"
                      value={`+${wittgenstein.share_2035_pct - wittgenstein.share_2025_pct} pp`}
                      tone="green"
                    />
                  </div>
                  <p className="text-sm text-slate-600">
                    Share of {country}'s 20–39 cohort with at least upper-secondary
                    education. By 2035, expect{" "}
                    <strong>
                      {wittgenstein.share_2035_pct - wittgenstein.share_2025_pct} pp
                    </strong>{" "}
                    more competition for entry-level roles requiring secondary credentials.
                  </p>
                </div>
              )}
            </Card>

            {/* Honest limits */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <Database className="h-4 w-4" /> What this dashboard does not know
              </div>
              <ul className="list-disc space-y-0.5 pl-5 text-amber-800">
                <li>
                  Wages are national medians from ILOSTAT, not local offers.
                  Variance within a city can be large.
                </li>
                <li>
                  Frey-Osborne probabilities are derived from US SOC and may
                  understate manual-task resilience in LMIC contexts.
                </li>
                <li>
                  Cohort here = users of Sawt-Net only. Not a representative
                  national sample.
                </li>
              </ul>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ---------- Sub-components ----------

function Card({
  title,
  icon,
  source,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            {icon}
          </div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        </div>
      </div>
      {children}
      <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">
        Source · {source}
      </p>
    </section>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "red" | "green";
}) {
  const toneClass =
    tone === "red"
      ? "text-red-600"
      : tone === "green"
        ? "text-emerald-600"
        : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green";
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`text-2xl font-semibold ${
          tone === "green" ? "text-emerald-600" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function FullScreenSpinner({
  label,
  inline,
}: {
  label: string;
  inline?: boolean;
}) {
  const wrap = inline ? "py-12" : "min-h-dvh";
  return (
    <div
      className={`flex ${wrap} items-center justify-center bg-slate-50 text-slate-600`}
    >
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

function AccessDenied({ userId }: { userId: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <h1 className="text-lg font-semibold text-slate-800">
          Policymaker access required
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This dashboard surfaces aggregate, anonymised data for program officers
          and policymakers. Your account does not yet hold the{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">policymaker</code>{" "}
          role.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Ask an administrator to grant the role to user&nbsp;
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">{userId}</code>.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Link>
      </div>
    </div>
  );
}

// ---------- Helpers ----------

function fmtPct(p: number | null): string {
  if (p == null) return "—";
  return `${(p * 100).toFixed(0)}%`;
}

function parseFirstNumber(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/[,\s]/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}
