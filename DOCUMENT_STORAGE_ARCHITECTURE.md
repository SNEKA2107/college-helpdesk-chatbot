# DOCUMENT STORAGE ARCHITECTURE — CampusAssist (Phase 1)

**Date:** 2026-06-14
**Decision:** Store Leave/OD supporting documents as **base64 data URLs in MongoDB**.
**Status:** IMPLEMENTED in Phase 1.

---

## Why base64-in-Mongo (approved)

- The project already stores images this way (`User.photo`), so it is a consistent pattern.
- Works on Render's free tier — **survives redeploys** (Render's filesystem is ephemeral, so multer-to-disk would lose files; this does not).
- No external cloud dependency, no extra secrets, no S3/Cloudinary account.
- Appropriate for college-project scale and document sizes (certificates, invitations).

**Trade-offs (documented, accepted for this scale):** base64 inflates payload ~33%; large blobs in documents bloat the collection. Mitigated by the 3 MB cap and by **excluding the blob from list queries** (fetched only on demand).

---

## Data model (`backend/models/Leave.js`)

```js
document:     { type: String, default: '' },   // base64 data URL: "data:<mime>;base64,<data>"
documentName: { type: String, default: '' },   // sanitized original filename
documentType: { type: String, default: '' },   // resolved MIME (image/png, image/jpeg, application/pdf)
```

`document` holds the blob; `documentName`/`documentType` are kept separately so the list view can show *that a document exists* without shipping the (large) blob.

---

## Validation & security (`backend/routes/leave.js` → `validateDocument()`)

| Control | Rule |
|---------|------|
| **Optional** | No document → request still valid. |
| **Data-URL shape** | Must match `^data:<mime>;base64,<data>$`, else 400. |
| **MIME allowlist** | `application/pdf`, `image/jpeg`, `image/png` only — derived from the data-URL header (the **source of truth**), not the client's claimed type. |
| **Type agreement** | If the client sends `documentType`, it must equal the data-URL MIME, else 400. |
| **Size cap** | Decoded size ≤ **3 MB** (computed from base64 length), keeping the ~4 MB encoded body safely under the server's 5 MB JSON limit. |
| **Base64 integrity** | Payload must be valid base64 (`/^[A-Za-z0-9+/=]+$/`). |
| **Filename sanitization** | Strip to `[\w.\- ]`, max 120 chars (prevents path/script injection in the stored name). |
| **Extension allowlist** | `.pdf/.jpg/.jpeg/.png` (when an extension is present). |

Client-side mirror in `frontend/src/utils/file.js` (`validateUploadFile`) gives immediate feedback; the server re-validates (never trusts the client).

---

## Serving & access control

**`GET /api/leave/:id/document`** (protected):
- **Owner-or-admin only.** A student fetching another student's document → **403**.
- No document on the record → **404** ("No document was attached…").
- Returns the data URL in JSON. The client (`utils/file.js → dataUrlToObjectUrl`) converts it to a `Blob` + object URL for preview/download.

**Why JSON + client-side Blob (not a direct binary link):** auth is a `Bearer` token in `localStorage`, not a cookie. A plain `<a href>` would not carry the token. Fetching through the authenticated `apiCall` and building a local object URL keeps the existing auth model intact and works in the Capacitor APK WebView.

**List payload:** `GET /api/leave` uses `.select('-document')` — the blob never travels in list responses (verified: list returns `documentName` but `document === undefined`).

---

## Graceful failure handling

| Scenario | Behavior |
|----------|----------|
| No document attached | Admin sees "—"; student sees no button; endpoint 404 with friendly message. |
| Blob missing/corrupt | `dataUrlToObjectUrl` wrapped in try/catch → toast "Could not open/download the document." |
| Wrong/oversized file at upload | Rejected client-side (toast) and server-side (400). |
| Unauthorized fetch | 403, no data leaked. |

---

## End-to-end flow

```
Student picks file
  → validateUploadFile (type/ext/size)         [client]
  → FileReader.readAsDataURL → base64           [client]
  → POST /api/leave { …, document, name, type }
  → validateDocument (MIME/size/base64/name)    [server]
  → stored on Leave doc                          [MongoDB]

Admin (LeavesTab) sees "Preview / ⬇" when documentName present
  → GET /api/leave/:id/document (owner-or-admin) [server]
  → dataUrlToObjectUrl → window.open / download  [client]
```

**Verified (15/15 API checks passed):** upload persists; list excludes blob but keeps name; owner & admin can fetch; cross-user fetch blocked; invalid type rejected.

*Phase 1 deliverable — DO NOT COMMIT.*
