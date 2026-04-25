import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Check, Loader2, Sparkles } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useSpeech } from "@/hooks/useSpeech";
import {
  useSpeechRecognition,
  type RecognitionLang,
} from "@/hooks/useSpeechRecognition";

/**
 * Voice-first onboarding flow.
 *
 * UX:
 *  1. Speaks a localised welcome ("Which country are you calling from?") —
 *     defaults to Arabic (Darija) since that's our largest user base.
 *  2. Auto-starts the microphone after the prompt finishes.
 *  3. Detects the country/language from what the user says (works in
 *     Arabic, French, English, or Hindi).
 *  4. Saves to the profile + localStorage and calls onComplete().
 *
 * UI is intentionally minimal: a pulsing mic, a friendly headline, and a
 * coloured ring that flashes green on success.
 */

interface OnboardingFlowProps {
  onComplete: () => void;
}

type Step = "welcome" | "listening" | "saving" | "done";

// Multi-language welcome — we cycle through these so a user who doesn't
// understand the first language still hears a tongue they recognize.
const WELCOMES: { lang: RecognitionLang; text: string; headline: string }[] = [
  {
    lang: "ar-MA",
    text: "مرحباً! من أي دولة تتحدث معي؟",
    headline: "مرحباً 👋",
  },
  {
    lang: "en-US",
    text: "Welcome! Which country are you calling from?",
    headline: "Welcome 👋",
  },
  {
    lang: "fr-FR",
    text: "Bienvenue ! De quel pays m'appelles-tu ?",
    headline: "Bienvenue 👋",
  },
  {
    lang: "hi-IN",
    text: "नमस्ते! आप किस देश से बात कर रहे हैं?",
    headline: "नमस्ते 👋",
  },
];

