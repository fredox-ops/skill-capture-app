# Deploy `analyze-skills` to your personal Supabase project

## Why the error happens

Your app talks to `vlieoxikhjfnaosumvzi.supabase.co` (your personal Supabase project, hardcoded in `src/integrations/supabase/client.ts`).
Lovable can only deploy edge functions to its own managed project (`pfdtywytvvzlnkruaido`), so the `analyze-skills` function does not exist on your personal project — that's why every call returns **"Failed to fetch"**.

Until the function is deployed to **your** project, the chat will keep failing.

---

## What I'll do in code (after you approve)

### 1. Fix `supabase/config.toml`
Currently it has `verify_jwt = true` for `analyze-skills`, but the frontend calls it with the anon key only (no user JWT in the request). I'll change it to:

```toml
[functions.analyze-skills]
verify_jwt = false
```

So the function actually accepts requests from the browser.

### 2. Make the edge function fail gracefully
Right now if the AI returns malformed data or Tavily times out the user just sees "Failed to fetch". I'll:
- Wrap Tavily calls in `Promise.allSettled` with a 6s timeout each so a slow Tavily search can't hang the function.
- Return cleaner JSON error messages (so the frontend toast tells you *why* it failed instead of "Failed to fetch").

### 3. Update `DEPLOY_EDGE_FUNCTION.md`
Refresh the deploy guide so it matches the new `verify_jwt = false` setting and remove the `--no-verify-jwt` CLI flag (it'll already be in `config.toml`).

---

## What you'll need to do (one-time, ~3 minutes)

I cannot run these for you — they have to be done from your machine against your own Supabase account.

```bash
# 1. Install CLI (if not installed)
brew install supabase/tap/supabase     # macOS
# or: npm i -g supabase                # any OS

# 2. Login to Supabase
supabase login

# 3. From the project root:
supabase link --project-ref vlieoxikhjfnaosumvzi

# 4. Set secrets on YOUR project
supabase secrets set LOVABLE_API_KEY=<your_lovable_api_key>
supabase secrets set TAVILY_API_KEY=<your_tavily_key>

# 5. Deploy
supabase functions deploy analyze-skills
```

After step 5, refresh the app and the mic flow will work end-to-end.

> ⚠️ **Rotate your Tavily key first** — `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` was shared in chat. Get a new one at tavily.com → Account → API Keys, then use the new value in step 4.

> 🔑 **LOVABLE_API_KEY** — get it from Lovable → top-right avatar → **Workspace Settings → API Keys**.

---

## Files I'll edit

- `supabase/config.toml` — flip `verify_jwt` to `false`
- `supabase/functions/analyze-skills/index.ts` — Tavily timeouts + cleaner errors
- `DEPLOY_EDGE_FUNCTION.md` — updated steps

## Files you'll touch

- Nothing in code. Just the 5 CLI commands above.

---

## After deploy — how to verify

1. Open the app, sign in, hold the mic, say a sentence in Darija.
2. Network tab: the `POST /functions/v1/analyze-skills` request should return **200** with `skills`, `ai_risk_score`, `opportunities[].listings`.
3. If it fails, copy the JSON error body — it'll now tell us exactly what went wrong (AI key missing, Tavily down, etc.) instead of "Failed to fetch".