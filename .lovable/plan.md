## Galaxy Component Integration Plan

The user is currently on `/login` — I'll integrate the Galaxy WebGL star-field as a premium ambient background there (perfect "million-dollar SaaS" feel for the auth screen). I'll also expose it as a reusable component so we can drop it elsewhere (e.g. policymaker hero, landing) later.

### 1. Install dependency
- `bun add ogl` (WebGL micro-library, ~12KB, Worker-safe since it only runs client-side inside `useEffect`).

### 2. Create the component (TypeScript-adapted)
**`src/components/Galaxy.tsx`** — port the provided JSX to TSX:
- Convert prop signature to a typed `GalaxyProps` interface (focal/rotation as `[number, number]` tuples, all numeric/boolean props typed).
- Keep shaders and `useEffect` logic byte-identical.
- Guard against SSR: bail early if `typeof window === "undefined"` (TanStack Start renders this route on the server).
- Inline the 3 lines of CSS via a `style` prop on the container — avoids creating a separate `Galaxy.css` file and keeps the component self-contained.

### 3. Wire it into `/login`
**`src/routes/login.tsx`**:
- Add an absolutely-positioned `<Galaxy />` layer behind the existing login card (`absolute inset-0 -z-10` with `pointer-events-none` so the form remains fully interactive).
- Use props tuned for the brand: `hueShift={180}` (teal/cyan to match our palette), `density={1}`, `glowIntensity={0.4}`, `saturation={0.6}`, `twinkleIntensity={0.4}`, `mouseRepulsion`, `transparent`.
- Darken the existing background slightly (e.g. `bg-slate-950/40`) so stars pop without breaking legibility.
- Respect `prefers-reduced-motion`: pass `disableAnimation` based on a `matchMedia` check.

### 4. Verification
- Run `bunx tsc --noEmit` to confirm types compile.
- Visit `/login` to verify: stars render, form remains clickable, no console errors, no SSR hydration mismatch.

### Notes / honest limits
- The original snippet is JSX; I'll convert to TSX (project is strict TS). Shader strings stay identical.
- `ogl` is pure ESM and Worker-safe at *bundle* time, but it touches `window`/WebGL — the component must only mount client-side. The `useEffect` guard handles this naturally; no SSR work needed since the canvas is created inside the effect.
- Not adding it to `/policy` in this pass — that route already has the `GrainientHero`. If you want Galaxy *instead* of (or layered with) Grainient on `/policy`, say the word and I'll swap it after this lands.
