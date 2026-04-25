import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Cloud TTS placeholder.
 *
 * No free multilingual TTS provider is currently wired up
 * (ElevenLabs free tier is blocked, Lovable AI Gateway has no TTS model).
 * Always returns `{ fallback: true }` with HTTP 200 so the supabase-js client
 * can read the body and the frontend transparently falls back to the
 * browser's native `speechSynthesis`.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ fallback: true, error: "TTS_UNAVAILABLE" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
