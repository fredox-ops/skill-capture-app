import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Briefcase, Coins, ShieldAlert, TrendingUp } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your Skills Profile — Sawt-Net" },
      { name: "description", content: "Your standardized skills profile, AI risk score, and matched job opportunities." },
    ],
  }),
  component: ResultsScreen,
});

const SKILLS = ["Plumbing", "Electrical Repair", "Customer Service"];
const AI_SCORE = 72;
const JOBS = [
  { title: "Maintenance Technician", match: 85, salary: "4000 MAD" },
  { title: "Facility Assistant", match: 78, salary: "3500 MAD" },
  { title: "Electrician Helper", match: 90, salary: "4200 MAD" },
];

function ResultsScreen() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 2200);
    return () => clearTimeout(t);
  }, []);

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
        {loading ? <ResultsSkeleton /> : <ResultsContent />}
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
      <p className="text-center text-sm text-muted-foreground">Analyzing your voice…</p>
    </div>
  );
}

function ResultsContent() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="space-y-4"
    >
      {/* Skills */}
      <Section icon={<TrendingUp className="h-4 w-4" />} title="Skills Profile" subtitle="ISCO-08 Standardized">
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => (
            <span
              key={s}
              className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
            >
              {s}
            </span>
          ))}
        </div>
      </Section>

      {/* AI Score */}
      <Section icon={<ShieldAlert className="h-4 w-4" />} title="AI Readiness Score" subtitle="How safe your skills are from automation">
        <div className="mb-2 flex items-end justify-between">
          <span className="text-4xl font-bold text-foreground">{AI_SCORE}%</span>
          <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning">
            Medium risk
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${AI_SCORE}%` }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, oklch(0.7 0.17 150), oklch(0.75 0.17 55))`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Hands-on skills like yours stay valuable — robots can't replace them yet.
        </p>
      </Section>

      {/* Jobs */}
      <Section icon={<Briefcase className="h-4 w-4" />} title="Job Opportunities" subtitle={`${JOBS.length} matches near you`}>
        <div className="space-y-3">
          {JOBS.map((j) => (
            <div
              key={j.title}
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
