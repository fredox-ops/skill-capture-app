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
    const { messages, country = "Morocco", user_lang } = await req.json();

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

    const allowedLangs = ["ar-MA", "en-US", "fr-FR", "hi-IN"] as const;
    const langHint = allowedLangs.includes(user_lang) ? user_lang : null;

    const systemPrompt = `You are Sawt-Net, an empathetic voice-first career assistant for young workers in the informal economy.

Your job: continue the conversation naturally and collect richer details about the user's real work skills.

LANGUAGE RULES (HIGHEST PRIORITY):
- Your reply MUST be in the EXACT same language and script as the user's MOST RECENT message.
- ${langHint ? `The user spoke this turn in: ${langHint}. Reply in that language.` : "Detect the language of the latest user message and reply in it."}
- If the user uses Moroccan Darija, reply in Moroccan Darija using Arabic script.
- If the user writes in English, reply in English.
- If the user writes in French, reply in French.
- If the user writes in Hindi, reply in Hindi (Devanagari).
- Never switch to a different language than the user's latest message, even if earlier messages were in another language.

CONVERSATION RULES:
- Do NOT repeat any previous assistant question from the conversation.
- Ask exactly ONE short follow-up question, maximum 18 words.
- Never ask two questions in the same reply.
- Do not add greetings like "hello" after the conversation has started.
- Sound warm, human, and simple like WhatsApp.
- Focus on one concrete work detail only: tools, tasks, experience, customers, problems solved, teamwork, safety, certifications, or daily routine.
- Do not analyze yet. Do not list jobs yet. Do not mention AI or scores.
- Country context: ${country}.

The speech_lang field MUST match the language of YOUR reply (the same language as the latest user message).`;

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
                    description: "BCP-47 locale matching the language of the reply (same as user's latest message).",
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
