import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Settings, Sparkles, Square, MicOff } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { SettingsModal } from "@/components/SettingsModal";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSpeechRecognition, getRecognitionLang } from "@/hooks/useSpeechRecognition";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sawt-Net — Speak your skills" },
      { name: "description", content: "Tap the mic and speak your skills. Sawt-Net turns your voice into job opportunities." },
    ],
  }),
  component: ChatScreen,
});

interface Bubble {
  id: number;
  from: "bot" | "user";
  text: string;
}

function ChatScreen() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: 1,
      from: "bot",
      text: "Hi 👋 I'm Sawt-Net. Tap the microphone and tell me what you do every day — your real skills.",
    },
  ]);

  const lang = getRecognitionLang(profile?.language ?? "English", profile?.country ?? "Morocco");
  const { supported, listening, transcript, interim, error, start, stop, reset } =
    useSpeechRecognition(lang);

  // Redirect if not signed in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  // Show error toast
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const stopAndPush = () => {
    stop();
    const text = transcript.trim();
    if (!text) {
      toast.error("I didn't catch that. Try again.");
      reset();
      return;
    }
    setBubbles((b) => [...b, { id: Date.now(), from: "user", text }]);
    setTimeout(() => {
      setBubbles((b) => [
        ...b,
        {
          id: Date.now() + 1,
          from: "bot",
          text: "Got it! Ready to analyze these skills?",
        },
      ]);
    }, 400);
  };

  const lastUserMessage = [...bubbles].reverse().find((b) => b.from === "user")?.text;

  const startAnalysis = async () => {
    if (!lastUserMessage || !user) return;
    setAnalyzing(true);
    try {
      // Save the voice session
      const { data: session, error: sessionErr } = await supabase
        .from("voice_sessions")
        .insert({
          user_id: user.id,
          transcript: lastUserMessage,
          language: lang,
        })
        .select()
        .single();
      if (sessionErr) throw sessionErr;

      // Call analyze-skills edge function
      const { data, error: fnErr } = await supabase.functions.invoke("analyze-skills", {
        body: {
          transcript: lastUserMessage,
          country: profile?.country ?? "Morocco",
          language: profile?.language ?? "English",
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      // Save the analysis
      const { data: analysis, error: aErr } = await supabase
        .from("analyses")
        .insert({
          user_id: user.id,
          session_id: session.id,
          skills: data.skills,
          ai_score: data.ai_score,
          risk_level: data.risk_level,
          jobs: data.jobs,
        })
        .select()
        .single();
      if (aErr) throw aErr;

      navigate({ to: "/results", search: { id: analysis.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      toast.error(msg);
      setAnalyzing(false);
    }
  };

  if (authLoading) {
    return (
      <MobileShell>
        <div className="flex flex-1 items-center justify-center">
          <Sparkles className="h-8 w-8 animate-pulse text-primary" />
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight sm:text-lg">Sawt-Net</h1>
              <p className="text-xs text-success">● online</p>
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-chat-bg">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
          <div className="space-y-3">
            {bubbles.map((b) => (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${b.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug shadow-sm ${
                    b.from === "user"
                      ? "rounded-br-md bg-bubble-user text-bubble-user-foreground"
                      : "rounded-bl-md bg-bubble-bot text-bubble-bot-foreground"
                  }`}
                >
                  {b.text}
                </div>
              </motion.div>
            ))}

            {listening && (transcript || interim) && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-bubble-user/70 px-4 py-2.5 text-[15px] text-bubble-user-foreground shadow-sm">
                  {transcript}
                  {interim && <span className="italic opacity-80"> {interim}</span>}
                  <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-white" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action area */}
      <div className="border-t border-border bg-card">
        <div className="mx-auto w-full max-w-3xl px-5 pb-6 pt-4 sm:px-8">
          <AnimatePresence mode="wait">
            {lastUserMessage && !listening ? (
              <motion.button
                key="analyze"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={startAnalysis}
                disabled={analyzing}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-mic)] active:scale-[0.98] disabled:opacity-70"
              >
                <Sparkles className={`h-5 w-5 ${analyzing ? "animate-spin" : ""}`} />
                {analyzing ? "Analyzing your skills…" : "Analyze My Skills"}
              </motion.button>
            ) : (
              <motion.div
                key="mic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="relative flex h-20 w-20 items-center justify-center">
                  {listening && (
                    <>
                      <span className="ripple" />
                      <span className="ripple delay-1" />
                      <span className="ripple delay-2" />
                    </>
                  )}
                  <button
                    onClick={() => (listening ? stopAndPush() : start())}
                    disabled={!supported}
                    aria-label={listening ? "Stop recording" : "Start recording"}
                    className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-mic)] active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {!supported ? (
                      <MicOff className="h-8 w-8" />
                    ) : listening ? (
                      <Square className="h-7 w-7 fill-current" />
                    ) : (
                      <Mic className="h-8 w-8" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {!supported
                    ? "Voice input not supported. Try Chrome."
                    : listening
                      ? "Listening… tap to stop"
                      : "Tap and speak your skills"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </MobileShell>
  );
}
