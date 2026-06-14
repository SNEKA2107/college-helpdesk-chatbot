# DOCUMENT WORKFLOW VERIFICATION — Phase 1

**Date:** 2026-06-14 · **Method:** API-level integration test against the live backend (incl. session re-fetch to simulate app restart), then test data removed.

> The document upload UI uses a **native file-picker intent** inside the Capacitor WebView, which cannot be driven by headless emulator automation. The underlying workflow (validate → store → serve → permission) is therefore verified at the API level, which the APK WebView calls unchanged. Manual on-device upload is the one step that still needs a human tester (noted in the readiness report).

---

## Student side

| Step | Result |
|------|--------|
| Upload proof + submit **Leave** (PNG, base64) | ✅ 201 Created, stored |
| Upload proof + submit **OD** (PNG, base64) | ✅ 201 Created, stored |
| Both documents listed (`documentName` present) | ✅ count = 2 |
| List response **excludes** the blob | ✅ verified in Phase 1 (`-document`) |
| Student views own uploaded file | ✅ `GET /leave/:id/document` returns the exact data URL |

## Admin side

| Step | Result |
|------|--------|
| Admin sees the leave + `documentName` | ✅ (Phase 1: LeavesTab Document column) |
| Admin **views/previews** document | ✅ `GET /leave/:id/document` returns data URL → client Blob preview |
| Admin **downloads** document | ✅ same endpoint → client `downloadDataUrl` |
| Admin **approve** | ✅ `PUT /leave/:id/status {Approved}` (unchanged, working) |
| Admin **reject** | ✅ `PUT /leave/:id/status {Rejected}` (unchanged, working) |

## Persistence after restart

| Step | Result |
|------|--------|
| Re-fetch document in a fresh session (simulating app restart) | ✅ document still retrievable — data lives in MongoDB, not client/session state |
| Admin retrieves the persisted document independently | ✅ 200, exact bytes returned |

## Security / robustness (from Phase 1, re-affirmed)
- ✅ Invalid MIME (e.g. text/plain) rejected with 400.
- ✅ Cross-user fetch → 403 (owner-or-admin only).
- ✅ Missing document → graceful 404 message; UI shows "—" / toast, no crash.
- ✅ Size cap ≤3 MB, extension allowlist, filename sanitization, base64 integrity.

---

## Result — 11/11 PASS (combined with the cohort run)
Document upload (Leave + OD), persistence across sessions, owner & admin retrieval, list-blob-exclusion, and permission gating all verified.

## Not yet device-click-verified (honest gap)
- The **native file-picker selection** on the APK (tapping "Choose file" → picking from device storage) was **not** automated — it requires a native intent + human interaction. Recommend a 2-minute manual check on a real device: pick a PDF in Leave, submit, then confirm it previews/downloads in the admin panel.

*All test fixtures deleted from the live DB after the run. Verification only — DO NOT COMMIT.*
