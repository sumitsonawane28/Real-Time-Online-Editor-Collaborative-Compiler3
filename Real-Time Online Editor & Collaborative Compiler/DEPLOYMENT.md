# NexusCode — Deployment Guide

## Architecture

```
Browser  ──►  Vercel (React frontend)
                │
                ├── REST API calls  ──►  Render (Node/Express backend)
                └── Socket.IO WS   ──►  Render (same backend)
                                          │
                                          └── MongoDB Atlas
```

---

## Step 1 — Set up MongoDB Atlas (free)

1. Go to https://cloud.mongodb.com and create a free cluster.
2. Under **Database Access**, create a user with read/write permissions.
3. Under **Network Access**, add `0.0.0.0/0` (allow all IPs — required for Render).
4. Click **Connect → Drivers** and copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/nexuscode
   ```

---

## Step 2 — Deploy Backend on Render

1. Push your code to GitHub (make sure `backend/` folder is included).
2. Go to https://render.com → **New → Web Service**.
3. Connect your GitHub repo.
4. Configure:
   | Field | Value |
   |---|---|
   | **Root Directory** | `backend` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
5. Under **Environment Variables**, add:
   ```
   NODE_ENV          = production
   PORT              = 5000
   MONGO_URI         = mongodb+srv://...  (your Atlas URI)
   JWT_SECRET        = (generate: openssl rand -base64 32)
   ALLOWED_ORIGINS   = https://your-app.vercel.app
   ```
6. Click **Deploy**. Once live, copy the URL:
   ```
   https://nexuscode-backend.onrender.com
   ```

> **Note:** Render free tier spins down after 15 min of inactivity.
> Upgrade to a paid plan for always-on or use Railway instead.

---

## Step 3 — Deploy Frontend on Vercel

1. Go to https://vercel.com → **New Project**.
2. Import your GitHub repo.
3. Configure:
   | Field | Value |
   |---|---|
   | **Framework Preset** | `Vite` |
   | **Root Directory** | `.` (project root) |
   | **Build Command** | `npm run build` |
   | **Output Directory** | `dist` |
4. Under **Environment Variables**, add:
   ```
   VITE_BACKEND_URL = https://nexuscode-backend.onrender.com
   GEMINI_API_KEY   = (optional, your Gemini key)
   ```
5. Click **Deploy**. Copy your Vercel URL:
   ```
   https://nexuscode.vercel.app
   ```

---

## Step 4 — Connect Frontend ↔ Backend

Go back to your **Render** service → **Environment** and update:
```
ALLOWED_ORIGINS = https://nexuscode.vercel.app
```
Then **redeploy** the backend (Manual Deploy → Deploy Latest Commit).

---

## Step 5 — Verify

- Open `https://nexuscode.vercel.app`
- Open DevTools → Network tab
- You should see:
  - `POST https://nexuscode-backend.onrender.com/api/auth/login` → 200
  - WebSocket connection to `wss://nexuscode-backend.onrender.com` → 101

---

## Alternative: Deploy Backend on Railway

1. Go to https://railway.app → **New Project → Deploy from GitHub**.
2. Select your repo, set **Root Directory** to `backend`.
3. Railway auto-detects Node.js and runs `npm start`.
4. Add the same environment variables as Render above.
5. Railway provides a domain like `nexuscode-backend.up.railway.app`.

---

## Local Development (after deployment)

Create `.env.local` in the project root:
```
VITE_BACKEND_URL=http://localhost:5000
```

Create `backend/.env`:
```
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
MONGO_URI=mongodb://localhost:27017/nexuscode
JWT_SECRET=dev_secret_only
```

Then:
```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
npm run dev
```

---

## Environment Variables Reference

### Frontend (Vercel)
| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Yes | Full URL of your backend, e.g. `https://nexuscode-backend.onrender.com` |
| `GEMINI_API_KEY` | No | Gemini AI key for the AI assistant panel |

### Backend (Render / Railway)
| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | Port to listen on (Render sets this automatically) |
| `NODE_ENV` | Yes | Set to `production` |
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Random secret for JWT signing |
| `ALLOWED_ORIGINS` | Yes | Comma-separated Vercel domains, e.g. `https://nexuscode.vercel.app` |
