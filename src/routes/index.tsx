import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  History as HistoryIcon,
  Loader2,
  Mic,
  MicOff,
  Settings,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Play,
  WifiOff,
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
  speechLang?: RecognitionLang;
  direction?: "rtl" | "ltr";
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

const fallbackFollowUps: Record<RecognitionLang, string> = {
  "ar-MA": "فهمتك. زيد عاود لي على شي مثال آخر من الخدمة ديالك؟",
  "en-US": "I understand. Can you tell me one more real example from your work?",
  "fr-FR": "Je comprends. Tu peux me donner un autre exemple concret de ton travail ?",
  "hi-IN": "समझ गया। क्या आप अपने काम का एक और असली उदाहरण बता सकते हैं?",
};

const MIN_USER_MESSAGES_TO_ANALYZE = 2;

function ChatScreen() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [step, setStep] = useState<AnalyzeStep>("idle");
  const [analyzeAttempt, setAnalyzeAttempt] = useState(0);
  const analyzing = step !== "idle";
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [replying, setReplying] = useState(false);
  // Transient mic state: when true, the mic button shows a no-wifi icon in
  // a warning color and shakes briefly. Purely visual — no text required.
  const [micWarning, setMicWarning] = useState(false);
  // Severe (red) state — analyze failed completely after retries.
  const [micError, setMicError] = useState(false);
  // Brief green flash after a successful analysis save (right before navigate).
  const [micSuccess, setMicSuccess] = useState(false);

  const profileLang = getRecognitionLang(profile?.language ?? "English", profile?.country ?? "Morocco");

  const tts = useSpeech();

  // Per-turn language picker — defaults to the profile language but the user
  // can switch on the fly so the recognizer hears them in the language they
  // are actually about to speak. Persisted in localStorage between sessions.
  const [lang, setLang] = useState<RecognitionLang>(() => {
    if (typeof window === "undefined") return profileLang;
    const saved = localStorage.getItem("sawtnet-active-lang") as RecognitionLang | null;
    if (saved && (saved === "ar-MA" || saved === "en-US" || saved === "fr-FR" || saved === "hi-IN")) {
      return saved;
    }
    return profileLang;
  });

  // If the user changes their profile language while no message has been sent
  // yet, follow the profile (handled in the greeting effect below). Otherwise
  // their per-turn pick wins.
  const pickLang = (next: RecognitionLang) => {
    // Any tap counts as a user gesture — unlock TTS so replies can auto-play.
    tts.unlock();
    setLang(next);
    try {
      localStorage.setItem("sawtnet-active-lang", next);
    } catch {
      // ignore
    }
  };

  const { supported, listening, transcript, interim, error, start, stop, reset } =
    useSpeechRecognition(lang);

  const [bubbles, setBubbles] = useState<Bubble[]>(() => [
    { id: 1, from: "bot", text: GREETINGS[lang], speechLang: lang, direction: lang === "ar-MA" ? "rtl" : "ltr" },
  ]);

  // Keep the initial greeting in sync if the user changes language in Settings
  // before sending any message.
  useEffect(() => {
    setBubbles((b) => {
      if (b.length === 1 && b[0].from === "bot") {
        return [{ id: 1, from: "bot", text: GREETINGS[lang], speechLang: lang, direction: lang === "ar-MA" ? "rtl" : "ltr" }];
      }
      return b;
    });
  }, [lang]);


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

  // Localised "weak network" voice messages, played automatically when the
  // recognizer fails. No reading required — illiterate users hear what
  // happened and see the mic flash orange + a no-wifi icon.
  const NETWORK_ERROR_VOICE: Record<RecognitionLang, string> = {
    "ar-MA": "شبكة الإنترنت ضعيفة. المرجو المحاولة مرة أخرى.",
    "en-US": "Internet is weak. Please try again.",
    "fr-FR": "La connexion est faible. Réessayez s'il vous plaît.",
    "hi-IN": "इंटरनेट कमज़ोर है। कृपया दोबारा कोशिश करें।",
  };

  // Map the recognizer's machine-readable error code to a fully audio-visual
  // response. We DO NOT show any text to the user.
  useEffect(() => {
    if (!error) return;
    const isNetwork = error === "network";
    setMicWarning(true);
    // Speak the localised message so non-readers understand what's happening.
    if (isNetwork) {
      // Force-unmute briefly so the warning is always heard.
      const wasMuted = tts.muted;
      if (wasMuted) tts.toggleMute();
      tts.speak(NETWORK_ERROR_VOICE[lang], lang, -1);
      if (wasMuted) {
        // Re-mute after the message would have finished (~3s).
        setTimeout(() => tts.toggleMute(), 3500);
      }
    }
    // Auto-clear the orange/shake state after 3.5s — the mic returns to normal.
    const t = setTimeout(() => setMicWarning(false), 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Cancel any in-flight speech when the user starts talking again.
  useEffect(() => {
    if (listening) tts.cancel();
  }, [listening, tts]);

  const userMessageCount = bubbles.filter((b) => b.from === "user").length;
  const canAnalyze = userMessageCount >= MIN_USER_MESSAGES_TO_ANALYZE && !analyzing;

  // Send a user message (whether typed or spoken) through the chat-followup
  // edge function. Shared by the mic handler and the text fallback.
  const sendUserMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const userBubble: Bubble = { id: Date.now(), from: "user", text, speechLang: lang };
    const conversation = [...bubbles, userBubble];
    setBubbles(conversation);
    setReplying(true);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("chat-followup", {
        body: {
          messages: conversation.map(({ from, text }) => ({ from, text })),
          country: profile?.country ?? "Morocco",
          user_lang: lang,
        },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      const speechLang: RecognitionLang =
        data?.speech_lang === "ar-MA" ||
        data?.speech_lang === "en-US" ||
        data?.speech_lang === "fr-FR" ||
        data?.speech_lang === "hi-IN"
          ? data.speech_lang
          : lang;
      const followUp = typeof data?.reply === "string" && data.reply.trim()
        ? data.reply.trim()
        : fallbackFollowUps[speechLang];
      const botBubble: Bubble = {
        id: userBubble.id + 1,
        from: "bot",
        text: followUp,
        speechLang,
        direction: data?.direction === "rtl" ? "rtl" : "ltr",
      };

      setBubbles((b) => [...b, botBubble]);
      tts.speak(followUp, speechLang, botBubble.id);
    } catch (err) {
      console.error(err);
      const followUp = fallbackFollowUps[lang];
      const botBubble: Bubble = {
        id: userBubble.id + 1,
        from: "bot",
        text: followUp,
        speechLang: lang,
        direction: lang === "ar-MA" ? "rtl" : "ltr",
      };
      setBubbles((b) => [...b, botBubble]);
      tts.speak(followUp, lang, botBubble.id);
    } finally {
      setReplying(false);
    }
  };

  const stopAndPush = async () => {
    stop();
    const text = transcript.trim();
    reset();
    if (!text) return;
    await sendUserMessage(text);
  };

  // ---- Press-and-hold mic handlers ----------------------------------------
  const handleHoldStart = (e: React.PointerEvent | React.KeyboardEvent) => {
    if (!supported || listening || analyzing || replying) return;
    if ("preventDefault" in e) e.preventDefault();
    // Unlock TTS on this real user gesture so later replies can speak automatically.
    tts.unlock();
    start();
  };
  const handleHoldEnd = () => {
    if (!listening) return;
    stopAndPush();
  };

  // Brief, friendly two-tone chime via Web Audio so the user gets an audible
  // cue that the app is working in the background — useful when the screen
  // animation alone might be missed.
  const playThinkingChime = () => {
    if (typeof window === "undefined") return;
    try {
      const Ctx = (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const tone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      };
      tone(660, 0, 0.18);
      tone(880, 0.16, 0.22);
      setTimeout(() => ctx.close(), 800);
    } catch {
      // ignore — chime is a nice-to-have
    }
  };

  const startAnalysis = async () => {
    if (!canAnalyze || !user) return;

    // Concatenate ALL user messages into a single rich transcript.
    const fullTranscript = bubbles
      .filter((b) => b.from === "user")
      .map((b) => b.text)
      .join(" \n ");

    const conversationLang: RecognitionLang =
      [...bubbles].reverse().find((b) => b.from === "bot" && b.speechLang)?.speechLang ?? lang;
    const languageLabel: Record<RecognitionLang, string> = {
      "ar-MA": "Moroccan Arabic (Darija, Arabic script)",
      "en-US": "English",
      "fr-FR": "French",
      "hi-IN": "Hindi",
    };

    setMicError(false);
    setMicSuccess(false);
    setStep("saving-transcript");
    setAnalyzeAttempt(0);
    playThinkingChime();
    try {
      const { data: session, error: sessionErr } = await supabase
        .from("voice_sessions")
        .insert({
          user_id: user.id,
          transcript: fullTranscript,
          language: conversationLang,
        })
        .select()
        .single();
      if (sessionErr) throw sessionErr;

      setStep("calling-ai");

      // Auto-retry the AI call up to 3 attempts (initial + 2 retries) — many
      // failures on weak 3G are transient timeouts that succeed on retry.
      const MAX_ATTEMPTS = 3;
      let lastErr: unknown = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let aiData: any = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        setAnalyzeAttempt(attempt);
        try {
          const { data, error: fnErr } = await supabase.functions.invoke("analyze-skills", {
            body: {
              transcript: fullTranscript,
              country: profile?.country ?? "Morocco",
              language: languageLabel[conversationLang],
            },
          });
          if (fnErr) throw fnErr;
          if (data?.error) throw new Error(data.error);
          aiData = data;
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          // Show the orange "weak network" state during retries so the user
          // sees something is going on without needing to read.
          if (attempt < MAX_ATTEMPTS) {
            setMicWarning(true);
            await new Promise((r) => setTimeout(r, 1200 * attempt));
          }
        }
      }
      if (!aiData) throw lastErr ?? new Error("Analysis failed");

      setStep("saving-results");
      const { data: analysis, error: aErr } = await supabase
        .from("analyses")
        .insert({
          user_id: user.id,
          session_id: session.id,
          skills: aiData.skills,
          ai_score: aiData.ai_risk_score,
          risk_level: aiData.ai_risk_level,
          jobs: aiData.opportunities,
        })
        .select()
        .single();
      if (aErr) throw aErr;

      // Audio + visual success cue before navigating.
      tts.cancel();
      setMicWarning(false);
      setMicSuccess(true);
      setTimeout(() => navigate({ to: "/results", search: { id: analysis.id } }), 600);
    } catch (err) {
      console.error(err);
      // Severe failure → red mic + spoken localised "weak network" message.
      setMicWarning(false);
      setMicError(true);
      const wasMuted = tts.muted;
      if (wasMuted) tts.toggleMute();
      tts.speak(NETWORK_ERROR_VOICE[lang], lang, -1);
      if (wasMuted) setTimeout(() => tts.toggleMute(), 3500);
      setTimeout(() => setMicError(false), 4000);
      setStep("idle");
      setAnalyzeAttempt(0);
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
                    dir={isUser ? "auto" : b.direction ?? "ltr"}
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
                    {!isUser && !isSpeaking && tts.supported && (
                      <button
                        type="button"
                        onClick={() => {
                          tts.unlock();
                          if (tts.muted) tts.toggleMute();
                          // Defer slightly so the unmute state propagates before speak() reads it.
                          setTimeout(() => tts.speak(b.text, b.speechLang ?? lang, b.id), 50);
                        }}
                        className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-primary/80 hover:text-primary"
                        aria-label="Play reply audio"
                      >
                        <Play className="h-3 w-3" />
                        <span>{tts.muted ? "Unmute & play" : "Play audio"}</span>
                      </button>
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
          {/* Per-turn language picker — tap before recording so the recognizer
              hears the language you're actually about to speak. */}
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            {(Object.keys(RECOGNITION_LANG_LABELS) as RecognitionLang[]).map((code) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => pickLang(code)}
                  disabled={listening || analyzing}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  aria-pressed={active}
                  aria-label={`Speak in ${RECOGNITION_LANG_LABELS[code]}`}
                >
                  {RECOGNITION_LANG_LABELS[code]}
                </button>
              );
            })}
          </div>
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
                    : replying
                      ? "Sawt-Net is thinking…"
                      : userMessageCount === 0
                      ? "Hold to start the conversation"
                      : "Hold to keep talking"}
              </p>
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
