# LIBRARY MODULE VERIFICATION — Phase 3

**Date:** 2026-06-15 · **Scope:** Category filter realism

## Problem
`Library.jsx` had a **hard-coded** filter list `IT, AI, Java, DBMS, Python, Math` while the catalog stores categories `Programming, DBMS, AI / ML, Networking, Python, Software Eng.`. So `IT`, `AI`, `Java`, `Math` → `?category=…` matched **zero** books ("No books found"). 4 of 6 chips were dead-ends.

## Fix (frontend, backward compatible)
Filter chips are now **derived from the actual catalog** — no hard-coded list:
```js
setCategories([...new Set(res.data.books.map(b => b.category).filter(Boolean))].sort());
```
- Chips render one button per distinct category present in the data, plus an **"All Books"** reset.
- Active chip is highlighted; selecting one re-queries `/library?category=<exact value>`.
- Because options come from real data, **every chip returns ≥1 book**.
- No data migration, no category renaming → existing `books` records untouched (fully backward compatible).

## Verification
Catalog distinct categories (from seed): `AI / ML, DBMS, Networking, Programming, Python, Software Eng.`

| Chip | Old behavior | New behavior |
|------|--------------|--------------|
| All Books | n/a | full catalog ✅ |
| AI / ML | (chip was "AI" → 0) | 2 books ✅ |
| DBMS | 1 book ✅ | 1 book ✅ |
| Networking | (absent) | 1 book ✅ |
| Programming | (chip was "Java" → 0) | 1 book ✅ |
| Python | 1 book ✅ | 1 book ✅ |
| Software Eng. | (absent) | 2 books ✅ |
| ~~IT / Java / Math~~ | 0 books (dead) | **removed** (not in data) |

- `npm run build` ✅ — no errors.
- Empty-catalog case: no chips render except "All Books"; table shows "No books found" gracefully.

## Note on static catalog (audit H2)
H2 (no admin Library tab → catalog never changes) is **not** in the must-fix set and was **not** implemented this pass (would add a new admin module). Documented as a remaining item.

## Files changed
- `frontend/src/pages/Library.jsx`

## Collections / APIs
No schema change. Uses existing `GET /api/library?category=`. Collection: `books` (read-only).
