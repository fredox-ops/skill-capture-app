# Migrate to your own Supabase project

You already provided your credentials — they're stored as the secrets `MY_SUPABASE_URL`, `MY_SUPABASE_ANON_KEY`, and `MY_SUPABASE_SERVICE_ROLE_KEY`. This plan rewires the app to point at **your** Supabase project instead of Lovable Cloud's, so you get full dashboard access (SQL editor, logs, auth UI, storage, etc.).

> ⚠️ **Heads-up before we start**
> - This is a **one-way swap**. Lovable's automated migration tool, type generation, and edge-function deploys will no longer sync to your project. You'll run SQL and deploy functions yourself.
> - Existing data in the current Lovable Cloud DB will **not** be copied. You confirmed earlier the DB only has test data, so we'll start fresh.
> - The files `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, and `types.ts` are normally auto-generated. After the swap I'll edit them manually and they should be treated as hand-managed from then on.

---

## 1. Rewire environment variables

Update `.env` so both client (Vite) and server (TanStack server fns) point at your project:

```env
VITE_SUPABASE_URL=<your project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon key>
VITE_SUPABASE_PROJECT_ID=<your project ref>
SUPABASE_URL=<your project URL>
SUPABASE_PUBLISHABLE_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
```

I'll pull the actual values from the `MY_SUPABASE_*` secrets you already added.

## 2. Update Supabase client files

- **`src/integrations/supabase/client.ts`** — keep the same `import.meta.env` / `process.env` lookup (no change needed since the env vars now point at your project).
- **`src/integrations/supabase/client.server.ts`** — same, reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `process.env`.
- **`src/integrations/supabase/auth-middleware.ts`** — same, no change needed.
- **`src/integrations/supabase/types.ts`** — replace the auto-generated content with a hand-written `Database` type covering `profiles`, `voice_sessions`, and `analyses` so TypeScript stays happy without the generator.

## 3. SQL you run in YOUR Supabase dashboard

I'll give you a single SQL script to paste into **SQL Editor → New query** in your project. It creates:

- `profiles` (id, user_id, display_name, country, language, avatar_url, timestamps)
- `voice_sessions` (id, user_id, transcript, language, created_at)
- `analyses` (id, user_id, session_id, skills jsonb, jobs jsonb, ai_score, risk_level, created_at)
- RLS enabled on all three with `auth.uid() = user_id` policies for SELECT/INSERT/UPDATE/DELETE
- `update_updated_at_column()` function + trigger on `profiles.updated_at`
- `handle_new_user()` function + `on_auth_user_created` trigger to auto-create a profile row on signup

## 4. Auth setup in your Supabase dashboard

Quick checklist I'll walk you through:
- **Authentication → URL Configuration** → Site URL = your Lovable preview/published URL; add the same to Redirect URLs.
- **Authentication → Providers → Email** → leave email/password on; toggle "Confirm email" off if you want instant sign-in (you currently have that behavior).
- **Authentication → Providers → Google** → optional; only if you want Google sign-in (you'd paste your Google OAuth client ID/secret).

## 5. Deploy the `analyze-skills` edge function to YOUR project

Since Lovable's auto-deploy is bound to its own project, you'll deploy this one yourself. Two options I'll document:

**Option A — Supabase CLI (recommended):**
```bash
npx supabase login
npx supabase link --project-ref <your project ref>
npx supabase secrets set LOVABLE_API_KEY=<your key>
npx supabase functions deploy analyze-skills
```

**Option B — Dashboard:** Edge Functions → New function → paste the contents of `supabase/functions/analyze-skills/index.ts` → set `LOVABLE_API_KEY` in Function Settings → Secrets.

> Note: `LOVABLE_API_KEY` currently comes from Lovable Cloud. If you want to keep using Lovable AI Gateway from your own project, you'll need to either (a) get a standalone Lovable AI key, or (b) swap the function to use OpenAI/Gemini directly with your own key. I'll flag this and ask before deploying.

## 6. Verify

After the swap, I'll:
1. Run the build to confirm TypeScript compiles against the hand-written types.
2. Walk you through signing up → checking the new user appears in **your** dashboard's Auth → Users tab.
3. Confirm a recording produces rows in **your** `voice_sessions` and `analyses` tables.

---

## What you'll need to do manually
1. Run the SQL script in your Supabase SQL Editor (I'll provide it).
2. Deploy `analyze-skills` via CLI or dashboard (I'll provide commands + secret value).
3. Configure Site URL + (optionally) Google OAuth in your Auth settings.

Everything else (env files, client code, types) I'll handle.

**Approve to proceed and I'll execute steps 1–2 and produce the SQL + deploy instructions for steps in your dashboard.**