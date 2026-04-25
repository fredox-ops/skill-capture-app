## Context

The Web Speech API is **already wired up** in this project:

- `src/hooks/useSpeechRecognition.tsx` — uses `window.SpeechRecognition || window.webkitSpeechRecognition`, supports `ar-MA`, `fr-FR`, `hi-IN`, `en-US`, exposes `start/stop/reset` plus `transcript`, `interim`, `listening`, `supported`, `error`.
- `src/routes/index.tsx` — wires the mic button, renders the live + final bubble, stores transcript in `bubbles` state, and POSTs it to the `analyze-skills` edge function.
- Settings (`SettingsModal`) lets the user pick **Country** (Morocco/India) and **Language** (Arabic/English/French). `getRecognitionLang()` already returns `ar-MA` when language is "Arabic" → **Darija works today** if the user picks Arabic.

The remaining gaps vs. your request are: (1) the button is tap-to-toggle, not push-and-hold, and (2) Darija is only selected when language="Arabic" — a Morocco user who left language on English/French won't get Darija.

## Changes

### 1. `src/hooks/useSpeechRecognition.tsx`
- Strengthen Darija handling in `getRecognitionLang()`: if `country === "Morocco"` AND language is English/French, **also default to `ar-MA`** so Darija is recognized even when the UI language differs. (Arabic + Morocco still → `ar-MA`. India still → `hi-IN`. Other cases unchanged.)
  - Rationale: Web Speech `lang` controls only the recognizer, not the UI. Setting `ar-MA` lets Chrome's recognizer accept Darija/Arabic phonetics regardless of the chat UI language.
- No API changes to the hook's return shape.

### 2. `src/routes/index.tsx` — push-and-hold mic button
Replace the current `onClick` toggle on the mic `<button>` with press-and-hold gestures that work on **mouse, touch, and pointer**:

- Add a small `holdingRef` + handlers:
  - `onPointerDown` → `start()` (call `e.preventDefault()` to avoid double-fire on touch devices).
  - `onPointerUp` / `onPointerLeave` / `onPointerCancel` → `stopAndPush()`.
  - Fallback `onTouchStart` / `onTouchEnd` for older iOS Safari that doesn't fully support pointer events on buttons.
  - Keyboard a11y: `onKeyDown` (Space) starts, `onKeyUp` (Space) stops — so the button stays usable without a pointer.
- Update the helper label from "Tap and speak your skills" → "**Hold to speak**" (and "Listening… release to send" while active).
- Keep the existing `Square`/`Mic`/`MicOff` icon swap logic — it already keys off `listening`.
- `stopAndPush()` already grabs `transcript`, pushes a user bubble, and triggers the bot follow-up — no change to that logic. The transcript remains stored in `bubbles` and is what's sent to `analyze-skills` via `lastUserMessage`.

### 3. (Optional, subtle) Show the active recognizer language under the mic
Add a tiny line like `Language: العربية (Darija)` / `English` / etc. below the helper text, so the user knows which model is listening. Pure UI; uses the value already returned by `getRecognitionLang()`.

## Notes / non-changes

- **No edge-function changes.** The transcript (already stored in component state) is already sent to `analyze-skills` — your request explicitly said "save it so we can send it later", and that wiring already exists.
- **No new dependencies.** Web Speech API is browser-native; works in Chrome/Edge/Android Chrome. Safari/Firefox will hit the existing `!supported` branch and show `MicOff` + the "not supported" message.
- **Darija caveat (worth knowing):** Chrome's `ar-MA` model handles Modern Standard Arabic well and accepts a lot of Darija, but accuracy varies by speaker and code-switching with French. The hook already lets a user override via Settings → Language if they prefer pure English/French recognition.

## Files touched

- `src/hooks/useSpeechRecognition.tsx` — tweak `getRecognitionLang()` only.
- `src/routes/index.tsx` — swap the mic button's `onClick` for press-and-hold pointer/touch/keyboard handlers + updated helper text.