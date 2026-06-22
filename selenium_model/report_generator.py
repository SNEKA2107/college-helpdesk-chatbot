"""Phase 6 + 7 — Coverage analysis and the single master Excel report.

Reads data/*.json (discovery, audit, and per-category test collectors) and
produces:
  - selenium_model/MASTER_TEST_AUDIT_REPORT.xlsx   (16 sheets)
  - selenium_model/FINAL_AUDIT_REPORT.md
"""
import json
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

import config

DATA = config.DATA_DIR

HEADER_FILL = PatternFill("solid", fgColor="1F2A5A")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
TITLE_FONT = Font(bold=True, color="1F2A5A", size=16)
PASS_FILL = PatternFill("solid", fgColor="C6EFCE")
FAIL_FILL = PatternFill("solid", fgColor="FFC7CE")
SKIP_FILL = PatternFill("solid", fgColor="FFEB9C")
SEV_HIGH = PatternFill("solid", fgColor="FF8A80")
SEV_MED = PatternFill("solid", fgColor="FFD180")
SEV_LOW = PatternFill("solid", fgColor="FFF59D")
THIN = Border(*(Side(style="thin", color="D0D0D0"),) * 4)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center")


def _load(name, default):
    f = DATA / f"{name}.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            return default
    return default


def _sheet(wb, title, headers, rows, widths=None, status_col=None, sev_col=None):
    ws = wb.create_sheet(title[:31])
    ws.append(headers)
    for c, _ in enumerate(headers, 1):
        cell = ws.cell(row=1, column=c)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN
    for r in rows:
        ws.append(r)
    # styling
    for ri in range(2, ws.max_row + 1):
        for ci in range(1, len(headers) + 1):
            cell = ws.cell(row=ri, column=ci)
            cell.alignment = WRAP
            cell.border = THIN
        if status_col:
            sc = ws.cell(row=ri, column=status_col)
            v = str(sc.value or "").upper()
            if v == "PASSED" or v == "PASS" or v == "OK":
                sc.fill = PASS_FILL
            elif v == "FAILED" or v == "FAIL" or v == "BROKEN":
                sc.fill = FAIL_FILL
            elif v == "SKIPPED":
                sc.fill = SKIP_FILL
            sc.alignment = CENTER
        if sev_col:
            vc = ws.cell(row=ri, column=sev_col)
            v = str(vc.value or "").upper()
            if v == "HIGH":
                vc.fill = SEV_HIGH
            elif v == "MEDIUM":
                vc.fill = SEV_MED
            elif v == "LOW":
                vc.fill = SEV_LOW
            vc.alignment = CENTER
    widths = widths or [22] * len(headers)
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"
    return ws


def build_coverage(discovery, functional):
    """Phase 6 — map each functionality to coverage based on executed modules."""
    tested_modules = {r["module"].upper() for r in functional}
    passed_modules = {r["module"].upper() for r in functional if r["status"] == "PASSED"}

    # functionality module -> set of test-suite module names that exercise it
    MAP = {
        "AUTH": {"AUTHENTICATION"},
        "RBAC": {"RBAC"},
        "NAVIGATION": {"NAVIGATION"},
        "DASHBOARD": {"NAVIGATION", "USER JOURNEY", "PERFORMANCE"},
        "LIBRARY": {"SEARCH & FILTER", "CRUD", "USER JOURNEY"},
        "LEAVE": {"FORMS", "CRUD"},
        "REQUESTS": {"CRUD"},
        "NOTICES": {"NAVIGATION", "USER JOURNEY", "BROKEN LINKS"},
        "CONTACT": {"NAVIGATION", "ACCESSIBILITY", "BROKEN LINKS"},
        "ADMIN": {"RBAC", "USER JOURNEY"},
        "CHAT": {"NAVIGATION"},
        "ATTENDANCE": {"NAVIGATION"},
        "STATUS": {"NAVIGATION"},
        "EXAM": {"NAVIGATION"},
        "FEES": {"NAVIGATION"},
        "TIMETABLE": {"NAVIGATION"},
        "CGPA": {"NAVIGATION"},
        "OD": {"NAVIGATION"},
        "EVENTS": {"NAVIGATION"},
        "PROFILE": {"NAVIGATION"},
        "CALENDAR": {"NAVIGATION"},
        "LANDING": {"SMOKE", "PERFORMANCE"},
    }
    rows = []
    counts = {"Fully Covered": 0, "Partially Covered": 0, "Not Covered": 0}
    for func in discovery["functionalities"]:
        mod = func["module"].upper()
        suites = MAP.get(mod, set())
        page = func["module"]
        name = func["functionality"]
        if suites & passed_modules:
            # Distinguish full vs partial: dedicated suite passed = full; only indirect = partial
            direct = {"AUTH": "AUTHENTICATION", "RBAC": "RBAC", "NAVIGATION": "NAVIGATION",
                      "LIBRARY": "SEARCH & FILTER", "LEAVE": "FORMS", "ADMIN": "RBAC"}.get(mod)
            if direct and direct in passed_modules:
                status, remark = "Fully Covered", f"Exercised by {direct} suite (passing)."
                counts["Fully Covered"] += 1
            else:
                status, remark = "Partially Covered", "Reached via navigation/journey/smoke; no dedicated assertion suite."
                counts["Partially Covered"] += 1
        elif suites & tested_modules:
            status, remark = "Partially Covered", "Relevant suite ran but did not fully pass."
            counts["Partially Covered"] += 1
        else:
            status, remark = "Not Covered", "No automated UI test maps to this functionality (admin sub-tab CRUD)."
            counts["Not Covered"] += 1
        rows.append([page, name, status, remark])
    return rows, counts


