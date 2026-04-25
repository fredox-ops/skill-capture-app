import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Free multilingual TTS using Google Translate's unofficial endpoint.
 * Supports Arabic / Darija, English, French, Hindi (and many others).
 * On any failure returns `{ fallback: true }` so the client uses
 * the browser's native speechSynthesis.
 */

const LANG_MAP: Record<string, string> = {
  "ar-MA": "ar",
  "ar-SA": "ar",
  ar: "ar",
  "en-US": "en",
  en: "en",
  "fr-FR": "fr",
  fr: "fr",
  "hi-IN": "hi",
  hi: "hi",
};

const MAX_CHUNK = 190;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_CHUNK) return [clean];
  const chunks: string[] = [];
  // Split at sentence boundaries first, then by spaces.
  const sentences = clean.split(/(?<=[.!?؟।])\s+/);
  let buf = "";
  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };
  for (const s of sentences) {
    if (s.length > MAX_CHUNK) {
      flush();
      const words = s.split(" ");
      for (const w of words) {
        if ((buf + " " + w).trim().length > MAX_CHUNK) {
          flush();
        }
        buf = (buf + " " + w).trim();
      }
      flush();
    } else if ((buf + " " + s).trim().length > MAX_CHUNK) {
      flush();
      buf = s;
    } else {
      buf = (buf + " " + s).trim();
    }
  }
  flush();
  return chunks;
}

async function fetchChunk(text: string, tl: string, idx: number, total: number): Promise<Uint8Array> {
  const url = new URL("https://translate.google.com/translate_tts");
  url.searchParams.set("ie", "UTF-8");
  url.searchParams.set("tl", tl);
  url.searchParams.set("client", "tw-ob");
  url.searchParams.set("q", text);
  url.searchParams.set("textlen", String(text.length));
  url.searchParams.set("total", String(total));
  url.searchParams.set("idx", String(idx));

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://translate.google.com/",
      Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Google TTS chunk ${idx} failed: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error(`Google TTS chunk ${idx} empty`);
  return buf;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, lang } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ fallback: true, error: "NO_TEXT" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tl = LANG_MAP[lang] ?? LANG_MAP[(lang ?? "").split("-")[0]] ?? "en";
    const chunks = chunkText(text);
    const total = chunks.length;

    const parts: Uint8Array[] = [];
    for (let i = 0; i < chunks.length; i++) {
      parts.push(await fetchChunk(chunks[i], tl, i, total));
    }

    // Concatenate MP3 byte arrays.
    const totalLen = parts.reduce((sum, p) => sum + p.byteLength, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const p of parts) {
      merged.set(p, off);
      off += p.byteLength;
    }

    const audio = encodeBase64(merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength));
    return new Response(
      JSON.stringify({ audio, mime: "audio/mpeg" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("tts error:", e);
    return new Response(
      JSON.stringify({
        fallback: true,
        error: e instanceof Error ? e.message : "TTS_FAILED",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
