import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";

export interface AutomationRow {
  major: string;
  label: string;
  cohort: number | null;
  baseline: number | null;
  n: number;
}

/**
 * Grouped bar chart comparing this cohort's average automation probability
 * against the Frey & Osborne (2017) national baseline, for each ISCO-08
 * major group. Values are 0–100 (% probability). Real data — passed in from
 * the policymaker page's existing aggregation.
 */
export function AutomationRiskChart({ data }: { data: AutomationRow[] }) {
  // Recharts wants finite numbers; convert nulls to 0 but keep an explicit
  // flag so the tooltip can say "no data" instead of "0%".
  const chartData = data.map((d) => ({
    code: d.major,
    label: d.label,
    short: shortLabel(d.label),
    cohort: d.cohort != null ? Math.round(d.cohort * 100) : 0,
    baseline: d.baseline != null ? Math.round(d.baseline * 100) : 0,
    cohortMissing: d.cohort == null,
    n: d.n,
  }));

  const hasAny = data.some((d) => d.cohort != null);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              AI Automation Risk · Cohort vs Frey-Osborne
            </h2>
            <p className="text-xs text-slate-500">
              Probability that tasks in each ISCO-08 major group are exposed to
              automation. Lower bars = more durable work.
            </p>
          </div>
        </div>
      </div>

      {!hasAny ? (
        <div className="flex h-64 items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
          No cohort skills with ISCO codes yet for this filter.
        </div>
      ) : (
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 12, left: 0, bottom: 8 }}
              barCategoryGap={18}
            >
              <defs>
                <linearGradient id="cohortFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.85} />
                </linearGradient>
                <linearGradient id="baselineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#64748b" stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="short"
                tick={{ fill: "#475569", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#cbd5e1" }}
                tickFormatter={(v) => `${v}%`}
                width={42}
              />
              <Tooltip
                cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
                content={<CustomTooltip />}
              />
              <Legend
                verticalAlign="top"
                height={32}
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: "#475569" }}
              />
              <Bar
                dataKey="baseline"
                name="Frey-Osborne baseline"
                fill="url(#baselineFill)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="cohort"
                name="Sawt-Net cohort avg"
                fill="url(#cohortFill)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">
        Source · Frey & Osborne (2017), <em>The Future of Employment</em> — major-group
        averages mapped via SOC↔ISCO-08 crosswalk. Cohort = Sawt-Net analysed profiles.
      </p>
    </section>
  );
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  // recharts payload is loosely typed; narrow inline.
  payload?: Array<{ payload: { code: string; label: string; cohort: number; baseline: number; n: number; cohortMissing: boolean } }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-800">
        <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
          {row.code}
        </span>
        {row.label}
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
        Frey-Osborne baseline: <span className="font-medium text-slate-800">{row.baseline}%</span>
      </div>
      <div className="flex items-center gap-2 text-slate-600">
        <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
        Cohort avg:{" "}
        <span className="font-medium text-slate-800">
          {row.cohortMissing ? "no data" : `${row.cohort}%`}
        </span>
      </div>
      {!row.cohortMissing && (
        <div className="mt-1 text-[11px] text-slate-500">n = {row.n} skills</div>
      )}
    </div>
  );
}

function shortLabel(label: string): string {
  // Compact axis labels so 9 categories fit on mobile.
  const map: Record<string, string> = {
    Managers: "Mgrs",
    Professionals: "Prof",
    "Technicians & Associate Professionals": "Tech",
    "Clerical Support": "Clerk",
    "Service & Sales": "Svc",
    "Skilled Agricultural": "Agri",
    "Craft & Related Trades": "Craft",
    "Plant & Machine Operators": "Plant",
    "Elementary Occupations": "Elem",
  };
  return map[label] ?? label.slice(0, 6);
}
