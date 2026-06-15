# NOTICE DATA CLEANUP REPORT

**Date:** 2026-06-15 · **Scope:** `notices` collection only · **Policy:** identify & recommend — **no automatic deletion**

---

## 1. Purpose

Newly registered students were seeing obsolete artifacts in **Recent Notifications** (DAST probe
notices, "Phase 3" notes, test/sample notices, development leftovers). These rows were created at
runtime — mostly through the public `POST /api/notices` endpoint during security scans (DAST) and
manual development/testing — and therefore are **not** in `seed.js`. They live only in the production
database.

This report lists the candidates and the recommended action. **No records are deleted.** The
recommended remediation is **Archive** (`status: 'archived'`), which is reversible and hides the
notice from students without losing data.

---

## 2. How candidates are identified

The auditor `backend/scripts/cleanup-notices.js` scans every notice's **title + content + postedBy**
against these rules:

| Rule | Reason flagged | Matches (examples) |
|------|----------------|--------------------|
| Security scan | Security-scan / DAST probe artifact | `dast`, `sast`, `probe`, `burp`, `zap`, `nikto`, `nessus`, `acunetix`, `pentest`, `vuln` |
| Injection | Injection / XSS test payload | `<script`, `onerror=`, `javascript:`, `alert(`, `xss`, `sqli`, `sql injection`, `csrf`, `payload` |
| Test data | Test / sample / placeholder data | `test`, `qa`, `sample`, `dummy`, `lorem`, `ipsum`, `asdf`, `placeholder`, `foobar` |
| Dev / temp | Development / phase / temporary note | `phase 3`, `dev`, `debug`, `staging`, `sandbox`, `temp`, `delete me`, `do not use`, `ignore this` |
| Author | Automated / non-human author (`postedBy`) | `test`, `dev`, `qa`, `script`, `bot`, `probe`, `seed` |

Already-archived rows are skipped.

---

## 3. Flagged candidates

The exact rows depend on live data; run the auditor to produce the authoritative list:

```bash
cd backend
node scripts/cleanup-notices.js          # dry run — prints the table below, changes nothing
```

Based on the reported symptoms, the following classes are expected to be flagged:

| # | Notice title (pattern) | Reason flagged | Recommended action |
|---|------------------------|----------------|--------------------|
| 1 | `DAST probe notice` / scanner-injected titles | Security-scan / DAST probe artifact | **Archive** |
| 2 | `Phase3 Notice` / `Phase 3 …` | Development / phase / temporary note | **Archive** |
| 3 | `Test notice`, `test`, `sample`, `dummy` | Test / sample / placeholder data | **Archive** |
| 4 | Development artifacts (`debug`, `staging`, `delete me`, `ignore this`) | Development / temporary note | **Archive** |
| 5 | Any notice containing `<script>` / `alert(` / `payload` | Injection / XSS test payload | **Archive** |
| 6 | Notices authored by `test`/`dev`/`script`/`bot` | Automated / non-human author | **Archive** |

> Legitimate seeded notices ("Fee Payment Deadline", "Semester V Examination Schedule",
> "Internal Marks Published", "College Holiday", "Scholarship Application Open") do **not** match any
> rule and are **left published**.

---

## 4. Recommended remediation (manual, reviewed)

1. **Snapshot** the database (Atlas snapshot / `mongodump`).
2. **Dry run** to review the list: `node scripts/cleanup-notices.js`
3. **Apply** (archives, does not delete): `node scripts/cleanup-notices.js --apply`
4. Spot-check the **Notices → Archived** tab in the admin panel; re-publish any false positive with one click.

Archiving is preferred over deletion so the audit trail and history remain intact. Permanent deletion,
if ever required, stays a manual per-row action in the admin UI.

---

## 5. Prevention (root cause)

- `POST /api/notices` is now **admin-only** in effect for student visibility: anything created without
  going through the publish flow can be saved as a **draft** (invisible to students).
- Future scanner/test traffic that does manage to create notices will still be caught by this auditor
  and, because students only ever see `status: 'published'`, will not surface unless explicitly published.
- Recommend running the auditor as a periodic hygiene check (e.g. monthly).
