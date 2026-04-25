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

import { MobileShell } from "@/components/MobileShell";
import { SettingsModal } from "@/components/SettingsModal";
import { AudioWave } from "@/components/AudioWave";
import { OnboardingFlow } from "@/components/OnboardingFlow";
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
  // Voice-first onboarding gate. Shown the very first time a signed-in
  // user lands on the chat — captures country/language by voice and is
  // then dismissed forever (tracked in localStorage).
  const [onboarding, setOnboarding] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sawtnet-onboarded") !== "1";
  });
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

  // When the profile updates (e.g. after voice onboarding writes Morocco/Arabic),
  // pull the new language into the chat so the greeting + recognizer match.
  useEffect(() => {
    if (!profile) return;
    const next = getRecognitionLang(profile.language, profile.country);
    setLang((curr) => (curr === next ? curr : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.country, profile?.language]);

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
          signals: aiData.signals ?? {},
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

  // Voice-first onboarding takes over the entire viewport on first visit.
  // It captures country/language by voice, persists it to the profile, then
  // hands control back to the main chat (which will pick up the new lang
  // and greet them in their tongue thanks to the existing greeting effect).
  if (onboarding && user) {
    return (
      <MobileShell>
        <OnboardingFlow
          onComplete={() => {
            // Reset the chat's initial bubble so the next render uses the
            // freshly-detected language. The greeting effect will re-speak
            // it automatically.
            greetedRef.current = false;
            setOnboarding(false);
          }}
        />
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      {/* Header — clean, white, no hard borders */}
      <header className="bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground shadow-[var(--shadow-card)]"
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold leading-tight tracking-tight text-foreground sm:text-lg">
                Sawt-Net
              </h1>
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tts.supported && (
              <button
                onClick={tts.toggleMute}
                aria-label={tts.muted ? "Unmute voice" : "Mute voice"}
                title={tts.muted ? "Unmute voice" : "Mute voice"}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-accent"
              >
                {tts.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
            <Link
              to="/history"
              aria-label="History"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-accent"
            >
              <HistoryIcon className="h-5 w-5" />
            </Link>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-accent"
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
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    dir={isUser ? "auto" : b.direction ?? "ltr"}
                    className={`relative max-w-[82%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-[var(--shadow-card)] ${
                      isUser
                        ? "rounded-br-md bg-gradient-to-br from-primary to-[var(--primary-glow)] text-bubble-user-foreground"
                        : "rounded-bl-md bg-bubble-bot text-bubble-bot-foreground"
                    }`}
                  >
                    <span className="block font-medium">{b.text}</span>
                    {isSpeaking && (
                      <span className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
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
                          setTimeout(() => tts.speak(b.text, b.speechLang ?? lang, b.id), 50);
                        }}
                        className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary/80 transition hover:text-primary"
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
                <div className="max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-br from-primary/80 to-[var(--primary-glow)]/80 px-4 py-3 text-[15px] font-medium text-bubble-user-foreground shadow-[var(--shadow-card)]">
                  {transcript}
                  {interim && <span className="italic opacity-80"> {interim}</span>}
                  <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-white" />
                </div>
              </div>
            )}

            {/* Sentinel — auto-scroll target. */}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Bottom mic dock — floating panel above off-white shell, no hard border */}
      <div className="relative flex-shrink-0 bg-card shadow-[0_-8px_30px_-12px_oklch(0.22_0.05_250/0.10)]">
        {/* Floating Action Button — gated until enough user messages */}
        <button
          onClick={startAnalysis}
          disabled={!canAnalyze}
          aria-label="Analyze My Skills"
          className={`absolute -top-7 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full transition-all ${
            canAnalyze
              ? "fab-pulse bg-gradient-to-br from-primary to-[var(--primary-glow)] text-primary-foreground"
              : "cursor-not-allowed bg-muted text-muted-foreground opacity-60 shadow-[var(--shadow-card)]"
          }`}
        >
          {analyzing ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Sparkles className="h-7 w-7" />
          )}
        </button>

        <div className="mx-auto w-full max-w-3xl px-5 pb-7 pt-7 sm:px-8">
          {/* Per-turn language picker — pill tags */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
            {(Object.keys(RECOGNITION_LANG_LABELS) as RecognitionLang[]).map((code) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => pickLang(code)}
                  disabled={listening || analyzing}
                  className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-wide transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  aria-pressed={active}
                  aria-label={`Speak in ${RECOGNITION_LANG_LABELS[code]}`}
                >
                  {RECOGNITION_LANG_LABELS[code]}
                </button>
              );
            })}
          </div>

          {/* "Wait for signal" overlay — large pulsing radar shown while the
              analyze pipeline is running. */}
          {analyzing && (
            <div className="mb-4 flex flex-col items-center gap-2">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
                <span className="absolute inline-flex h-2/3 w-2/3 animate-ping rounded-full bg-primary/40 [animation-delay:300ms]" />
                <Loader2 className="relative h-8 w-8 animate-spin text-primary" />
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key="mic"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative flex h-24 w-24 items-center justify-center">
                {/* Multi-layer radar — only while listening, only on the safe state */}
                {listening && !micWarning && !micError && !micSuccess && (
                  <>
                    <motion.span
                      className="absolute h-24 w-24 rounded-full border-2 border-primary/60"
                      initial={{ scale: 0.95, opacity: 0.7 }}
                      animate={{ scale: 2.4, opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <motion.span
                      className="absolute h-24 w-24 rounded-full border-2 border-primary/50"
                      initial={{ scale: 0.95, opacity: 0.6 }}
                      animate={{ scale: 2.4, opacity: 0 }}
                      transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
                    />
                    <motion.span
                      className="absolute h-24 w-24 rounded-full border-2 border-primary/40"
                      initial={{ scale: 0.95, opacity: 0.5 }}
                      animate={{ scale: 2.4, opacity: 0 }}
                      transition={{ duration: 2, delay: 1, repeat: Infinity, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </>
                )}
                <motion.button
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
                  disabled={!supported || analyzing || micWarning || micError}
                  aria-label={
                    micError
                      ? "Connection error"
                      : micWarning
                        ? "Weak connection"
                        : micSuccess
                          ? "Success"
                          : listening
                            ? "Release to send"
                            : "Hold to record"
                  }
                  animate={listening && !micWarning && !micError ? { scale: 1.08 } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  className={`relative z-10 flex h-20 w-20 select-none items-center justify-center rounded-full text-white touch-none ${
                    micError
                      ? "bg-destructive animate-shake shadow-[0_18px_42px_-8px_oklch(0.62_0.22_27/0.55)]"
                      : micWarning
                        ? "bg-warning animate-shake shadow-[0_18px_42px_-8px_oklch(0.78_0.16_60/0.55)]"
                        : micSuccess
                          ? "bg-success shadow-[0_18px_42px_-8px_oklch(0.7_0.17_150/0.55)]"
                          : listening
                            ? "bg-gradient-to-br from-primary to-[var(--primary-glow)] shadow-[var(--shadow-mic)]"
                            : "mic-glow bg-gradient-to-br from-primary to-[var(--primary-glow)] disabled:opacity-50"
                  }`}
                >
                  {micError || micWarning ? (
                    <WifiOff className="h-9 w-9" />
                  ) : micSuccess ? (
                    <Check className="h-10 w-10" strokeWidth={3} />
                  ) : !supported ? (
                    <MicOff className="h-8 w-8" />
                  ) : listening ? (
                    <Square className="h-7 w-7 fill-current" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </motion.button>
              </div>

              {/* Tiny dot indicator for "remaining messages until analysis" */}
              {!analyzing && userMessageCount < MIN_USER_MESSAGES_TO_ANALYZE && userMessageCount > 0 && (
                <div className="flex items-center gap-1.5" aria-label={`${userMessageCount} of ${MIN_USER_MESSAGES_TO_ANALYZE} messages sent`}>
                  {Array.from({ length: MIN_USER_MESSAGES_TO_ANALYZE }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        i < userMessageCount ? "bg-primary" : "bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </MobileShell>
  );
}
