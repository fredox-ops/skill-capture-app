import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History as HistoryIcon,
  Mic,
  MicOff,
  Settings,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/components/MobileShell";
import { SettingsModal } from "@/components/SettingsModal";
import { AudioWave } from "@/components/AudioWave";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  useSpeechRecognition,
  getRecognitionLang,
  RECOGNITION_LANG_LABELS,
  type RecognitionLang,
} from "@/hooks/useSpeechRecognition";
import { useSpeech } from "@/hooks/useSpeech";
import { supabase } from "@/integrations/supabase/client";

type AnalyzeStep = "idle" | "saving-transcript" | "calling-ai" | "saving-results";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sawt-Net — Speak your skills" },
      {
        name: "description",
        content:
          "Tap the mic and speak your skills. Sawt-Net turns your voice into job opportunities.",
      },
    ],
  }),
  component: ChatScreen,
});

interface Bubble {
  id: number;
  from: "bot" | "user";
  text: string;
}

const GREETINGS: Record<RecognitionLang, string> = {
  "ar-MA":
    "أهلا 👋 أنا Sawt-Net. عاود لي على الخدمة اللي كتدير كل نهار، وأنا غادي نعاونك تلقا فرص خدمة حقيقية.",
  "en-US":
    "Hi 👋 I'm Sawt-Net. Tell me about the work you do every day, and I'll help you find real job opportunities.",
  "fr-FR":
    "Salut 👋 Je suis Sawt-Net. Raconte-moi le travail que tu fais chaque jour, et je vais t'aider à trouver de vraies opportunités.",
  "hi-IN":
    "नमस्ते 👋 मैं Sawt-Net हूँ। मुझे बताइए आप रोज़ क्या काम करते हैं — मैं आपके लिए असली नौकरी के मौके ढूंढूंगा।",
};

const FOLLOW_UPS: Record<RecognitionLang, string[]> = {
  "ar-MA": [
    "مزيان! شنو هما الحوايج اللي كتعرف تصاوب بيدك؟",
    "شحال هادي وأنت كدير هاد الخدمة؟",
    "واش كتخدم بوحدك ولا مع ناس أخرين؟",
    "شنو هي أصعب حاجة فهاد الخدمة بالنسبة ليك؟",
    "عاود لي على آخر يوم خدمت فيه — كيفاش دازت النهار؟",
    "واش كتستعمل شي ماكينات ولا أدوات خاصة؟",
    "شنو هي الحاجة اللي كتعجبك أكثر فخدمتك؟",
  ],
  "en-US": [
    "Nice! What kinds of things can you make or fix with your hands?",
    "How long have you been doing this kind of work?",
    "Do you work alone or with other people?",
    "What's the hardest part of your job?",
    "Walk me through your last working day — how did it go?",
    "Do you use any specific tools or machines?",
    "What do you enjoy most about what you do?",
  ],
  "fr-FR": [
    "Super ! Quelles sont les choses que tu sais faire ou réparer de tes mains ?",
    "Depuis combien de temps tu fais ce travail ?",
    "Tu travailles seul ou avec d'autres personnes ?",
    "Qu'est-ce qui est le plus difficile dans ton travail ?",
    "Raconte-moi ta dernière journée de travail — comment ça s'est passée ?",
    "Tu utilises des outils ou des machines particulières ?",
    "Qu'est-ce que tu aimes le plus dans ton travail ?",
  ],
  "hi-IN": [
    "बढ़िया! आप अपने हाथों से क्या-क्या बना या ठीक कर सकते हैं?",
    "आप यह काम कब से कर रहे हैं?",
    "आप अकेले काम करते हैं या दूसरों के साथ?",
    "इस काम में सबसे मुश्किल बात क्या है?",
    "अपने पिछले काम के दिन के बारे में बताइए — कैसा रहा?",
    "क्या आप कोई खास उपकरण या मशीन इस्तेमाल करते हैं?",
    "अपने काम में आपको सबसे ज़्यादा क्या पसंद है?",
  ],
};

const MIN_USER_MESSAGES_TO_ANALYZE = 2;

