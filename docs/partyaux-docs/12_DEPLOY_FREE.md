# 12 — Free Deployment

## Option 1 (recommended): Cloudflare Pages (free, allows commercial use)
1. Push the repo to GitHub.
2. Cloudflare dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git -> pick the repo.
3. Build settings: Framework preset "Vite" (or Build command `npm run build`, Output directory `dist`).
4. Environment variables (Production): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (leave empty if no telemetry/rooms yet).
5. Deploy. You get `https://<project>.pages.dev`.
6. Make sure `public/_redirects` exists with `/*  /index.html  200` so deep links like `/play` and `/join/ABC123` work.

## Option 2: Vercel Hobby (free, NON-commercial use only)
Import the repo, Vite preset, same env vars. Add `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

## Option 3: GitHub Pages
Works but needs `base` set in `vite.config.ts` and a 404.html redirect trick. Prefer Option 1.

## Supabase (free) setup, for telemetry and rooms
1. supabase.com -> New project (free plan).
2. SQL Editor -> paste the SQL from doc 04 section 5 -> Run.
3. Project Settings -> API: copy `Project URL` and `anon public` key into `.env.local` and Cloudflare env vars.
4. Realtime is on by default; no extra setup for Broadcast.
5. GitHub repo -> Settings -> Secrets: add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (the service role key is secret; never put it in the frontend or in `VITE_` variables).
6. Free projects pause after about a week of inactivity -> keep the `keepalive.yml` weekly cron.

## After deploy checklist
- [ ] Open the live URL on a phone and run the wizard
- [ ] Open `/join/TEST12` shows a friendly "room not found" (not a blank page)
- [ ] Check browser console: no errors, no failed requests except intentionally blocked ones
- [ ] Share the link with 2 friends and watch the `events` table fill

## Cost summary
Hosting 0, database 0, realtime 0, CI 0, domain 0 (use the provided subdomain). The only cost is time.

## Legal reminder (put in a README section)
- YouTube mode uses the official IFrame Player; it must keep the player visible and unmodified. Hobby use only.
- Local mode: users play files they own. Nothing is uploaded.
