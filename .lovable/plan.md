## Root cause

The `<Galaxy />` is mounted correctly in `__root.tsx` inside a `fixed inset-0 -z-10` div, but it is being **painted over by two opaque white layers** that sit *above* it in the stacking context:

1. **`html, body` in `src/styles.css` (lines 188–196)** sets `background-color: var(--color-app-shell)` which is near-white. Because the Galaxy wrapper uses `-z-10`, it sits *behind* the body's background paint → the white body covers the entire star-field.
2. **`.app-shell` utility (lines 205–211)** used by `MobileShell.tsx` paints another opaque white background on top of every route's content area.

Net result: the WebGL canvas is correctly mounted and animating, but you only ever see a flat white/teal page.

## Fix

### 1. `src/styles.css` — make body transparent on top of the Galaxy
- Change `html, body { background-color: var(--color-app-shell); ... }` to `background-color: transparent;`
- Move the off-white `--app-shell` paint to a new `.solid-shell` utility for routes that *need* an opaque background (none currently do — the app is fully chat-driven).
- Update the `.app-shell` utility (line 205) to `background: transparent;` so route content lets the Galaxy show through.

### 2. `src/components/MobileShell.tsx` — confirm transparency
- Already uses `bg-transparent`, but the inner `app-shell` utility was overriding it. With #1 done, this becomes truly transparent.

### 3. `src/routes/__root.tsx` — keep Galaxy wrapper as the dark base
- Current wrapper already uses `bg-slate-950` as the canvas fallback color — leave it. With body transparent, this dark slate becomes the visible "void" behind the stars.
- Keep `transparent={false}` on `<Galaxy />` so the WebGL clear color paints the dark backdrop itself (matches reactbits demo).

### 4. Glassmorphism contrast fix on `/` (home)
- Bot bubbles in `src/routes/index.tsx` currently use `bg-bubble-bot` (white, lines ~600+ — visible in the truncated section). With a dark Galaxy backdrop, white-on-white text inside chat bubbles is fine, but the surrounding shell text (`text-foreground` = dark slate) will be invisible on dark.
- Add `text-slate-100` to top-level shell text in `index.tsx`, `history.tsx`, `results.tsx`, `login.tsx`, and switch any plain card backgrounds to `bg-slate-900/40 backdrop-blur-md border-white/10` for legibility on the star-field.

## Verification
- Hard reload `/` — expect to see animated stars behind glassy chat bubbles.
- Navigate to `/login`, `/history`, `/results` — all routes share the global Galaxy, so all should show the same animated background.
- Check browser console for any WebGL warnings.

## Files to edit
- `src/styles.css` (body + `.app-shell` background → transparent)
- `src/components/MobileShell.tsx` (no functional change needed after CSS fix; verify)
- `src/routes/index.tsx` (text color + bubble glassmorphism on shell elements)
- `src/routes/login.tsx`, `src/routes/history.tsx`, `src/routes/results.tsx` (text color for legibility on dark)
