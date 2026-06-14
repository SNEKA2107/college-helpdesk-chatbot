# DOCUMENT WORKFLOW AUDIT — CampusAssist (Leave / OD / Medical / Special Permission)

**Audit date:** 2026-06-14
**Scope:** Upload → storage → schema → serving → admin review for supporting documents on Leave and OD requests.
**Files:** `frontend/src/pages/Leave.jsx`, `frontend/src/pages/Od.jsx`, `backend/routes/leave.js`, `backend/models/Leave.js`, `frontend/src/pages/admin/LeavesTab.jsx`, `backend/server.js`.
**Status:** ✅ RESOLVED in Phase 1 (2026-06-14). Original audit findings retained below for the record; see the **Phase 1 Resolution** section at the end for what was implemented and verified.

---

## Executive finding (original audit)

**The document workflow does not exist end-to-end. It is broken at every stage.** A student *appears* to be able to attach a proof document, but the file is never read by the browser, never sent to the server, never stored, and there is no admin UI or API to view or download it. The `Leave.document` field in the schema is dead.

---

## Stage-by-stage trace

### Stage 1 — Upload (frontend) — ❌ BROKEN
**`Leave.jsx:140-143`**
```html
<label className="form-label">Supporting Document (optional)</label>
<input type="file" className="form-input" accept=".pdf,.jpg,.png" style={{ padding: 8 }} />
```
**`Od.jsx:160-163`** — identical pattern.

- The `<input type="file">` has **no `onChange`, no `ref`, no `value`** binding. The selected file is never captured into state.
- The submit handler sends a JSON body only:
  - `Leave.jsx:55-58` → `body: JSON.stringify({ leaveType, fromDate, toDate, reason })`
  - `Od.jsx:61-64` → `body: JSON.stringify({ leaveType:'On Duty (OD) – Event', fromDate, toDate, reason: fullReason })`
- No `FormData`, no `multipart/form-data`, no base64 encoding. **The file is discarded the moment the user picks it.**

### Stage 2 — Transport / API — ❌ BROKEN
`POST /api/leave` (`leave.js:21-39`) destructures only:
```js
const { leaveType, fromDate, toDate, reason, department, semester } = req.body;
```
`document` is **not read** and not passed to `Leave.create(...)`. Even if the frontend sent a document, the route would drop it.

### Stage 3 — Storage — ❌ ABSENT
- No `multer` (or any upload middleware) anywhere in the backend (`server.js` only mounts `express.json`/`urlencoded` at 5 MB).
- No uploads directory, no cloud bucket, no GridFS. Nothing persists files.
- `express.json({ limit: '5mb' })` would allow a base64 document in JSON, but nothing on the client produces one and nothing on the server reads it.

### Stage 4 — Schema — ⚠️ DEAD FIELD
**`Leave.js:16`** `document: { type: String, default: '' }` exists but is **never written** (POST ignores it) and **never read** (no route returns it specifically; it would serialize as `''`). It is a placeholder field with no workflow behind it.

### Stage 5 — Serving — ❌ ABSENT
There is no `GET /api/leave/:id/document`, no static `/uploads` mount, no signed-URL issuance. Documents cannot be retrieved because none are stored.

### Stage 6 — Admin review — ❌ ABSENT
**`LeavesTab.jsx`** columns: `Student | Leave Type | From | To | Reason | Status | Action`.
- **No document column, no preview, no download link, no "verify document" control.**
- Admin can only Approve / Reject (`updateStatus` → `PUT /api/leave/:id/status`). There is no way to see any proof before deciding.
- Medical Leave and OD — which the UI explicitly says require a doctor's certificate / event proof (`Leave.jsx:147`, `Od.jsx` guidelines) — are approved blind.

---

## Workflow matrix (requested)

| Capability | Required | Today |
|------------|----------|-------|
| Student uploads proof (Leave) | ✅ | ❌ input not wired |
| Student uploads proof (OD) | ✅ | ❌ input not wired |
| Medical leave certificate | ✅ | ❌ |
| Special permission proof | ✅ | ❌ (no such request type exists; see OD note) |
| File stored | ✅ | ❌ no storage |
| Admin preview document | ✅ | ❌ no column |
| Admin download document | ✅ | ❌ |
| Admin verify document | ✅ | ❌ |
| Admin approve / reject | ✅ | ✅ (blind — no doc) |
| Handle broken link / missing file | ✅ | ❌ n/a (nothing stored) |
| Permission check on document access | ✅ | ❌ n/a |

---

## Related structural issue — OD has no real workflow

