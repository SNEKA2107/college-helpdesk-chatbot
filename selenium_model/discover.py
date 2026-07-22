"""Phase 1 — Project discovery.

Recursively scans the repo, maps functionalities to source files, and writes
data/discovery.json (consumed by the report generator and coverage analysis).
"""
import json
import re
from pathlib import Path

import config

SRC = config.PROJECT_ROOT / "frontend" / "src"
BACKEND = config.PROJECT_ROOT / "backend"

# ── Functionality catalog: (page/module, functionality, source files) ─────────
# Curated from a full read of the React app + Express API.
FUNCTIONALITIES = [
    ("Landing", "Public marketing landing page + CTAs", ["frontend/src/pages/Landing.jsx"]),
    ("Auth", "Student/Admin login (JWT)", ["frontend/src/pages/Login.jsx", "backend/routes/auth.js"]),
    ("Auth", "Logout / session clear", ["frontend/src/services/auth.js", "frontend/src/components/Sidebar.jsx"]),
    ("Auth", "Registration (pending admin approval)", ["frontend/src/pages/Register.jsx", "backend/routes/auth.js"]),
    ("Auth", "Forgot password affordance", ["frontend/src/pages/Login.jsx"]),
    ("Auth", "Invalid login handling", ["frontend/src/pages/Login.jsx", "backend/routes/auth.js"]),
    ("Auth", "Change password", ["backend/routes/auth.js"]),
    ("RBAC", "Route guards (RequireAuth/RequireAdmin/RedirectIfAuthed)", ["frontend/src/routes/guards.jsx"]),
    ("Navigation", "Sidebar / menu navigation", ["frontend/src/components/Sidebar.jsx"]),
    ("Navigation", "Topbar", ["frontend/src/components/Topbar.jsx"]),
    ("Navigation", "Bottom nav (mobile)", ["frontend/src/components/BottomNav.jsx"]),
    ("Navigation", "Layout shell", ["frontend/src/components/Layout.jsx"]),
    ("Dashboard", "Student dashboard widgets", ["frontend/src/pages/Dashboard.jsx"]),
    ("Chat", "AI helpdesk chatbot", ["frontend/src/pages/Chat.jsx", "backend/routes/chat.js"]),
    ("Requests", "Certificate requests (list/create)", ["frontend/src/pages/Requests.jsx", "backend/routes/requests.js"]),
    ("Attendance", "Attendance view", ["frontend/src/pages/Attendance.jsx", "backend/routes/attendance.js"]),
    ("Status", "Marksheet/request status", ["frontend/src/pages/Status.jsx", "backend/routes/requests.js"]),
    ("Exam", "Exam schedule + hall ticket", ["frontend/src/pages/Exam.jsx", "backend/routes/exam.js"]),
    ("Fees", "Fee breakdown / history", ["frontend/src/pages/Fees.jsx", "backend/routes/fees.js"]),
    ("Timetable", "Weekly timetable", ["frontend/src/pages/Timetable.jsx", "backend/routes/timetable.js"]),
    ("CGPA", "CGPA calculator", ["frontend/src/pages/Cgpa.jsx"]),
    ("Leave", "Leave application + file upload", ["frontend/src/pages/Leave.jsx", "backend/routes/leave.js"]),
    ("OD", "On-duty request", ["frontend/src/pages/Od.jsx", "backend/routes/leave.js"]),
    ("Events", "Events listing", ["frontend/src/pages/Events.jsx", "backend/routes/events.js"]),
    ("Notices", "Notices feed", ["frontend/src/pages/Notices.jsx", "backend/routes/notices.js"]),
    ("Library", "Book catalog search + filter + borrowed", ["frontend/src/pages/Library.jsx", "backend/routes/library.js"]),
    ("Contact", "Contact office form", ["frontend/src/pages/Contact.jsx", "backend/routes/contact.js"]),
    ("Profile", "Student profile view/edit", ["frontend/src/pages/Profile.jsx", "backend/routes/auth.js"]),
    ("Calendar", "Academic calendar", ["frontend/src/pages/Calendar.jsx", "backend/routes/calendar.js"]),
    ("Admin", "Admin console shell + tabs", ["frontend/src/pages/Admin.jsx"]),
    ("Admin", "Overview dashboard", ["frontend/src/pages/admin/OverviewTab.jsx"]),
    ("Admin", "Students management + search", ["frontend/src/pages/admin/StudentsTab.jsx", "backend/routes/students.js"]),
    ("Admin", "Requests management (CRUD)", ["frontend/src/pages/admin/RequestsTab.jsx", "backend/routes/requests.js"]),
    ("Admin", "Leaves approval", ["frontend/src/pages/admin/LeavesTab.jsx", "backend/routes/leave.js"]),
    ("Admin", "Notices management (CRUD)", ["frontend/src/pages/admin/NoticesTab.jsx", "backend/routes/notices.js"]),
    ("Admin", "Events management (CRUD)", ["frontend/src/pages/admin/EventsTab.jsx", "backend/routes/events.js"]),
    ("Admin", "Exams management", ["frontend/src/pages/admin/ExamsTab.jsx", "backend/routes/exam.js"]),
    ("Admin", "Fees management", ["frontend/src/pages/admin/FeesTab.jsx", "backend/routes/fees.js"]),
    ("Admin", "Marks management", ["frontend/src/pages/admin/MarksTab.jsx", "backend/routes/marks.js"]),
    ("Admin", "Attendance management", ["frontend/src/pages/admin/AttendanceTab.jsx", "backend/routes/attendance.js"]),
    ("Admin", "Timetable management", ["frontend/src/pages/admin/TimetableTab.jsx", "backend/routes/timetable.js"]),
    ("Admin", "Calendar management", ["frontend/src/pages/admin/CalendarTab.jsx", "backend/routes/calendar.js"]),
    ("Admin", "Messages (contact inbox)", ["frontend/src/pages/admin/MessagesTab.jsx", "backend/routes/contact.js"]),
    ("Admin", "Audit log", ["frontend/src/pages/admin/AuditTab.jsx", "backend/routes/audit.js"]),
    ("Admin", "Account / registration approvals", ["frontend/src/pages/admin/AccountTab.jsx", "backend/routes/students.js"]),
]


