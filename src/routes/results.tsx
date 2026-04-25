import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Briefcase, Coins, History as HistoryIcon, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Skill {
  name: string;
  isco_code: string;
}
interface Opportunity {
  job_title: string;
  match_percent: number;
  local_wage: string;
}
type RiskLevel = "Low Risk" | "Medium Risk" | "High Risk";

interface Analysis {
  id: string;
  skills: Skill[];
  ai_score: number;
  risk_level: RiskLevel;
  jobs: Opportunity[];
}

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Your Skills Profile — Sawt-Net" },
      { name: "description", content: "Your standardized ISCO-08 skills profile, AI risk score, and matched job opportunities." },
    ],
  }),
  component: ResultsScreen,
});

function ResultsScreen() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchAnalysis = async () => {
      let query = supabase
        .from("analyses")
        .select("id, skills, ai_score, risk_level, jobs")
        .eq("user_id", user.id);
      if (id) {
        query = query.eq("id", id);
      } else {
        query = query.order("created_at", { ascending: false }).limit(1);
      }
      const { data, error } = await query.maybeSingle();
      if (error) {
        toast.error(error.message);
      } else if (data) {
        setAnalysis(data as unknown as Analysis);
      }
      setLoading(false);
    };
    fetchAnalysis();
  }, [user, id]);

  return (
    <MobileShell>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label="Back"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-base font-bold leading-tight">Your Profile</h1>
              <p className="text-xs text-muted-foreground">Powered by Sawt-Net AI</p>
            </div>
          </div>
          <Link
            to="/history"
            aria-label="History"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <HistoryIcon className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-chat-bg">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
          {loading ? (
            <ResultsSkeleton />
          ) : !analysis ? (
            <EmptyState />
          ) : (
            <ResultsContent analysis={analysis} />
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      {[140, 200, 260].map((h, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl bg-card shadow-[var(--shadow-card)]"
          style={{ height: h }}
        />
      ))}
      <p className="text-center text-sm text-muted-foreground">Loading your analysis…</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="mb-4 text-sm text-muted-foreground">No analysis yet.</p>
      <div className="flex gap-2">
        <Link
          to="/"
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          Record your first one
        </Link>
        <Link
          to="/history"
          className="rounded-2xl border-2 border-border bg-background px-5 py-3 text-sm font-semibold text-foreground"
        >
          View past analyses
        </Link>
      </div>
    </div>
  );
}

const RISK_META: Record<RiskLevel, { className: string; gradient: string }> = {
  "Low Risk": {
    className: "bg-success/15 text-success",
    gradient: "linear-gradient(90deg, oklch(0.78 0.15 145), oklch(0.7 0.17 150))",
  },
  "Medium Risk": {
    className: "bg-warning/15 text-warning",
    gradient: "linear-gradient(90deg, oklch(0.7 0.17 150), oklch(0.75 0.17 55))",
  },
  "High Risk": {
    className: "bg-destructive/15 text-destructive",
    gradient: "linear-gradient(90deg, oklch(0.75 0.17 55), oklch(0.6 0.22 27))",
  },
};

function ResultsContent({ analysis }: { analysis: Analysis }) {
  // Defensive: tolerate legacy rows where risk_level isn't one of the new strings
  const riskKey: RiskLevel = (
    analysis.risk_level === "Low Risk" || analysis.risk_level === "Medium Risk" || analysis.risk_level === "High Risk"
      ? analysis.risk_level
      : analysis.ai_score >= 70
        ? "Low Risk"
        : analysis.ai_score >= 40
          ? "Medium Risk"
          : "High Risk"
  ) as RiskLevel;
  const riskMeta = RISK_META[riskKey];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-4"
    >
      <Section icon={<TrendingUp className="h-4 w-4" />} title="Skills Profile" subtitle="ISCO-08 Standardized">
        <div className="flex flex-wrap gap-2">
          {analysis.skills.map((s, idx) => (
            <span
              key={`${s.isco_code}-${idx}`}
              className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
            >
              {s.name}
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary/80">
                ISCO {s.isco_code}
              </span>
            </span>
          ))}
        </div>
      </Section>

      <Section
        icon={<ShieldAlert className="h-4 w-4" />}
        title="AI Readiness Score"
        subtitle="How safe your skills are from automation"
      >
        <div className="mb-2 flex items-end justify-between">
          <span className="text-4xl font-bold text-foreground">{analysis.ai_score}%</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskMeta.className}`}>
            {riskKey}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${analysis.ai_score}%` }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: riskMeta.gradient }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Hands-on, interpersonal skills are hardest for AI to replace.
        </p>
      </Section>

      <Section
        icon={<Briefcase className="h-4 w-4" />}
        title="Job Opportunities"
        subtitle={`${analysis.jobs.length} matches near you`}
      >
        <div className="space-y-3">
          {analysis.jobs.map((j, idx) => (
            <div
              key={`${j.job_title}-${idx}`}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold leading-tight">{j.job_title}</h3>
                <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                  {j.match_percent}%
                </span>
              </div>
              <div className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Coins className="h-3.5 w-3.5" />
                {j.local_wage} / month
              </div>
              <button className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]">
                Apply
              </button>
            </div>
          ))}
        </div>
      </Section>
    </motion.div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0 },
      }}
      className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]"
    >
      <div className="mb-1 flex items-center gap-2 text-primary">
        {icon}
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </motion.section>
  );
}
