// Web Speech API typings (browser-provided)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

import { useCallback, useEffect, useRef, useState } from "react";

export type RecognitionLang = "en-US" | "fr-FR" | "ar-MA" | "hi-IN";

export const RECOGNITION_LANG_LABELS: Record<RecognitionLang, string> = {
  "ar-MA": "العربية (Darija)",
  "fr-FR": "Français",
  "en-US": "English",
  "hi-IN": "हिन्दी",
};

export function getRecognitionLang(language: string, country: string): RecognitionLang {
  // Morocco speakers usually mix Darija into anything they say — default to ar-MA
  // unless they explicitly picked French. Chrome's ar-MA recognizer accepts a lot
  // of Darija + Arabic phonetics, even when the UI is in English.
  if (country === "Morocco") {
    if (language === "French") return "fr-FR";
    return "ar-MA";
  }
  if (language === "Arabic") return "ar-MA";
  if (language === "French") return "fr-FR";
  if (country === "India") return "hi-IN";
  return "en-US";
}

export function useSpeechRecognition(lang: RecognitionLang) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalRef = useRef("");

  useEffect(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(!!Ctor);
  }, []);

  const start = useCallback(() => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input is not supported in this browser. Try Chrome.");
      return;
    }
    setError(null);
    finalRef.current = "";
    setTranscript("");
    setInterim("");

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          finalRef.current += r[0].transcript + " ";
        } else {
          interimText += r[0].transcript;
        }
      }
      setTranscript(finalRef.current.trim());
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error || "Recognition error");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start microphone");
    }
  }, [lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setInterim("");
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
