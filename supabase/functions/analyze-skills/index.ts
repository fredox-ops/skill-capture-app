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

    const systemPrompt = `You are Sawt-Net, an AI that helps young workers in the informal economy (focus: ${country}) turn their spoken skills into formal job opportunities.

You receive a raw transcript (in ${language}) describing what someone does. Extract:
1. Concrete skills, mapped to ISCO-08 occupational categories where possible (3-6 short skill names, in English).
2. AI Readiness Score 0-100: how protected these skills are from automation. Hands-on / interpersonal = HIGHER score (safer). Routine cognitive = LOWER. Then risk_level: "safe" (>=70), "medium" (40-69), "high" (<40).
3. 3 realistic local job opportunities for ${country} with title, match% (60-95), and a realistic monthly salary in local currency (MAD for Morocco, INR for India).

Be concise, realistic, and grounded in the transcript.`;

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
              description: "Return the structured skill analysis for the worker.",
              parameters: {
                type: "object",
                properties: {
                  skills: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 2,
                    maxItems: 6,
                  },
                  ai_score: { type: "integer", minimum: 0, maximum: 100 },
                  risk_level: { type: "string", enum: ["safe", "medium", "high"] },
                  jobs: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        match: { type: "integer", minimum: 50, maximum: 99 },
                        salary: { type: "string" },
                      },
                      required: ["title", "match", "salary"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["skills", "ai_score", "risk_level", "jobs"],
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
