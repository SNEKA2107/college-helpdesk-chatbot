# FAST TRACK AUDIT — Remaining Medium/Low (2-hour window)

**Date:** 2026-06-14 · **Goal:** maximize demo quality / realism within ~2h, not perfection.

Severity legend: 🟡 Medium · 🟢 Low. Demo impact = how visible to an evaluator.

| ID | Issue | Sev | User-visible impact | Demo impact | Risk if unfixed | Est. | Deps | Recommended |
|----|-------|-----|---------------------|-------------|-----------------|------|------|-------------|
| **A** | Exam page ignores DB `instructions` (renders hardcoded) | 🟡 | Admin edits to instructions never show | **High** — shows a broken admin→student link | Looks static/fake | 10m | none | **DO** |
| **B** | Event registration state from `localStorage`, not server | 🟡 | "Registered" can be wrong after re-login/device | **High** — core workflow looks fake | Visible inconsistency | 15m | none | **DO** |
| **C** | Chatbot facts hardcoded (sem-V dates, ₹55,000, phones) | 🟡 | Bot gives stale/wrong facts vs real data | **High** — chatbot is a headline feature | Evaluator may probe it | 25m | Exam/Fee/Notice data | **DO** |
| **D** | Landing testimonials + stats fabricated | 🟡 | Fake quotes/numbers on public page | **Med** — first screen seen | "Fake data" impression | 10m | none | **DO** |
| **E** | "Download Hall Ticket" / "Download Receipt" = toast stubs | 🟡 | Button does nothing real | **Med** — obvious dead button | Looks unfinished | 10m | none | **DO** (print) |
| F | Hardcoded Contact offices/FAQ, Library hours/rules | 🟡 | Static institutional info | Low | Acceptable as config | 30m+ | needs Config model | DEFER |
| G | Fee component CRUD for admin | 🟡 | Admin can't edit fee structure in UI | Low (not in demo path) | — | 40m+ | — | DEFER |
| H | Student CRUD (admin create/deactivate) | 🟡 | Admin can't add/deactivate from UI | Low | — | 40m+ | — | DEFER |
| I | Structured OD model/tab (vs Leave) | 🟡 | OD works, just shares Leave tab | Low (works) | — | 60m+ | schema | DEFER |
| J | JWT lifetime / refresh | 🟡 | none visible | None | security-only | 60m+ | — | DEFER (excluded) |
| K | Timetable unique-cohort index + subjectDetails capture | 🟡 | conflict checks partial | Low | — | 45m | grid rework | DEFER |
| L | Pagination, CSP, perf | 🟢 | none visible | None | — | — | — | **EXCLUDE** (per instruction) |
| M | Notices read-status, theme persistence, forgot-password | 🟢 | minor UX | Low | — | varied | — | DEFER |

## Ranking (demo value × realism ÷ risk × speed)
1. **A — Exam instructions from DB** (fast, high realism, zero risk)
2. **B — Event registration server state** (core workflow realism)
3. **C — Chatbot dynamic facts** (headline feature, removes most visible hardcoding)
4. **D — Landing fake content** (first impression)
5. **E — Real print workflows** (kills obvious dead buttons)

Everything F–M is deferred as low demo value, higher risk, or explicitly excluded.

*Audit only.*
