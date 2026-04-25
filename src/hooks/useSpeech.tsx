import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wrapper around the browser SpeechSynthesis API.
 * - Picks the best available Arabic voice (prefers ar-MA, then any ar-*).
 * - Tracks which bubble id is currently being spoken so the UI can render
 *   an "audio wave" indicator next to that bubble.
 * - Persists a global mute preference in localStorage.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sawtnet-tts-muted") === "1";
  });
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Keep a fresh list of voices. getVoices() can return [] until voiceschanged fires.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const refresh = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", refresh);
      window.speechSynthesis.cancel();
    };
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("sawtnet-tts-muted", next ? "1" : "0");
      } catch {
        // ignore
      }
      if (next && typeof window !== "undefined") {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
      }
      return next;
    });
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, []);

  const pickArabicVoice = useCallback((preferred: string): SpeechSynthesisVoice | undefined => {
    const voices = voicesRef.current;
    if (!voices.length) return undefined;
    return (
      voices.find((v) => v.lang === preferred) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("ar-ma")) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith("ar")) ||
      undefined
    );
  }, []);

  const speak = useCallback(
    (text: string, lang: string, id: number) => {
      if (!supported || muted || typeof window === "undefined") return;
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 0.95;
      utter.pitch = 1;

      const voice = pickArabicVoice(lang);
      if (voice) utter.voice = voice;

      utter.onstart = () => setSpeakingId(id);
      utter.onend = () => setSpeakingId((curr) => (curr === id ? null : curr));
      utter.onerror = () => setSpeakingId((curr) => (curr === id ? null : curr));

      window.speechSynthesis.speak(utter);
    },
    [muted, pickArabicVoice, supported],
  );

  return { supported, muted, toggleMute, speak, cancel, speakingId };
}
