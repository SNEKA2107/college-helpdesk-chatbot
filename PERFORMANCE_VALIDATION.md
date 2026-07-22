# CampusAssist v1.0 — Performance Validation

**Build:** v1.0-rc1 · **Date:** 2026-07-22 · **Owner:** QA Lead

**Test conditions:** local backend (`node server.js`, single instance) → **MongoDB Atlas (cloud)**; warm cache; sequential requests. Latency figures therefore **include client→Atlas network round-trip** from a developer machine. In production (Render co-located with the Atlas region) DB-bound latency is expected to be similar or lower. All numbers below are **measured**, not estimated.

---

## 1. Login response time
| Metric | Value |
|--------|-------|
| Min / Median / Max (10 runs) | **235 / 261 / 349 ms** |

**Analysis:** dominated by **bcrypt password verification at cost factor 12** (a deliberate security choice), plus one Atlas round-trip. This is expected and acceptable; it is not a query-performance issue. Not a bottleneck at pilot scale, but note logins are CPU-bound (see §6).

## 2. Dashboard load time (AI-aggregation endpoints)
| Endpoint | min / median / avg / max (ms, n=8) |
|----------|-------------------------------------|
| `/home` (personalized dashboard) | 201 / 215 / 222 / 260 |
| `/success` (success engine) | 195 / 200 / 206 / 229 |
| `/placement` (placement engine) | 167 / 172 / 174 / 185 |

**Analysis:** these aggregate several collections (attendance, marks, fees, exams, notices, conversations, success snapshots) per request. 172–222 ms is well within the < 800 ms target. AI prose (when `ANTHROPIC_API_KEY` is set) is generated with a fallback and a low token budget; when unset, these endpoints use deterministic templates at the measured speed.

## 3. API latency (standard endpoints)
| Endpoint | median (ms) |
|----------|-------------|
| `/attendance` | 61 |
| `/notices` | 57 |
| `/timetable` | 59 |
| `/fees` | 56 |
| `/marks/cgpa` | 57 |
| `/library` | 57 |
| `/exam` | 57 |
| `/conversations` | 57 |
| `/faculty` | 56 |

**Analysis:** standard reads cluster at **55–72 ms** — excellent, essentially one indexed Atlas query + serialization. Comfortably beats the p95 < 400 ms target.

## 4. Database query performance
- **Indexes:** 13 of 23 models declare indexes; `User.studentId` and `User.email` are **unique-indexed**; attendance and marks carry unique compound indexes (dedup invariants, unit-tested). Hot read paths (auth by `studentId`, cohort lookups by `department`+`semester`) are index-supported.
- **Observed:** single-collection reads at 55–72 ms indicate index-served queries, not collection scans.
- **Known concern (not blocking):** `POST /api/attendance/bulk` issues a sequential `User.findOne` + upsert **per record** (N+1). Admin-only, low-frequency; at a 60-student roster ≈ 120 sequential round-trips. Tracked as KI-05 / BUG-003; planned fix = `$in` batch lookup + `bulkWrite`.

## 5. Largest frontend bundle
Production build (Vite, minified, gzipped, **no sourcemaps**), total `dist` ≈ **686 KB**:
| Chunk | Raw | Gzip |
|-------|-----|------|
| `index` (app core + vendor) | 173.0 KB | **56.9 KB** |
| `ScrollTrigger` (GSAP animation) | 114.9 KB | 45.5 KB |
| `Admin` (admin console) | 80.8 KB | 16.9 KB |
| Per-page route chunks | 4–15 KB | 1.7–4.3 KB |

**Analysis:** route-level code-splitting means a student never downloads the Admin chunk. First meaningful payload (index + a page chunk) ≈ **60–65 KB gzip** — fast on 3G/4G. **Optimization opportunity (non-blocking):** GSAP/ScrollTrigger (45 KB gz) is the second-largest chunk; lazy-loading it only where animations are used would trim first load.

## 6. Memory usage
| Metric | Value |
|--------|-------|
| Working set | **111.9 MB** |
| Private memory | **145.1 MB** |
| Threads | 13 |

**Analysis:** a single Node/Express + Mongoose instance uses ~145 MB — well within Render's 512 MB free-tier limit, with headroom for connection pools and concurrent requests at pilot scale.

---

## Bottlenecks & recommendations

| Area | Severity | Finding | Recommendation |
|------|----------|---------|----------------|
| Login CPU cost | Low | bcrypt cost-12 ≈ 200 ms CPU/login; logins are CPU-bound, single instance | Fine for 20–100 users; for university scale, scale out instances (bcrypt doesn't parallelize on one core) |
| AI-aggregation endpoints | Low | 172–222 ms multi-collection reads | Acceptable; consider caching the success snapshot if it becomes hot |
| Bulk attendance N+1 | Medium | Sequential per-record DB ops | Batch with `$in` + `bulkWrite` (post-pilot, KI-05) |
| GSAP chunk | Low | 45 KB gz on first load | Lazy-load animation lib (post-pilot) |
| Render free tier | **Medium (infra)** | Cold start after 15 min idle; shared CPU | Upgrade to a paid always-on instance before a 100-user pilot (see `PILOT_RISK_REGISTER.md` R-01) |

**Verdict:** application-level performance is **strong and pilot-ready**. The only material scaling constraints are **infrastructure-tier** (Render free-tier cold starts, Atlas shared tier), not code.
