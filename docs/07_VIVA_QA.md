# 50 Viva Questions & Answers

Grouped: General/Architecture (1–10), AI/Copilot (11–22), Database (23–30), Security (31–37), Frontend (38–43), Testing/Deployment (44–50). Answers reflect the actual implementation.

## A. General & Architecture

**1. What is CampusAssist AI in one line?**
A grounded, AI-powered college operating system: a single React + Express + MongoDB app where a Campus Copilot answers from each student's real records (with citations), backed by success, home, placement and knowledge dashboards.

**2. Why is it called "grounded" AI?**
Because the Copilot answers *only* from facts retrieved from the database and knowledge base — it never free-associates. Every fact carries a source citation, so answers are traceable and hallucination-resistant.

**3. Describe the architecture.**
Three tiers — React 18 SPA (presentation), Node/Express API with a dedicated AI services layer (application), MongoDB Atlas (data) — plus the external Anthropic Claude API. One Express process serves both the built SPA and `/api/*`.

**4. Why one deployable unit instead of separate frontend/backend hosts?**
Simplicity and cost on a student project: Express serves `frontend/dist` statically with an SPA catch-all and the API under `/api`. No CORS issues in production, one Render service, one URL.

**5. What are the 7 feature phases?**
(1) Campus Copilot, (2) Student Success Dashboard, (3) Smart Notice Summarizer, (4) AI Analytics, (5) Personalized Home, (6) Placement Hub, (7) Knowledge Base + Faculty Directory + training-data collection.

**6. What does "thin routes, rich services" mean here?**
Route modules only handle HTTP, auth and validation; the business logic lives in 5 reusable engine modules (`aiAgent`, `successEngine`, `summarizer`, `placementEngine`, `homeBriefing`). This keeps logic testable and reusable.

**7. Give an example of code reuse across features.**
`successEngine.computeSuccess()` is the single source of truth for the Success Dashboard, the Home daily briefing, the Placement readiness score, and the Copilot's "performance" intent.

**8. Why MongoDB rather than SQL?**
Heterogeneous, evolving document shapes (notices gained AI fields, query logs gained training fields) suit a flexible document model; embedded sub-docs (exam schedule, message sources) map naturally to JSON; Atlas gives managed hosting + text indexes + a vector-search upgrade path.

**9. How does the app evolve its schema without breaking old data?**
All new fields are optional with defaults (e.g. Phase-7 `QueryLog.rating`, notice lifecycle fields). Legacy rows still validate and render; the UI treats missing fields as sensible defaults.

**10. What is the biggest engineering strength of the project?**
A genuinely grounded RAG pipeline with citation-by-construction and graceful degradation, layered on a secure, audited, production-style backend — not a toy chatbot.

## B. AI & Campus Copilot

**11. Walk through the Copilot pipeline.**
Intent classification (keyword routing) → grounded retrieval scoped to that intent and the student (recording a citation per fact) → Claude generation constrained to those facts with the last 8 turns of memory → parse out 3 follow-ups → persist the message + log a training example.

**12. Why keyword intent classification and not an LLM classifier?**
It's cheap, deterministic, predictable, unit-testable, and logged for analytics. The domains (exam/fees/marks/attendance/placement/faculty/notice) are known and finite, so a classifier LLM call would add latency and cost with little benefit.

**13. What is RAG and where is it used?**
Retrieval-Augmented Generation: retrieve relevant facts, then have the LLM generate using only those facts. The `retrieve()` function in `aiAgent.js` pulls from live records, KnowledgeArticle, KnowledgeDocument, Faculty and notices; the generation step is instructed to answer strictly from them.

**14. How do source citations work?**
Every time the retriever adds a fact to the context, it also pushes a `{type, refId, label}` source. These are stored on the `Message` and rendered as chips (📘 exam, 📊 attendance, 📖 KB, 👤 faculty) under the answer.

**15. How does the Copilot avoid hallucinating dates, fees, or grades?**
The system prompt says "Answer ONLY from the FACTS below… never invent dates, fees, grades or numbers." Since the facts come from the database, the model has nothing to invent.

