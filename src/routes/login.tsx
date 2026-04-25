import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Sparkles, Wand2 } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Sawt-Net" },
      { name: "description", content: "Sign in to Sawt-Net to save your skills profile and apply to jobs." },
    ],
  }),
  component: LoginScreen,
});

function LoginScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/" });
  };

  return (
    <MobileShell>
      <div className="flex flex-1 flex-col px-6 pt-12 pb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 flex flex-col items-center text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-mic)]">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Sawt-Net</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Speak. Analyze. Get jobs.
          </p>
        </motion.div>

        <div className="mb-6 flex rounded-full bg-muted p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${
                mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {m === "login" ? "Login" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border-2 border-input bg-background py-4 pl-12 pr-4 text-base outline-none transition-colors focus:border-primary"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border-2 border-input bg-background py-4 pl-12 pr-4 text-base outline-none transition-colors focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-mic)] active:scale-[0.98]"
          >
            {mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-border bg-background py-4 text-base font-semibold text-foreground active:scale-[0.98]"
        >
          <Wand2 className="h-5 w-5 text-primary" />
          Send me a magic link
        </button>

        <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms & Privacy.
        </p>
      </div>
    </MobileShell>
  );
}