OD is filed through the **Leave** collection (`Od.jsx:61-64`) with `leaveType: 'On Duty (OD) – Event'`. The structured OD fields the form collects — `odType`, `eventName`, `venue` — are **flattened into a single `reason` string** (`Od.jsx:60`):
```js
const fullReason = `${odType} — ${eventName} at ${venue}. ${reason}`;
```
Consequences:
- OD-specific data is unstructured and unqueryable.
- Admin sees OD and Leave mixed in one tab with no distinction (only the `leaveType` text differs).
- "On Duty (OD) – Training" exists in the enum but the OD form always sends "– Event".
- There is no place to attach the required invitation/brochure or post-event participation proof.

---

## Recommended target design (for the fix phase — not yet implemented)

**Decision needed (defer to fix phase):** storage strategy —
1. **Base64 in Mongo** (simplest, no new infra; fits the existing 5 MB JSON limit; matches how `User.photo` is already stored as a string). Good for a college-project / single-service Render deploy.
2. **`multer` → disk/`/uploads`** (Render's filesystem is ephemeral — lost on redeploy; not recommended without a disk).
3. **Cloud bucket (S3/Cloudinary) + signed URLs** (most "enterprise", adds a dependency + secrets).

**Proposed (option 1, lowest-risk, consistent with `User.photo`):**

- **Frontend:** wire the file input → read via `FileReader.readAsDataURL` → include `document` (data URL) + `documentName`/`documentType` in the POST body. Validate type (pdf/jpg/png) and size (≤ ~4 MB to stay under the 5 MB JSON cap).
- **Backend POST `/api/leave`:** accept and store `document`, `documentName`, `documentType`; validate size/type server-side.
- **Schema:** keep `document` (data URL or storage key) + add `documentName`, `documentType`, `documentVerified: Boolean`.
- **Serving:** `GET /api/leave/:id/document` (protected) — owner or admin only; streams/returns the file; 404 with a clean message if missing.
- **Admin UI:** add a "Proof" column with Preview (open in new tab / inline `<img>`/`<iframe>`) + Download, a "Verify" toggle, and only then Approve/Reject. Show "No document attached" when empty and a graceful error if the blob is missing/corrupt.
- **OD:** either add structured `odType/eventName/venue` fields to the model, or split OD into its own model + admin tab (see ENTERPRISE_GAP_ANALYSIS H3/M8).

---

## Verification checklist (for the fix phase)
- [ ] Student attaches a PDF/JPG/PNG to a Leave; it round-trips and is visible to admin.
- [ ] Oversized / wrong-type files are rejected client- and server-side.
- [ ] Admin can preview and download the exact file uploaded.
- [ ] Admin can mark a document Verified before approving.
- [ ] Requests with no document show a clean "No document" state.
- [ ] A request whose stored blob is missing shows a graceful error, not a crash.
- [ ] A student cannot fetch another student's document (permission check).

---

## PHASE 1 RESOLUTION (implemented & verified 2026-06-14)

Storage decision: **base64 in MongoDB** — see `DOCUMENT_STORAGE_ARCHITECTURE.md`.

| Stage | Before | After |
|-------|--------|-------|
| Upload (Leave) | input not wired | `Leave.jsx` `onPickDocument` → validate → `FileReader` → base64 in POST |
| Upload (OD) | input not wired | `Od.jsx` same wiring |
| Transport | `document` dropped | POST `/api/leave` accepts `document`/`documentName`/`documentType` |
| Storage | none | stored on `Leave` doc (base64 data URL) |
| Schema | dead `document` | `document` used + `documentName`, `documentType` added |
| Serving | none | `GET /api/leave/:id/document` (owner-or-admin), JSON→Blob client-side |
| Admin review | no column | `LeavesTab` "Document" column: **Preview + Download**, "—" when none |
| Student view | none | "📎 View document" in own Leave/OD history |
| Validation | none | MIME allowlist, ext allowlist, ≤3 MB, base64 integrity, filename sanitize (client + server) |
| Missing/broken | n/a | graceful 404 + toast; "—" when absent |
| Permissions | n/a | cross-user fetch → 403 (verified) |

**Files changed:** `backend/models/Leave.js`, `backend/routes/leave.js`, `frontend/src/utils/file.js` (new), `frontend/src/pages/Leave.jsx`, `frontend/src/pages/Od.jsx`, `frontend/src/pages/admin/LeavesTab.jsx`.

**Verification:** 15/15 live API checks passed — upload persists, list excludes blob but keeps name, owner & admin fetch succeed, cross-user fetch 403, invalid type 400. Test data removed from the live DB afterward.

**Still deferred (Phase 2/High):** splitting OD into its own structured model/tab + structured OD fields (currently OD still rides the Leave model with fields flattened into `reason`); a dedicated "document verified" flag for admin sign-off.

*Original section was AUDIT ONLY. Phase-1 changes are uncommitted per instruction — DO NOT COMMIT.*
