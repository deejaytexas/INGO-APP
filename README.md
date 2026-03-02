# Kirya Delivery — Supabase Realtime Edition

Real-time delivery tracking for Mbale, Uganda.
No Node.js server required — pure frontend + Supabase.

────────────────────────────────────────────────────────────
STEP 1 — Create a free Supabase project (2 minutes)
────────────────────────────────────────────────────────────

1. Go to https://supabase.com and sign up (free)
2. Click "New project", give it a name (e.g. kirya-delivery)
3. Wait ~1 minute for it to provision

STEP 2 — Run the database setup SQL
────────────────────────────────────────────────────────────

1. In your Supabase dashboard, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the file:  supabase/setup.sql  in this project
4. Copy the entire contents and paste into the SQL editor
5. Click "Run" (green button)
   → You should see: "Success. No rows returned"

This creates the riders, orders, and chat_messages tables
and enables Realtime on all of them.

STEP 3 — Get your API keys
────────────────────────────────────────────────────────────

1. In Supabase dashboard → Settings (gear icon) → API
2. Copy:
   - "Project URL"       → this is your VITE_SUPABASE_URL
   - "anon / public" key → this is your VITE_SUPABASE_ANON_KEY

STEP 4 — Configure the app
────────────────────────────────────────────────────────────

1. In this project folder, copy the example env file:
      Windows:  copy .env.example .env
      Mac/Linux: cp .env.example .env

2. Open .env in any text editor (Notepad is fine) and fill in:
      VITE_SUPABASE_URL=https://your-project-id.supabase.co
      VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your-key...

STEP 5 — Run locally (requires Node.js, or use online deploy below)
────────────────────────────────────────────────────────────

   npm install
   npm run dev

Open http://localhost:3000 in your browser.
Test across devices: open the same URL on your phone
(replace localhost with your computer's IP address).

DEPLOY ONLINE — No Node.js install needed at all
────────────────────────────────────────────────────────────

Option A: Netlify Drop (easiest — drag and drop, no account needed)
  1. Run: npm run build   (creates a "dist" folder)
     If you don't have Node.js, use an online IDE:
     - Go to https://stackblitz.com
     - Import this folder
     - Run npm install && npm run build in the terminal
  2. Go to https://netlify.com/drop
  3. Drag the "dist" folder onto the page
  4. You get a live URL instantly!
  5. In Netlify site settings → Environment variables, add:
       VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
  6. Trigger a redeploy

Option B: Vercel (also free)
  1. Push this folder to GitHub
  2. Go to https://vercel.com → Import project → select repo
  3. Add the two VITE_ environment variables in the Vercel dashboard
  4. Click Deploy → live in ~30 seconds

Option C: Use StackBlitz directly (zero install, runs in browser)
  1. Go to https://stackblitz.com/github/YOUR_GITHUB_USERNAME/YOUR_REPO
  2. It runs entirely in your browser
  3. Add .env variables in StackBlitz settings

────────────────────────────────────────────────────────────
HOW REAL-TIME WORKS (Supabase Broadcast)
────────────────────────────────────────────────────────────

Supabase Broadcast sends messages between browser tabs/devices
instantly through a named "channel" — no server needed.

  Rider goes online     → broadcasts to channel "kirya:riders"
  Rider moves (GPS)     → broadcasts rider_location every ~1s
  Rider taps "At Shop"  → broadcasts rider_status
  Admin assigns order   → broadcasts to channel "kirya:orders"
  User/Rider chat       → broadcasts to channel "kirya:chat"

All three views (User, Rider, Admin) subscribe to these channels
and update their UI the moment any message arrives.

GPS positions and task statuses are ALSO written to the Supabase
database so they persist between sessions and page refreshes.
