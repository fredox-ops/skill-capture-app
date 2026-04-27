import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  Layers,
  Network,
  Brain,
  BarChart3,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
// Galaxy is the single biggest JS chunk on the login page (ogl + WebGL shader).
// Lazy-load it so the form is interactive immediately; the starfield streams in.
const Galaxy = lazy(() => import("@/components/Galaxy"));

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Sawt-Net" },
      {
        name: "description",
        content: "Sign in to Sawt-Net — voice-first skills profiling for the world's invisible workforce.",
      },
    ],
  }),
  component: LoginScreen,
});

function LoginScreen() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reduceMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Skip the WebGL Galaxy on small screens / low-power devices entirely.
  // Saves ~70KB JS + a continuous fragment shader; the CSS gradient looks great alone.
  const enableGalaxy = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (reduceMotion) return false;
    if (window.innerWidth < 768) return false;
    return true;
  }, [reduceMotion]);

  const getPostLoginRoute = async (
    currentUser: { id: string; email?: string | null } | null,
  ): Promise<"/" | "/policy"> => {
    if (!currentUser) return "/";
    const normalizedEmail = currentUser.email?.toLowerCase() ?? "";
    if (normalizedEmail === "admin12@gmail.com") {
      return "/policy";
    }

    const { data, error } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id);
    if (error) return "/";

    const roles = (data ?? []).map((r: { role?: string }) => r.role ?? "");
    if (roles.includes("admin") || roles.includes("policymaker")) {
      return "/policy";
    }
    return "/";
  };

  useEffect(() => {
    let cancelled = false;
    if (loading || !user) return;

    (async () => {
      const destination = await getPostLoginRoute(user);
      if (!cancelled) {
        navigate({ to: destination });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created! You're in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
      const { data: authData } = await supabase.auth.getUser();
      const destination = await getPostLoginRoute(authData.user ?? null);
      navigate({ to: destination });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const googleSignIn = async () => {
    setSubmitting(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/`,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      setSubmitting(false);
    }
  };

  const proofChips = [
    { icon: Layers, label: "ISCO-08" },
    { icon: Network, label: "ESCO" },
    { icon: Brain, label: "Frey-Osborne" },
    { icon: BarChart3, label: "ILOSTAT" },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-white">
      {/* Galaxy backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Galaxy
          mouseRepulsion
          mouseInteraction
          density={1.2}
          glowIntensity={0.5}
          saturation={0.7}
          hueShift={190}
          twinkleIntensity={0.5}
          rotationSpeed={0.06}
          repulsionStrength={2}
          starSpeed={0.45}
          speed={1}
          disableAnimation={reduceMotion}
          transparent={false}
        />
        {/* Gradient overlays for legibility */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-950/30 to-slate-950/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(20,184,166,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(34,211,238,0.12),transparent_60%)]" />
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 md:grid-cols-12">
        {/* LEFT — Brand & narrative */}
        <aside className="relative hidden flex-col justify-between p-12 md:col-span-7 md:flex lg:p-16">
          {/* Top: wordmark */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
            </span>
            <span className="text-sm font-bold tracking-[0.32em] text-white/90">SAWT&middot;NET</span>
            <span className="ml-3 hidden rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/60 backdrop-blur lg:inline-block">
              UNMAPPED · World Bank Youth Summit
            </span>
          </motion.div>

          {/* Center: headline */}
          <div className="max-w-2xl">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              Voice-first · Built for low-bandwidth
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18 }}
              className="bg-gradient-to-br from-white via-cyan-100 to-teal-300 bg-clip-text text-4xl font-extrabold leading-[1.05] tracking-tight text-transparent lg:text-6xl"
            >
              Speak your skills.
              <br />
              <span className="text-white/90">We&rsquo;ll map them to the</span>
              <br />
              global economy.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.28 }}
              className="mt-6 max-w-xl text-base leading-relaxed text-white/65 lg:text-lg"
            >
              Voice-first skills profiling for the 600&nbsp;million young people the formal economy
              can&rsquo;t see. Grounded in ISCO-08, ESCO, ILOSTAT and Frey-Osborne &mdash; not
              hallucinations.
            </motion.p>

            {/* Proof chips */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.38 }}
              className="mt-8 flex flex-wrap gap-2.5"
            >
              {proofChips.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur-md transition-colors hover:border-cyan-300/30 hover:text-white"
                >
                  <Icon className="h-3.5 w-3.5 text-cyan-300/80" />
                  {label}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Bottom: collaboration */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="text-xs text-white/40"
          >
            In collaboration with the MIT Club of Northern California &amp; MIT Club of Germany.
          </motion.p>
        </aside>

        {/* RIGHT — Auth card */}
        <main className="relative flex flex-col justify-center px-5 py-10 sm:px-8 md:col-span-5 md:py-12 lg:px-12">
          {/* Mobile compact header */}
          <div className="mb-6 flex flex-col items-center text-center md:hidden">
            <div className="mb-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
              </span>
              <span className="text-xs font-bold tracking-[0.3em] text-white/90">SAWT&middot;NET</span>
            </div>
            <h2 className="bg-gradient-to-br from-white to-cyan-200 bg-clip-text text-2xl font-extrabold leading-tight tracking-tight text-transparent">
              Speak your skills.
            </h2>
            <p className="mt-1 text-xs text-white/55">Mapped to the global economy.</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative mx-auto w-full max-w-[440px]"
          >
            {/* Glow halo */}
            <div className="pointer-events-none absolute -inset-px rounded-[28px] bg-gradient-to-br from-cyan-400/30 via-teal-300/10 to-transparent blur-xl" />

            <div className="relative rounded-3xl border border-white/15 bg-white/[0.06] p-7 shadow-[0_25px_80px_-20px_rgba(20,184,166,0.45)] backdrop-blur-2xl sm:p-8">
              {/* Brand mark */}
              <div className="mb-6 flex flex-col items-center text-center">
                <motion.div
                  animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 shadow-[0_10px_30px_-5px_rgba(20,184,166,0.6)]"
                >
                  <Sparkles className="h-7 w-7 text-white" />
                </motion.div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h2 className="text-xl font-bold text-white">
                      {mode === "login" ? "Welcome back" : "Create your account"}
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      {mode === "login"
                        ? "Pick up where you left off."
                        : "Start mapping your skills in 60 seconds."}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Mode toggle */}
              <div className="mb-6 flex rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur">
                {(["login", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    type="button"
                    className={`relative flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                      mode === m ? "text-slate-950" : "text-white/60 hover:text-white/85"
                    }`}
                  >
                    {mode === m && (
                      <motion.span
                        layoutId="auth-mode-pill"
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-300 to-teal-300 shadow-[0_4px_20px_-2px_rgba(34,211,238,0.5)]"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative">{m === "login" ? "Login" : "Sign up"}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-3">
                {/* Email */}
                <div className="group relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-cyan-300" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-white/35 outline-none backdrop-blur transition-all focus:border-cyan-300/60 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
                  />
                </div>

                {/* Password */}
                <div className="group relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-cyan-300" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 pl-11 pr-12 text-sm text-white placeholder:text-white/35 outline-none backdrop-blur transition-all focus:border-cyan-300/60 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/45 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative mt-2 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-500 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_-8px_rgba(20,184,166,0.7)] transition-all hover:shadow-[0_14px_38px_-8px_rgba(20,184,166,0.85)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Please wait&hellip;
                      </>
                    ) : mode === "login" ? (
                      "Login"
                    ) : (
                      "Create account"
                    )}
                  </span>
                  {/* Shimmer */}
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </button>
              </form>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                  or continue with
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              {/* Google */}
              <button
                onClick={googleSignIn}
                disabled={submitting}
                type="button"
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] py-3.5 text-sm font-semibold text-white backdrop-blur transition-all hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleIcon />
                Continue with Google
              </button>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-between text-[11px] text-white/40">
                <Link
                  to="/"
                  className="inline-flex items-center gap-1 transition-colors hover:text-white/70"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back home
                </Link>
                <span>
                  Terms &middot; Privacy
                </span>
              </div>
            </div>
          </motion.div>

          {/* Mobile-only proof chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-2 md:hidden">
            {proofChips.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-white/65 backdrop-blur"
              >
                <Icon className="h-3 w-3 text-cyan-300/80" />
                {label}
              </span>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.83Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
