# Sawt-Net: Voice-to-Skills and Opportunity Matching

Sawt-Net is a voice-first web app that helps users describe what they do in everyday language, then turns that into structured skills, AI exposure signals, and job opportunities.

It is built with React + TanStack + Supabase, and includes:
- a multilingual conversational capture flow,
- an analysis pipeline backed by a Supabase Edge Function,
- a results experience with economic signal overlays,
- and policymaker/admin views for aggregate insights and country configuration.

## Table of Contents
- [Why this project exists](#why-this-project-exists)
- [Core product flows](#core-product-flows)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Local development setup](#local-development-setup)
- [Environment variables](#environment-variables)
- [Supabase setup and edge function deployment](#supabase-setup-and-edge-function-deployment)
- [Country configuration (no code change)](#country-configuration-no-code-change)
- [Build and deployment](#build-and-deployment)
- [Documentation pages](#documentation-pages)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Why this project exists
Many people can clearly explain their real work verbally, but struggle with forms, CV language, or formal taxonomy terms. Sawt-Net bridges that gap by:
- capturing voice in user-friendly language,
- extracting standardized skills and job signals,
- and presenting practical next-step opportunities.

## Core product flows
- **Voice capture (`/`)**: users speak about daily work; the app records transcript turns and guides follow-ups.
- **Results (`/results`)**: users get a skills profile, risk score, and matched opportunities with wage and automation context.
- **History (`/history`)**: previous analyses can be revisited.
- **Share page (`/p/$shareId`)**: selected results can be shared by link.
- **Policymaker dashboard (`/policy`)**: aggregate anonymized cohort insights (skills, automation, wage gap, education trend).
- **Admin configs (`/admin/configs`)**: country-level behavior can be configured without app code changes.

## Tech stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Routing/data**: TanStack Router, TanStack Query
- **Backend/data**: Supabase (Postgres, Auth, Edge Functions)
- **UI/UX**: Radix UI, Lucide icons, Framer Motion
- **Validation/forms**: Zod, React Hook Form

## Project structure
```text
skill-capture-app/
  src/
    routes/                  # App routes (chat, results, policy, admin, etc.)
    components/              # UI components
    hooks/                   # Auth, profile, speech, role hooks
    lib/ and utils/          # Domain logic, datasets, helpers
  supabase/
    functions/               # Edge functions (e.g., analyze-skills)
    migrations/              # Database schema/data migrations
  docs/
    CONFIGURING_A_NEW_COUNTRY.md
  DEPLOY_EDGE_FUNCTION.md
```

## Local development setup
### 1) Prerequisites
- Node.js 20+ (recommended)
- npm (or Bun, if you prefer)
- Supabase CLI (for edge function deployment)

### 2) Install dependencies
```bash
npm install
```

### 3) Run the app
```bash
npm run dev
```

### 4) Build and preview
```bash
npm run build
npm run preview
```

## Environment variables
Create/update `.env` in project root with your Supabase and integration keys.

Typical values include:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- any app-specific client environment values used by your deployment

For secrets required by edge functions (server-side), set them through Supabase secrets (not `.env` for browser runtime).

## Supabase setup and edge function deployment
The `analyze-skills` edge function must be deployed to your own Supabase project.

Use the documented process in:
- [`DEPLOY_EDGE_FUNCTION.md`](./DEPLOY_EDGE_FUNCTION.md)

Quick summary:
1. Install Supabase CLI
2. `supabase login`
3. `supabase link --project-ref <your-project-ref>`
4. Set required secrets:
   - `LOVABLE_API_KEY`
   - `TAVILY_API_KEY`
5. Deploy:
   - `supabase functions deploy analyze-skills`

## Country configuration (no code change)
Sawt-Net is designed so adding a new country is a data operation, not a code refactor.

Full guide:
- [`docs/CONFIGURING_A_NEW_COUNTRY.md`](./docs/CONFIGURING_A_NEW_COUNTRY.md)

In short:
- add a row in `public.country_configs`,
- provide country economic data JSON files under `supabase/functions/_shared/econ-data/` where needed,
- and the app uses it on next request.

## Build and deployment
### Frontend
The frontend is a Vite app:
```bash
npm run build
```
Deploy the generated `dist` output to your preferred host (Cloudflare Pages, Netlify, Vercel, static hosting, etc.).

### Supabase backend
- Apply migrations to your Supabase database.
- Deploy edge functions after code updates.

## Documentation pages
Current project documentation pages:
- [Configuring a New Country](./docs/CONFIGURING_A_NEW_COUNTRY.md)
- [Deploy Edge Function](./DEPLOY_EDGE_FUNCTION.md)

If you want these docs visible as a website with **GitHub Pages**:
1. Push this repository to GitHub.
2. In GitHub: `Settings` -> `Pages`.
3. Set source to your default branch and `/docs` folder (or use GitHub Actions/static site generator).
4. Add an index page in `docs/` if you want a docs homepage.

## Troubleshooting
- **App loads but analysis fails**  
  Check `analyze-skills` deployment and Supabase function secrets.

- **No data in policy/admin pages**  
  Verify user role setup and that expected tables (`analyses`, `profiles`, `country_configs`) are populated.

- **Speech issues in browser**  
  Confirm browser speech recognition support and microphone permissions.

- **Country not appearing in switcher**  
  Ensure the row exists in `country_configs` and uses a valid `iso3`.

## Contributing
1. Create a feature branch.
2. Make your changes with clear commit messages.
3. Run checks:
   - `npm run lint`
   - `npm run build`
4. Open a pull request with:
   - what changed,
   - why it changed,
   - and how it was verified.

## License
No license file is currently included in this repository.  
Add a `LICENSE` file (for example MIT, Apache-2.0, or proprietary) before public distribution.
