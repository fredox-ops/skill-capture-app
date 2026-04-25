import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, country = "Morocco", language = "English" } = await req.json();

    if (!transcript || typeof transcript !== "string" || transcript.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Transcript is too short. Please record again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const currency = country === "India" ? "INR" : "MAD";

    const systemPrompt = `You are Sawt-Net, an AI econometric engine that helps young workers in the informal economy (focus: ${country}) turn their spoken skills into formal job opportunities.

You receive a raw transcript describing what someone does day-to-day. You MUST extract:

1. **skills**: 3-6 concrete skills, each mapped to its standardized **ISCO-08 4-digit occupational code** (e.g. "Hardware Repair" -> "7422", "Customer Service" -> "5223", "Plumbing" -> "7126"). Skill names MUST be written in ${language}. If ${language} is Moroccan Arabic (Darija), use Arabic script.

2. **ai_risk_score** (0-100): how protected these skills are from automation by AI. Hands-on, interpersonal, manual-dexterity skills = HIGHER score (safer). Routine cognitive / data-entry tasks = LOWER score.

3. **ai_risk_level**: derived from the score:
   - score >= 70 -> "Low Risk"
   - score 40-69 -> "Medium Risk"
   - score < 40 -> "High Risk"
   (Always return these enum values in English exactly.)

4. **opportunities**: exactly 3 realistic LOCAL job opportunities for ${country}, each with:
   - job_title written in ${language} (Arabic script if Darija)
   - match_percent (60-95)
   - local_wage: realistic monthly wage as a string in local currency, e.g. "4500 ${currency}"

Be concise, realistic, and grounded in the transcript. Use real ISCO-08 codes, not made-up ones. Translate skill names and job titles into ${language} naturally — do not leave them in English unless ${language} is English.`;

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
          { role: "user", content: transcript },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_skill_analysis",
              description: "Return the structured ISCO-08 skill analysis for the worker.",
              parameters: {
                type: "object",
                properties: {
                  skills: {
                    type: "array",
                    minItems: 3,
                    maxItems: 6,
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        isco_code: {
                          type: "string",
                          description: "ISCO-08 4-digit code as a string, e.g. '7422'",
                        },
                      },
                      required: ["name", "isco_code"],
                      additionalProperties: false,
                    },
                  },
                  ai_risk_score: { type: "integer", minimum: 0, maximum: 100 },
                  ai_risk_level: {
                    type: "string",
                    enum: ["Low Risk", "Medium Risk", "High Risk"],
                  },
                  opportunities: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        job_title: { type: "string" },
                        match_percent: { type: "integer", minimum: 50, maximum: 99 },
                        local_wage: {
                          type: "string",
                          description: `Monthly wage with currency, e.g. "4500 ${currency}"`,
                        },
                      },
                      required: ["job_title", "match_percent", "local_wage"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["skills", "ai_risk_score", "ai_risk_level", "opportunities"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_skill_analysis" } },
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
      return new Response(JSON.stringify({ error: "AI analysis failed." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Could not parse AI response." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Enrich opportunities with real local job listings via Tavily.
    // Each Tavily call is wrapped in a 6-second timeout via AbortController so
    // a slow Tavily request can never hang the entire edge function.
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
    if (TAVILY_API_KEY && Array.isArray(result.opportunities)) {
      const tavilyResults = await Promise.allSettled(
        result.opportunities.map(
          async (op: { job_title: string; match_percent: number; local_wage: string }) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            try {
              const tavilyRes = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${TAVILY_API_KEY}`,
                },
                body: JSON.stringify({
                  query: `${op.job_title} jobs in ${country} hiring now`,
                  search_depth: "basic",
                  max_results: 3,
                  include_answer: false,
                }),
                signal: controller.signal,
              });
              if (!tavilyRes.ok) {
                console.error("Tavily error", tavilyRes.status, await tavilyRes.text());
                return { ...op, listings: [] };
              }
              const tavilyData = await tavilyRes.json();
              const listings = (tavilyData.results || [])
                .slice(0, 3)
                .map((r: { title: string; url: string; content?: string }) => ({
                  title: r.title,
                  url: r.url,
                  snippet: (r.content || "").slice(0, 160),
                }));
              return { ...op, listings };
            } catch (err) {
              console.error("Tavily fetch failed:", err);
              return { ...op, listings: [] };
            } finally {
              clearTimeout(timeout);
            }
          },
        ),
      );
      result.opportunities = tavilyResults.map((r, i) =>
        r.status === "fulfilled" ? r.value : { ...result.opportunities[i], listings: [] },
      );
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-skills error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
