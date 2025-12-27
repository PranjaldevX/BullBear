# Deployment Guide for Bull vs Bear Royale on Railway

This guide covers deploying the server to Railway.app and the client to Netlify (recommended).

## Part 1: Deploy Server (Railway)

1.  **Push to GitHub**: Ensure your latest code is pushed.
2.  **Login to Railway**: Go to [Railway.app](https://railway.app/) and login with GitHub.
3.  **New Project**: Click "New Project" -> "Deploy from GitHub repo".
4.  **Select Repository**: Choose your `BullBear` (or equivalent) repository.
5.  **Configure Service**:
    *   Railway usually tries to auto-detect. Since this is a monorepo, we need to configure it.
    *   Click on the tile for your repository to open **Settings**.
    *   **Root Directory**: Set this to `/server`.
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `npm start`
    *   **Watch Paths** (Optional): `/server/**`
6.  **Variables**: Go to the **Variables** tab.
    *   Add `GEMINI_API_KEY`: [Your Google Gemini API Key]
    *   `PORT`: Railway provides this automatically (defaults to dynamic, accessible via `$PORT`). The app listens on `process.env.PORT`, so it should work.
7.  **Generate Domain**:
    *   Go to the **Settings** tab -> **Networking**.
    *   Click "Generate Domain" (e.g., `web-production-1234.up.railway.app`).
    *   **Copy this URL**. Using `https://` is required.

## Part 2: Deploy Client (Netlify)

1.  **Login to Netlify**: Go to [Netlify](https://netlify.com).
2.  **Add New Site**: Import from Git -> GitHub.
3.  **Settings**:
    *   **Base directory**: `client`
    *   **Build command**: `npm run build`
    *   **Publish directory**: `client/dist`
4.  **Environment Variables**:
    *   Add `VITE_SERVER_URL`: Paste the Railway URL from Part 1 (e.g., `https://web-production-1234.up.railway.app`).
    *   *Important*: Ensure no trailing slash (e.g. `...app`, NOT `...app/`).
5.  **Deploy Site**.

## Troubleshooting

*   **CORS Errors**: If you see CORS errors in the browser console, ensure your Client URL is added to the `allowedOrigins` list in `server/src/index.ts` and that you redeployed the server after making that change.
*   **Connection Refused**: Ensure the Server URL in Netlify is correct (starts with `https://`).