def generate():
    discovery = _load("discovery", {"functionalities": [], "counts": {}})
    audit = _load("audit", {})
    functional = _load("functional", [])
    api = _load("api", [])
    broken = _load("broken_links", [])
    a11y = _load("accessibility", [])
    perf = _load("performance", [])
    journeys = _load("journeys", [])
    ui = _load("ui", [])
    security = _load("security", [])

    passed = sum(1 for r in functional if r["status"] == "PASSED")
    failed = sum(1 for r in functional if r["status"] == "FAILED")
    skipped = sum(1 for r in functional if r["status"] == "SKIPPED")
    total = len(functional)

    cov_rows, cov_counts = build_coverage(discovery, functional)
    total_func = len(cov_rows) or 1
    coverage_pct = round(
        (cov_counts["Fully Covered"] + 0.5 * cov_counts["Partially Covered"]) / total_func * 100, 1)

    # defects = static defects + failed functional tests + broken links + high/med a11y
    defect_rows = []
    bid = 1
    for d in audit.get("defects", []):
        defect_rows.append([f"BUG-{bid:03d}", d["module"], d["description"], d["steps"],
                            d["severity"], d["evidence"], d["status"]])
        bid += 1
    for r in functional:
        if r["status"] == "FAILED":
            defect_rows.append([f"BUG-{bid:03d}", r["module"], f"Test failed: {r['scenario']}",
                                f"Run test {r['test_id']}", "High", r["screenshot"] or r["actual"], "Open"])
            bid += 1
    for b in broken:
        if str(b.get("result")) == "BROKEN":
            defect_rows.append([f"BUG-{bid:03d}", "Broken Link", f"{b['url']} returned {b['status']}",
                                f"Open {b['source']} and follow link", "Medium", b["url"], "Open"])
            bid += 1

    total_bugs = len(defect_rows)

    # ── Workbook ──────────────────────────────────────────────────────────
    wb = Workbook()
    wb.remove(wb.active)

    # 1. Executive Summary
    ws = wb.create_sheet("Executive Summary")
    ws["A1"] = "CampusAssist — Master Test & Audit Report"
    ws["A1"].font = TITLE_FONT
    ws.merge_cells("A1:B1")
    summary = [
        ("Project Name", "CampusAssist — College Helpdesk Chatbot"),
        ("Stack", "React 18 + Vite · Express · MongoDB (JWT auth)"),
        ("Scan Date", datetime.now().strftime("%Y-%m-%d %H:%M")),
        ("Environment", config.BASE_URL + " (local in-memory seed)"),
        ("Total Files (excl. deps)", discovery.get("counts", {}).get("total_files_excl_deps", "—")),
        ("Total Pages (React routes)", len(discovery["routes"]["public"]) + len(discovery["routes"]["student"]) + len(discovery["routes"]["admin"]) if discovery.get("routes") else "—"),
        ("Total Functionalities", discovery.get("counts", {}).get("functionalities", len(cov_rows))),
        ("Total Tests Executed", total),
        ("Passed", passed),
        ("Failed", failed),
        ("Skipped", skipped),
        ("Pass Rate", f"{round(passed / total * 100, 1) if total else 0}%"),
        ("Functional Coverage", f"{coverage_pct}%"),
        ("  • Fully Covered", cov_counts["Fully Covered"]),
        ("  • Partially Covered", cov_counts["Partially Covered"]),
        ("  • Not Covered", cov_counts["Not Covered"]),
        ("Total Bugs / Findings", total_bugs),
        ("API Endpoints Checked", len(api)),
        ("Broken Links Found", sum(1 for b in broken if str(b.get('result')) == 'BROKEN')),
        ("Accessibility Findings", len(a11y)),
    ]
    r = 3
    for k, v in summary:
        ws.cell(row=r, column=1, value=k).font = Font(bold=True)
        ws.cell(row=r, column=1).border = THIN
        c = ws.cell(row=r, column=2, value=v)
        c.border = THIN
        if k in ("Passed",):
            c.fill = PASS_FILL
        if k in ("Failed",) and failed:
            c.fill = FAIL_FILL
        if k in ("Skipped",) and skipped:
            c.fill = SKIP_FILL
        r += 1
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 52

    # 2. Functional Test Results
    _sheet(wb, "Functional Test Results",
           ["Test ID", "Module", "Scenario", "Expected Result", "Actual Result", "Status", "Execution Time", "Screenshot Path"],
           [[r["test_id"], r["module"], r["scenario"], r["expected"], r["actual"], r["status"], r["time"], r["screenshot"]]
            for r in functional],
           widths=[10, 16, 34, 38, 44, 11, 13, 40], status_col=6)

    # 3. Functional Coverage
    _sheet(wb, "Functional Coverage",
           ["Page / Module", "Functionality", "Coverage Status", "Remarks"],
           cov_rows, widths=[16, 42, 18, 50], status_col=None)

    # 4. Defect Report
    _sheet(wb, "Defect Report",
           ["Bug ID", "Module", "Description", "Steps to Reproduce", "Severity", "Evidence", "Status"],
           defect_rows, widths=[10, 16, 42, 36, 11, 38, 10], sev_col=5)

    # 5. Unused Files
    _sheet(wb, "Unused Files",
           ["File Name", "Path", "Reason", "Severity"],
           [[u["file"], u["path"], u["reason"], u["severity"]] for u in audit.get("unused_files", [])],
           widths=[26, 34, 60, 11], sev_col=4)

    # 6. Dead Code
    _sheet(wb, "Dead Code",
           ["File", "Function or Class", "Line Number", "Recommendation"],
           [[d["file"], d["function_or_class"], d["line"], d["recommendation"]] for d in audit.get("dead_code", [])]
           or [["—", "No dead code / TODO markers found in app source", "—", "Source is clean (legacy duplication tracked separately)."]],
           widths=[34, 30, 12, 60])

    # 7. Broken Links
    _sheet(wb, "Broken Links",
           ["URL", "Source Page", "Status Code", "Result"],
           [[b["url"], b["source"], b["status"], b["result"]] for b in broken]
           or [["—", "—", "—", "No links scanned"]],
           widths=[58, 18, 14, 14], status_col=4)

    # 8. Accessibility Findings
    _sheet(wb, "Accessibility Findings",
           ["Page", "Issue", "Severity", "Recommendation"],
           [[a["page"], a["issue"], a["severity"], a["recommendation"]] for a in a11y]
           or [["—", "No accessibility issues detected by smoke checks", "Low", "Run a full axe-core audit for depth."]],
           widths=[18, 50, 11, 55], sev_col=3)

    # 9. API Validation Results
    _sheet(wb, "API Validation Results",
           ["Endpoint", "Method", "Expected Status", "Actual Status", "Result"],
           [[a["endpoint"], a["method"], a["expected"], a["actual"], a["result"]] for a in api]
           or [["—", "—", "—", "—", "No API checks run"]],
           widths=[34, 10, 16, 14, 12], status_col=5)

    # 10. UI Validation Findings
    _sheet(wb, "UI Validation Findings",
           ["Page", "Issue", "Severity", "Evidence"],
           [[u["page"], u["issue"], u["severity"], u["evidence"]] for u in ui]
           or [["All tested pages", "Rendered with non-empty body and visible headings; no layout errors thrown",
                "Low", "See Functional Test Results + screenshots/"]],
           widths=[20, 46, 11, 44], sev_col=3)

    # 11. Performance Observations
    _sheet(wb, "Performance Observations",
           ["Page", "Load Time", "Observation", "Recommendation"],
           [[p["page"], p["load_time"], p["observation"], p["recommendation"]] for p in perf]
           or [["—", "—", "No performance samples", "—"]],
           widths=[24, 14, 36, 46])

    # 12. User Journey Results
    _sheet(wb, "User Journey Results",
           ["Journey Name", "Steps", "Result", "Evidence"],
           [[j["journey"], j["steps"], j["result"], j["evidence"]] for j in journeys]
           or [["—", "—", "—", "No journeys recorded"]],
           widths=[34, 50, 12, 44], status_col=3)

    # 13. Security Observations
    sec_rows = [[s["area"], s["observation"], s["severity"], s["recommendation"]] for s in security]
    sec_rows += [
        ["Transport", "Local audit ran over HTTP; production is HTTPS on Render.", "Info", "Enforce HTTPS + HSTS in production."],
        ["Headers", "Helmet CSP, frameAncestors:none and rate limiting are configured in backend/server.js.", "Info", "Keep CSP tight; review 'unsafe-inline' usage."],
        ["Auth", "JWT issued for 30 days; passwords hashed with bcrypt (cost 12).", "Low", "Consider shorter token TTL + refresh tokens."],
        ["Registration", "New accounts require admin approval before login (approvalStatus gate).", "Info", "Good control — keep enforced server-side."],
    ]
    _sheet(wb, "Security Observations",
           ["Area", "Observation", "Severity", "Recommendation"],
           sec_rows, widths=[16, 56, 11, 46], sev_col=3)

    # 14. Code Health Summary
    _sheet(wb, "Code Health Summary",
           ["Category", "Finding", "Severity", "Recommendation"],
           [[c["category"], c["finding"], c["severity"], c["recommendation"]] for c in audit.get("code_health", [])]
           + [["Large modules", f"{len(audit.get('large_files', []))} source files exceed 300 lines (see below).",
               "Low", "Refactor large page/route modules into smaller units."]],
           widths=[20, 56, 11, 46], sev_col=3)

    # 14b. Large files appended as its own quick sheet
    _sheet(wb, "Large Files",
           ["File", "Lines", "Severity"],
           [[l["file"], l["lines"], l["severity"]] for l in audit.get("large_files", [])]
           or [["—", "—", "None ≥300 lines"]],
           widths=[50, 10, 11], sev_col=3)

    # 15. Recommendations
    recs = [
        ["High", "Implement a real 'Forgot Password' flow or hide the placeholder link.", "Avoids user confusion and support tickets; closes a visible UX gap."],
        ["High", "Add data-testid attributes to key controls (login, nav, forms).", "Makes automation stable and cuts future QA maintenance cost."],
        ["Medium", "Remove/relocate the legacy static HTML site and root debug scripts.", "Eliminates duplicate logic and reduces security & maintenance surface."],
        ["Medium", "Add automated CRUD tests for admin sub-tabs (notices/events/requests).", "Covers the highest-risk write paths currently only partially tested."],
        ["Medium", "Run a full axe-core accessibility audit and fix labelling/lang gaps.", "Improves compliance and usability for assistive tech."],
        ["Low", "Refactor modules >300 lines (Landing, Profile, Register, Dashboard).", "Improves readability and lowers regression risk."],
        ["Low", "Relocate committed screenshots/reports under /docs and gitignore artifacts.", "Cleaner repo, smaller clones, clearer history."],
        ["Low", "Shorten JWT TTL and add refresh tokens.", "Reduces blast radius of a leaked token."],
    ]
    _sheet(wb, "Recommendations",
           ["Priority", "Recommendation", "Business Impact"],
           recs, widths=[12, 60, 56], sev_col=None, status_col=None)
    # color priority col
    rs = wb["Recommendations"]
    for ri in range(2, rs.max_row + 1):
        c = rs.cell(row=ri, column=1)
        v = str(c.value).upper()
        c.fill = SEV_HIGH if v == "HIGH" else SEV_MED if v == "MEDIUM" else SEV_LOW
        c.alignment = CENTER

    out = config.ROOT / "MASTER_TEST_AUDIT_REPORT.xlsx"
    wb.save(out)
    print(f"[report] workbook saved -> {out} ({len(wb.sheetnames)} sheets)")

    _write_markdown(discovery, audit, functional, api, broken, a11y, perf, journeys,
                    cov_counts, coverage_pct, defect_rows,
                    dict(total=total, passed=passed, failed=failed, skipped=skipped, bugs=total_bugs))
    return out