def _count(globpat, root):
    return len([p for p in root.rglob(globpat) if "node_modules" not in p.parts and "dist" not in p.parts])


def discover():
    pages = sorted([p.name for p in (SRC / "pages").glob("*.jsx")])
    admin_tabs = sorted([p.name for p in (SRC / "pages" / "admin").glob("*.jsx")])
    components = sorted([p.name for p in (SRC / "components").glob("*.jsx")])
    services = sorted([p.name for p in (SRC / "services").glob("*.js")])
    hooks = sorted([p.name for p in (SRC / "hooks").glob("*")])
    routes = sorted([p.name for p in (BACKEND / "routes").glob("*.js")])
    models = sorted([p.name for p in (BACKEND / "models").glob("*.js")])

    total_files = sum(1 for p in config.PROJECT_ROOT.rglob("*")
                      if p.is_file() and "node_modules" not in p.parts
                      and ".git" not in p.parts and "dist" not in p.parts)

    data = {
        "project": "CampusAssist — College Helpdesk (React + Express + MongoDB)",
        "routes": {
            "public": config.PUBLIC_ROUTES,
            "student": config.STUDENT_ROUTES,
            "admin": config.ADMIN_ROUTES,
        },
        "pages": pages,
        "admin_tabs": admin_tabs,
        "components": components,
        "services": services,
        "hooks": hooks,
        "backend_routes": routes,
        "backend_models": models,
        "api_endpoints": [f"{m} /api{p}" for p, m in config.API_ENDPOINTS],
        "functionalities": [
            {"module": m, "functionality": f, "source_files": s} for m, f, s in FUNCTIONALITIES],
        "counts": {
            "total_files_excl_deps": total_files,
            "react_pages": len(pages),
            "admin_tabs": len(admin_tabs),
            "components": len(components),
            "backend_routes": len(routes),
            "backend_models": len(models),
            "functionalities": len(FUNCTIONALITIES),
        },
    }
    out = config.DATA_DIR / "discovery.json"
    out.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"[discover] {len(FUNCTIONALITIES)} functionalities, {len(pages)} pages, "
          f"{len(routes)} API route files -> {out}")
    return data


if __name__ == "__main__":
    discover()
