# Why the bot doesn't follow your language (and why audio sounds wrong)

After reading the chat code I found **two real bugs** that explain what you're seeing:

### Bug 1 — Speech recognition is locked to your profile language, not what you actually speak
`useSpeechRecognition(lang)` is initialized once from `profile.language` + `profile.country`. If your profile says **Morocco** the recognizer is hard-set to **`ar-MA`**, so even if you speak English or French, the browser transcribes it as Arabic gibberish — and naturally the AI replies in Arabic. You think "the bot ignores my language", but it never actually heard your real language.

### Bug 2 — Text-to-speech always picks an Arabic voice
In `src/hooks/useSpeech.tsx`, the `speak()` function calls `pickArabicVoice()` for **every** reply, regardless of `lang`. So when the bot replies in English/French/Hindi, your browser still speaks it with an Arabic voice → it sounds broken or doesn't play at all on some systems.

### Bug 3 — Browser autoplay blocks the first greeting audio
`speechSynthesis.speak()` fired 400ms after page load is silently blocked by Chrome until the user interacts. No fallback or visible "tap to enable sound" cue.

---

# The fix

## 1. Make speech recognition multilingual (auto-detect on each turn)

The Web Speech API can't truly auto-detect, but we can make it adaptive:
- Add a small **language picker chip row** above the mic (Darija / English / French / Hindi) — one tap, persists locally.
- The chip defaults to the profile's language but the user can switch on the fly *per turn*.
- Each tap updates the recognizer's `lang` immediately so the next "hold to record" uses the right STT locale.

This is the most reliable way given browser limits: the user picks the language they're about to speak, then the recognizer hears them correctly, then the AI reply matches.

## 2. Fix the TTS voice picker so it matches the reply language

Rewrite `pickArabicVoice` → `pickVoiceForLang(lang)`:
- For `ar-MA`: prefer `ar-MA`, then any `ar-*`.
- For `en-US`: prefer `en-US`, then any `en-*`.
- For `fr-FR`: prefer `fr-FR`, then any `fr-*`.
- For `hi-IN`: prefer `hi-IN`, then any `hi-*`.
- Always set `utter.lang` correctly and only set `utter.voice` when a real match exists (otherwise the OS picks a sane default).

This means the bot's English reply is read by an English voice, French by a French voice, etc.

## 3. Make audio reliable & visible

- On the first user mic press (a real user gesture), unlock `speechSynthesis` by calling a silent `speak("")` — this satisfies the autoplay policy for the rest of the session.
- If `tts.muted` is true when a reply comes in, show a tiny **"🔊 Tap to hear reply"** hint next to that bubble so the user knows audio is available.
- Add an `onerror` toast so failures aren't invisible.

## 4. Make the chat-followup edge function strictly mirror the user's last language

Tighten the system prompt: *"Your reply MUST be in the exact same language and script as the user's most recent message. Never switch languages mid-conversation unless the user does."* Plus require `speech_lang` to be derived from the **latest** user message only, not the conversation average.

## 5. (Bonus) Remember the per-turn language across the conversation
Store the picked language on each user bubble's `speechLang` and pass that as a hint into `chat-followup` so it doesn't have to re-detect from raw text alone.

---

# Files I'll touch

| File | Change |
|---|---|
| `src/hooks/useSpeech.tsx` | Replace Arabic-only voice picker with a multilingual one; add silent-unlock helper. |
| `src/routes/index.tsx` | Add language chip row above the mic; pass picked language into STT + the edge function; show "tap to hear" hint when muted; trigger TTS unlock on first mic press. |
| `supabase/functions/chat-followup/index.ts` | Strengthen system prompt to mirror the user's latest language exactly; accept an optional `user_lang` hint from the client. |

No DB changes, no new dependencies.

---

# What you'll experience after the fix

- Tap **EN** → speak English → bot replies in English, read aloud by an English voice.
- Tap **FR** → speak French → bot replies in French, read aloud by a French voice.
- Tap **AR** → speak Darija → bot replies in Darija (Arabic script), read aloud by an Arabic voice.
- Audio plays automatically after your first interaction; if you've muted it, you see a clear hint.