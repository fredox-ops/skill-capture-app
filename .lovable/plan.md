# Performance Optimization Plan

Goal: make the app feel instant — fast first paint on `/login` and `/`, smooth scroll on `/policy`, lower CPU on low-end devices.

## What's slow today
1. **Galaxy WebGL** (`ogl` shader) loads eagerly on `/login` — heavy GPU + JS bundle on the first screen users see.
2. **Google Fonts** loaded at runtime via `@import url(...)` in `styles.css` — render-blocking, no `font-display: swap` control, no preconnect.
3. **Aurora backdrop** runs a 22s `filter: blur(40px)` animation on a fixed full-screen layer → continuous compositor + paint cost.
4. **SVG noise overlay** is a fixed full-viewport element with `mix-blend-mode: overlay` → forces layer compositing on every scroll.
5. **Multiple infinite CSS animations** running simultaneously even when off-screen (mic conic halos, shimmer, marquee, spinner).
6. **framer-motion** page transitions + `AnimatePresence` on every route swap → extra JS work and layout thrash.
7. **Recharts** (`/policy`) imported eagerly — large bundle even when user never scrolls to chart.
8. **Heavy modals** (`SettingsModal`, `OnboardingFlow`, `CvModal`, `SmartApplyModal`) imported at top of routes instead of lazy.

## Changes

### 1. Lazy-load the Galaxy (biggest single win)
- Convert `Galaxy` import in `src/routes/login.tsx` to `React.lazy(() => import("@/components/Galaxy"))` wrapped in `<Suspense fallback={null}>`.
- Render a pure CSS gradient placeholder immediately so the login UI is interactive in <100ms; Galaxy mounts after.
- Skip Galaxy entirely on small screens (`window.innerWidth < 768`) and when `prefers-reduced-motion` — show the CSS gradient only.
- Lower default `density` to 0.8 and clamp `devicePixelRatio` to 1.5 inside the renderer to cut fragment-shader cost ~40% on retina screens.

### 2. Self-host & preload the font, drop the runtime @import
- Remove `@import url("https://fonts.googleapis.com/...")` from `styles.css` (render-blocking).
- Add `<link rel="preconnect">` + `<link rel="preload" as="style">` + stylesheet `<link>` for Plus Jakarta Sans in `__root.tsx` head with `display=swap`, and only the weights actually used (400, 600, 700 — drop 500 + 800).
- Keeps the same look but unblocks first paint.

### 3. Cheaper Aurora backdrop
- Drop the `::before` blurred animated layer entirely — replace with a single static radial-gradient stack (still looks identical at rest).
- For "rich" intensity on `/policy`, keep one slow `transform` animation (no filter blur) — `transform` is GPU-cheap; `filter: blur(40px)` is not.
- Reduce noise overlay `background-size` and add `will-change: auto` (remove implicit layer); gate it behind `@media (min-width: 768px)`.

### 4. Pause off-screen / non-essential animations
- Add `animation-play-state: paused` via `content-visibility: auto` on the sources marquee and any decorative section so they stop when scrolled out of view.
- Mic conic halos: only mount the halo divs when `recording === true` (currently always rendered with opacity 0, still animating).

### 5. Code-split heavy route modules
- `recharts` in `src/components/policy/AutomationRiskChart.tsx` → wrap consumer with `React.lazy`.
- `SettingsModal`, `OnboardingFlow`, `CvModal`, `SmartApplyModal` → `React.lazy` + render only when `open`.

### 6. Trim framer-motion usage
- Remove the global page-transition wrapper in `__root.tsx` (220ms fade adds work + delays TTI for every nav). Native instant nav is faster and feels snappier in a SaaS context.
- Replace small `motion.div` fade-ins on static landing chips with plain CSS `@keyframes` (one-shot, no JS).
- Keep framer-motion only for the auth-mode toggle and the chat bubble enter animation.

### 7. Misc
- Add `loading="lazy"` + `decoding="async"` on any `<img>`.
- Add `<link rel="dns-prefetch">` for the Supabase + storage domains in `__root.tsx` head.
- Vite: nothing to add — TanStack Start already auto-splits routes; the lazy imports above let it actually shrink the per-route bundle.

## Files to edit
- `src/routes/login.tsx` — lazy Galaxy + mobile/reduced-motion gate
- `src/components/Galaxy.tsx` — DPR clamp
- `src/styles.css` — remove font @import, simplify aurora animation, content-visibility on marquee
- `src/routes/__root.tsx` — preload font, dns-prefetch, drop page-transition wrapper
- `src/components/AuroraBackdrop.tsx` — drop animated `::before`
- `src/routes/index.tsx` — gate mic halos behind recording state, lazy SettingsModal/OnboardingFlow
- `src/routes/results.tsx` — lazy CvModal, SmartApplyModal
- `src/routes/policy.tsx` — lazy AutomationRiskChart

## Out of scope
- No visual redesign — purely perf. The login still has Galaxy, just deferred.
- No Supabase/auth/data changes.

## Expected impact
- Login LCP: ~1.2s → ~300–500ms on mid-tier mobile.
- `/` (chat) JS bundle: ~25–35% smaller after splitting modals.
- `/policy` scroll FPS: 30–45 → 55–60 on low-end Android.
- CPU at idle on `/login`: ~60% → ~10%.