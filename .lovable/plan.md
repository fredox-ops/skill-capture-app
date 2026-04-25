# Migrate Sawt-Net to your own Supabase project

## Goal
Switch the app from Lovable Cloud's managed Supabase to **your own Supabase project** so you get full dashboard access (SQL editor, Auth providers, Logs, Storage UI, etc.). Keep the Lovable AI Gateway for the `analyze-skills` function (no key changes needed).

## Important context (please read)
- **Lovable Cloud cannot be disabled** once enabled. After we switch, the Cloud-managed Supabase project will remain provisioned but unused. No data lives there that you care about (test data only).
- The recommended path is the **official Supabase Connector** (Connectors → Supabase). This rewires Lovable's auto-generated client/types to your project and lets future schema migrations run against your database.
- Once switched, **all future migrations, edge function deploys, and auth config will go to your Supabase project, not Lovable Cloud.**

---

## Step 1 — Connect your Supabase project (you do this part)
You'll be guided through Connectors → Supabase. You'll need to provide:
1. **Project URL** (e.g. `https://xxxx.supabase.co`)
2. **Anon / publishable key**
3. **Service role key** (for server functions and admin operations)

After connecting, Lovable will:
- Update `.env` with your `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
- Regenerate `src/integrations/supabase/client.ts` and `types.ts` against your project
- Route the existing `requireSupabaseAuth` middleware and `supabaseAdmin` client to your project

No code changes from me are needed for the wiring itself — it's automatic.

## Step 2 — Recreate the database schema in your project
Your Supabase project starts empty. I'll generate a single SQL migration that recreates everything currently on Lovable Cloud:

**Tables**
- `profiles` (user_id, display_name, country [default 'Morocco'], language [default 'English'], avatar_url, timestamps)
- `voice_sessions` (user_id, transcript, language, created_at)
- `analyses` (user_id, session_id, skills jsonb, ai_score, risk_level, jobs jsonb, created_at)

**RLS policies** (identical to current — users can only access their own rows)
- SELECT / INSERT / UPDATE / DELETE policies on each table scoped by `auth.uid() = user_id`

**Functions + triggers**
- `update_updated_at_column()` trigger function
- `handle_new_user()` SECURITY DEFINER function that auto-inserts a profile row on signup
- Trigger on `auth.users` AFTER INSERT → `handle_new_user()`

This will run via the migration tool against your Supabase project.

## Step 3 — Configure authentication in your Supabase dashboard
Things you'll need to set up manually in **your** Supabase dashboard (I can't do these for you because they require dashboard access):

1. **Auth → URL Configuration**
   - Site URL: your Lovable preview/production URL
   - Redirect URLs: add the same URL(s)

2. **Auth → Providers → Email**
   - Decide whether to require email confirmation (currently off in Cloud — flip on if you want verified emails)

3. **Auth → Providers → Google** (if you want Google sign-in to keep working)
   - Create OAuth credentials in Google Cloud Console
   - Paste Client ID + Secret into Supabase
   - Add the Supabase callback URL to Google Console authorized redirects

I'll give you exact URLs and a checklist when we get to this step.

## Step 4 — Deploy the `analyze-skills` edge function to your project
The function code stays identical. It needs:
- `LOVABLE_API_KEY` secret in your Supabase project (for the Lovable AI Gateway)
- `verify_jwt = true` (already in `supabase/config.toml`)

I'll deploy it to your Supabase project and you'll add the `LOVABLE_API_KEY` secret in your Supabase dashboard under **Edge Functions → Secrets**. I'll provide the key value to paste.

## Step 5 — Smoke test end-to-end
After everything is wired:
1. Sign up with a new email → confirm a row appears in `profiles` (proves the trigger works)
2. Sign in, record a voice transcript → confirm a row in `voice_sessions`
3. Run "Analyze Skills" → confirm a row in `analyses` and dashboard renders
4. Sign in with Google (if configured)

I'll guide you through each check and fix any RLS / redirect / CORS issues that surface.

---

## What does NOT change
- All frontend code (routes, components, hooks) stays the same
- `useAuth`, `useProfile`, `useSpeechRecognition` keep working as-is
- Tailwind / design system / mobile shell unchanged
- The `analyze-skills` function code is unchanged

## What you'll need ready before approving
- ✅ Your Supabase Project URL
- ✅ Anon (publishable) key
- ✅ Service role key
- ✅ (Optional) Google OAuth Client ID + Secret if you want to keep Google sign-in

## Risks / things to know
- **One-way switch in practice**: After switching, the app talks only to your Supabase project. Lovable Cloud data won't be reachable from the app (no loss since it's empty).
- **Google sign-in will break temporarily** until you reconfigure OAuth credentials in your project.
- **Existing Lovable Cloud users (if any) won't transfer.** Since you only have test users, this is fine — you'll re-sign-up in the new project.
- Email templates in your Supabase project will use Supabase defaults unless you customize them.

Ready to proceed? Once you approve, I'll prompt you for the Supabase connection in the next step.