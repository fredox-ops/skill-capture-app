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
import {
  lookupAutomation,
  lookupWage,
  wittgensteinProjections,
} from "@/utils/econometricData";

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
      <header className="bg-card/95 backdrop-blur-sm" dir={dir}>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              aria-label={copy.back}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition hover:bg-accent"
            >
              <ArrowLeft className={`h-5 w-5 ${dir === "rtl" ? "rotate-180" : ""}`} />
            </Link>
            <div>
              <h1 className="text-base font-extrabold leading-tight tracking-tight text-foreground">
                {copy.yourProfile}
              </h1>
              <p className="text-xs font-medium text-muted-foreground">{copy.poweredBy}</p>
            </div>
          </div>
          <Link
            to="/history"
            aria-label={copy.history}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition hover:bg-accent"
          >
            <HistoryIcon className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-app-shell" dir={dir}>
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
            className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-[var(--primary-glow)] py-3.5 text-sm font-bold tracking-wide text-primary-foreground shadow-[var(--shadow-mic)] transition active:scale-[0.98]"
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
                  ? "bg-[color:var(--primary-soft)] text-[color:var(--primary-deep)]"
                  : pct >= 70
                    ? "bg-destructive/10 text-destructive"
                    : pct >= 40
                      ? "bg-warning/15 text-[color:oklch(0.45_0.13_55)]"
                      : "bg-success/10 text-success";
              return (
                <motion.span
                  key={`${s.isco_code}-${idx}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--primary-soft)] px-4 py-2 text-sm font-semibold text-[color:var(--primary-deep)] shadow-[var(--shadow-card)]"
                  title={s.automation_source ? `${copy.sourceLabel}: ${s.automation_source}` : undefined}
                >
                  {s.name}
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold tracking-wide text-[color:var(--primary-deep)]/80">
                    ISCO {s.isco_code}
                  </span>
                  {pct !== null && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>
                      🤖 {pct}%
                    </span>
                  )}
                </motion.span>
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
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <span className="text-5xl font-extrabold tracking-tight text-foreground">
                {analysis.ai_score}
              </span>
              <span className="ml-1 text-xl font-bold text-muted-foreground">/100</span>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-success">
                <Database className="h-2.5 w-2.5" />
                {copy.realDataBadge}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${riskMeta.className}`}
                aria-label={riskLabel}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      riskMeta.key === "Low"
                        ? "var(--success)"
                        : riskMeta.key === "Medium"
                          ? "var(--warning)"
                          : "var(--destructive)",
                  }}
                />
                {riskLabel}
              </span>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${analysis.ai_score}%` }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: riskMeta.gradient }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{copy.riskFootnote}</p>
        </Section>

        <Section
          icon={<Briefcase className="h-4 w-4" />}
          title={copy.jobsTitle}
          subtitle={copy.jobsSubtitle(analysis.jobs.length)}
        >
          <div className="space-y-3">
            {analysis.jobs.map((j, idx) => (
              <motion.div
                key={`${j.job_title}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.3 }}
                className="rounded-2xl bg-card p-4 shadow-[var(--shadow-floating)] transition hover:shadow-[var(--shadow-app)]"
              >
                <div className="mb-3 flex items-start gap-3">
                  {/* Logo placeholder — soft teal tile with briefcase glyph */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary-soft)] text-[color:var(--primary-deep)]">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15px] font-bold leading-tight tracking-tight text-foreground">
                        {j.job_title}
                      </h3>
                      <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                        {j.match_percent}%
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
                        <Coins className="h-3.5 w-3.5" />
                        {j.local_wage}
                        <span className="font-normal text-muted-foreground">{copy.perMonth}</span>
                      </span>
                      {j.wage_source && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">
                          <Database className="h-2.5 w-2.5" />
                          {copy.sourceLabel}: {j.wage_source}
                          {j.wage_year ? ` (${j.wage_year})` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {j.listings && j.listings.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {copy.liveListings}
                    </p>
                    {j.listings.map((l, i) => (
                      <a
                        key={`${l.url}-${i}`}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl bg-muted/60 p-3 transition hover:bg-accent"
                      >
                        <div className="line-clamp-1 text-xs font-bold text-foreground">
                          {l.title}
                        </div>
                        {l.snippet && (
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                            {l.snippet}
                          </div>
                        )}
                        <div className="mt-1 line-clamp-1 text-[10px] font-semibold text-primary">
                          {safeHostname(l.url)}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* Smart Apply — primary teal, full width, rounded-full */}
                <button
                  type="button"
                  onClick={() => setApplyJob(j)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-[var(--primary-glow)] py-2.5 text-sm font-bold tracking-wide text-primary-foreground shadow-[var(--shadow-card)] transition active:scale-[0.98]"
                >
                  <Sparkles className="h-4 w-4" />
                  {copy.smartApply}
                </button>
              </motion.div>
            ))}
          </div>
        </Section>

        {analysis.signals?.education_trend && (
          <Section
            icon={<BookOpen className="h-4 w-4" />}
            title={copy.educationTrendTitle}
            subtitle={analysis.signals.education_trend.source_short}
          >
            <div className="mb-3 flex items-end gap-3">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">2025</div>
                <div className="text-2xl font-bold">{analysis.signals.education_trend.share_2025_pct}%</div>
              </div>
              <div className="text-2xl text-muted-foreground">→</div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">2035</div>
                <div className="text-2xl font-bold text-primary">{analysis.signals.education_trend.share_2035_pct}%</div>
              </div>
              <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                +{analysis.signals.education_trend.delta_pct} pts
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {copy.educationTrendBody(
                analysis.signals.education_trend.share_2025_pct,
                analysis.signals.education_trend.share_2035_pct,
                country,
              )}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Database className="h-3 w-3" />
              <span className="font-semibold uppercase tracking-wide">{copy.sourceLabel}:</span>
              <span>{analysis.signals.education_trend.source}</span>
            </p>
          </Section>
        )}

        <Section
          icon={<Info className="h-4 w-4" />}
          title={copy.honestLimitsTitle}
          subtitle=""
        >
          <p className="text-xs leading-relaxed text-muted-foreground">{copy.honestLimitsBody}</p>
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
      className="rounded-2xl bg-card p-5 shadow-[var(--shadow-floating)]"
    >
      <div className="mb-1 flex items-center gap-2 text-primary">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--primary-soft)] text-[color:var(--primary-deep)]">
          {icon}
        </span>
        <h2 className="text-base font-extrabold tracking-tight text-foreground">{title}</h2>
      </div>
      <p className="mb-4 text-xs font-medium text-muted-foreground">{subtitle}</p>
      {children}
    </motion.section>
  );
}
