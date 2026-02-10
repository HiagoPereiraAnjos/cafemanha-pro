
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1i-kFRm0vnwX9L3EboSxLz-Q9UtOzXBC4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. (Optional) Set Supabase vars if you want cloud persistence:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_TABLE`
   Default table name used by the app is `guests`.
4. If you are using Supabase for the first time, run:
   `supabase/guests_table.sql` in Supabase SQL Editor.
5. Run the app:
   `npm run dev`

## Deploy on Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, import the project.
3. Build settings:
   `npm run build` and output `dist` (auto-detected by `vercel.json`).
4. Add environment variables (Project Settings):
   `GEMINI_API_KEY`, `VITE_PUBLIC_BASE_URL` (optional), `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_TABLE` (optional).
