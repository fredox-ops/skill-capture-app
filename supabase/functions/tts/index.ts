import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Multilingual TTS via Lovable AI Gateway (Google Gemini TTS).
 * Free during the promo period, supports Arabic / English / French / Hindi / etc.
 *
 * Returns: { audio: <base64 mp3>, mime: "audio/mpeg" }
 *
 * Gemini returns 24kHz signed 16-bit PCM. We wrap it in a WAV container so
 * the browser can play it directly via <audio src="data:audio/wav;base64,...">.
 * We keep the response field name `audio` so the client stays unchanged.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-preview-tts",
        modalities: ["audio"],
        audio: { voice: "alloy", format: "pcm16" },
        messages: [
          {
            role: "user",
            content: text.slice(0, 2500),
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Lovable AI TTS error:", response.status, err);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: `TTS failed: ${response.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const audioB64: string | undefined =
      result?.choices?.[0]?.message?.audio?.data ?? result?.choices?.[0]?.audio?.data;

    if (!audioB64) {
      console.error("No audio in response:", JSON.stringify(result).slice(0, 500));
      return new Response(JSON.stringify({ error: "No audio returned from model" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Wrap raw 24kHz 16-bit mono PCM in a WAV header so <audio> can play it.
    const pcmBytes = base64ToBytes(audioB64);
    const wavBytes = pcm16ToWav(pcmBytes, 24000, 1);
    const wavBase64 = bytesToBase64(wavBytes);

    return new Response(JSON.stringify({ audio: wavBase64, mime: "audio/wav" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pcm16ToWav(pcm: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, "WAVE");
  // fmt chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data chunk
  writeStr(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const out = new Uint8Array(buffer);
  out.set(pcm, 44);
  return out;
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
