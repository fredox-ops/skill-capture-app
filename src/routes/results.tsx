import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Briefcase, Coins, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Job {
  title: string;
  match: number;
  salary: string;
}
interface Analysis {
  id: string;
  skills: string[];
  ai_score: number;
  risk_level: "safe" | "medium" | "high";
  jobs: Job[];
}

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Your Skills Profile — Sawt-Net" },
      { name: "description", content: "Your standardized skills profile, AI risk score, and matched job opportunities." },
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
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-4">
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
      </header>

      <div className="flex-1 overflow-y-auto bg-chat-bg px-4 py-5">
        {loading ? (
          <ResultsSkeleton />
        ) : !analysis ? (
          <EmptyState />
        ) : (
          <ResultsContent analysis={analysis} />
        )}
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
      <Link
        to="/"
        className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        Record your first one
      </Link>
    </div>
  );
}

function ResultsContent({ analysis }: { analysis: Analysis }) {
  const riskMeta = {
    safe: { label: "Safe — keep going", className: "bg-success/15 text-success" },
    medium: { label: "Medium risk", className: "bg-warning/15 text-warning" },
    high: { label: "High risk", className: "bg-destructive/15 text-destructive" },
  }[analysis.risk_level];

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-4"
    >
      <Section icon={<TrendingUp className="h-4 w-4" />} title="Skills Profile" subtitle="ISCO-08 Standardized">
        <div className="flex flex-wrap gap-2">
          {analysis.skills.map((s) => (
            <span
              key={s}
              className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
            >
              {s}
            </span>
          ))}
        </div>
      </Section>

      <Section icon={<ShieldAlert className="h-4 w-4" />} title="AI Readiness Score" subtitle="How safe your skills are from automation">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-4xl font-bold text-foreground">{analysis.ai_score}%</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskMeta.className}`}>
            {riskMeta.label}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${analysis.ai_score}%` }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, oklch(0.7 0.17 150), oklch(0.75 0.17 55))`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Hands-on, interpersonal skills are hardest for AI to replace.
        </p>
      </Section>

      <Section icon={<Briefcase className="h-4 w-4" />} title="Job Opportunities" subtitle={`${analysis.jobs.length} matches near you`}>
        <div className="space-y-3">
          {analysis.jobs.map((j, idx) => (
            <div
              key={`${j.title}-${idx}`}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold leading-tight">{j.title}</h3>
                <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
                  {j.match}%
                </span>
              </div>
              <div className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
                <Coins className="h-3.5 w-3.5" />
                {j.salary} / month
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
