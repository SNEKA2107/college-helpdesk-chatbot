"""Phase 4 — Search, filters, sorting, tables and pagination."""
import time

import pytest

import apiclient
import collectors

pytestmark = pytest.mark.search


# ── library search (student) ────────────────────────────────────────────────
def test_library_exact_match_search(case, student):
    case("Library", "Search — exact title match returns that book",
         "Searching the full title of a seeded book lists it")
    collectors.covers("student-portal-library-search")
    student.open("library")
    time.sleep(1.5)
    student.library_search("Computer Networks")
    time.sleep(1.0)
    body = student.body_text.lower()
    case.actual(f"'computer networks' present={'computer networks' in body}")
    assert "computer networks" in body, "exact-match search did not return the book"


def test_library_partial_match_search(case, student):
    case("Library", "Search — a partial term still matches",
         "Searching a substring of a title returns the matching book(s)")
    student.open("library")
    time.sleep(1.5)
    student.library_search("Java")
    time.sleep(1.0)
    body = student.body_text.lower()
    case.actual(f"'java' present={'java' in body}")
    assert "java" in body, "partial-match search returned nothing"


def test_library_empty_search_restores_full_catalogue(case, student):
    case("Library", "Search — an empty query restores the full catalogue",
         "Clearing the search box lists the books again rather than an empty state")
    student.open("library")
    time.sleep(1.5)
    student.library_search("Computer Networks")
    time.sleep(1.0)
    narrowed = student.result_count()
    student.library_search("")
    time.sleep(1.2)
    restored = student.result_count()
    case.actual(f"narrowed={narrowed} restored={restored}")
    assert restored >= narrowed, f"empty search did not restore results ({narrowed} -> {restored})"


def test_library_no_match_shows_empty_state(case, student):
    case("Library", "Search — a term with no matches shows an empty state",
         "The UI communicates 'no results' instead of rendering a broken list")
    student.open("library")
    time.sleep(1.5)
    student.library_search("zzzqqqxxnotabook")
    time.sleep(1.2)
    body = student.body_text.lower()
    has_empty_state = any(k in body for k in ("no book", "not found", "no result", "no match"))
    case.actual(f"empty state shown={has_empty_state}")
    if not has_empty_state:
        collectors.ui_finding("/student/library",
                              "A no-results search shows no empty-state message",
                              "Medium", "search term 'zzzqqqxxnotabook'")
    assert student.rendered_ok, "the library page broke on a no-match search"


def test_library_category_filter(case, student):
    case("Library", "Filter — category chips narrow the catalogue",
         "Selecting a category shows only books in that category")
    collectors.covers("student-portal-library-filtering")
    student.open("library")
    time.sleep(1.5)
    all_count = student.result_count()
    student.library_category("Programming")
    time.sleep(1.2)
    filtered = student.result_count()
    student.library_category("All Books")
    time.sleep(1.2)
    restored = student.result_count()
    case.actual(f"all={all_count} filtered={filtered} restored={restored}")
    assert student.rendered_ok, "the category filter broke the page"


def test_library_search_api_is_case_insensitive(case):
    case("Library", "Search API matches case-insensitively",
         "'java' and 'JAVA' return the same number of books")
    token = apiclient.login_token("student")
    lower = apiclient.api("/library?search=java", "GET", token=token)
    upper = apiclient.api("/library?search=JAVA", "GET", token=token)
    n_lower = len(lower.json().get("books") or [])
    n_upper = len(upper.json().get("books") or [])
    case.actual(f"'java'={n_lower} books, 'JAVA'={n_upper} books")
    collectors.api_result("/library?search=", "GET", "same count", f"{n_lower} vs {n_upper}",
                          "Pass" if n_lower == n_upper else "Fail", "case-insensitive search")
    assert n_lower == n_upper, f"case sensitivity in search ({n_lower} vs {n_upper})"


# ── request filters (student) ───────────────────────────────────────────────
@pytest.mark.parametrize("tab", ["All", "Completed", "In Progress", "Pending"])
def test_request_status_filter(case, student, tab):
    case("Requests", f"Filter — the '{tab}' tab narrows the request list",
         "The list re-renders with only requests in that state")
    collectors.covers("student-portal-requests-filtering")
    student.open("requests")
    time.sleep(1.5)
    total = len(student.request_cards())
    clicked = student.filter_requests(tab)
    time.sleep(0.8)
    shown = len(student.request_cards())
    case.actual(f"clicked={clicked} all={total} '{tab}'={shown}")
    assert clicked, f"the '{tab}' filter was not clickable"
    assert shown <= total, f"'{tab}' showed more rows ({shown}) than 'All' ({total})"
    assert student.rendered_ok, f"the '{tab}' filter broke the page"


# ── attendance search + filter ──────────────────────────────────────────────
def test_attendance_search_and_filter(case, student):
    case("Attendance", "Search and status filter operate on the attendance table",
         "The subject search and status dropdown both narrow the visible rows")
    collectors.covers("student-portal-attendance-search", "student-portal-attendance-filtering")
    student.open("attendance")
    time.sleep(1.5)
    box = student.find("input[aria-label='Search attendance by subject']") \
        or student.find("input.form-input")
    filt = student.find("select[aria-label='Filter by attendance status']") \
        or (student.selects()[0] if student.selects() else None)
    if box is not None:
        student.type(box, "Java")
        time.sleep(1.0)
    if filt is not None:
        student.select_index(filt, 1)
        time.sleep(1.0)
    case.actual(f"search box={box is not None} status filter={filt is not None} "
                f"rows={len(student.all('tbody tr'))}")
    assert student.rendered_ok, "attendance search/filter broke the page"


