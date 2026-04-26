## Premium Login Redesign — "Million-Dollar SaaS" Auth

The current `/login` is a stock mobile form floating on a Galaxy. It doesn't tell the UNMAPPED story, doesn't use the desktop viewport (1336×887), and the inputs/CTAs look like a starter template. Here's the targeted redesign.

### What's wrong today
1. Single narrow column on desktop — wastes 70% of the viewport.
2. Generic "Welcome to Sawt-Net" headline with no hackathon narrative or proof points.
3. Inputs use `border-2 border-input bg-background` — opaque white blocks fight with the Galaxy backdrop.
4. Tiny Sparkles icon doesn't read as a brand.
5. No social proof, no data visualization, no "infrastructure" framing — jury sees a login form, not a product.

### New design — two-pane premium layout

**Left pane (60% on `md+`, hidden on mobile)** — Brand & narrative
- Galaxy as full-bleed backdrop (kept, retuned: `hueShift={190}`, `density={1.2}`, `glowIntensity={0.5}`).
- Top: small wordmark — animated dot + "SAWT-NET" in tracked uppercase, with "UNMAPPED · World Bank Youth Summit" eyebrow.
- Center: large editorial headline with gradient text — *"Speak your skills. We'll map them to the global economy."* (Plus Jakarta Sans, 800 weight, ~5xl).
- Sub: one-line value prop grounded in real data: "Voice-first skills profiling for 600M young people the formal economy can't see."
- Three "proof chips" stacked at bottom: ISCO-08 · ESCO · Frey-Osborne 2017 · ILOSTAT — each with a tiny lucide icon (Layers, Network, Brain, BarChart3). These signal the data-grounded substance.
- Bottom: "In collaboration with MIT Club of Northern California & Germany" in muted micro-copy.

**Right pane (40% on `md+`, full-width on mobile)** — The auth card
- A glassmorphic card: `bg-white/8 backdrop-blur-2xl border border-white/15 rounded-3xl` with a subtle inner glow (`shadow-[0_0_120px_-20px_rgba(20,184,166,0.4)]`).
- Card sits centered vertically, max-width ~440px.
- Header inside card: brand mark (gradient teal→cyan rounded-2xl tile with `Sparkles`), "Welcome back" (or "Create your account"), one-line sub.
- Segmented Login/Sign-up toggle restyled: pill background `bg-white/5`, active pill = white-on-teal gradient with soft glow.
- **Inputs redesigned**: `bg-white/5 backdrop-blur border border-white/10`, white text, muted-white placeholders, focus ring = teal glow + border lift. Floating-label pattern (label slides up on focus/value) for a high-end feel. Icon stays inside.
- Password input gets an eye-toggle (show/hide) with `Eye`/`EyeOff` lucide icons.
- Primary CTA: teal→cyan gradient (`from-teal-400 to-cyan-500`), white text, soft glow shadow, subtle scale-on-press, loading spinner replacing text on submit.
- "or continue with" divider with hairline `bg-white/10`.
- Google button: glass style matching inputs, no garish white block. Hover lifts border to white/25.
- Footer micro-copy: terms link + small "← Back to home" link to `/`.

**Mobile (<md)** — only the right pane shows; Galaxy still renders behind, narrative collapses to a compact 3-line hero above the card. The existing `MobileShell` constrains width on mobile, so we'll bypass it on `md+` (use a `min-h-screen` wrapper outside the shell on desktop).

### Motion & polish
- Stagger framer-motion entrance: brand wordmark → headline → proof chips → card (each 60ms apart, `y: 12 → 0`, opacity).
- On mode toggle (login ↔ signup), card content cross-fades with `AnimatePresence` and a tiny height-spring.
- Subtle floating animation on the brand mark tile (2px y-bob, 4s ease).
- Respect `prefers-reduced-motion` — disable Galaxy animation + framer transitions when set.

### Typography & color
- Use the existing Plus Jakarta Sans (already loaded).
- Headline gradient: `bg-gradient-to-br from-white via-cyan-100 to-teal-300 bg-clip-text text-transparent`.
- Body text: `text-white/70` for sub, `text-white/50` for micro.
- Card text: white primary, `text-white/60` secondary.

### Files to edit
- **`src/routes/login.tsx`** — full rewrite of the component (keep the route export, head meta, auth handlers, GoogleIcon untouched). Replace the JSX shell with the two-pane layout described above. Bypass `MobileShell` on `md+` via a custom outer wrapper, keep it on mobile.

No new dependencies — `framer-motion`, `lucide-react`, Galaxy, Tailwind, and the design tokens are all in place. No new files needed unless we want to extract `<BrandPanel />` and `<AuthCard />` for cleanliness — I'll inline both in the route file to keep the diff focused (~220 lines total).

### Honest limits
- Galaxy is WebGL — on very low-end devices it may stutter. The `prefers-reduced-motion` + `disableAnimation` guard handles the worst case; we won't add a static fallback image in this pass (can add later if needed).
- The two-pane layout assumes `md` breakpoint (≥768px). Below that it's a single elegant column — already covers 320px–767px.
- I'm not changing the auth logic, Supabase calls, or Google OAuth — purely a visual/UX overhaul.