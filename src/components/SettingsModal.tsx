import { motion, AnimatePresence } from "framer-motion";
import { X, Globe, MapPin, LogOut } from "lucide-react";
import { useProfile, type Country, type Language } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const { profile, update } = useProfile();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const country = profile?.country ?? "Morocco";
  const language = profile?.language ?? "English";

  const handleSignOut = async () => {
    await signOut();
    onClose();
    navigate({ to: "/login" });
  };

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

            {user && (
              <div className="mb-6 rounded-2xl bg-muted/50 px-4 py-3">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="truncate text-sm font-semibold">{user.email}</p>
              </div>
            )}

            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <MapPin className="h-4 w-4" /> Country
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["Morocco", "India"] as Country[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => update({ country: c })}
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

            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Globe className="h-4 w-4" /> Language
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["Arabic", "English", "French"] as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => update({ language: l })}
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

            {user && (
              <button
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-destructive/30 bg-destructive/5 py-3 text-sm font-semibold text-destructive active:scale-[0.98]"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