// Keyword detection across the 4 supported tongues. Each entry maps a
// detected phrase to the canonical (country, language) we'll save.
const COUNTRY_KEYWORDS: {
  match: RegExp;
  country: "Morocco" | "India";
  language: "Arabic" | "English" | "French";
  label: string;
}[] = [
  // Morocco — Arabic / Darija
  { match: /المغرب|مغرب|maghreb|maroc|morocco/i, country: "Morocco", language: "Arabic", label: "🇲🇦 Morocco" },
  // India — Hindi / English
  { match: /الهند|भारत|हिन्दुस्तान|hindustan|india|inde/i, country: "India", language: "English", label: "🇮🇳 India" },
  // France-speaking → keep them on French in Morocco context
  { match: /france|français|francaise/i, country: "Morocco", language: "French", label: "🇫🇷 French" },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { update } = useProfile();
  const tts = useSpeech();
  const [step, setStep] = useState<Step>("welcome");
  // Which welcome we're currently speaking — drives the displayed headline.
  const [welcomeIdx, setWelcomeIdx] = useState(0);
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  // The recognizer needs a single language code; we start with Arabic since
  // that covers our largest user base, and most country names are recognized
  // in their local script regardless.
  const [recogLang, setRecogLang] = useState<RecognitionLang>("ar-MA");
  const startedListeningRef = useRef(false);
  const completedRef = useRef(false);

  const { listening, transcript, interim, start, stop, supported } =
    useSpeechRecognition(recogLang);

  // ---- Step 1: speak the welcome message(s) -------------------------------
  // We speak all 4 welcomes back-to-back so a non-Arabic speaker still hears
  // their language. The mic opens right after the last one.
  useEffect(() => {
    if (step !== "welcome") return;
    let cancelled = false;
    tts.unlock();
    // Force-unmute for onboarding — the user hasn't had a chance to mute yet.
    if (tts.muted) tts.toggleMute();

    const speakAll = async () => {
      for (let i = 0; i < WELCOMES.length; i++) {
        if (cancelled) return;
        setWelcomeIdx(i);
        // Speak and wait roughly long enough for the phrase to finish.
        // (useSpeech doesn't expose a "done" promise, so we estimate.)
        const w = WELCOMES[i];
        tts.speak(w.text, w.lang, -100 - i);
        // Estimate ~80ms per character + 600ms breathing room.
        const estMs = Math.max(2200, w.text.length * 80 + 600);
        await new Promise((r) => setTimeout(r, estMs));
      }
      if (!cancelled) setStep("listening");
    };

    speakAll();
    return () => {
      cancelled = true;
      tts.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ---- Step 2: open the mic once we hit the listening step ----------------
  useEffect(() => {
    if (step !== "listening") return;
    if (!supported) {
      // Mic unsupported → skip onboarding with sensible defaults.
      handleSave("Morocco", "Arabic", "🇲🇦 Morocco (default)");
      return;
    }
    if (startedListeningRef.current) return;
    startedListeningRef.current = true;
    // Tiny delay so the TTS audio context fully releases the audio device.
    const t = setTimeout(() => start(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, supported]);

  // ---- Step 3: detect country/language as the user speaks -----------------
  useEffect(() => {
    if (step !== "listening") return;
    const heard = `${transcript} ${interim}`.toLowerCase();
    if (!heard.trim()) return;

    for (const k of COUNTRY_KEYWORDS) {
      if (k.match.test(heard)) {
        if (completedRef.current) return;
        completedRef.current = true;
        stop();
        handleSave(k.country, k.language, k.label);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, interim, step]);

  // Safety net: if the user is silent for ~12s, default to Morocco/Arabic
  // and move on so they're never stuck on the onboarding screen.
  useEffect(() => {
    if (step !== "listening") return;
    const t = setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      stop();
      handleSave("Morocco", "Arabic", "🇲🇦 Morocco (default)");
    }, 12000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // If the recognizer errors (e.g., bad network), retry once in English then
  // fall back to defaults — never block the user.
  const retriedRef = useRef(false);
  useEffect(() => {
    if (step !== "listening") return;
    // The recognition hook stops itself on error; if listening flips off
    // before we detected anything, try once more in English.
    if (!listening && startedListeningRef.current && !completedRef.current) {
      if (retriedRef.current) {
        completedRef.current = true;
        handleSave("Morocco", "Arabic", "🇲🇦 Morocco (default)");
        return;
      }
      retriedRef.current = true;
      setRecogLang("en-US");
      const t = setTimeout(() => start(), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, step]);

  const handleSave = async (
    country: "Morocco" | "India",
    language: "Arabic" | "English" | "French",
    label: string,
  ) => {
    setDetectedLabel(label);
    setStep("saving");
    // Persist for the recognizer's per-turn picker (used by the chat screen).
    try {
      const lang: RecognitionLang =
        country === "India"
          ? "hi-IN"
          : language === "French"
            ? "fr-FR"
            : language === "English"
              ? "en-US"
              : "ar-MA";
      localStorage.setItem("sawtnet-active-lang", lang);
      localStorage.setItem("sawtnet-onboarded", "1");
    } catch {
      // ignore
    }
    try {
      await update({ country, language });
    } catch {
      // Even if the DB update fails, we still proceed — localStorage covers us.
    }
    setStep("done");
    // Brief green flash, then transition.
    setTimeout(() => onComplete(), 900);
  };

  const currentHeadline = WELCOMES[welcomeIdx]?.headline ?? "Welcome 👋";
  const currentDir = WELCOMES[welcomeIdx]?.lang === "ar-MA" ? "rtl" : "ltr";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-background to-muted/40 px-6">
      <div className="flex flex-col items-center gap-10">
        {/* Brand mark */}
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wide">Sawt-Net</span>
        </div>

        {/* Headline (cycles through the 4 languages while speaking) */}
        <AnimatePresence mode="wait">
          <motion.h1
            key={`${step}-${welcomeIdx}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            dir={currentDir}
            className="text-center text-3xl font-bold text-foreground sm:text-4xl"
          >
            {step === "done" || step === "saving"
              ? detectedLabel
              : currentHeadline}
          </motion.h1>
        </AnimatePresence>

        {/* Big pulsing mic — the only interactive-looking thing on screen */}
        <div className="relative flex h-32 w-32 items-center justify-center">
          {(step === "listening" || step === "welcome") && (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
              <span className="absolute inline-flex h-3/4 w-3/4 animate-ping rounded-full bg-primary/40 [animation-delay:300ms]" />
            </>
          )}
          <div
            className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full text-white shadow-[var(--shadow-mic)] transition-colors ${
              step === "done"
                ? "bg-success"
                : step === "saving"
                  ? "bg-primary"
                  : "bg-primary"
            }`}
          >
            {step === "done" ? (
              <Check className="h-12 w-12" strokeWidth={3} />
            ) : step === "saving" ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </div>
        </div>

        {/* Sub-line — flips between status icons (no required reading) */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {step === "welcome" && (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span>🔊</span>
            </>
          )}
          {step === "listening" && (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-success" />
              <span>🎙️</span>
            </>
          )}
          {step === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
          {step === "done" && <Check className="h-4 w-4 text-success" />}
        </div>
      </div>
    </div>
  );
}
