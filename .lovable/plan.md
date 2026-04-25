## Problem

Two issues:

1. **Stale build error** referencing `chatScrollRef` on line 273 of `src/routes/index.tsx` — that variable does **not** exist anywhere in the codebase (verified with ripgrep). It's a leftover from the previous edit's transient state and will clear on the next build. No code change needed for it specifically — just rebuilding.

2. **Real issue**: The bot always replies in Moroccan Darija from a hardcoded bank (`FOLLOW_UP_QUESTIONS_AR`), regardless of what language the user spoke. The user wants the bot to **mirror the language they used** — talk back in English when they speak English, French when they speak French, Hindi when they speak Hindi, Arabic when they speak Darija/Arabic.

## Approach

The recognizer already runs in a fixed locale (`ar-MA`, `en-US`, `fr-FR`, `hi-IN`) determined from the user's profile via `getRecognitionLang(language, country)`. So the spoken locale is **already known per turn**. We use that as the source of truth for which language to reply in.

### 1. Multilingual follow-up question banks (`src/routes/index.tsx`)

Replace the single `FOLLOW_UP_QUESTIONS_AR` array with a map keyed by `RecognitionLang`:

```ts
const FOLLOW_UPS: Record<RecognitionLang, string[]> = {
  "ar-MA": [ /* current Darija questions */ ],
  "en-US": [
    "Nice! What kinds of things can you make or fix with your hands?",
    "How long have you been doing this kind of work?",
    "Do you work alone or with other people?",
    "What's the hardest part of your job?",
    "Walk me through your last working day — how did it go?",
    "Do you use any specific tools or machines?",
    "What do you enjoy most about what you do?",
  ],
  "fr-FR": [
    "Super ! Quelles sont les choses que tu sais faire ou réparer de tes mains ?",
    "Depuis combien de temps tu fais ce travail ?",
    "Tu travailles seul ou avec d'autres personnes ?",
    "Qu'est-ce qui est le plus difficile dans ton travail ?",
    "Raconte-moi ta dernière journée de travail — comment ça s'est passé ?",
    "Tu utilises des outils ou des machines particulières ?",
    "Qu'est-ce que tu aimes le plus dans ton travail ?",
  ],
  "hi-IN": [
    "बढ़िया! आप अपने हाथों से क्या-क्या बना या ठीक कर सकते हैं?",
    "आप यह काम कब से कर रहे हैं?",
    "आप अकेले काम करते हैं या दूसरों के साथ?",
    "इस काम में सबसे मुश्किल बात क्या है?",
    "अपने पिछले काम के दिन के बारे में बताइए — कैसा रहा?",
    "क्या आप कोई खास उपकरण या मशीन इस्तेमाल करते हैं?",
    "अपने काम में आपको सबसे ज़्यादा क्या पसंद है?",
  ],
};
```

Also localize the **greeting** the same way:

```ts
const GREETINGS: Record<RecognitionLang, string> = {
  "ar-MA": "أهلا 👋 أنا Sawt-Net. عاود لي على الخدمة اللي كتدير كل نهار…",
  "en-US": "Hi 👋 I'm Sawt-Net. Tell me about the work you do every day, and I'll help you find real job opportunities.",
  "fr-FR": "Salut 👋 Je suis Sawt-Net. Raconte-moi le travail que tu fais chaque jour, et je vais t'aider à trouver de vraies opportunités.",
  "hi-IN": "नमस्ते 👋 मैं Sawt-Net हूँ। मुझे बताइए आप रोज़ क्या काम करते हैं — मैं आपके लिए असली नौकरी के मौके ढूंढूंगा।",
};
```

Initial greeting bubble + initial TTS call use `GREETINGS[lang]` and `lang` as the spoken locale instead of hardcoded `GREETING_AR` / `"ar-MA"`.

### 2. Per-turn language selection in `stopAndPush`

Currently `stopAndPush` always pulls from `FOLLOW_UP_QUESTIONS_AR` and always speaks `"ar-MA"`. Change it to:

```ts
const followUps = FOLLOW_UPS[lang];
const followUp = followUps[questionIndexRef.current % followUps.length];
questionIndexRef.current += 1;
// …
tts.speak(followUp, lang, botBubbleId);
```

That single change makes every reply match the recognizer locale, which already reflects what the user is speaking.

### 3. Update small helper copy

- "Speaking…" indicator stays in English (it's a UI label, not part of the conversation) — no change.
- The `dir="rtl"` on bot bubbles should only apply when the bot's text is Arabic. Update to `dir={lang === "ar-MA" ? "rtl" : "ltr"}` (or `"auto"`) so English/French/Hindi replies render left-to-right correctly.

### 4. Stale build error

No direct fix required — the missing `chatScrollRef` reference doesn't exist in source. The error will disappear on the next successful compile triggered by the edits above.

## Out of scope (could be a follow-up)

- True per-message language **detection** (e.g. user mid-conversation switches from English to French). For now we trust the profile-derived locale, which is consistent with how the recognizer is already configured. If the user wants dynamic switching, that would need either a small AI classifier call or letting the user pick a language toggle in the header.
- Translating the analysis results page — it currently uses English labels with localized job titles from the AI. Out of scope for this turn.

## Files touched

- `src/routes/index.tsx` — add `GREETINGS` + `FOLLOW_UPS` maps, switch `stopAndPush` and the greeting `useEffect` to use them, fix bubble `dir` attribute.

No new files, no backend changes, no schema changes.
