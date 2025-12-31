# 🚀 Deployment Guide - Bull vs Bear Royale

## Overview
- **Frontend**: Netlify (React + Vite)
- **Backend**: Render (Node.js + Socket.io)

---

## Step 1: Deploy Backend to Render

### 1.1 Create Render Account
1. Go to [render.com](https://render.com) and sign up
2. Connect your GitHub account

### 1.2 Create New Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `bull-bear-server` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### 1.3 Set Environment Variables
In Render dashboard, add these environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `GEMINI_API_KEY` | Your Gemini API key (optional) |

### 1.4 Deploy
Click **"Create Web Service"** and wait for deployment.

📝 **Note your Render URL**: `https://bull-bear-server.onrender.com`

---

## Step 2: Deploy Frontend to Netlify

### 2.1 Create Netlify Account
1. Go to [netlify.com](https://netlify.com) and sign up
2. Connect your GitHub account

### 2.2 Create New Site
1. Click **"Add new site"** → **"Import an existing project"**
2. Select your GitHub repository
3. Configure build settings:

| Setting | Value |
|---------|-------|
| **Base directory** | `client` |
| **Build command** | `npm install && npm run build` |
| **Publish directory** | `client/dist` |

### 2.3 Set Environment Variables
Before deploying, add this environment variable:

| Key | Value |
|-----|-------|
| `VITE_SERVER_URL` | `https://bull-bear-server.onrender.com` |

⚠️ **Important**: Replace with YOUR actual Render URL from Step 1.4

### 2.4 Deploy
Click **"Deploy site"** and wait for deployment.

---

## Step 3: Update CORS (Optional)

After both are deployed, update the server's CORS settings:

1. Go to Render dashboard
2. Add environment variable:
   - `FRONTEND_URL` = `https://your-site.netlify.app`

---

## 🎮 Testing Your Deployment

1. Open your Netlify URL in browser
2. Enter a player name and start playing!
3. Open in another browser/incognito for multiplayer

---

## Troubleshooting

### WebSocket Connection Failed
- Check that `VITE_SERVER_URL` is set correctly in Netlify
- Ensure the URL uses `https://` not `http://`
- Check Render logs for errors

### CORS Errors
- Verify your Netlify URL is in the allowed origins
- Check browser console for specific error messages

### Server Sleeping (Free Tier)
- Render free tier sleeps after 15 min of inactivity
- First request may take 30-60 seconds to wake up
- Consider upgrading for always-on service

---

## Local Development

```bash
# Install dependencies
npm install

# Run both client and server
npm run dev

# Or run separately:
cd client && npm run dev
cd server && npm run dev
```

---

## Environment Variables Summary

### Client (Netlify)
| Variable | Description |
|----------|-------------|
| `VITE_SERVER_URL` | Backend WebSocket URL |

### Server (Render)
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (auto-set by Render) |
| `GEMINI_API_KEY` | Google Gemini API key (optional) |
| `FRONTEND_URL` | Netlify URL for CORS (optional) |

---

## 📝 Notes

- **Free Tier Limitations**: Both Render and Netlify free tiers have limitations
- **Cold Starts**: Render free tier may have 30-60s cold start delay
- **WebSocket**: Make sure your Render service supports WebSocket connections

Happy Trading! 🐂🐻
