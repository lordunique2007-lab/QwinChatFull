# QwinCHAT Backend 🚀
### Global, real, multi-user backend — Created by Qwin Grace

This is the **real backend** that makes QwinCHAT work for anyone in the world — not a demo. It includes:

- ✅ Real user accounts stored in Supabase (PostgreSQL)
- ✅ Real OTP login via SMS (Twilio) or Email
- ✅ Real-time messaging via WebSocket (Socket.IO)
- ✅ Real JWT authentication & sessions
- ✅ Groups, Channels, Stories, Calls — all persisted
- ✅ Full Admin Panel backend with all 60 powers
- ✅ QwinAI powered by real Claude API
- ✅ Push notifications via Firebase
- ✅ Rate limiting & security (anti-spam, anti-DDoS)

---

## ⚠️ IMPORTANT SECURITY NOTE

**Never share your `.env` file, passwords, or API keys with anyone — including in chat with any AI.**

This backend uses **OTP-only login** (no passwords stored anywhere) for maximum security. Your admin account is created using a script that runs **only on your own computer** — your credentials never leave your machine.

---

## 🚀 Setup Instructions (Step by Step)

### Step 1 — Create your Supabase project
1. Go to **supabase.com** → New Project
2. Wait ~2 minutes for it to provision
3. Go to **SQL Editor** → paste the entire contents of `database/schema.sql` → Run
4. Go to **Settings → API** → copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role` key (NOT anon key) → this is your `SUPABASE_SERVICE_KEY`

### Step 2 — Set up your environment file
```bash
cp .env.template .env
```
Open `.env` in a text editor and fill in:
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (from Step 1)
- `JWT_SECRET` — generate one by running: `openssl rand -hex 64`
- `FRONTEND_URL` — your Vercel URL once deployed

### Step 3 — Set up OTP delivery (choose one or both)

**Option A: SMS via Twilio**
1. Go to **twilio.com** → sign up free
2. Get a free trial phone number
3. Copy `Account SID`, `Auth Token`, and phone number into `.env`

**Option B: Email via Gmail**
1. Go to your Google Account → Security → App Passwords
2. Generate an app password for "Mail"
3. Put your Gmail address + app password into `.env`

### Step 4 — Create your Owner Admin Account (Qwin Grace)
This runs locally on YOUR computer only:
```bash
npm install
node scripts/seed-admin.js
```
Follow the prompts. This creates your Global Super Administrator account directly in your database. **Nothing is shared with anyone.**

### Step 5 — Deploy to Railway
1. Go to **railway.app** → New Project → Deploy from GitHub
2. Upload this `qwinchat-backend` folder to a GitHub repo first
3. Connect the repo in Railway
4. Go to **Variables** tab → paste in all values from your `.env` file
5. Railway auto-detects NestJS and deploys
6. Copy your live backend URL (e.g. `https://qwinchat-backend.up.railway.app`)

### Step 6 — Connect your frontend
In your QwinCHAT frontend (the React app), update the API URL:
```javascript
const API_URL = 'https://your-backend.up.railway.app/api/v1';
const SOCKET_URL = 'https://your-backend.up.railway.app';
```
Redeploy your frontend on Vercel.

---

## 🔑 How Login Works (No Passwords!)

QwinCHAT uses **OTP-only authentication** for security:

1. User enters phone or email
2. Backend sends 6-digit code via SMS/Email
3. User enters code → verified
4. Backend issues JWT token → user logged in

Your admin account (Qwin Grace) works the same way — you log in with your phone/email + OTP, and the system recognizes you as Owner automatically because of the role set during seeding.

---

## 📡 API Endpoints Overview

| Category | Endpoint | Description |
|----------|----------|--------------|
| Auth | `POST /api/v1/auth/send-otp` | Send verification code |
| Auth | `POST /api/v1/auth/verify-otp` | Verify code |
| Auth | `POST /api/v1/auth/register` | Create account |
| Auth | `POST /api/v1/auth/login` | Login existing user |
| Users | `GET /api/v1/users/me` | Get my profile |
| Chats | `GET /api/v1/chats` | Get my chat list |
| Messages | `GET /api/v1/messages/chat/:id` | Get chat messages |
| Groups | `POST /api/v1/groups` | Create group |
| Channels | `GET /api/v1/channels/discover` | Discover channels |
| Stories | `GET /api/v1/stories/feed` | Get stories feed |
| Admin | `GET /api/v1/admin/stats` | Platform statistics |
| Admin | `POST /api/v1/admin/users/:id/ban/permanent` | Ban user |
| AI | `POST /api/v1/ai/chat` | Chat with QwinAI |

**WebSocket events:** `message:send`, `message:new`, `typing:start`, `call:initiate`, and more — see `src/gateway/app.gateway.ts`

---

## 🗄️ Database Tables Created

users, otps, sessions, chats, chat_members, messages, message_receipts, message_reactions, stories, story_views, channels, channel_subscriptions, communities, contacts, call_logs, referrals, reports, audit_logs, verification_requests, premium_subscriptions, daily_rewards

---

## 👑 Your 60 Admin Powers

All 60 powers from your original spec are implemented in `src/admin/admin.service.ts` and exposed via `src/admin/admin.controller.ts`. Every action is logged to `audit_logs` automatically.

---

## 🧪 Local Testing

```bash
npm install
npm run start:dev
```
Backend runs at `http://localhost:3001`

---

## 🌍 You're Going Global

Once deployed:
- Anyone, anywhere can sign up with their real phone/email
- Messages are stored permanently and sync in real-time
- You (Qwin Grace) have full administrative control
- Everything scales automatically with Railway + Supabase

---

**Created by Qwin Grace** · Global Super Administrator
