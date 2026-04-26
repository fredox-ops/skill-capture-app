## The real problem

The Galaxy component is mounted on `/login` correctly, but **the entire stylesheet is failing to compile**, so nothing positions/sizes properly and the canvas never gets a visible box. Dev-server log confirms this on every reload:

```
[vite:css][postcss] @import must precede all other statements (besides @charset or empty @layer)
4299 |  @import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans...");
```

### Why my previous "fix" did not work

I moved the Google Fonts `@import` to **line 1** of `src/styles.css`. That looked right, but in Tailwind v4 the directive `@import "tailwindcss"` on line 4 gets **inlined at build time** — it expands into thousands of lines of generated utilities. After expansion, the Google Fonts `@import` ends up at line ~4299, *after* tons of `:root`, `@property`, and rule blocks. CSS spec forbids `@import` after other rules, so PostCSS rejects the whole file.

Putting `@import url(...)` first in the **source** file does not help, because Tailwind's expansion happens *around* it, not *before* it.

## The fix

Stop loading the Google Font through CSS. Load it via `<link>` tags in the document head instead — the standard, recommended approach. This removes the `@import url(...)` from the CSS pipeline entirely, so PostCSS has nothing to complain about.

### Step 1 — `src/styles.css`
Delete the first two lines (the comment + `@import url("https://fonts.googleapis.com/...")`). Leave the rest untouched.

### Step 2 — `src/routes/__root.tsx`
Add Google Fonts preconnect + stylesheet links to the existing `links: [...]` array in the root route's `head()`:

```ts
links: [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap",
  },
  { rel: "stylesheet", href: appCss },
],
```

### Step 3 — Verify
- Tail `/tmp/dev-server-logs/dev-server.log` and confirm the `[vite:css][postcss] @import must precede...` error is gone.
- Confirm `/login` now shows the animated Galaxy starfield behind the login card (teal hue, twinkling stars, mouse repulsion).
- Confirm Plus Jakarta Sans font is still applied (headings, body).

## Out of scope
- No changes to `Galaxy.tsx` — the component itself is correct and `ogl` is installed.
- No changes to `login.tsx` — the integration (absolute fixed background, `-z-10`, gradient overlay) is already correct and will become visible the moment the CSS compiles.
