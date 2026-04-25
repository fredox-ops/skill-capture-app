import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cloud TTS via the `tts` edge function (ElevenLabs multilingual_v2).
 * Works for ar/en/fr/hi without requiring any voice to be installed locally.
 *
 * - Tracks which bubble id is currently playing so the UI can render an
 *   "audio wave" indicator next to that bubble.
 * - Persists a global mute preference in localStorage.
 * - `unlock()` is called on the first user gesture (mic press / chip tap)
 *   so the very first auto-played reply isn't blocked by browser autoplay.
 */
export function useSpeech() {
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sawtnet-tts-muted") === "1";
  });
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);
  // Cache base64 audio per text so replaying a bubble doesn't re-call the API.
  const cacheRef = useRef<Map<string, { audio: string; mime: string }>>(new Map());

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const cancel = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
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
      if (next && audioRef.current) {
        audioRef.current.pause();
        setSpeakingId(null);
      }
      return next;
    });
  }, []);

  // First user gesture — create a silent <audio> element so subsequent
  // programmatic .play() calls are allowed by autoplay policy.
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    if (typeof window === "undefined") return;
    try {
      const a = new Audio();
      a.muted = true;
      // Tiny silent mp3 (1-frame) — enough to satisfy gesture requirement.
      a.src =
        "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
      void a.play().catch(() => undefined);
      unlockedRef.current = true;
    } catch {
      // ignore
    }
  }, []);

  const speak = useCallback(
    async (text: string, _lang: string, id: number) => {
      if (muted) return;
      if (!text?.trim()) return;
      if (typeof window === "undefined") return;

      // Stop anything currently playing.
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      try {
        let base64 = cacheRef.current.get(text);
        if (!base64) {
          const { data, error } = await supabase.functions.invoke("tts", {
            body: { text },
          });
          if (error) throw error;
          if (!data?.audio) throw new Error(data?.error ?? "No audio returned");
          base64 = data.audio as string;
          cacheRef.current.set(text, base64);
        }

        const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
        audioRef.current = audio;
        audio.onplay = () => setSpeakingId(id);
        audio.onended = () => setSpeakingId((curr) => (curr === id ? null : curr));
        audio.onerror = () => {
          console.warn("[tts] audio playback error");
          setSpeakingId((curr) => (curr === id ? null : curr));
        };
        await audio.play();
      } catch (err) {
        console.warn("[tts] speak failed", err);
        setSpeakingId((curr) => (curr === id ? null : curr));
      }
    },
    [muted],
  );

  return { supported: true, muted, toggleMute, speak, cancel, unlock, speakingId };
}
