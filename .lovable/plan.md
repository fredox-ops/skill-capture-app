## Why you don't see it

You're on `/` (home), but the Galaxy was only wired into `/login`. On top of that, `MobileShell` uses `bg-app-shell` (a solid light color) which would cover any background sitting behind it anyway. So even if Galaxy were mounted, the shell would paint over it.

That's the real fix: mount Galaxy as a **fixed, full-viewport background at the root level** (behind everything), and make the shell + cards transparent / glassy so the stars show through.

## Plan

### 1. Mount Galaxy globally in the root layout
File: `src/routes/__root.tsx`

- Import `Galaxy` from `@/components/Galaxy`.
- Inside `RootComponent`, render a `fixed inset-0 -z-10` wrapper containing `<Galaxy />` with the exact props you provided (mouseRepulsion, density 1, glowIntensity 0.3, saturation 0, hueShift 140, twinkleIntensity 0.3, rotationSpeed 0.1, repulsionStrength 2, starSpeed 0.5, speed 1, `transparent={false}` so it paints its own deep-space backdrop).
- Wrap with `<ClientOnly>` (or a mounted-state guard) because `ogl` touches `window` — must not run during SSR.
- Add a soft dark gradient overlay above it for legibility.

### 2. Make the shell see-through so the galaxy is visible everywhere
File: `src/components/MobileShell.tsx`

- Replace `bg-app-shell` with `bg-transparent` (or `bg-slate-950/30 backdrop-blur-[2px]`) so the global Galaxy shows through on every route, not just login.

### 3. Adapt the home page (`/`) for the dark galaxy background
File: `src/routes/index.tsx`

- Set the page text color to light (`text-slate-100`) on the main container.
- Convert the primary surfaces (chat bubbles, mic card, header chips, history button) to glassy style: `bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl`.
- Keep the mic button vivid (its existing primary color works on dark).
- Loading / empty states get the same glass treatment.

### 4. Clean up the login route
File: `src/routes/login.tsx`

- Remove its local `<Galaxy />` block — it's now global.
- Keep the existing dark text/glass styling so it still looks right.

### 5. Verify
- Hard-refresh `/` and confirm the animated star field is visible behind the chat UI.
- Navigate to `/login`, `/history`, `/results` — the same galaxy persists across routes (no re-mount flicker because it lives in `__root`).
- Confirm no SSR crash (`window is not defined`) thanks to the ClientOnly guard.
- Check console for WebGL context errors.

## What you'll see after this
A single, continuous animated galaxy background across the whole app, with your chat UI, login form, and other content floating in glassy cards on top of it — exactly the look in the snippet you pasted.