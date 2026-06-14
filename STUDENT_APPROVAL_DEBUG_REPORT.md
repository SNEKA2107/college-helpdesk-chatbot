# STUDENT APPROVAL — DEBUG REPORT

**Date:** 2026-06-15
**Component:** Admin → Students (registration approval)
**Severity:** High — admins cannot view/approve any pending registration whenever pending students exist.
**Status:** Root cause **CONFIRMED** (not a guess — verified against live MongoDB/API data and React source).

---

## 1. Observed vs. Expected

| | Observed | Expected |
|---|---|---|
| Header subtitle | "… · 4 awaiting approval" | same |
| Filter dropdown | "Pending (4)" | same |
| Table body (after selecting Pending) | **"No students found"** | **4 pending student rows** |

---

## 2. Verification — traced MongoDB → API → React → Table

### 2.1 MongoDB / API payload (live, `ADMIN01`)

`GET /api/students`:

```
total count: 1017
approvalStatus breakdown: {'approved': 1013, 'pending': 4}
--- pending rows (name | studentId | approvalStatus) ---
'lavanya m'    | 19232005    | 'pending'
'roshan kumar' | 192321000   | 'pending'
'lavanya m'    | 22IT05      | 'pending'
'mani sm'      | 9787225154  | 'pending'
```

`GET /api/students?status=pending`:

```
count: 4
'lavanya m'    19232005    'pending'
'roshan kumar' 192321000   'pending'
'lavanya m'    22IT05      'pending'
'mani sm'      9787225154  'pending'
```

**Conclusion:** The database holds exactly 4 documents with `approvalStatus: 'pending'`, each with a valid `name`. The API returns them correctly, both unfiltered and server-filtered. **Backend, MongoDB query, and API response mapping are all correct.** The bug is 100% in the React layer.

### 2.2 Investigation checklist results

| # | Item | File / location | Verdict |
|---|------|-----------------|---------|
| 1 | Student count query | `backend/routes/students.js:9-26` (`GET /`) | ✅ Correct — returns `count: 1017` |
| 2 | Student list query | same | ✅ Correct — all 1017 returned with `name` + `approvalStatus` |
| 3 | Pending filter logic | `frontend/src/pages/admin/StudentsTab.jsx:20` | ⚠️ Correct *in isolation*, but fed a corrupted `statusFilter` value |
| 4 | Search filter logic | `StudentsTab.jsx:21` | ✅ Not involved (`applied` is empty in repro) |
| 5 | Approval status field names | `User.approvalStatus` (model `:27`), `norm()` (`StudentsTab.jsx:8`) | ✅ Consistent (`pending`/`approved`/`rejected`) |
| 6 | API response mapping | `Admin.jsx:75` `students: sRes.data.students` | ✅ Correct |
| 7 | MongoDB query conditions | `backend/routes/students.js:11-21` | ✅ Correct |
| 8 | React state management | `StudentsTab.jsx:14,41-43` (`statusFilter`) | ❌ **ROOT CAUSE — corrupted state value** |

---

## 3. Root Cause

**File:** `frontend/src/pages/admin/StudentsTab.jsx`
**Exact bug location:** **line 42** (the filter `<option>` inside the `<select>`).

```jsx
// line 41-43
<select className="form-select" ... value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
  {FILTERS.map(f => <option key={f}>{f}{f === 'Pending' && pendingCount ? ` (${pendingCount})` : ''}</option>)}
</select>
```

The `<option>` element has **no `value` attribute**. Per the HTML spec, when an `<option>` has no `value`, its value defaults to its **text content**. For the Pending option the text content is dynamically built as `"Pending (4)"` whenever `pendingCount > 0`.

Therefore, when the admin selects "Pending":

```
e.target.value === "Pending (4)"        // NOT "Pending"
setStatusFilter("Pending (4)")
```

The filter at `StudentsTab.jsx:20` then runs:

```js
// statusFilter = "Pending (4)"
if (statusFilter !== 'All')
  list = list.filter(s => norm(s) === statusFilter.toLowerCase());
//                         norm(s) === "pending (4)"   → matches 0 students
```

No student has `approvalStatus === "pending (4)"`, so `list` becomes empty → the table renders **"No students found"** (`StudentsTab.jsx:64`).

Meanwhile `pendingCount` (line 16) is computed independently and directly from `data.students`, so it correctly stays **4** — which is why the header and the dropdown label still say "4 awaiting approval" / "Pending (4)". The card title visibly exposes the corruption: it renders `"{statusFilter} Students ({list.length})"` → **"Pending (4) Students (0)"**.

### Why it is self-defeating
The count suffix ` (4)` is appended **only when `pendingCount > 0`** — i.e. exactly when there *are* pending students to display. So:
- 0 pending → option value is clean `"Pending"`, filter works, but nothing to show anyway.
- ≥1 pending → option value becomes `"Pending (N)"`, filter breaks, pending students are **never** viewable/approvable.

The `All`, `Approved`, and `Rejected` options have no count suffix, so their value equals their label and they work — which is why the pending students *are* visible under the **All** filter, masking the bug.

---

## 4. Affected Files

| File | Role | Change needed |
|------|------|---------------|
| `frontend/src/pages/admin/StudentsTab.jsx` | Renders filter dropdown + applies status filter | **Fix** — pin option `value` to the canonical label |
| `backend/routes/students.js` | Data source | None (correct) |
| `backend/models/User.js` | `approvalStatus` field | None (correct) |
| `frontend/src/pages/Admin.jsx` | Loads `data.students` | None (correct) |

---

## 5. Proposed Fix

Give every `<option>` an explicit `value` equal to its canonical filter key, decoupling the displayed label (which carries the count badge) from the value used in state/comparison.

```jsx
// before (line 42)
{FILTERS.map(f => <option key={f}>{f}{f === 'Pending' && pendingCount ? ` (${pendingCount})` : ''}</option>)}

// after
{FILTERS.map(f => <option key={f} value={f}>{f}{f === 'Pending' && pendingCount ? ` (${pendingCount})` : ''}</option>)}
```

After the fix, selecting the option sets `statusFilter = "Pending"` regardless of the displayed `"Pending (4)"`, so `norm(s) === "pending"` matches all 4 rows and the card title reads "Pending Students (4)".

**Verification plan post-fix:** rebuild frontend, load Admin → Students, select **Pending**, confirm 4 rows (`lavanya m / 19232005`, `roshan kumar / 192321000`, `lavanya m / 22IT05`, `mani sm / 9787225154`) render with working ✓ Approve / ✗ Reject buttons.
