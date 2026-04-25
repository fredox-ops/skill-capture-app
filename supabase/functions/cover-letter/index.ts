import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReqBody {
  job_title?: string;
  local_wage?: string;
  skills?: { name: string; isco_code: string }[];
  display_name?: string | null;
  country?: string;
  language?: string; // free-form display label e.g. "Arabic", "French"
  transcript?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ReqBody;
    const {
      job_title,
      local_wage,
      skills = [],
      display_name,
      country = "Morocco",
      language = "English",
      transcript = "",
    } = body;

    if (!job_title) {
      return new Response(JSON.stringify({ error: "job_title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const skillList = skills.map((s) => `${s.name} (ISCO ${s.isco_code})`).join(", ");
    const trimmedTranscript = transcript.slice(0, 800);

    const systemPrompt = `You are a career coach for workers in the informal economy. Write a SHORT, warm, professional cover letter / application message in ${language}. If ${language} is Moroccan Arabic (Darija), write in Arabic script using everyday Darija — not classical Arabic.

RULES:
- 4 short paragraphs maximum (greeting, why-me, concrete experience, polite close).
- Reference their actual skills naturally — do not list them mechanically.
- Mention 1 concrete example from their own words (the transcript) so it feels personal, not templated.
- Tone: confident, polite, no buzzwords, no "synergy", no fake corporate fluff.
- End with a warm closing and a placeholder line for their name: "— ${display_name || "[your name]"}".
- Do NOT include subject lines, addresses, or date headers. Just the message body.
- Length: 90–140 words. Suitable to paste into WhatsApp or an application form.`;

    const userPrompt = `Job they're applying to: ${job_title}${local_wage ? ` (around ${local_wage}/month)` : ""}
Country: ${country}
Their skills: ${skillList || "(not provided)"}
What they told us about their work (raw transcript):
"""
${trimmedTranscript || "(not provided)"}
"""

Write the cover letter / application message now, in ${language}.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, text);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please try again in a minute." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Cover letter generation failed." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const letter = data.choices?.[0]?.message?.content?.trim();
    if (!letter) {
      return new Response(JSON.stringify({ error: "Empty AI response." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ letter }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cover-letter error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
