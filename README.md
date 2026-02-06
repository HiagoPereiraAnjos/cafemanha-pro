<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1i-kFRm0vnwX9L3EboSxLz-Q9UtOzXBC4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy on Vercel

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, import the project.
3. Build settings:
   `npm run build` and output `dist` (auto-detected by `vercel.json`).
4. Add environment variables (Project Settings):
   `GEMINI_API_KEY` and (optional) `VITE_PUBLIC_BASE_URL` with your production URL.