function ChatScreen() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [step, setStep] = useState<AnalyzeStep>("idle");
  const analyzing = step !== "idle";
  const questionIndexRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const lang = getRecognitionLang(profile?.language ?? "English", profile?.country ?? "Morocco");
  const { supported, listening, transcript, interim, error, start, stop, reset } =
    useSpeechRecognition(lang);

  const [bubbles, setBubbles] = useState<Bubble[]>(() => [
    { id: 1, from: "bot", text: GREETINGS[lang] },
  ]);

  // Keep the initial greeting in sync if the user changes language in Settings
  // before sending any message.
  useEffect(() => {
    setBubbles((b) => {
      if (b.length === 1 && b[0].from === "bot") {
        return [{ id: 1, from: "bot", text: GREETINGS[lang] }];
      }
      return b;
    });
  }, [lang]);

  const tts = useSpeech();

  // Speak the initial greeting once TTS is ready (and unmuted).
  const greetedRef = useRef(false);
  useEffect(() => {
    if (greetedRef.current) return;
    if (!tts.supported || tts.muted) return;
    greetedRef.current = true;
    // Slight delay so voices have a chance to load on first paint.
    const t = setTimeout(() => tts.speak(GREETINGS[lang], lang, 1), 400);
    return () => clearTimeout(t);
  }, [tts, lang]);

  // Auto-scroll to the newest bubble whenever messages or live transcript change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, listening, interim, transcript]);


  // Redirect if not signed in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login" });
    }
  }, [user, authLoading, navigate]);

  // Show STT error toast
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // Cancel any in-flight speech when the user starts talking again.
  useEffect(() => {
    if (listening) tts.cancel();
  }, [listening, tts]);

  const userMessageCount = bubbles.filter((b) => b.from === "user").length;
  const canAnalyze = userMessageCount >= MIN_USER_MESSAGES_TO_ANALYZE && !analyzing;

  const stopAndPush = () => {
    stop();
    const text = transcript.trim();
    if (!text) {
      reset();
      return;
    }
    const userBubbleId = Date.now();
    setBubbles((b) => [...b, { id: userBubbleId, from: "user", text }]);

    // Pick the next mock follow-up question in the user's language.
    const followUps = FOLLOW_UPS[lang];
    const idx = questionIndexRef.current % followUps.length;
    questionIndexRef.current += 1;
    const followUp = followUps[idx];
    const botBubbleId = userBubbleId + 1;

    window.setTimeout(() => {
      setBubbles((b) => [...b, { id: botBubbleId, from: "bot", text: followUp }]);
      tts.speak(followUp, lang, botBubbleId);
    }, 650);
  };

  // ---- Press-and-hold mic handlers ----------------------------------------
  const handleHoldStart = (e: React.PointerEvent | React.KeyboardEvent) => {
    if (!supported || listening || analyzing) return;
    if ("preventDefault" in e) e.preventDefault();
    start();
  };
  const handleHoldEnd = () => {
    if (!listening) return;
    stopAndPush();
  };

  const startAnalysis = async () => {
    if (!canAnalyze || !user) return;

    // Concatenate ALL user messages into a single rich transcript.
    const fullTranscript = bubbles
      .filter((b) => b.from === "user")
      .map((b) => b.text)
      .join(" \n ");

    setStep("saving-transcript");
    try {
      const { data: session, error: sessionErr } = await supabase
        .from("voice_sessions")
        .insert({
          user_id: user.id,
          transcript: fullTranscript,
          language: lang,
        })
        .select()
        .single();
      if (sessionErr) throw sessionErr;

      setStep("calling-ai");
      const { data, error: fnErr } = await supabase.functions.invoke("analyze-skills", {
        body: {
          transcript: fullTranscript,
          country: profile?.country ?? "Morocco",
          language: profile?.language ?? "English",
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      setStep("saving-results");
      const { data: analysis, error: aErr } = await supabase
        .from("analyses")
        .insert({
          user_id: user.id,
          session_id: session.id,
          skills: data.skills,
          ai_score: data.ai_risk_score,
          risk_level: data.ai_risk_level,
          jobs: data.opportunities,
        })
        .select()
        .single();
      if (aErr) throw aErr;

      tts.cancel();
      navigate({ to: "/results", search: { id: analysis.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      toast.error(msg);
      setStep("idle");
    }
  };

  const stepLabel: Record<AnalyzeStep, string> = {
    "idle": "",
    "saving-transcript": "Saving transcript…",
    "calling-ai": "Calling AI engine…",
    "saving-results": "Saving results…",
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
          <div className="flex items-center gap-2">
            {tts.supported && (
              <button
                onClick={tts.toggleMute}
                aria-label={tts.muted ? "Unmute voice" : "Mute voice"}
                title={tts.muted ? "Unmute voice" : "Mute voice"}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
              >
                {tts.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
            <Link
              to="/history"
              aria-label="History"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
            >
              <HistoryIcon className="h-5 w-5" />
            </Link>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Chat area — scrollable, hidden scrollbar, takes all remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-chat-bg scrollbar-hide">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-8">
          <div className="space-y-3">
            {bubbles.map((b) => {
              const isUser = b.from === "user";
              const isSpeaking = !isUser && tts.speakingId === b.id;
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    dir={isUser ? "auto" : "rtl"}
                    className={`relative max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-snug shadow-sm ${
                      isUser
                        ? "rounded-br-md bg-bubble-user text-bubble-user-foreground"
                        : "rounded-bl-md bg-bubble-bot text-bubble-bot-foreground"
                    }`}
                  >
                    <span className="block">{b.text}</span>
                    {isSpeaking && (
                      <span className="mt-1 flex items-center gap-1.5 text-[11px] text-primary">
                        <AudioWave />
                        <span>Speaking…</span>
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {listening && (transcript || interim) && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-bubble-user/70 px-4 py-2.5 text-[15px] text-bubble-user-foreground shadow-sm">
                  {transcript}
                  {interim && <span className="italic opacity-80"> {interim}</span>}
                  <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-white" />
                </div>
              </div>
            )}

            {/* Sentinel — auto-scroll target. Always rendered last. */}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Bottom mic area — fixed-height dock, never pushed by messages */}
      <div className="relative flex-shrink-0 border-t border-border bg-card">
        {/* Floating Action Button — gated until enough user messages */}
        <button
          onClick={startAnalysis}
          disabled={!canAnalyze}
          aria-label="Analyze My Skills"
          className={`absolute -top-7 right-5 z-20 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all ${
            canAnalyze
              ? "fab-pulse bg-primary text-primary-foreground"
              : "cursor-not-allowed bg-muted text-muted-foreground opacity-60"
          }`}
        >
          <Sparkles className={`h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />
          {analyzing ? "Analyzing…" : "Analyze My Skills"}
        </button>

        <div className="mx-auto w-full max-w-3xl px-5 pb-6 pt-6 sm:px-8">
          <AnimatePresence mode="wait">
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
                  onPointerDown={handleHoldStart}
                  onPointerUp={handleHoldEnd}
                  onPointerLeave={handleHoldEnd}
                  onPointerCancel={handleHoldEnd}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.code === "Space") handleHoldStart(e);
                  }}
                  onKeyUp={(e) => {
                    if (e.key === " " || e.code === "Space") handleHoldEnd();
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={!supported || analyzing}
                  aria-label={listening ? "Release to send" : "Hold to record"}
                  className="relative z-10 flex h-20 w-20 select-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-mic)] transition-transform disabled:opacity-50 touch-none"
                  style={{ transform: listening ? "scale(1.08)" : undefined }}
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
                    ? "Listening… release to send"
                    : userMessageCount === 0
                      ? "Hold to start the conversation"
                      : "Hold to keep talking"}
              </p>
              {supported && (
                <p className="text-[11px] text-muted-foreground/70">
                  Language: {RECOGNITION_LANG_LABELS[lang]}
                </p>
              )}
              {analyzing && (
                <p className="text-[11px] font-medium text-primary">{stepLabel[step]}</p>
              )}
              {!canAnalyze && userMessageCount > 0 && !analyzing && (
                <p className="text-[11px] text-muted-foreground/70">
                  Send {MIN_USER_MESSAGES_TO_ANALYZE - userMessageCount} more message
                  {MIN_USER_MESSAGES_TO_ANALYZE - userMessageCount === 1 ? "" : "s"} to unlock analysis
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </MobileShell>
  );
}
