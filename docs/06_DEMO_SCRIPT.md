# Demo Walkthrough Script (5–7 minutes)

**Goal:** show grounded AI, personalization, and admin knowledge management — end to end.

### Pre-demo checklist (do before you present)
- [ ] Backend running and DB connected (local `node backend/server.js`, or the deployed URL **after** merging `demo-branch` — see `09_DEPLOYMENT_READINESS.md`).
- [ ] Seed data loaded: `node backend/scripts/seed-success-demo.js` **and** `node backend/scripts/seed-knowledge-demo.js`.
- [ ] (Optional, for live Claude prose) `ANTHROPIC_API_KEY` set; otherwise the grounded fallback still demos perfectly — mention this proactively.
- [ ] Two browser tabs ready: Student and Admin. Credentials: **22IT101 / student123**, **ADMIN01 / admin@123**.
- [ ] Dark mode on (default) for the glassmorphism look.

---

## Script

### [0:00–0:30] Hook & login
> "CampusAssist AI turns a college helpdesk into a grounded AI assistant that answers from each student's *real* records — with citations, never hallucinations."

Log in as **22IT101**. You land on the **Personalized Home**.

### [0:30–1:30] Personalized Home (Phase 5)
- Point to the **AI Daily Briefing** ("Good afternoon, Sneka… success score 74…").
- Walk the widgets: **exam countdown**, **attendance alert** (Computer Networks 69% flagged), **placement readiness 82**, **smart notices**, **insights trends**.
> "This is assembled server-side by reusing our Success Engine — one source of truth across the app."

### [1:30–3:00] Campus Copilot (Phases 1, 2, 7) — the centerpiece
Open **Campus Copilot**. Ask in sequence:
1. **"What is my attendance percentage?"** → grounded answer + 📊 **source chip**.
> "Notice the source citation — every fact is traceable."
2. **"Who teaches Machine Learning?"** → cites **Faculty: Dr. Arun Prakash** (Phase 7 faculty directory).
3. **"What is the attendance condonation policy?"** → cites **Attendance Regulations 2026 · §4 Condonation Policy** (Phase 7 knowledge document, with **section reference**).
4. Click a **follow-up pill** to show conversation memory.
5. Click **👍** on an answer.
> "That thumbs-up just became a labelled training example for future fine-tuning."

### [3:00–3:45] Success Dashboard (Phase 2)
Open **Success Dashboard**: ring gauge (74), sub-scores, **risk indicators**, **AI recommendations**, trend charts.
> "Deterministic, explainable scoring — attendance 30%, academics 40%, placement 20%, engagement 10%."

### [3:45–4:45] Placement Hub (Phase 6)
Open **Placement Hub**:
- **Readiness 82** + component bars; **Resume Strength 77 (Competitive)**.
- **Company Eligibility Checker** — toggle "Eligible only" (7/10 eligible; Amazon/Freshworks locked on CGPA).
- **Skill-Gap Analysis** matrix and **Recommended Companies** (Cognizant 92% match).
- **Interview Prep** tracks.

### [4:45–6:15] Admin side (Phases 3, 4, 7)
Switch to the **Admin** tab, log in as **ADMIN01**.
- **Knowledge Base** tab → upload/add a document (title, category, section, content) → show it appears instantly.
- Switch to **Knowledge Analytics** sub-view → **training dataset size**, **helpful rate**, **intent distribution**, **most-accessed documents**, **missing knowledge areas**.
- **Faculty Directory** tab → show the seeded faculty (HOD starred); add one live.
- **AI Analytics** tab → top questions, resolution rate, peak hours, knowledge gaps.
- **Notices** tab → create a notice and show the **AI summary / key dates / action items** auto-generated (Phase 3).

### [6:15–7:00] Close
> "Same React codebase ships as an Android APK via Capacitor. Everything is JWT-secured, rate-limited, audit-logged, and falls back gracefully if the AI API is unavailable. Seven phases — from chatbot to a grounded campus operating system."

Return to the Title slide. **Q&A.**

---

## Fallback talking points (if something fails live)
- **AI gives the 'Here's what I found' format** → "We're in graceful-fallback mode without an API key — the answer is still fully grounded and cited; with the key set on Render, Claude rewrites it in natural prose."
- **Cold start / slow first request** → "Render's free tier sleeps; the first request wakes it (~30–50s)." (Hit the URL once before presenting.)
- **Empty dashboard** → re-run the two seed scripts.
- **Network down** → fall back to the screenshots in the report appendix.