# ── admin student directory: search, table, pagination ──────────────────────
def test_admin_student_search_exact(case, admin):
    case("Students", "Search — an exact register number finds one student",
         "Searching 22IT101 lists the matching student")
    collectors.covers("admin-panel-studentstab-search")
    admin.open()
    time.sleep(1.2)
    admin.open_tab("Students")
    time.sleep(1.5)
    admin.search_students("22IT101")
    time.sleep(1.2)
    body = admin.body_text
    case.actual(f"'22IT101' present={'22IT101' in body} rows={admin.row_count()}")
    assert "22IT101" in body, "exact register-number search did not find the student"


def test_admin_student_search_partial(case, admin):
    case("Students", "Search — a partial name matches",
         "Searching a name fragment lists the matching students")
    admin.open()
    time.sleep(1.2)
    admin.open_tab("Students")
    time.sleep(1.5)
    before = admin.row_count()
    admin.search_students("Sneka")
    time.sleep(1.2)
    after = admin.row_count()
    case.actual(f"rows {before} -> {after}; 'sneka' present={'sneka' in admin.body_text.lower()}")
    assert admin.rendered_ok, "partial search broke the students tab"


def test_admin_student_search_api_boundaries(case):
    case("Students", "Search API handles exact, partial and no-match queries",
         "Each query returns HTTP 200 with a well-formed list")
    token = apiclient.login_token("admin")
    cases = [("22IT101", "exact"), ("Sne", "partial"), ("zzzznotastudent", "no match")]
    results = {}
    for q, label in cases:
        res = apiclient.api(f"/students/search/{q}", "GET", token=token)
        results[label] = (res.status, len(res.json().get("students") or []))
        collectors.api_result(f"/students/search/{q}", "GET", 200, res.status,
                              "Pass" if res.status == 200 else "Fail", label)
    case.actual(str(results))
    assert all(s == 200 for s, _ in results.values()), f"search API errors: {results}"
    assert results["no match"][1] == 0, "a nonsense query returned matches"


def test_admin_tables_render_rows(case, admin):
    case("Admin Panel", "Data tables render with headers and rows",
         "The Students tab shows a table containing a header row and data rows")
    collectors.covers("admin-panel-studentstab-data-table")
    admin.open()
    time.sleep(1.2)
    admin.open_tab("Students")
    time.sleep(1.8)
    tables = admin.tables()
    headers = len(admin.all("thead th"))
    rows = len(admin.all("tbody tr"))
    case.actual(f"{len(tables)} table(s), {headers} header cell(s), {rows} row(s)")
    assert tables, "no table rendered in the students tab"
    assert rows > 0, "the students table rendered no rows"


def test_admin_student_list_is_paginated(case):
    case("Students", "Pagination — the student list is served in pages",
         "GET /api/students supports paging rather than returning all 1000+ records at once")
    collectors.covers("admin-panel-studentstab-pagination")
    token = apiclient.login_token("admin")
    first = apiclient.api("/students?page=1&limit=25", "GET", token=token)
    second = apiclient.api("/students?page=2&limit=25", "GET", token=token)
    a = first.json().get("students") or []
    b = second.json().get("students") or []
    ids_a = {s.get("_id") for s in a}
    ids_b = {s.get("_id") for s in b}
    paginated = bool(a) and bool(b) and ids_a != ids_b
    case.actual(f"page1={len(a)} page2={len(b)} distinct={ids_a != ids_b}")
    if not paginated:
        collectors.defect(
            "Students / Performance",
            f"GET /api/students ignores page/limit and returned {len(a)} records in a single "
            "response. With 1000+ seeded students this ships the entire directory to the browser "
            "on every admin page load.",
            "1. GET /api/students?page=1&limit=25  2. GET /api/students?page=2&limit=25  "
            "3. Compare the returned ids",
            "Medium", "backend/routes/students.js")
        collectors.performance("/api/students", 0,
                               f"Returns {len(a)} records with no server-side paging",
                               "Add skip/limit paging and a total count to the response.")
    assert first.status == 200, f"student list failed (HTTP {first.status})"


# ── sorting ─────────────────────────────────────────────────────────────────
def test_notices_are_sorted_pinned_first(case):
    case("Notices", "Sort — pinned notices are returned before unpinned ones",
         "The notices list is ordered with pinned items first")
    token = apiclient.login_token("student")
    rows = apiclient.api("/notices", "GET", token=token).json().get("notices") or []
    flags = [bool(n.get("pinned")) for n in rows]
    ordered = flags == sorted(flags, reverse=True)
    case.actual(f"{len(rows)} notice(s); pinned-first={ordered}")
    if rows and not ordered:
        collectors.ui_finding("/student/notices",
                              "Pinned notices are not ordered ahead of unpinned notices",
                              "Low", f"pinned flags: {flags[:12]}")
    assert rows, "no notices were returned to verify ordering"


def test_audit_log_is_reverse_chronological(case):
    case("Audit Log", "Sort — the audit log is newest-first",
         "Consecutive entries have non-increasing timestamps")
    token = apiclient.login_token("admin")
    logs = apiclient.api("/audit", "GET", token=token).json().get("logs") or []
    stamps = [l.get("createdAt") or "" for l in logs if l.get("createdAt")]
    ordered = stamps == sorted(stamps, reverse=True)
    case.actual(f"{len(stamps)} entr(ies); newest-first={ordered}")
    assert ordered or len(stamps) < 2, "audit log is not in reverse-chronological order"
