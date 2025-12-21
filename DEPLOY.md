# Deployment Guide for Bull vs Bear Royale

This application has two parts:
1.  **Client (Frontend)**: React application (Deploy to Netlify).
2.  **Server (Backend)**: NodeJS + Socket.io application (Deploy to Render/Railway).

## Part 1: Deploy Server (Render.com)

1.  Push your code to GitHub.
2.  Go to [Render.com](https://render.com) and creating a new **Web Service**.
3.  Connect your GitHub repository.
4.  Settings:
    *   **Root Directory**: `server`
    *   **Build Command**: `npm install && npm run build`
        *   (If you get TS errors, just `npm install` and run `npx ts-node src/index.ts` as Start Command for simplicity, or fix them. Better: `npm install && npm install typescript -g && tsc`)
    *   **Start Command**: `node dist/index.js` (if built) OR `npx ts-node src/index.ts`
    *   **Environment Variables**:
        *   `GEMINI_API_KEY`: [Your Google Gemini API Key]
        *   `PORT`: `10000` (Render sets this automatically, but good to know)

5.  Deploy. Wait for it to go live.
6.  **Copy the Server URL** (e.g., `https://bvb-server.onrender.com`).

## Part 2: Deploy Client (Netlify)

1.  Go to [Netlify](https://netlify.com) and "Add new site" -> "Import from Git".
2.  Connect your GitHub repository.
3.  Settings:
    *   **Base directory**: `client`
    *   **Build command**: `npm run build`
    *   **Publish directory**: `client/dist` (or just `dist` if Base dir is set)
4.  **Environment Variables**:
    *   `VITE_SERVER_URL`: [Paste the Server URL from Part 1] (e.g., `https://bvb-server.onrender.com`)
    *   *Note: Remove any trailing slash from the URL.*

5.  Deploy.

## Part 3: Verify

1.  Open your Netlify URL.
2.  If it says "Connecting..." check the console. It should say "Connecting to [Your Render URL]".
3.  Once connected, the game Lobby will appear.
