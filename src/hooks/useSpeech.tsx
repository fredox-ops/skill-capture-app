import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * TTS hook. Tries the cloud `tts` edge function first; if it returns
 * `fallback: true` (no provider configured) or fails, falls back to the
 * browser's native `speechSynthesis` API.
 *
 * Browser TTS is free and supports Arabic / French / Hindi / English when
 * the user's OS has the corresponding voices installed.
 */

const LANG_TO_BCP47: Record<string, string> = {
  ar: "ar-SA",
  en: "en-US",
  fr: "fr-FR",
  hi: "hi-IN",
};

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const target = (LANG_TO_BCP47[lang] ?? lang).toLowerCase();
  const prefix = target.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase() === target) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

export function useSpeech() {
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sawtnet-tts-muted") === "1";
  });
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const unlockedRef = useRef(false);
  // Cache base64 audio per text so replaying a bubble doesn't re-call the API.
  const cacheRef = useRef<Map<string, { audio: string; mime: string }>>(new Map());

  // Warm up voices list (some browsers populate it asynchronously).
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", handler);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", handler);
    };
  }, []);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("sawtnet-tts-muted", next ? "1" : "0");
      } catch {
        // ignore
      }
      if (next) {
        audioRef.current?.pause();
        if (typeof window !== "undefined") window.speechSynthesis?.cancel();
        setSpeakingId(null);
      }
      return next;
    });
  }, []);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const a = new Audio();
      a.muted = true;
      a.src =
        "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
      void a.play().catch(() => undefined);
      unlockedRef.current = true;
    } catch {
      // ignore
    }
  }, []);

  const speakBrowser = useCallback((text: string, lang: string, id: number) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.lang = LANG_TO_BCP47[lang] ?? lang;
    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => setSpeakingId(id);
    u.onend = () => setSpeakingId((curr) => (curr === id ? null : curr));
    u.onerror = () => setSpeakingId((curr) => (curr === id ? null : curr));
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    async (text: string, lang: string, id: number) => {
      if (muted) return;
      if (!text?.trim()) return;
      if (typeof window === "undefined") return;

      // Stop anything currently playing.
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis?.cancel();

      // Try cloud TTS first; on failure for this phrase, fall back to browser TTS.
      try {
        let cached = cacheRef.current.get(`${lang}::${text}`);
        if (!cached) {
          const { data, error } = await supabase.functions.invoke("tts", {
            body: { text, lang },
          });
          if (error) throw error;
          if (data?.fallback) {
            speakBrowser(text, lang, id);
            return;
          }
          if (!data?.audio) throw new Error(data?.error ?? "No audio returned");
          cached = {
            audio: data.audio as string,
            mime: (data.mime as string) ?? "audio/mpeg",
          };
          cacheRef.current.set(`${lang}::${text}`, cached);
        }

        const audio = new Audio(`data:${cached.mime};base64,${cached.audio}`);
        audioRef.current = audio;
        audio.onplay = () => setSpeakingId(id);
        audio.onended = () => setSpeakingId((curr) => (curr === id ? null : curr));
        audio.onerror = () => setSpeakingId((curr) => (curr === id ? null : curr));
        await audio.play();
        return;
      } catch (err) {
        console.warn("[tts] cloud failed for this phrase, using browser TTS", err);
        speakBrowser(text, lang, id);
      }
    },
    [muted, speakBrowser],
  );

  return { supported: true, muted, toggleMute, speak, cancel, unlock, speakingId };
}
