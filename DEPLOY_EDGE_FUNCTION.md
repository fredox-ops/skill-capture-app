# Deploy `analyze-skills` to YOUR Supabase project

The app talks to **your** Supabase project (`vlieoxikhjfnaosumvzi`), not Lovable Cloud, so Lovable cannot push edge functions for you. Run these 5 commands once on your machine and the chat → analysis flow will start working.

---

## 0. Rotate your Tavily key first

The key you shared in chat (`tvly-dev-2fgfxn-...`) should be considered compromised.

1. Open https://app.tavily.com/home
2. Account → API Keys → Revoke the old key
3. Create a new one — keep it for step 4

## 1. Install the Supabase CLI (one time)

macOS (Homebrew):
```bash
brew install supabase/tap/supabase
```

Windows (Scoop):
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Linux / any OS (npm):
```bash
npm i -g supabase
```

## 2. Login to Supabase

```bash
supabase login
```
A browser window opens — sign in with the account that owns project `vlieoxikhjfnaosumvzi`.

## 3. Link this project

From the project root (where the `supabase/` folder lives):
```bash
supabase link --project-ref vlieoxikhjfnaosumvzi
```

## 4. Set the secrets the function needs

```bash
supabase secrets set LOVABLE_API_KEY=YOUR_LOVABLE_AI_KEY
supabase secrets set TAVILY_API_KEY=YOUR_NEW_TAVILY_KEY
```

> Get your `LOVABLE_API_KEY` from Lovable → top-right avatar → **Workspace Settings → API Keys**.

## 5. Deploy

```bash
supabase functions deploy analyze-skills
```

`verify_jwt = false` is already set in `supabase/config.toml`, so the function will accept requests from the browser using the anon key. No CLI flag needed.

---

## Verify it works

After step 5, refresh the app, sign in, hold the mic, say a sentence, then tap **Analyze My Skills**. The Network tab should show `POST /functions/v1/analyze-skills → 200` with `skills`, `ai_risk_score`, `opportunities[].listings`.

If you still see an error, the response body will now contain a clear JSON message (e.g. `"LOVABLE_API_KEY not configured"`) instead of the generic `Failed to fetch`. Paste that here and I can fix it from the code side.

## Re-deploying after edits

Whenever I update `supabase/functions/analyze-skills/index.ts`, run step 5 again to push the new version:
```bash
supabase functions deploy analyze-skills
```

## Quick smoke test (optional)

```bash
curl -i -X POST https://vlieoxikhjfnaosumvzi.supabase.co/functions/v1/analyze-skills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"transcript":"I repair phones and laptops for customers in my shop","country":"Morocco","language":"English"}'
```
