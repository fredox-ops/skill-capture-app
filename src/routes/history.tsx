import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Mic, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Skill {
  name: string;
  isco_code: string;
}
type RiskLevel = "Low Risk" | "Medium Risk" | "High Risk";

interface AnalysisRow {
  id: string;
  skills: Skill[];
  ai_score: number;
  risk_level: RiskLevel;
  created_at: string;
}

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Your Past Analyses — Sawt-Net" },
      { name: "description", content: "Browse all your past Sawt-Net skill analyses." },
    ],
  }),
  component: HistoryScreen,
});

function HistoryScreen() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("analyses")
      .select("id, skills, ai_score, risk_level, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error(error.message);
        } else if (data) {
          setRows(data as unknown as AnalysisRow[]);
        }
        setLoading(false);
      });
  }, [user]);

  return (
    <MobileShell>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 sm:px-8">
          <Link
            to="/"
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold leading-tight">History</h1>
            <p className="text-xs text-muted-foreground">All your past analyses</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-chat-bg">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
          {loading ? (
            <Skeleton />
          ) : rows.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-3">
              {rows.map((row, i) => (
                <motion.li
                  key={row.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <HistoryRow row={row} />
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function HistoryRow({ row }: { row: AnalysisRow }) {
  const date = new Date(row.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = new Date(row.created_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const skills = Array.isArray(row.skills) ? row.skills.slice(0, 3) : [];

  const riskClass =
    row.risk_level === "Low Risk"
      ? "bg-success/15 text-success"
      : row.risk_level === "High Risk"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/15 text-warning";

  return (
    <Link
      to="/results"
      search={{ id: row.id }}
      className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition-transform active:scale-[0.99] hover:bg-card/90"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShieldAlert className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{date}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          {skills.map((s, idx) => (
            <span
              key={`${s.isco_code}-${idx}`}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80"
            >
              {s.name}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-foreground">{row.ai_score}%</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${riskClass}`}>
            {row.risk_level || "—"}
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Mic className="h-7 w-7" />
      </div>
      <p className="mb-1 text-base font-semibold">No analyses yet</p>
      <p className="mb-4 text-sm text-muted-foreground">Record your first session to see it here.</p>
      <Link
        to="/"
        className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        Start recording
      </Link>
    </div>
  );
}
