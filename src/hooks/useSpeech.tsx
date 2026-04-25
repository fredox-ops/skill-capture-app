import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wrapper around the browser SpeechSynthesis API.
 * - Picks the best available voice for the requested language (any of ar/en/fr/hi).
 * - Tracks which bubble id is currently being spoken so the UI can render
 *   an "audio wave" indicator next to that bubble.
 * - Persists a global mute preference in localStorage.
 * - Exposes `unlock()` so the first user gesture can satisfy the browser
 *   autoplay policy and let later replies speak automatically.
 */
export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sawtnet-tts-muted") === "1";
  });
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const unlockedRef = useRef(false);

  // Keep a fresh list of voices. getVoices() can return [] until voiceschanged fires.
  const [voicesReady, setVoicesReady] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const refresh = () => {
      const v = window.speechSynthesis.getVoices();
      voicesRef.current = v;
      if (v.length > 0) setVoicesReady(true);
    };
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    // Some browsers (Chrome) need a kick to populate voices.
    const t = setTimeout(refresh, 250);
    return () => {
      clearTimeout(t);
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

  // Pick the closest available voice for the requested BCP-47 language tag.
  // Falls back to any voice in the same primary subtag (e.g. "en-*" for "en-US").
  const pickVoiceForLang = useCallback((preferred: string): SpeechSynthesisVoice | undefined => {
    const voices = voicesRef.current;
    if (!voices.length) return undefined;
    const lower = preferred.toLowerCase();
    const primary = lower.split("-")[0];
    return (
      voices.find((v) => v.lang?.toLowerCase() === lower) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(`${primary}-`)) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(primary)) ||
      undefined
    );
  }, []);

  // Call from a real user gesture (e.g. mic press) to satisfy autoplay policies.
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      unlockedRef.current = true;
    } catch {
      // ignore
    }
  }, []);

  const speak = useCallback(
    (text: string, lang: string, id: number) => {
      if (!supported || muted || typeof window === "undefined") return;
      if (!text?.trim()) return;
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 0.95;
      utter.pitch = 1;

      const voice = pickVoiceForLang(lang);
      if (voice) utter.voice = voice;

      utter.onstart = () => setSpeakingId(id);
      utter.onend = () => setSpeakingId((curr) => (curr === id ? null : curr));
      utter.onerror = () => setSpeakingId((curr) => (curr === id ? null : curr));

      window.speechSynthesis.speak(utter);
    },
    [muted, pickVoiceForLang, supported],
  );

  return { supported, muted, toggleMute, speak, cancel, unlock, speakingId };
}
