# CampusAssist — Demo Script

**For:** Final project demonstration (web or Android APK)
**Date:** 2026-06-13
**Live URL:** `https://college-helpdesk-chatbot-l4bk.onrender.com`

---

## ⚠️ Before You Start (read this first)

1. **Wake the backend ~3–5 minutes before demoing.** Render's free tier sleeps; the first
   request after idle takes 20–30 s. Open the site or the app once beforehand so the
   server is warm.
2. **Have two logins ready:**
   - A **student** account (e.g. student ID `192221001`).
   - The **admin** account (`ADMIN01`).
   - Keep the passwords on a sticky note — don't fumble at the podium.
3. **Pick your surface:** demo on the **web** (projector-friendly) or the **Android APK**
   (shows it's a real mobile app). The flow is identical. If on Android, install the APK
   beforehand and confirm internet is on.
4. **Have a fallback:** if Wi-Fi fails, screenshots in `device-screenshots/final/` and the
   `react-e2e-*.png` files show every screen working.
5. **One-line pitch to open with:**
   > "CampusAssist is a full-stack web and Android app that turns a college helpdesk into a
   > single student portal — with an AI chatbot, request tracking, and an admin panel —
   > running live on the cloud."

---

# PART A — 5-Minute Demo Flow

> Target: ~5 minutes. Keep moving; don't read every screen. Hit the seven beats below.

### Step 1 — Login (≈ 30 s)
- **What to click:** Open the app → on the landing page click **Login** → enter the
  **student** ID and password → **Login**.
- **What to explain:** "Authentication is **JWT-based**. The password is checked against a
  **bcrypt hash** on the server; on success the server returns a signed token the app
  stores and sends with every request."
- **Expected output:** Redirect to the **Dashboard**; a welcome message with the student's name.
- **Key talking points:** stateless JWT · bcrypt (cost 12) · role decides what you see next.

### Step 2 — Dashboard (≈ 30 s)
- **What to click:** Land on the dashboard; point to the **stat cards** and quick links.
- **What to explain:** "These numbers are **live from MongoDB** via an authenticated API
  call — not hard-coded. Every card is a real database read."
- **Expected output:** Stat cards populated; navigation (bottom nav on mobile / sidebar on web) visible.
- **Key talking points:** live data · single dashboard for all services · responsive UI.

### Step 3 — Requests (≈ 50 s)
- **What to click:** Go to **Requests** → **New Request** → pick a type (e.g. *Bonafide
  Certificate*), enter a purpose, choose urgency → **Submit** → show it appear in "My Requests".
- **What to explain:** "The student raises a certificate request; the backend assigns a
  **unique sequential reference number** like `BC-2026-0007` using an **atomic counter**,
  so two requests can never collide. The status moves through six stages, all tracked."
- **Expected output:** New request card with a reference number and status **Submitted**.
- **Key talking points:** request lifecycle · atomic ref numbers · status tracking · this is the core problem we solve.

### Step 4 — Chatbot (≈ 50 s)
- **What to click:** Open **Chat** (chat icon / FAB) → type **"When do exams start?"** →
  then **"How do I get a bonafide certificate?"**
- **What to explain:** "The chatbot is powered by the **Anthropic Claude API** with a
  college-specific prompt. If the AI is ever unavailable, it **falls back to a built-in
  knowledge base**, so it always answers — that's a deliberate reliability design."
- **Expected output:** Concise, relevant answers (exam dates; directs to the Requests page for bonafide).
- **Key talking points:** real AI integration · graceful fallback · 24×7 helpdesk · token/length limits for safety.

### Step 5 — Profile (≈ 30 s)
- **What to click:** Go to **Profile** → show details → edit a field (e.g. phone) → **Save**.
- **What to explain:** "Students manage their own profile — personal and parent details and
  a photo. Updates go through an authenticated `PUT` and are validated server-side."
- **Expected output:** "Profile updated successfully" confirmation; the new value persists.
- **Key talking points:** self-service · server-side validation · per-user data isolation.

### Step 6 — Admin Features (≈ 60 s)
- **What to click:** **Log out**, then log in as **ADMIN01** → land on the **Admin overview**
  → open the **Requests** tab → change the status of the request you created in Step 3
  (e.g. to *Processing*).
- **What to explain:** "Admins get a completely different view, gated by **role-based
  authorization** — the `adminOnly` middleware. The same request the student just raised
  now appears here, and updating its status flows back to the student instantly."
- **Expected output:** Admin overview stats; Requests tab lists live requests; status update succeeds.
- **Key talking points:** RBAC · end-to-end workflow (student → admin → student) · one admin panel for 9 modules.

### Step 7 — Logout (≈ 20 s)
- **What to click:** **Logout**.
- **What to explain:** "Logout clears the stored token and redirects to login. With no
  valid token, every protected API call is rejected with a 401."
- **Expected output:** Back on the **Login** page; protected pages are no longer accessible.
- **Key talking points:** clean session teardown · token invalidation on the client · security closes the loop.

**Closing line:** "So that's CampusAssist — one secure platform, web and Android, that
takes a student request from raised to resolved, with an AI assistant alongside, running
live on the cloud."

---

# PART B — 10-Minute Detailed Demo

> Same seven beats, expanded with the *why* behind each, plus a short architecture intro
> and a mobile moment. Use this when you have a full slot and want to show depth.

### 0. Opening & architecture (≈ 60 s)
- Show the **live URL** loading (already warm).
- One sentence each: "**React + Vite** frontend · **Express + Node** backend · **MongoDB
  Atlas** database · **JWT** auth · **Claude** chatbot · deployed on **Render** · same
  build wrapped with **Capacitor** into an **Android APK**."
- If on a phone: hold it up — "this is the *same* React code running natively."

### 1. Login & the auth story (≈ 75 s)
- Log in as the student.
- Explain the full flow: "Credentials → server looks up the student ID → **bcrypt.compare**
  → if valid, **jwt.sign** a 30-day token → client stores it in localStorage → it's sent as
  a **Bearer** header on every call → the `protect` middleware verifies it server-side."
- Mention security depth: "Passwords are hashed with cost 12 and **never** returned to the
  client; the User model strips them in `toJSON`."
- (Optional) Try a wrong password once to show the "Invalid Student ID or password" guard.

### 2. Dashboard & live data (≈ 60 s)
- Walk the stat cards. "Each is an **authenticated** API call to MongoDB — open the network
  tab if you like; every request carries the Bearer token and returns real data."
- Show responsive layout (resize the browser or rotate the phone): "mobile-first, with a
  bottom nav on mobile and a sidebar on desktop."

### 3. Requests — the core workflow (≈ 90 s)
- Create a request end-to-end. Read out the generated reference number.
- Explain the design: "Reference numbers come from an **atomic Counter** collection using
  `findByIdAndUpdate` with `$inc` and `upsert` — concurrency-safe, sequential, no
  duplicates. The status enum has six stages from *Submitted* to *Completed/Rejected*."
- Tie back to the problem: "This is exactly the pain point — a student used to have no way
  to *track* a marksheet or bonafide request. Now they have a ref number and a live status."

### 4. Chatbot — AI with a safety net (≈ 90 s)
- Ask 2–3 questions: an exam question, a fees question, a "help" command.
- Explain: "Backend route calls **Claude (`claude-haiku-4-5`)** with a constrained system
  prompt — concise answers, *no inventing student data*, capped at 300 tokens, message
  length capped at 1000 characters."
- Highlight the fallback: "If the API key is missing or the call fails, a **keyword
  knowledge base** answers instead — the chatbot degrades gracefully rather than breaking."

### 5. Profile & self-service (≈ 45 s)
- Edit and save a field; change a parent detail.
- "All writes are authenticated and validated server-side; a student can only ever edit
  **their own** record because the update is keyed to the token's user id."

### 6. Admin panel — depth (≈ 120 s)
- Log out, log in as admin. Tour the **overview**, then 2–3 tabs (Requests, Students, Notices).
- Process the student's request (change status) and, if time allows, **post a notice**.
- Explain RBAC: "Every admin route passes through `adminOnly`; a student token hitting an
  admin endpoint gets a **403**. The student and admin see entirely different apps from the
  same codebase — driven purely by the `role` field."
- Mention scale: "The admin panel manages nine modules — students, requests, leaves,
  notices, exams, attendance, events, timetable, messages — plus CSV/SQL export of the
  student directory."

### 7. Logout & security wrap-up (≈ 45 s)
- Log out; try to hit a protected page → bounced to login.
- Recap the security layers in one breath: "**Helmet CSP, CORS allowlist, rate limiting,
  input validation, bcrypt, JWT, role-based access, HTTPS/TLS, minimal Android
  permissions** — defence in depth."

### Closing (≈ 30 s)
- "CampusAssist is feature-complete, deployed live, and ships as a real Android app. It
  takes a request from raised to resolved, has an AI assistant, and is built with
  production-grade security. Future work: release-signed app on the Play Store, push
  notifications, and online fee payments. Happy to take questions."

---

## Quick Demo Checklist (print this)

- [ ] Backend warmed up (opened site 3–5 min before)
- [ ] Student login works
- [ ] Admin login works
- [ ] Network/Wi-Fi confirmed
- [ ] APK installed (if demoing on phone)
- [ ] Fallback screenshots open in a tab (`device-screenshots/final/`, `react-e2e-*.png`)
- [ ] One request pre-thought-out (type + purpose) so you don't pause
- [ ] Two chatbot questions ready
- [ ] Know your three numbers: ports/stack/versions if asked
