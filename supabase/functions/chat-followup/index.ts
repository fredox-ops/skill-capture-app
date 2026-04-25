import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMessage = {
  from: "bot" | "user";
  text: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, country = "Morocco" } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanMessages: ChatMessage[] = messages
      .filter(
        (m: ChatMessage) =>
          (m.from === "bot" || m.from === "user") && typeof m.text === "string" && m.text.trim(),
      )
      .slice(-12)
      .map((m: ChatMessage) => ({ from: m.from, text: m.text.trim() }));

    const latestUserMessage = [...cleanMessages].reverse().find((m) => m.from === "user")?.text;
    if (!latestUserMessage) {
      return new Response(JSON.stringify({ error: "No user message provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are Sawt-Net, an empathetic voice-first career assistant for young workers in the informal economy.

Your job: continue the conversation naturally and collect richer details about the user's real work skills.

Rules:
- Detect the language of the user's latest message and reply in that same language.
- If the user uses Moroccan Darija, reply in Moroccan Darija using Arabic script.
- Do NOT repeat any previous assistant question from the conversation.
- Ask exactly ONE short follow-up question.
- Sound warm, human, and simple like WhatsApp.
- Focus on concrete work details: tools, tasks, experience, customers, problems solved, teamwork, safety, certifications, or daily routine.
- Do not analyze yet. Do not list jobs yet. Do not mention AI or scores.
- Country context: ${country}.`;

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
          ...cleanMessages.map((m) => ({
            role: m.from === "user" ? "user" : "assistant",
            content: m.text,
          })),
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_followup",
              description: "Return a fresh conversational follow-up question in the user's latest language.",
              parameters: {
                type: "object",
                properties: {
                  reply: {
                    type: "string",
                    description: "One short warm follow-up question in the latest user's language.",
                  },
                  speech_lang: {
                    type: "string",
                    enum: ["ar-MA", "en-US", "fr-FR", "hi-IN"],
                    description: "Best browser TTS locale for this reply.",
                  },
                  direction: {
                    type: "string",
                    enum: ["rtl", "ltr"],
                  },
                },
                required: ["reply", "speech_lang", "direction"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_followup" } },
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      console.error("AI follow-up error:", aiResponse.status, text);
      return new Response(JSON.stringify({ error: "Could not generate a reply." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No follow-up tool call", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "Could not parse reply." }), {
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
    console.error("chat-followup error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
