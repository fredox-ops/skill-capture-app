## Goal

Carry the dark, cinematic energy of the new login into the live app so the jury sees one coherent "million-dollar" product — not a beautiful login that opens into a plain white form. The three screens that decide the demo are:

1. **Chat / mic** (`/`) — the moment of magic. Right now: white bubble UI, decent but generic.
2. **Results** (`/results`) — the proof. Right now: white card stack, lots of value but visually flat.
3. **Policy dashboard** (`/policy`) — the infrastructure pitch. Right now: slate/white admin look. Has a Grainient hero already.

Plus a small set of shared upgrades that elevate every screen at once.

All logic, data, Supabase calls, edge functions and routing stay **identical** — this is a visual + motion overhaul.

---

## 1. Shared design upgrade (one-time)

**New "Aurora" surface tokens in `src/styles.css`** (additive — won't break the existing white skin):
- `--surface-deep`, `--surface-elev` — near-black slate with a hint of teal.
- `--surface-glass` + `--surface-glass-border` for glass cards.
- New `--gradient-aurora`: layered radial gradients in teal + violet over deep slate.
- Two new utility classes: `.glass-card` (glass background + backdrop-blur + soft inner border + soft outer glow) and `.aurora-bg` (the radial gradient backdrop).

**Shared `<AuroraBackdrop />`** (`src/components/AuroraBackdrop.tsx`):
- Fixed-position layer behind page content.
- `intensity` prop ("subtle" | "rich").
- Aurora gradient + faint SVG noise overlay (~3%) to kill banding.
- Respects `prefers-reduced-motion`.
- Pure CSS, no WebGL — stays fast on low-end devices (key product claim).

**Shared `<GlassCard />`** (`src/components/GlassCard.tsx`) — thin wrapper used in results + policy.

---

## 2. Chat screen (`src/routes/index.tsx`) — "the magic moment"

Make the mic feel like hardware, not a form button.

- Wrap in `<AuroraBackdrop intensity="subtle" />`. Header + chat area become transparent.
- **Header**: glassmorphic strip (`bg-white/5 backdrop-blur-xl border-b border-white/10`). Sparkles tile keeps its teal→cyan gradient (matches the login). Text becomes white-on-dark.
- **Bot bubbles**: glass cards with white text. **User bubbles**: keep teal→cyan gradient — pops on dark.
- **Live transcript bubble**: animated cyan shimmer border so it visibly "listens".
- **Mic dock**:
  - Glass panel floating above aurora (`bg-white/5 backdrop-blur-2xl border-t border-white/10`).
  - Mic button gets a **conic-gradient halo** (replaces the single ripple) — three counter-rotating arcs in teal/cyan/violet that intensify while listening. The "expensive" detail the jury remembers.
  - Idle state: teal→cyan orb with inner highlight — looks like a polished glass button.
  - Per-turn language pills: glass style, active = teal gradient with cyan glow.
- **Analyze FAB**: teal gradient pill with soft cyan halo. While analyzing, a clean three-ring conic spinner replaces `Loader2`.
- **Onboarding**: not touching its logic, just give the wrapper the aurora background so it doesn't look out of place against the new shell.

---

## 3. Results screen (`src/routes/results.tsx`) — "the proof"

Turn the long card stack into a short, scannable "data dossier".

- Wrap in `<AuroraBackdrop intensity="subtle" />`. Header glassmorphic.
- **New hero summary card**:
  - Big AI-resilience score rendered as a **circular SVG gauge** (teal→cyan gradient stroke, animated `stroke-dasharray` on mount). Score number inside.
  - 3 micro-KPIs in glass chips: `Skills mapped`, `Top opportunity match %`, `Risk band` — all from existing data.
  - "Real data" badge restyled as glass pill with a tiny pulsing dot.
- **Skills section**: chips become glass with a thin automation-risk gradient (green→amber→red) on the left edge — turns a tag list into a visual risk fingerprint.
- **Risk section**: replace the flat horizontal bar with a single thin teal→cyan→amber→red accent line under the score, plus an annotation marker. Less space, more meaning.
- **Opportunities cards**: glass cards with match % as a small SVG progress ring on the left. Wage chips get a country-flag emoji prefix (`country` already in props).
- **Education trend**: glass card + tiny inline SVG sparkline showing 2025→2035 share movement. No new dependencies.
- **CV + Share + Smart Apply CTAs**: grouped into a sticky bottom action bar on mobile, hero-positioned on desktop. Teal gradient primary, glass secondaries.

All `motion` stagger animations stay; only the visual chrome changes.

---

## 4. Policy dashboard (`src/routes/policy.tsx`) — "the infrastructure pitch"

The screen that wins the "infrastructure not app" argument. Make it feel Bloomberg / Stripe Atlas-class.

- Replace `bg-slate-50` with `<AuroraBackdrop intensity="rich" />` — slightly more saturated since this is the showcase.
- **Header**: glassmorphic; "Policymaker Dashboard" gets the same gradient text as the login headline (`from-white via-cyan-100 to-teal-300`).
- **Existing `<GrainientHero />`**: keep, retune props to harmonise with the aurora behind it. Add a thin **data sources marquee** beneath it: `ISCO-08 · Frey-Osborne 2017 · ILOSTAT · Wittgenstein 2035 · ESCO v1.2 · ITU` — silently reinforces the data-grounded claim.
- **KPI cards**: glass cards with large numerals (`text-5xl font-extrabold`) and a small trend indicator. Tone props (`red`, `green`) drive the accent stroke.
- **`AutomationRiskChart`**: keep Recharts intact, restyle for dark — transparent background, brighter cohort/baseline colours (`#22d3ee` cyan vs `#a78bfa` violet), soft SVG glow filter under each bar.
- **Skill-supply heatmap**: rows on a glass background, bars in `from-cyan-400 to-violet-500`.
- **Tables (automation gap, wage gap)**: rebuild on shadcn `<Table>` themed dark — `border-white/10`, hover `bg-white/5`, monospace ISCO codes in subtle pills. Same columns and logic.
- **Wittgenstein education panel**: small two-point SVG line chart (~80px tall) instead of text-only — visible "trend up to 2035".
- **Export CSV**: glass primary button with download-icon spinner state.
- **Access-denied + spinner**: re-themed so polish carries through every code path.

---

## 5. Small polish that punches above its weight

- **Page transitions**: in `__root.tsx`, wrap `<Outlet />` in `framer-motion` `AnimatePresence` with a 220ms fade+slide between routes.
- **Cursor glow on policy**: 240px radial gradient that follows the cursor inside the dashboard hero. Single throttled listener updating one CSS variable — no per-move React state. Desktop only, opt-out on `prefers-reduced-motion`. A "did they really build this?" moment.

---

## Files I will touch

- `src/styles.css` — add aurora tokens + glass utilities + gradient-text utility. No removals.
- `src/components/AuroraBackdrop.tsx` — new.
- `src/components/GlassCard.tsx` — new.
- `src/components/MobileShell.tsx` — small change so the shell can render on top of the aurora when requested.
- `src/routes/__root.tsx` — page-transition wrapper.
- `src/routes/index.tsx` — chat shell + mic dock restyle (no logic changes).
- `src/routes/results.tsx` — hero gauge + glass cards + sticky action bar (no data changes).
- `src/routes/policy.tsx` — aurora + glass cards/tables, sources ticker, cursor glow.
- `src/components/policy/GrainientHero.tsx` — minor prop/colour tuning.
- `src/components/policy/AutomationRiskChart.tsx` — dark-theme recolour + soft glow.

No new dependencies — `framer-motion`, `lucide-react`, `recharts`, Tailwind v4 and the existing tokens cover everything.

---

## What I'm explicitly NOT doing

- Not touching any Supabase calls, RLS, edge functions, auth, routing, i18n copy, ESCO/ISCO mappings, or Frey-Osborne / ILOSTAT data plumbing.
- Not adding 3D / WebGL inside the live app. Galaxy stays exclusive to the login so it's a first-impression moment and the working app stays fast on low-end devices — itself a story you can tell the jury.
- Not touching `OnboardingFlow` internals — only its outer background so it inherits the aurora.

Implementation order once approved: shared tokens/components → chat → results → policy → page transitions, with `tsc --noEmit` after each step.