**16. What happens if the Anthropic API key isn't set or the call fails?**
Graceful fallback: the Copilot returns the grounded retrieval text itself (still cited), the summarizer uses a heuristic, and the briefing/prep use templates. The app is fully functional offline from the LLM.

**17. Which Claude model and why?**
`claude-haiku-4-5-20251001` — fast and inexpensive, ideal for short, grounded campus answers and summaries where latency and cost matter more than long-form reasoning.

**18. How is conversation memory implemented?**
The chat route loads the last ~20 messages of the conversation; the agent replays the last 8 turns into the Claude `messages` array, so follow-ups resolve in context. Threads persist in `Conversation`/`Message`.

**19. How does Phase 7 extend the Copilot?**
`retrieve()` now also takes the raw message and text-searches `KnowledgeDocument` (citing document + section, and incrementing `accessCount`) and the `Faculty` directory (e.g. "who teaches ML", HOD scoped to the student's department).

**20. How does the Success Score get computed?**
Weighted: attendance 30%, academics (CGPA→100) 40%, placement readiness 20%, engagement (Copilot usage) 10%. Each sub-score is deterministic and explainable, with risk indicators and recommendations derived from thresholds.

**21. How does the feedback/training-data pipeline work?**
Each answer returns a `messageId`; 👍/👎 calls `/api/chat/feedback`, which writes `Message.feedback` and mirrors the rating onto the `QueryLog` row. `QueryLog` thus becomes a labelled `(query→response, rating, intent, category, role)` dataset — the foundation for future fine-tuning.

**22. How is the Placement readiness/recommendation computed?**
`placementEngine` reuses the success breakdown for CGPA/attendance/skills/projects, gates a recruiter catalog by CGPA/attendance/backlog thresholds (eligibility checker), computes skill-gap coverage, a resume strength score, and ranks companies by a blended fit score (eligibility + skill overlap + CGPA headroom).

## C. Database

**23. How many collections and what are the main ones?**
23. Core: User, Conversation, Message, QueryLog, SuccessMetric; knowledge: KnowledgeArticle, KnowledgeDocument, Faculty; academics/services: Attendance, Marks, Fee, Exam, Notice, etc.

**24. Reference vs embedding — how did you decide?**
Embed sub-documents always read with their parent (exam `schedule[]`, message `sources[]`, event registrations). Reference high-cardinality, independently-queried data (attendance/marks/messages per user).

**25. How does Copilot search the knowledge base?**
MongoDB text indexes on `KnowledgeArticle`, `KnowledgeDocument` and `Faculty`; a `$text` search (or regex for admin filters) returns top matches. The `embedding` field is reserved for an Atlas Vector Search upgrade.

**26. What is `SuccessMetric` for?**
A daily upserted snapshot (one per student per day) of the computed scores, enabling the trend line charts on the Success, Home and Placement dashboards.

**27. Why store the AI summary on the Notice document?**
The summarizer runs once on create/update and persists `summary`, `keyDates`, `actionItems`, `aiPriority`, so reads are instant and don't re-call the LLM on every page view.

**28. How is the training dataset stored?**
On the existing `QueryLog` collection, extended with `response`, `rating`, `category`, `role`, and a `message` reference — additive so analytics keep working and old rows stay valid.

**29. How do you prevent duplicate daily snapshots?**
`SuccessMetric` has a unique compound index on `{student, snapshotDate}` and is written with `findOneAndUpdate(..., {upsert:true})`.

**30. Where are uploaded PDFs stored?**
Inline as a base64 string on `KnowledgeDocument.fileData` (same pattern as user photos), excluded from list queries via projection. A production upgrade would move them to object storage (S3/GridFS).

## D. Security

**31. How is authentication implemented?**
Stateless JWT: login verifies a bcrypt hash and returns a signed token; the `protect` middleware verifies the bearer token and loads `req.user`; the SPA stores the token and sends it as `Authorization: Bearer`.

**32. How are passwords protected?**
Hashed with bcrypt (cost 12) in a Mongoose pre-save hook; never returned — `User.toJSON()` deletes the password field.

**33. How do you enforce admin-only routes?**
The `adminOnly` middleware checks `req.user.role === 'admin'` after `protect`; admin route modules apply it, returning 403 otherwise.

**34. What protects against brute-force and abuse?**
Two rate limiters: a strict auth limiter (20 attempts / 15 min on login/register) and a global limiter (150 req/min/IP on all `/api`), plus `trust proxy` for correct IPs behind Render.

**35. How do you mitigate stored XSS?**
User-supplied HTML is stripped (`replace(/<[^>]*>/g,'')`) before storing notices, knowledge documents and faculty fields; helmet sets a Content-Security-Policy.

**36. What does helmet do here?**
Sets secure HTTP headers and a CSP restricting script/style/img/connect sources, frame-ancestors none, object-src none — reducing XSS and clickjacking surface.

**37. How are admin actions auditable?**
A fire-and-forget `logAudit()` writes an append-only `AuditLog` (actor, action, entity, details) on every mutation — visible in the admin Audit Log tab. It never throws into the business action.

## E. Frontend

**38. Why React + Vite?**
Component reuse, a fast dev/build experience, code-splitting via lazy routes, and a single codebase that also ships as a mobile app via Capacitor.

**39. How is routing/access control done client-side?**
`react-router` with guard components: `RequireAuth`, `RequireAdmin`, and `RedirectIfAuthed`; pages are lazy-loaded; unknown/legacy `.html` URLs redirect to React routes.

**40. How are the charts built — any chart library?**
No chart dependency — custom dependency-free SVG components (`RingGauge`, `LineChart`, `BarList`) in `features/charts`, animated with CSS. Keeps the bundle small and the look consistent.

**41. How is the premium UI achieved?**
A shared design system: CSS variables with three themes (dark default / light / night), glassmorphism cards (`backdrop-filter: blur`), CSS keyframe card animations, GSAP scroll reveals, responsive grids.

**42. How does the same code become an Android app?**
Capacitor wraps the built `dist` in a native WebView; `api.js` detects the Capacitor platform and points to the hosted API. The APK was built and device-tested on Android 15.

**43. How does the feedback UI work?**
Each assistant message carries a `messageId`; the Chat component shows 👍/👎 buttons that call `useChat.rate()` (optimistic update, reverts on failure) → `/api/chat/feedback`. Existing ratings are restored when a conversation is reopened.

## F. Testing & Deployment

**44. How did you test the project?**
5 backend unit tests (`node:test` + `mongodb-memory-server`) covering CGPA weighting, fee verification, auth and success scoring — all passing; a 337-case Selenium E2E audit suite with a GitHub Actions workflow; and per-phase live API smoke tests.

**45. What does a unit test look like here?**
e.g. CRIT-01 asserts CGPA is credit-weighted across subjects; CRIT-05 asserts fee status counts only verified payments — run in-memory so no real DB is touched.

**46. How is the app deployed?**
A Render web service runs `node backend/server.js`; a `postinstall` builds the frontend; Express serves the build + API; secrets (`MONGO_URI`, `JWT_SECRET`, `ANTHROPIC_API_KEY`) are environment variables, never committed.

**47. Is the AI work live on the deployed URL right now?**
The site is up and DB-connected, but it serves the older `main` branch, so Phases 1–7 (on `demo-branch`) return 404 there. Deploying them is a one-step merge of `demo-branch` → the branch Render tracks (documented in `09_DEPLOYMENT_READINESS.md`).

**48. How do you keep the API key and DB URI secret?**
They live only in environment variables (Render dashboard / local `.env` which is git-ignored). `render.yaml` marks them `sync: false`. Nothing sensitive is in the repo.

**49. What happens on a cold start?**
Render's free tier sleeps after inactivity; the first request wakes it (~30–50s). We warm it by hitting the URL once before a demo.

**50. If you had more time, what would you improve?**
Atlas Vector Search with real embeddings (field already reserved), genuine PDF text extraction, fine-tuning on the collected feedback dataset, object storage for files, push notifications, and an iOS build.
