import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Copy, Check, Loader2, Sparkles, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ResultsCopy } from "@/lib/results-i18n";
import { toast } from "sonner";

interface Skill {
  name: string;
  isco_code: string;
}

interface SmartApplyModalProps {
  open: boolean;
  onClose: () => void;
  copy: ResultsCopy;
  dir: "rtl" | "ltr";
  language: string;
  country: string;
  displayName: string;
  jobTitle: string;
  localWage: string;
  skills: Skill[];
  transcript: string;
}

export function SmartApplyModal({
  open,
  onClose,
  copy,
  dir,
  language,
  country,
  displayName,
  jobTitle,
  localWage,
  skills,
  transcript,
}: SmartApplyModalProps) {
  const [letter, setLetter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset whenever the modal closes so the next job opens fresh.
  useEffect(() => {
    if (!open) {
      setLetter("");
      setShowForm(false);
      setCopied(false);
    }
  }, [open]);

  // Generate the cover letter the moment the sheet opens.
  useEffect(() => {
    if (!open || letter || loading) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("cover-letter", {
          body: {
            job_title: jobTitle,
            local_wage: localWage,
            skills,
            display_name: displayName,
            country,
            language,
            transcript,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setLetter(typeof data?.letter === "string" ? data.letter : "");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Generation failed";
        toast.error(msg);
        // Soft fallback so the user still has SOMETHING to copy/paste.
        setLetter(
          dir === "rtl"
            ? `السلام عليكم،\n\nأنا مهتم بمنصب ${jobTitle}. عندي تجربة في ${skills
                .map((s) => s.name)
                .slice(0, 3)
                .join("، ")}. متحمّس باش نخدم معاكم ونعطي القيمة.\n\nشكرا،\n— ${displayName || "[your name]"}`
            : `Hello,\n\nI'm applying for the ${jobTitle} role. I have hands-on experience in ${skills
                .map((s) => s.name)
                .slice(0, 3)
                .join(", ")} and I'm excited to contribute.\n\nThank you,\n— ${displayName || "[your name]"}`,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCopy = async () => {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      toast.success(copy.copied);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Clipboard not available");
    }
  };

  // Mocked "auto-filled" form values.
  const phoneMock = country === "India" ? "+91 ●● ●●●●● ●●●●" : "+212 ● ●●●●●●●●";
  const yearsMock = Math.max(1, Math.min(8, Math.round(skills.length * 1.5)));

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        dir={dir}
        className="h-[92vh] rounded-t-2xl border-t border-border p-0 sm:max-w-2xl sm:mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <h2 className="text-[15px] font-bold text-foreground">{copy.smartApplyTitle}</h2>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">{jobTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[calc(92vh-64px)] overflow-y-auto px-5 py-4">
          {!showForm ? (
            <>
              <p className="mb-3 text-xs text-muted-foreground">{copy.smartApplyHelper}</p>

              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                {loading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>{copy.generating}</span>
                  </div>
                ) : (
                  <pre
                    dir={dir}
                    className="whitespace-pre-wrap break-words font-sans text-[14px] leading-relaxed text-foreground"
                  >
                    {letter}
                  </pre>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={loading || !letter}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-success" />
                      {copy.copied}
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      {copy.copy}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(true)}
                  disabled={loading || !letter}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {copy.autoFill}
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-card p-5">
              <div className="mb-4 flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <p className="text-xs font-bold uppercase tracking-wide">{copy.formMockTitle}</p>
              </div>

              <FormRow label={copy.formField.name} value={displayName || copy.cvName} />
              <FormRow label={copy.formField.phone} value={phoneMock} />
              <FormRow label={copy.formField.country} value={country} />
              <FormRow label={copy.formField.role} value={jobTitle} />
              <FormRow label={copy.formField.experience} value={`${yearsMock}+`} />

              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.formField.message}
                </label>
                <div className="relative">
                  <textarea
                    readOnly
                    dir={dir}
                    value={letter}
                    rows={6}
                    className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-[13px] leading-relaxed text-foreground"
                  />
                  <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                    <Check className="h-3 w-3" />
                    auto
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toast.success(copy.copied + " ✓")}
                className="w-full rounded-xl bg-success py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.98]"
              >
                {copy.formField.submit}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FormRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          readOnly
          value={value}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground"
        />
        <span className="absolute end-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
          <Check className="h-3 w-3" />
          auto
        </span>
      </div>
    </div>
  );
}
