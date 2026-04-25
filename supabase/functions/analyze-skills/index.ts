import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  lookupAutomation,
  lookupWage,
  lookupEducationTrend,
  probabilityToResilienceScore,
  resilienceLevel,
  type AutomationSignal,
  type WageSignal,
} from "../_shared/econ-data/lookup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SkillIn {
  name: string;
  isco_code: string;
}

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

    // ---- 1. Ask the LLM ONLY for skill extraction + ISCO mapping + job titles.
    // All numeric signals (automation risk, wages) come from real datasets below.
    const systemPrompt = `You are Sawt-Net, an econometric engine that helps young workers in the informal economy turn spoken skills into formal opportunities. Country focus: ${country}.

You receive a raw transcript describing day-to-day work. Extract ONLY structured fields. Do NOT invent numeric scores or wages — those come from external datasets.

1. **skills**: 3-6 concrete skills, each mapped to its standardized **ISCO-08 4-digit code** (e.g. "Hardware Repair" -> "7422", "Plumbing" -> "7126", "Cooking in a restaurant" -> "5120"). Skill names MUST be written in ${language}. If ${language} is Moroccan Arabic (Darija), use Arabic script.

2. **opportunities**: exactly 3 realistic LOCAL job titles for ${country}, each tied to one ISCO-08 4-digit code from your detected skills (or a closely related code). Output:
   - job_title in ${language} (Arabic script for Darija)
   - isco_code (4-digit string)
   - match_percent (60-95) — your honest qualitative match estimate

Use real ISCO-08 codes only.`;

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
              name: "return_skill_extraction",
              description: "Return the structured ISCO-08 skill extraction for the worker.",
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
                        isco_code: { type: "string", description: "ISCO-08 4-digit code as a string" },
                      },
                      required: ["name", "isco_code"],
                      additionalProperties: false,
                    },
                  },
                  opportunities: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        job_title: { type: "string" },
                        isco_code: { type: "string", description: "ISCO-08 4-digit code matching this job" },
                        match_percent: { type: "integer", minimum: 50, maximum: 99 },
                      },
                      required: ["job_title", "isco_code", "match_percent"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["skills", "opportunities"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_skill_extraction" } },
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

    const extracted = JSON.parse(toolCall.function.arguments) as {
      skills: SkillIn[];
      opportunities: { job_title: string; isco_code: string; match_percent: number }[];
    };

    // ---- 2. Enrich each skill with a real Frey-Osborne automation probability.
    const enrichedSkills = extracted.skills.map((s) => {
      const auto = lookupAutomation(s.isco_code);
      return {
        name: s.name,
        isco_code: s.isco_code,
        automation_probability: auto.automation_probability,
        automation_source: auto.source_short,
      };
    });

    // ---- 3. Compute the cohort-level resilience score from the REAL data
    // (not from the LLM). Take the lowest automation prob across skills as the
    // worker's protective floor — they are protected by their MOST resilient
    // skill, not the average.
    const automations: AutomationSignal[] = extracted.skills.map((s) => lookupAutomation(s.isco_code));
    const minProb = Math.min(...automations.map((a) => a.automation_probability));
    const ai_risk_score = probabilityToResilienceScore(minProb);
    const ai_risk_level = resilienceLevel(ai_risk_score);

    // ---- 4. Replace the LLM's wage guess with ILOSTAT lookup per opportunity.
    const enrichedOpportunities = extracted.opportunities.map((op) => {
      const wage: WageSignal | null = lookupWage(op.isco_code, country);
      const auto = lookupAutomation(op.isco_code);
      return {
        job_title: op.job_title,
        isco_code: op.isco_code,
        match_percent: op.match_percent,
        local_wage: wage ? wage.formatted : "—",
        wage_year: wage?.year ?? null,
        wage_source: wage?.source_short ?? null,
        automation_probability: auto.automation_probability,
      };
    });

    // ---- 5. Look up the Wittgenstein education-trend signal for this country.
    const educationTrend = lookupEducationTrend(country);

    // ---- 6. Optional Tavily enrichment for live job listings (unchanged).
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");
    let opportunitiesWithListings = enrichedOpportunities;
    if (TAVILY_API_KEY) {
      const tavilyResults = await Promise.allSettled(
        enrichedOpportunities.map(async (op) => {
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
            if (!tavilyRes.ok) return { ...op, listings: [] };
            const tavilyData = await tavilyRes.json();
            const listings = (tavilyData.results || [])
              .slice(0, 3)
              .map((r: { title: string; url: string; content?: string }) => ({
                title: r.title,
                url: r.url,
                snippet: (r.content || "").slice(0, 160),
              }));
            return { ...op, listings };
          } catch {
            return { ...op, listings: [] };
          } finally {
            clearTimeout(timeout);
          }
        }),
      );
      opportunitiesWithListings = tavilyResults.map((r, i) =>
        r.status === "fulfilled" ? r.value : { ...enrichedOpportunities[i], listings: [] },
      );
    }

    // ---- 7. Return the enriched payload. The new `signals` block is what
    // the UI surfaces as "real econometric data with sources".
    const result = {
      skills: enrichedSkills,
      ai_risk_score,
      ai_risk_level,
      opportunities: opportunitiesWithListings,
      signals: {
        automation: {
          source: "Frey & Osborne (2017), The Future of Employment",
          source_short: "Frey-Osborne 2017",
          method:
            "Per-skill probability mapped from SOC to ISCO-08; the worker's resilience score is derived from their most-protected skill.",
        },
        wages: {
          source: "ILOSTAT — Mean nominal monthly earnings of employees by occupation (ISCO-08)",
          source_short: "ILOSTAT",
          year: opportunitiesWithListings.find((o) => o.wage_year)?.wage_year ?? null,
          country,
        },
        education_trend: educationTrend,
      },
      limits:
        "Wages are national medians by ISCO major group, not local offers. Automation probabilities are derived from Frey-Osborne (US labor market) and may understate manual-task resilience in LMIC contexts. Use as guidance, not as a guarantee.",
    };

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
