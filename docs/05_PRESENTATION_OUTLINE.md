# 30-Slide Presentation Outline

Every slide maps to features actually implemented in the codebase. Suggested time: ~18–20 min talk + 5–7 min live demo (slides 18–20).

---

### Slide 1 — Title
**CampusAssist AI — Intelligent College Operating System**
Student name · Reg. no · Department · Guide name · Academic year. Tagline: *"From a helpdesk chatbot to a grounded, AI-powered campus OS."*

### Slide 2 — Agenda
Problem → Objectives → Tech stack → Architecture → 7 feature phases → AI design → Demo → Testing → Deployment → Results → Future work.

### Slide 3 — Problem Statement
Students juggle scattered portals for attendance, marks, fees, exams, notices, placements. Generic chatbots hallucinate and can't see a student's own records. Admins lack insight into what students actually ask.

### Slide 4 — Objectives
1. One grounded AI assistant over a student's real data. 2. Proactive dashboards (success, home, placement). 3. Admin knowledge management + analytics. 4. Production-grade security & deployment. 5. A training-data pipeline for future model improvement.

### Slide 5 — Literature / Existing Systems Gap
Rule-based campus bots (no personalization), generic LLM chat (hallucination, no data access), separate ERP modules (no AI). CampusAssist = **RAG over institutional + personal data with citations**.

### Slide 6 — Technology Stack
React 18 + Vite + react-router + GSAP · Node/Express · MongoDB Atlas + Mongoose · JWT + bcrypt · Anthropic Claude (Haiku 4.5) · helmet/cors/rate-limit · Capacitor (Android APK). *(visual logos)*

### Slide 7 — System Architecture
3-tier SPA + AI services layer + Claude. Single Express deployable serving SPA and `/api`. *(insert diagram from `02_SYSTEM_ARCHITECTURE.md`)*

### Slide 8 — Database Design
23 collections; references vs embedding; text indexes for retrieval; `QueryLog` as training corpus. *(insert ER diagram from `03_ER_DIAGRAM.md`)*

### Slide 9 — Security Architecture
JWT auth (`protect`/`adminOnly`), helmet + CSP, CORS allowlist, two-tier rate limiting, bcrypt(12), XSS stripping, append-only audit log.

### Slide 10 — Feature Map (7 Phases)
Timeline graphic: Copilot → Success → Summarizer → Analytics → Home → Placement → Knowledge/Faculty/Training.

### Slide 11 — Phase 1: Campus Copilot
Intent classification → grounded retrieval → Claude generation. Chat history, **source citations**, follow-up suggestions, conversation memory, TTS.

### Slide 12 — AI Workflow (RAG pipeline)
*(insert pipeline diagram from `04_AI_WORKFLOW.md`)* — emphasise "answers only from FACTS" + graceful fallback.

### Slide 13 — Phase 2: Student Success Dashboard
Weighted Success Score (attendance 30 / academics 40 / placement 20 / engagement 10), risk indicators, AI recommendations, SVG trend charts.

### Slide 14 — Phase 3: Smart Notice Summarizer
On create/update, AI extracts summary, key dates, action items, priority — shown to students & admins.

### Slide 15 — Phase 4: AI Analytics Dashboard
Admin view from `QueryLog`: total queries, resolution rate, top questions, intent mix, peak hours, knowledge gaps.

### Slide 16 — Phase 5: Personalized Home
AI daily briefing + 10 widgets (exam countdown, attendance alert, placement, smart notices, recent Copilot, recommendations, insights). Glassmorphism, dark mode.

### Slide 17 — Phase 6: Placement Hub
Readiness score, company eligibility checker, skill-gap analysis, resume strength score, recommendation engine, interview-prep assistant, trend charts, Copilot integration.

### Slide 18 — Phase 7: Knowledge Base + Faculty Directory
Admin uploads regulations/handbooks/policies/FAQs (10 categories); Copilot cites **document + section**; Faculty directory answers "who teaches X / who is the HOD".

### Slide 19 — Phase 7: Feedback & Training-Data Pipeline
👍/👎 on every answer → labelled `QueryLog` examples → analytics: most/least helpful, dataset size, intent distribution, missing knowledge areas. *(future fine-tuning foundation)*

### Slide 20 — 🎬 LIVE DEMO
Student login → Home briefing → Copilot (records + faculty + KB citation) → 👍 → Success → Placement → Admin (Knowledge upload, Faculty, Analytics). *(see `06_DEMO_SCRIPT.md`)*

### Slide 21 — Engineering Highlights
Thin routes + 5 reusable AI engines; `successEngine` reused by 4 features; dependency-free SVG charts; additive, backward-compatible schema evolution.

### Slide 22 — Graceful AI Degradation
Live mode (Claude prose) vs fallback (deterministic retrieval/heuristic) — app fully works without an API key. Reliability for demos & cost control.

### Slide 23 — Testing Strategy
5 backend unit tests (CGPA weighting, fee verification, auth, success scoring) all passing; 337-case Selenium E2E audit suite + GitHub Actions; live API smoke tests per phase.

### Slide 24 — Mobile (Capacitor)
Android APK built & device-tested on Android 15 against the live API; same React codebase, no UI fork.

### Slide 25 — Deployment
Render web service; `postinstall` builds the frontend; Express serves `dist` + `/api` with SPA fallback; env-managed secrets (MONGO_URI, JWT_SECRET, ANTHROPIC_API_KEY). *(note branch-deploy step — slide 28)*

### Slide 26 — Results / Metrics
23 models · 23 APIs · 5 AI engines · 24 pages · 17 admin tabs · 7 phases. Demo: success score 74, placement readiness 82, Copilot grounds & cites faculty + KB.

### Slide 27 — Challenges & Solutions
Hallucination → RAG + citations. API cost/availability → graceful fallback. Stored XSS → input stripping. Trend data → daily success snapshots. Branch deploy → documented merge step.

### Slide 28 — Limitations & Honest Status
Keyword (not vector) retrieval; base64 file storage (not object store); live site serves pre-AI `main` — AI phases on `demo-branch` await merge/deploy.

### Slide 29 — Future Work
Atlas Vector Search (embeddings already reserved), real PDF text extraction, fine-tune on collected dataset, push notifications, iOS build, multi-language.

### Slide 30 — Conclusion & Thank You
A production-grade, secure, grounded AI campus OS spanning 7 phases. Q&A. Repo + live URL + demo credentials.
