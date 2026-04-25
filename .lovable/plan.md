
## Goal
Turn the single-shot mic UI into a back-and-forth Arabic chat with spoken AI replies, and gate the "Analyze My Skills" action behind a separate, intentional button.

---

## 1. Multi-turn conversational flow (mocked, no extra AI calls)

**Where:** `src/routes/index.tsx`

- Replace the current "got it, ready to analyze?" auto-reply with a rotating bank of empathetic Arabic (Darija) follow-up questions, e.g.:
  - "مزيان! شنو هما الحوايج اللي كتعرف تصاوب بيدك؟"
  - "شحال هادي وأنت كدير هاد الخدمة؟"
  - "واش خدمتي بوحدك ولا مع ناس أخرين؟"
  - "شنو هي أصعب حاجة فهاد الخدمة بالنسبة ليك؟"
  - "عاود لي على آخر يوم خدمت فيه — كيفاش دازت النهار؟"
- Keep an in-memory `questionIndex` so each user message gets the next question (cycling). No real AI / network — pure mock for now.
- After each user voice message: push the user bubble, then a 500–800 ms delayed bot bubble with the next Arabic follow-up, and feed that bubble into TTS (#2).
- Initial greeting bubble also switches to Darija ("أهلا 👋 أنا Sawt-Net. عاود لي على الخدمة اللي كتدير كل نهار.").

## 2. Text-to-Speech for bot bubbles

**New file:** `src/hooks/useSpeech.tsx`
- Thin wrapper around `window.speechSynthesis`.
- Exports `speak(text, lang)`, `cancel()`, and reactive `speakingId` state.
- Picks an Arabic voice: prefer `ar-MA`, fall back to any `ar-*` voice from `getVoices()`, then default. Handles the async voice-load (`onvoiceschanged`).
- Each call accepts an `id` so the UI can highlight which bubble is currently speaking.

**Wiring in `src/routes/index.tsx`:**
- When a new bot bubble is appended, call `speak(bubble.text, "ar-MA", bubble.id)`.
- On unmount or new user input → `cancel()` so we don't stack utterances.

**Visual indicator:**
- When `speakingId === bubble.id`, render an animated 3-bar audio-wave next to the bot bubble (small inline SVG/CSS, three `<span>`s with staggered scaleY animations using existing Tailwind keyframes, no new dependency).
- Add a tiny mute/unmute toggle in the header (next to History/Settings) so users can silence TTS — store preference in `localStorage`.

## 3. Separate, gated "Analyze My Skills" button

**Where:** `src/routes/index.tsx`

- Remove the big in-flow "Analyze My Skills" button from the bottom action area. The bottom area becomes mic-only, always.
- Add a sticky **Floating Action Button (FAB)** anchored bottom-right above the mic area (`fixed bottom-28 right-5`, respects mobile shell).
  - Icon: `Sparkles` + label "حلّل مهاراتي".
  - Disabled state (greyed, `opacity-40`, no shadow) until the user has sent **≥ 2** messages (`bubbles.filter(b => b.from === "user").length >= 2`).
  - Active state: gradient/primary background, gentle pulse to draw attention.
- On click: run the existing `startAnalysis()` logic, but concatenate **all** user messages (not just the last) into the transcript sent to the edge function — gives a richer multi-turn signal.
- While analyzing: FAB shows spinner + step label as a small toast / inline caption under the FAB.

**Header:** leave History + Settings as-is. Add the TTS mute toggle here. The FAB stays bottom-right per spec (cleaner on mobile than a header button).

---

## Files touched
- `src/routes/index.tsx` — multi-turn flow, FAB, remove inline analyze button, wire TTS, mute toggle, multi-message transcript.
- `src/hooks/useSpeech.tsx` — **new**, speechSynthesis wrapper with Arabic voice selection + speakingId.
- (No backend, schema, or edge-function changes.)

## Out of scope
- Real AI-driven follow-ups (current task says "mock conversational flow"). Easy to upgrade later by pointing the follow-up generator at a new edge function.
- Persisting multi-turn conversations to `voice_sessions` (still saves the concatenated transcript on analyze, same as today).
