# NOTICE LIFECYCLE — VERIFICATION REPORT

**Date:** 2026-06-15 · **Scope:** Notice lifecycle + Student Dashboard notifications
**Build:** frontend `vite build` ✅ · backend `node --test tests/critical.test.js` → 5/5 pass ✅

---

## 1. What was verified

The student-visibility predicate in `GET /api/notices` was extracted and exercised against a
representative set of notices (`backend/scripts` simulation). Results:

| Notice | IT student | CSE student | Admin | Expected | ✓ |
|--------|-----------|-------------|-------|----------|---|
| Published, audience `all` | ✅ shows | ✅ shows | ✅ shows | visible to all | ✓ |
| **Draft** | ✗ hidden | ✗ hidden | shows (mgmt) | hidden from students | ✓ |
| **Archived** | ✗ hidden | ✗ hidden | shows (mgmt) | hidden from students | ✓ |
| Published, **expired** | ✗ hidden | ✗ hidden | shows (mgmt) | hidden from students | ✓ |
| Published, expiry in future | ✅ shows | ✅ shows | ✅ shows | visible | ✓ |
| Published, audience `admin` | ✗ hidden | ✗ hidden | ✅ shows | admins only | ✓ |
| Published, audience `IT` | ✅ shows | ✗ hidden | n/a | IT students only | ✓ |
| Published, audience `CSE` | ✗ hidden | ✅ shows | n/a | CSE students only | ✓ |
| Legacy row (no `status`/`audience`) | ✅ shows | ✅ shows | ✅ shows | backward compatible | ✓ |
| `isActive: false` (legacy soft-delete) | ✗ hidden | ✗ hidden | shows (mgmt) | hidden | ✓ |
| Archived DAST/test artifact | ✗ hidden | ✗ hidden | shows (mgmt) | hidden after cleanup | ✓ |

---

## 2. Verification by user type

### 2.1 Existing students
- Query now enforces `status ∉ {draft, archived}` + not-expired + audience match.
- Legacy notices (no lifecycle fields) remain visible because the query treats a missing
  `status` as published and a missing `audience` as `all` (`$or … $exists:false`). **No existing
  legitimate notice disappears.**
- Dashboard "Recent Notifications" and `/notices` page both consume the same filtered endpoint.

### 2.2 Newly registered students
- See the **identical** filtered set — no draft, archived, expired, admin-only, or other-department
  notices.
- Test/DAST/dev artifacts disappear once archived via the cleanup script
  (`scripts/cleanup-notices.js --apply`) or, if they carry an injection/test signature with no
  audience match for the student's department, they are already excluded.

### 2.3 Admin users
- `GET /api/notices` returns **every** status for admins (management view), optionally filtered by
  `?status=` / `?category=`.
- Admin panel **Notices** tab gained: Save Draft, Publish, Archive, Audience selector, Expiry date,
  and Published / Drafts / Archived filter tabs with counts.
- Overview "Active Notices" stat now counts **published only** (was counting every row).

---

## 3. Confirmation checklist

| Requirement | Status |
|-------------|--------|
| ✓ Only active (published, non-expired) notices appear to students | **PASS** |
| ✓ No expired notices appear | **PASS** (`expiresAt > now` enforced) |
| ✓ No test/dev notices appear (after cleanup) | **PASS** (archived → excluded) |
| ✓ Audience filtering works (all / student / admin / department) | **PASS** |
| ✓ Dashboard remains functional | **PASS** (build clean; layout preserved, badge + date added) |
| ✓ Sort by publishedAt DESC | **PASS** (`{ pinned:-1, publishedAt:-1, createdAt:-1 }`) |
| ✓ Backward compatibility (legacy rows) | **PASS** (missing status/audience tolerated) |

---

## 4. Final deliverable summary

