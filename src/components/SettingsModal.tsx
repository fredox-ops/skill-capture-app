import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, MapPin } from "lucide-react";
import { useState } from "react";

type Country = "Morocco" | "India";
type Language = "Arabic" | "English" | "French";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const [country, setCountry] = useState<Country>("Morocco");
  const [language, setLanguage] = useState<Language>("English");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-40 bg-black/40"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-card p-6 pb-8 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Settings</h2>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <MapPin className="h-4 w-4" /> Country
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["Morocco", "India"] as Country[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCountry(c)}
                    className={`rounded-2xl border-2 px-4 py-3 text-sm font-medium transition-all ${
                      country === c
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Globe className="h-4 w-4" /> Language
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["Arabic", "English", "French"] as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLanguage(l)}
                    className={`rounded-2xl border-2 px-2 py-3 text-sm font-medium transition-all ${
                      language === l
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </section>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
