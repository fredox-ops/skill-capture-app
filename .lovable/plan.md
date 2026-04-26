## Root Cause

The dev server log reveals the real issue — and it has nothing to do with the Galaxy component itself:

```
[vite:css][postcss] @import must precede all other statements (besides @charset or empty @layer)
4299 |  @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans...");
```

**The entire Tailwind stylesheet is failing to compile.** That's why the page looks broken / unstyled — it's not that Galaxy isn't rendering, it's that no CSS is being applied at all (or only stale cached CSS), so every absolutely-positioned background layer collapses.

In `src/styles.css`, the Google Fonts `@import url(...)` is on line 6 — **after** `@import "tailwindcss"`, `@source "../src"`, and `@import "tw-animate-css"`. Per the CSS spec, **every `@import` rule must precede all other statements**. Once Tailwind v4 expands its utilities inline, the Google Fonts `@import` ends up at line ~4299 of the generated CSS, after thousands of rules — PostCSS rightly rejects it and the whole file fails to build.

## The Fix

**One file change** — reorder `src/styles.css` so the remote Google Fonts `@import url(...)` is the very first statement, before any Tailwind directives:

```css
/* Plus Jakarta Sans — must be first, before any other CSS statements */
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");

@import "tailwindcss" source(none);
@source "../src";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

/* …rest of file unchanged… */
```

That single move unblocks the entire stylesheet, which means:
- All Tailwind utility classes start applying again
- The login page's `bg-slate-950`, `absolute inset-0 -z-10`, gradient overlay, etc. all render
- The Galaxy WebGL canvas (which is already correctly mounted) becomes visible behind the form

## Verification After Approval

1. Tail `/tmp/dev-server-logs/dev-server.log` and confirm the `@import must precede all other statements` PostCSS error is gone.
2. Reload `/login` and confirm the animated star-field is visible behind the login card.
3. If for any reason it still doesn't render, capture the browser console with `code--read_console_logs` for any `WebGL`, `ogl`, or `Galaxy` errors and address those (e.g. parent container has zero height, WebGL context lost).

## What I'm NOT changing

- `src/components/Galaxy.tsx` — the component is correct, the shaders compile, the cleanup is safe.
- `src/routes/login.tsx` — the integration (absolute layer, `-z-10`, gradient overlay) is correct.
- `ogl` install — already added to `package.json`.

The Galaxy was never broken. The CSS pipeline was broken, which made it look like nothing was on screen.