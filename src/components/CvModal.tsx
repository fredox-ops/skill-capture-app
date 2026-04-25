import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, Printer, X } from "lucide-react";
import type { ResultsCopy } from "@/lib/results-i18n";

interface Skill {
  name: string;
  isco_code: string;
}
interface Opportunity {
  job_title: string;
  match_percent: number;
  local_wage: string;
}

interface CvModalProps {
  open: boolean;
  onClose: () => void;
  copy: ResultsCopy;
  dir: "rtl" | "ltr";
  displayName: string;
  country: string;
  skills: Skill[];
  opportunities: Opportunity[];
  aiScore: number;
  transcript: string;
}

/**
 * Print-ready CV modal. Uses a hidden-on-screen / shown-on-print sheet
 * (`#sawtnet-cv-printable`) and a screen preview, so window.print() outputs
 * just the CV — not the modal chrome. Works without any PDF library.
 */
export function CvModal({
  open,
  onClose,
  copy,
  dir,
  displayName,
  country,
  skills,
  opportunities,
  aiScore,
  transcript,
}: CvModalProps) {
  // Inject scoped print styles only while the modal is open.
  useEffect(() => {
    if (!open) return;
    const styleId = "sawtnet-cv-print-style";
    if (document.getElementById(styleId)) return;
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #sawtnet-cv-printable, #sawtnet-cv-printable * { visibility: visible !important; }
        #sawtnet-cv-printable {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          padding: 32px !important;
          background: white !important;
          color: #111 !important;
          box-shadow: none !important;
        }
        @page { size: A4; margin: 12mm; }
      }
    `;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [open]);

  const handlePrint = () => {
    // Defer one tick so layout is ready.
    setTimeout(() => window.print(), 50);
  };

  // Trim the transcript for the CV body so nothing overflows.
  const summary = transcript.trim().slice(0, 380);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        dir={dir}
        className="max-h-[92vh] max-w-3xl overflow-hidden p-0 sm:rounded-2xl"
      >
        {/* Toolbar — hidden when printing */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 print:hidden">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">{copy.cvHeadline}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Printer className="h-3.5 w-3.5" />
              {copy.cvDownload}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.cvClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="max-h-[78vh] overflow-y-auto bg-muted/40 p-5">
          <article
            id="sawtnet-cv-printable"
            dir={dir}
            className="mx-auto w-full max-w-[680px] rounded-xl bg-white p-8 text-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
            style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}
          >
            {/* Header */}
            <header className="mb-6 border-b-2 border-slate-900 pb-4">
              <h1 className="text-3xl font-extrabold tracking-tight">
                {displayName || copy.cvName}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {copy.cvCountry}: <span className="font-medium text-slate-800">{country}</span>
                {" · "}
                <span className="font-semibold text-emerald-700">
                  {copy.cvAiScore}: {aiScore}/100
                </span>
              </p>
            </header>

            {/* Summary */}
            {summary && (
              <section className="mb-5">
                <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {copy.cvProfileSummary}
                </h2>
                <p className="text-[14px] leading-relaxed text-slate-800">{summary}</p>
              </section>
            )}

            {/* Skills */}
            <section className="mb-5">
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {copy.cvSkillsHeading}
              </h2>
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {skills.map((s, i) => (
                  <li
                    key={`${s.isco_code}-${i}`}
                    className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px]"
                  >
                    <span className="font-medium text-slate-900">{s.name}</span>
                    <span className="font-mono text-[10px] font-bold text-slate-500">
                      ISCO {s.isco_code}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Experience (transcript verbatim, trimmed) */}
            {transcript && (
              <section className="mb-5">
                <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {copy.cvExperienceHeading}
                </h2>
                <blockquote className="border-s-4 border-slate-900 ps-3 text-[13px] italic leading-relaxed text-slate-700">
                  {transcript.slice(0, 600)}
                </blockquote>
              </section>
            )}

            {/* Opportunities */}
            {opportunities.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {copy.cvOpportunitiesHeading}
                </h2>
                <ul className="space-y-1.5">
                  {opportunities.map((o, i) => (
                    <li
                      key={`${o.job_title}-${i}`}
                      className="flex items-center justify-between text-[13px]"
                    >
                      <span className="font-semibold text-slate-900">{o.job_title}</span>
                      <span className="text-slate-600">
                        {o.local_wage} · {o.match_percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Footer */}
            <footer className="mt-8 border-t border-slate-200 pt-3 text-center text-[10px] uppercase tracking-[0.2em] text-slate-400">
              {copy.cvFooter}
            </footer>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
