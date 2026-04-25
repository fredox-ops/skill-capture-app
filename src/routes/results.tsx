import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Coins,
  Database,
  Download,
  History as HistoryIcon,
  Info,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { CvModal } from "@/components/CvModal";
import { SmartApplyModal } from "@/components/SmartApplyModal";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { getResultsCopy, type ResultsCopy } from "@/lib/results-i18n";

interface Skill {
  name: string;
  isco_code: string;
  automation_probability?: number;
  automation_source?: string;
}
interface Listing {
  title: string;
  url: string;
  snippet?: string;
}
interface Opportunity {
  job_title: string;
  match_percent: number;
  local_wage: string;
  isco_code?: string;
  wage_year?: number | null;
  wage_source?: string | null;
  automation_probability?: number;
  listings?: Listing[];
}
type RiskLevel = "Low Risk" | "Medium Risk" | "High Risk";

interface Signals {
  automation?: { source?: string; source_short?: string; method?: string };
  wages?: { source?: string; source_short?: string; year?: number | null; country?: string };
  education_trend?: {
    country: string;
    iso3: string;
    share_2025_pct: number;
    share_2035_pct: number;
    delta_pct: number;
    narrative_en: string;
    source: string;
    source_short: string;
  } | null;
}

interface Analysis {
  id: string;
  session_id: string;
  skills: Skill[];
  ai_score: number;
  risk_level: RiskLevel;
  jobs: Opportunity[];
  signals?: Signals;
}

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Your Skills Profile — Sawt-Net" },
      {
        name: "description",
        content:
          "Your standardized ISCO-08 skills profile, AI risk score, and matched job opportunities.",
      },
    ],
  }),
  component: ResultsScreen,
});