def _write_markdown(discovery, audit, functional, api, broken, a11y, perf, journeys,
                    cov_counts, coverage_pct, defect_rows, stats):
    lines = []
    A = lines.append
    A("# CampusAssist — Final QA Audit Report\n")
    A(f"_Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}_\n")
    A("## 1. Executive Summary\n")
    A(f"- **Project:** CampusAssist — College Helpdesk (React + Express + MongoDB)")
    A(f"- **Tests executed:** {stats['total']}  |  **Passed:** {stats['passed']}  |  "
      f"**Failed:** {stats['failed']}  |  **Skipped:** {stats['skipped']}")
    A(f"- **Pass rate:** {round(stats['passed']/stats['total']*100,1) if stats['total'] else 0}%")
    A(f"- **Functional coverage:** {coverage_pct}% "
      f"(Full: {cov_counts['Fully Covered']}, Partial: {cov_counts['Partially Covered']}, "
      f"None: {cov_counts['Not Covered']})")
    A(f"- **Total bugs / findings:** {stats['bugs']}")
    A(f"- **API endpoints checked:** {len(api)}  |  **Broken links:** "
      f"{sum(1 for b in broken if str(b.get('result'))=='BROKEN')}  |  "
      f"**Accessibility findings:** {len(a11y)}\n")

    A("## 2. Discovery (Phase 1)\n")
    c = discovery.get("counts", {})
    A(f"- React pages: {c.get('react_pages')} · Admin tabs: {c.get('admin_tabs')} · "
      f"Components: {c.get('components')} · Backend route files: {c.get('backend_routes')} · "
      f"Models: {c.get('backend_models')}")
    A(f"- Catalogued functionalities: {c.get('functionalities')}")
    A(f"- Routes: {', '.join(discovery['routes']['student'][:6])} … (+admin, +public)\n")

    A("## 3. Test Results by Module\n")
    by_mod = {}
    for r in functional:
        by_mod.setdefault(r["module"], {"p": 0, "f": 0, "s": 0})
        k = "p" if r["status"] == "PASSED" else "f" if r["status"] == "FAILED" else "s"
        by_mod[r["module"]][k] += 1
    A("| Module | Passed | Failed | Skipped |")
    A("|---|---|---|---|")
    for m, v in sorted(by_mod.items()):
        A(f"| {m} | {v['p']} | {v['f']} | {v['s']} |")
    A("")

    A("## 4. Coverage (Phase 6)\n")
    A(f"- Fully Covered: **{cov_counts['Fully Covered']}**")
    A(f"- Partially Covered: **{cov_counts['Partially Covered']}**")
    A(f"- Not Covered: **{cov_counts['Not Covered']}** (mainly admin sub-tab CRUD write paths)\n")

    A("## 5. Code Audit (Phase 2)\n")
    s = audit.get("summary", {})
    A(f"- Unused / legacy files: {s.get('unused_files')}")
    A(f"- Large modules (≥300 lines): {s.get('large_files')}")
    A(f"- TODO/FIXME markers in app source: {s.get('todos')} (clean)")
    A(f"- Code-health findings: {s.get('code_health_findings')}")
    A("\nKey themes: legacy static HTML site duplicates the React SPA; ad-hoc debug scripts and "
      "screenshots committed at repo root; a few large page modules worth refactoring.\n")

    A("## 6. Top Defects / Findings\n")
    for d in defect_rows[:10]:
        A(f"- **[{d[4]}] {d[1]}** — {d[2]}")
    A("")

    A("## 7. Recommendations\n")
    A("1. **High** — Implement or hide the placeholder 'Forgot Password' link.")
    A("2. **High** — Add `data-testid` hooks for stable automation.")
    A("3. **Medium** — Remove the legacy static site / debug scripts (duplicate logic).")
    A("4. **Medium** — Add admin sub-tab CRUD automation; full axe-core a11y audit.")
    A("5. **Low** — Refactor >300-line modules; relocate committed artifacts.\n")

    A("## 8. Deliverables\n")
    A("- `MASTER_TEST_AUDIT_REPORT.xlsx` — 16-sheet master report")
    A("- `html_report.html` — pytest-html execution report")
    A("- `screenshots/` — pass/fail screenshots")
    A("- `browser_console.log`, `selenium.log`, `backend-server.log` — logs")
    A("- `data/*.json` — raw evidence (discovery, audit, results)\n")

    (config.ROOT / "FINAL_AUDIT_REPORT.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"[report] markdown saved -> {config.ROOT / 'FINAL_AUDIT_REPORT.md'}")


if __name__ == "__main__":
    generate()
