# Deploy `analyze-skills` to your Supabase project

Lovable cannot push edge functions to an external Supabase project — you must deploy them yourself with the Supabase CLI.

## 1. Install the Supabase CLI (one time)

macOS:
```bash
brew install supabase/tap/supabase
```

Windows (scoop):
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Linux / npm:
```bash
npm i -g supabase
```

## 2. Login

```bash
supabase login
```
A browser window opens — log in with the account that owns project `vlieoxikhjfnaosumvzi`.

## 3. Link this project

From the project root (where `supabase/` lives):
```bash
supabase link --project-ref vlieoxikhjfnaosumvzi
```

## 4. Set the secrets the function needs

```bash
supabase secrets set LOVABLE_API_KEY=YOUR_LOVABLE_AI_KEY
supabase secrets set TAVILY_API_KEY=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
```

> Get your `LOVABLE_API_KEY` from Lovable → Workspace Settings → API Keys.
> ⚠️ The Tavily key above was shared in chat — rotate it on tavily.com and use the new value.

## 5. Deploy the function

```bash
supabase functions deploy analyze-skills --no-verify-jwt
```

`--no-verify-jwt` is fine here because the function is called from the browser with the anon key.

## 6. Test it

```bash
curl -i -X POST https://vlieoxikhjfnaosumvzi.supabase.co/functions/v1/analyze-skills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"transcript":"I repair phones and laptops for customers in my shop","country":"Morocco","language":"English"}'
```

You should get back JSON with `skills`, `ai_risk_score`, `ai_risk_level`, and `opportunities` (each with a `listings` array from Tavily).

## Re-deploying after edits

Whenever I update `supabase/functions/analyze-skills/index.ts` in Lovable, run step 5 again to push the new version.