function ResultsScreen() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const { copy, dir } = useMemo(
    () => getResultsCopy(profile?.language, profile?.country),
    [profile?.language, profile?.country],
  );

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
        .select("id, session_id, skills, ai_score, risk_level, jobs, signals")
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
        // Pull the originating voice transcript so the CV + Smart Apply
        // modals can ground their content in the user's actual words.
        if (data.session_id) {
          const { data: session } = await supabase
            .from("voice_sessions")
            .select("transcript")
            .eq("id", data.session_id)
            .maybeSingle();
          if (session?.transcript) setTranscript(session.transcript);
        }
      }
      setLoading(false);
    };
    fetchAnalysis();
  }, [user, id]);

  return (
    <MobileShell>
      <header className="border-b border-border bg-card" dir={dir}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label={copy.back}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
            >
              <ArrowLeft className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`} />
            </Link>
            <div>
              <h1 className="text-base font-bold leading-tight">{copy.yourProfile}</h1>
              <p className="text-xs text-muted-foreground">{copy.poweredBy}</p>
            </div>
          </div>
          <Link
            to="/history"
            aria-label={copy.history}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <HistoryIcon className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-chat-bg" dir={dir}>
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
          {loading ? (
            <ResultsSkeleton copy={copy} />
          ) : !analysis ? (
            <EmptyState copy={copy} />
          ) : (
            <ResultsContent
              analysis={analysis}
              copy={copy}
              dir={dir}
              language={profile?.language ?? "English"}
              country={profile?.country ?? "Morocco"}
              displayName={profile?.display_name ?? ""}
              transcript={transcript}
            />
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function ResultsSkeleton({ copy }: { copy: ResultsCopy }) {
  return (
    <div className="space-y-4">
      {[140, 200, 260].map((h, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl bg-card shadow-[var(--shadow-card)]"
          style={{ height: h }}
        />
      ))}
      <p className="text-center text-sm text-muted-foreground">{copy.loading}</p>
    </div>
  );
}

function EmptyState({ copy }: { copy: ResultsCopy }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="mb-4 text-sm text-muted-foreground">{copy.emptyTitle}</p>
      <div className="flex gap-2">
        <Link
          to="/"
          className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
        >
          {copy.recordFirst}
        </Link>
        <Link
          to="/history"
          className="rounded-2xl border-2 border-border bg-background px-5 py-3 text-sm font-semibold text-foreground"
        >
          {copy.pastAnalyses}
        </Link>
      </div>
    </div>
  );
}

const RISK_META: Record<
  RiskLevel,
  { className: string; gradient: string; key: "Low" | "Medium" | "High" }
> = {
  "Low Risk": {
    className: "bg-success/15 text-success",
    gradient: "linear-gradient(90deg, oklch(0.78 0.15 145), oklch(0.7 0.17 150))",
    key: "Low",
  },
  "Medium Risk": {
    className: "bg-warning/15 text-warning",
    gradient: "linear-gradient(90deg, oklch(0.7 0.17 150), oklch(0.75 0.17 55))",
    key: "Medium",
  },
  "High Risk": {
    className: "bg-destructive/15 text-destructive",
    gradient: "linear-gradient(90deg, oklch(0.75 0.17 55), oklch(0.6 0.22 27))",
    key: "High",
  },
};

interface ResultsContentProps {
  analysis: Analysis;
  copy: ResultsCopy;
  dir: "rtl" | "ltr";
  language: string;
  country: string;
  displayName: string;
  transcript: string;
}

function ResultsContent({
  analysis,
  copy,
  dir,
  language,
  country,
  displayName,
  transcript,
}: ResultsContentProps) {
  const [cvOpen, setCvOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<Opportunity | null>(null);

  // Defensive: tolerate legacy rows where risk_level isn't one of the new strings
  const riskKey: RiskLevel = (
    analysis.risk_level === "Low Risk" ||
    analysis.risk_level === "Medium Risk" ||
    analysis.risk_level === "High Risk"
      ? analysis.risk_level
      : analysis.ai_score >= 70
        ? "Low Risk"
        : analysis.ai_score >= 40
          ? "Medium Risk"
          : "High Risk"
  ) as RiskLevel;
  const riskMeta = RISK_META[riskKey];
  const riskLabel = copy.risk[riskMeta.key];

  return (
    <>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.1 } } }}
        className="space-y-4"
      >
        <Section
          icon={<TrendingUp className="h-4 w-4" />}
          title={copy.skillsTitle}
          subtitle={copy.skillsSubtitle}
        >
          {/* Prominent Download CV button */}
          <button
            type="button"
            onClick={() => setCvOpen(true)}
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            {copy.downloadCv}
          </button>

          <div className="flex flex-wrap gap-2">
            {analysis.skills.map((s, idx) => {
              const pct =
                typeof s.automation_probability === "number"
                  ? Math.round(s.automation_probability * 100)
                  : null;
              const tone =
                pct === null
                  ? "bg-primary/10 text-primary"
                  : pct >= 70
                    ? "bg-destructive/10 text-destructive"
                    : pct >= 40
                      ? "bg-warning/10 text-warning"
                      : "bg-success/10 text-success";
              return (
                <span
                  key={`${s.isco_code}-${idx}`}
                  className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
                  title={s.automation_source ? `${copy.sourceLabel}: ${s.automation_source}` : undefined}
                >
                  {s.name}
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary/80">
                    ISCO {s.isco_code}
                  </span>
                  {pct !== null && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
                      🤖 {pct}%
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          {analysis.signals?.automation?.source_short && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Database className="h-3 w-3" />
              <span className="font-semibold uppercase tracking-wide">{copy.sourceLabel}:</span>
              <span>{analysis.signals.automation.source_short}</span>
            </p>
          )}
        </Section>

        <Section
          icon={<ShieldAlert className="h-4 w-4" />}
          title={copy.riskTitle}
          subtitle={copy.riskSubtitle}
        >
          <div className="mb-2 flex items-end justify-between">
            <span className="text-4xl font-bold text-foreground">{analysis.ai_score}%</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${riskMeta.className}`}>
              {riskLabel}
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
          <p className="mt-2 text-xs text-muted-foreground">{copy.riskFootnote}</p>
        </Section>

        <Section
          icon={<Briefcase className="h-4 w-4" />}
          title={copy.jobsTitle}
          subtitle={copy.jobsSubtitle(analysis.jobs.length)}
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
                  {j.local_wage} {copy.perMonth}
                </div>

                {j.listings && j.listings.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {copy.liveListings}
                    </p>
                    {j.listings.map((l, i) => (
                      <a
                        key={`${l.url}-${i}`}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border border-border bg-muted/40 p-2.5 transition hover:bg-muted"
                      >
                        <div className="line-clamp-1 text-xs font-semibold text-foreground">
                          {l.title}
                        </div>
                        {l.snippet && (
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {l.snippet}
                          </div>
                        )}
                        <div className="mt-1 line-clamp-1 text-[10px] text-primary">
                          {safeHostname(l.url)}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Smart Apply — always present, regardless of listings */}
                <button
                  type="button"
                  onClick={() => setApplyJob(j)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
                >
                  <Sparkles className="h-4 w-4" />
                  {copy.smartApply}
                </button>
              </div>
            ))}
          </div>
        </Section>
      </motion.div>

      <CvModal
        open={cvOpen}
        onClose={() => setCvOpen(false)}
        copy={copy}
        dir={dir}
        displayName={displayName}
        country={country}
        skills={analysis.skills}
        opportunities={analysis.jobs.map(({ job_title, match_percent, local_wage }) => ({
          job_title,
          match_percent,
          local_wage,
        }))}
        aiScore={analysis.ai_score}
        transcript={transcript}
      />

      <SmartApplyModal
        open={!!applyJob}
        onClose={() => setApplyJob(null)}
        copy={copy}
        dir={dir}
        language={language}
        country={country}
        displayName={displayName}
        jobTitle={applyJob?.job_title ?? ""}
        localWage={applyJob?.local_wage ?? ""}
        skills={analysis.skills}
        transcript={transcript}
      />
    </>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
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
