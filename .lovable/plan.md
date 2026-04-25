## Goal

Make the bot reply in the same language the user speaks (already done via `chat-followup`) **and** play the answer out loud in that same language — including **Arabic / Darija** — on any device, without needing OS-installed voices and without paid keys.

## Why the change is needed

- `chat-followup` already detects the user's language and forces the assistant to reply in `ar-MA / en-US / fr-FR / hi-IN`. Bot text is correct.
- The current `tts` edge function returns `{ fallback: true }`, so audio falls back to `window.speechSynthesis`. On Windows/Linux/some Android browsers there is **no Arabic voice installed**, so the user hears nothing for Arabic. That is the root cause.
- Lovable AI Gateway has no TTS model. ElevenLabs free tier is blocked. The only remaining free, multilingual, no-key option is Google Translate's TTS endpoint.

## Approach

### 1. Replace `supabase/functions/tts/index.ts`

- Accept `{ text, lang }` (lang in `ar-MA | en-US | fr-FR | hi-IN` or short `ar/en/fr/hi`).
- Map to Google TTS language codes: `ar`, `en`, `fr`, `hi`.
- Split the text into ≤200-char chunks at sentence/space boundaries (Google's limit).
- For each chunk, fetch:
  `https://translate.google.com/translate_tts?ie=UTF-8&tl=<lang>&client=tw-ob&q=<encoded>&textlen=<n>&total=<total>&idx=<i>`
  with a normal browser `User-Agent` and `Referer: https://translate.google.com/`.
- Concatenate all returned MP3 byte arrays (MP3 frames concatenate cleanly), base64-encode, return `{ audio, mime: "audio/mpeg" }`.
- On any failure, return `{ fallback: true }` so the client still falls back to browser TTS.
- Keep CORS headers and `verify_jwt` behavior identical.

### 2. Keep `src/hooks/useSpeech.tsx` essentially as it is

- It already calls the `tts` edge function, caches base64 audio per text, plays it as `<audio>`, and falls back to `speechSynthesis` if the function reports `fallback: true`. No changes needed to the hook itself except:
  - Remove the `cloudUnavailableRef` "sticky" flag so a transient Google failure on one phrase doesn't permanently disable cloud TTS. Re-try cloud per call; only fall back to browser TTS for that single phrase.

### 3. No frontend behavior change in `src/routes/index.tsx`

- `tts.speak(followUp, speechLang, botBubble.id)` is already called automatically when each bot bubble arrives, so audio will play automatically in the user's language as soon as the function returns the MP3.

### 4. Deploy and verify

- Deploy the updated `tts` function.
- Smoke-test by calling it with a short Arabic phrase and confirming a non-empty base64 MP3 is returned.
- Check the live preview by speaking in Darija, observing that the bot's Arabic reply is auto-played.

## Caveats (called out honestly)

- `translate.google.com/translate_tts` is an **unofficial** endpoint. Google may rate-limit or block it without notice. If that happens the function returns `fallback: true` and the app silently uses browser TTS again — the chat keeps working.
- Voice quality is decent but not as natural as ElevenLabs. If you later want studio-grade Arabic, upgrading the ElevenLabs key is the upgrade path; the same `useSpeech` hook will keep working.

## Files touched

- `supabase/functions/tts/index.ts` — rewrite to call Google Translate TTS, chunk, concatenate, base64-encode.
- `src/hooks/useSpeech.tsx` — drop the sticky `cloudUnavailableRef` so we retry cloud per phrase.

No DB migrations, no new secrets, no new dependencies.