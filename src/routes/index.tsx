import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Settings, Sparkles, Square } from "lucide-react";
import { MobileShell } from "@/components/MobileShell";
import { SettingsModal } from "@/components/SettingsModal";

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

const SAMPLE_TRANSCRIPT =
  "I fix water pipes, install electrical sockets, and I help customers in my neighborhood every day.";

function ChatScreen() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([
    {
      id: 1,
      from: "bot",
      text: "Hi 👋 I'm Sawt-Net. Tap the microphone and tell me what you do every day — your real skills.",
    },
  ]);

  // Simulate live speech-to-text
  useEffect(() => {
    if (!recording) return;
    let i = 0;
    setLiveText("");
    const interval = setInterval(() => {
      i += 2;
      setLiveText(SAMPLE_TRANSCRIPT.slice(0, i));
      if (i >= SAMPLE_TRANSCRIPT.length) clearInterval(interval);
    }, 60);
    return () => clearInterval(interval);
  }, [recording]);

  const stopRecording = () => {
    setRecording(false);
    const text = liveText || SAMPLE_TRANSCRIPT;
    setBubbles((b) => [...b, { id: Date.now(), from: "user", text }]);
    setLiveText("");
    setHasSpoken(true);
    setTimeout(() => {
      setBubbles((b) => [
        ...b,
        {
          id: Date.now() + 1,
          from: "bot",
          text: "Got it! I heard real, valuable skills. Ready to analyze them?",
        },
      ]);
    }, 600);
  };

  const startAnalysis = () => {
    navigate({ to: "/results" });
  };

  return (
    <MobileShell>
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Sawt-Net</h1>
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
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto bg-chat-bg px-4 py-5">
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

          {recording && liveText && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-bubble-user/70 px-4 py-2.5 text-[15px] text-bubble-user-foreground italic shadow-sm">
                {liveText}
                <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-white" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action area */}
      <div className="border-t border-border bg-card px-5 pb-6 pt-4">
        <AnimatePresence mode="wait">
          {hasSpoken && !recording ? (
            <motion.button
              key="analyze"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={startAnalysis}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-[var(--shadow-mic)] active:scale-[0.98]"
            >
              <Sparkles className="h-5 w-5" />
              Analyze My Skills
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
                {recording && (
                  <>
                    <span className="ripple" />
                    <span className="ripple delay-1" />
                    <span className="ripple delay-2" />
                  </>
                )}
                <button
                  onClick={() => (recording ? stopRecording() : setRecording(true))}
                  aria-label={recording ? "Stop recording" : "Start recording"}
                  className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-mic)] active:scale-95 transition-transform"
                >
                  {recording ? <Square className="h-7 w-7 fill-current" /> : <Mic className="h-8 w-8" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {recording ? "Listening… tap to stop" : "Tap and speak your skills"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </MobileShell>
  );
}