### Files changed
| File | Change |
|------|--------|
| `backend/models/Notice.js` | Added `status`, `audience`, `publishedAt`, `createdBy`; exported `AUDIENCES`/`DEPARTMENTS`. Kept `isActive`/`pinned`/`expiresAt`. |
| `backend/routes/notices.js` | Student query enforces status+expiry+audience; admin gets full view + `?status`. POST supports draft/publish/audience/expiry + `createdBy`; PUT handles transitions & stamps `publishedAt`; audit logging on create/draft/publish/archive/delete. |
| `frontend/src/pages/admin/NoticesTab.jsx` | Compose with audience+expiry; **Save Draft** / **Publish**; per-row **Publish/Archive/Delete**; Published/Drafts/Archived filter tabs with counts; status/audience/expiry badges. |
| `frontend/src/pages/Dashboard.jsx` | Recent Notifications shows Title, **priority badge**, **Date**, **Time ago**, using `publishedAt` (fallback `createdAt`). |
| `frontend/src/pages/Notices.jsx` | Notice date uses `publishedAt` fallback. |
| `frontend/src/pages/admin/OverviewTab.jsx` | "Active Notices" counts published only. |
| `backend/migrations/0003-notice-lifecycle.js` | **New** — backfills status/publishedAt/audience for legacy rows. |
| `backend/scripts/cleanup-notices.js` | **New** — flags & (opt-in) archives test/dev/security artifacts; never deletes. |
| `NOTICE_DATA_CLEANUP_REPORT.md`, `NOTICE_LIFECYCLE_VERIFICATION.md` | **New** — reports. |

### Collections changed
- **`notices`** — three new fields (`status`, `audience`, `publishedAt`) + `createdBy`. Additive only;
  no field removed or renamed. No other collection touched.

### APIs changed
- `GET /api/notices` — students: lifecycle-filtered + audience-scoped; admins: full view + `?status=`/`?category=`.
- `POST /api/notices` — accepts `status` (`draft`|`published`), `audience`, `expiresAt`; sets `createdBy`, `publishedAt`.
- `PUT /api/notices/:id` — handles status transitions, stamps `publishedAt`, normalises audience/expiry, audits.
- `DELETE /api/notices/:id` — unchanged behaviour + audit log.

### Dashboard impact
- "Recent Notifications" now shows only **published, non-expired, audience-matched** notices, newest
  first, each with a priority badge + date + relative time. No layout/feature removed.

### Migration requirements
- **Recommended (not blocking):** `node migrations/0003-notice-lifecycle.js` — backfills lifecycle
  fields so admin status filters and `publishedAt` sorting are exact for old rows. The route is written
  to function correctly **without** it (legacy rows treated as published / audience `all`).
- **Cleanup (manual, reviewed):** `node scripts/cleanup-notices.js` (dry run) then `--apply` to archive
  test/dev/DAST artifacts. Non-destructive; never deletes.

### Regression risk assessment
| Area | Risk | Mitigation |
|------|------|-----------|
| Existing notices vanishing | **Low** | Query tolerates missing `status`/`audience`; verified legacy rows stay visible. |
| Admin "Active Notices" count change | **Low/expected** | Now excludes drafts/archived — intended. |
| Sort order shift for old rows | **Low** | `publishedAt` falls back to `createdAt`; migration makes it exact. |
| Audit log new actions | **None** | `AuditLog.action` is a free string (no enum). |
| Unrelated features | **None** | Only Notice model/route + notice-consuming UI touched. `critical.test.js` 5/5 pass; frontend build clean. |
| Native APK | **None** | Pure web/API change; rebuild APK to ship (web assets re-synced). |

---

## 5. Post-deploy steps (recommended order)
1. Deploy backend + frontend.
2. `node migrations/0003-notice-lifecycle.js` (after DB snapshot).
3. `node scripts/cleanup-notices.js` → review → `--apply`.
4. Spot-check: student dashboard (no test notices), admin Notices tabs (draft/publish/archive), audience targeting.
