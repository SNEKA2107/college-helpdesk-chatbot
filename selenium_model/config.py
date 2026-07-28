"""Central configuration for the CampusAssist automated audit + E2E suite.

Everything the suite needs to know about the application under test lives here:
base URLs, seeded credentials, the route map (kept in sync with
frontend/src/routes/AppRoutes.jsx) and the backend API surface
(backend/server.js + backend/routes/*.js).
"""
from pathlib import Path
import os

# ── Application under test ──────────────────────────────────────────────────
# The Express backend serves the built React SPA from frontend/dist, so one
# origin covers both UI and API.
BASE_URL = os.environ.get("CA_BASE_URL", "http://localhost:5000")
API_BASE = BASE_URL + "/api"

PROJECT_NAME = "CampusAssist — College Helpdesk & Campus OS"

# ── Seeded demo credentials (backend/dev-local.js) ──────────────────────────
STUDENT_ID = "22IT101"
STUDENT_EMAIL = "sneka@college.edu"
STUDENT_PASSWORD = "student123"

ADMIN_ID = "ADMIN01"
ADMIN_EMAIL = "admin@college.edu"
ADMIN_PASSWORD = "admin@123"

FACULTY_ID = "FAC01"
FACULTY_EMAIL = "rajesh.kumar@college.edu"
FACULTY_PASSWORD = "faculty123"

ROLES = {
    "student": (STUDENT_ID, STUDENT_PASSWORD, "/student/dashboard"),
    "admin":   (ADMIN_ID,   ADMIN_PASSWORD,   "/admin/dashboard"),
    "faculty": (FACULTY_ID, FACULTY_PASSWORD, "/faculty/dashboard"),
}

# ── Directory layout ────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
FRONTEND_SRC = PROJECT_ROOT / "frontend" / "src"
BACKEND_DIR = PROJECT_ROOT / "backend"

SCREENSHOT_DIR = ROOT / "screenshots"
DATA_DIR = ROOT / "data"
EVIDENCE_DIR = ROOT / "evidence"
LOG_DIR = ROOT / "logs"
REPORT_XLSX = ROOT / "MASTER_TEST_AUDIT_REPORT.xlsx"
REPORT_HTML = ROOT / "execution_report.html"
CONSOLE_LOG = LOG_DIR / "browser_console.log"
SELENIUM_LOG = LOG_DIR / "selenium.log"

for _d in (SCREENSHOT_DIR, DATA_DIR, EVIDENCE_DIR, LOG_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ── Route map (frontend/src/routes/AppRoutes.jsx) ───────────────────────────
PUBLIC_ROUTES = ["/", "/welcome", "/login", "/register", "/setup"]

STUDENT_ROUTES = [
    "/student/dashboard", "/student/chat", "/student/requests",
    "/student/attendance", "/student/status", "/student/exam", "/student/fees",
    "/student/timetable", "/student/cgpa", "/student/leave", "/student/od",
    "/student/events", "/student/notices", "/student/coursework",
    "/student/library", "/student/contact", "/student/profile",
    "/student/settings", "/student/calendar",
]

FACULTY_ROUTES = [
    "/faculty/dashboard", "/faculty/classes", "/faculty/students",
    "/faculty/attendance", "/faculty/marks", "/faculty/assignments",
    "/faculty/materials", "/faculty/analytics", "/faculty/leave-od",
    "/faculty/notices", "/faculty/notifications", "/faculty/timetable",
    "/faculty/profile",
]

ADMIN_ROUTES = ["/admin/dashboard"]

# Admin control-panel sections are tabs inside /admin/dashboard, not routes.
ADMIN_TABS = [
    ("overview", "Overview"), ("analytics", "AI Analytics"),
    ("knowledge", "Knowledge Base"), ("faculty", "Faculty Directory"),
    ("requests", "Requests"), ("leaves", "Leave Applications"),
    ("notices", "Notices"), ("messages", "Messages"), ("students", "Students"),
    ("departments", "Departments"), ("account", "My Account"),
    ("exams", "Exams"), ("attendance", "Attendance"), ("events", "Events"),
    ("timetable", "Timetable"), ("marks", "Marks"), ("calendar", "Calendar"),
    ("fees", "Fee Verification"), ("audit", "Audit Log"),
]

# Legacy URLs that must redirect rather than 404 (backward-compat contract).
LEGACY_REDIRECTS = [
    ("/roles", "/login"), ("/student/login", "/login"),
    ("/faculty/login", "/login"), ("/admin/login", "/login"),
    ("/dashboard", "/student/dashboard"), ("/requests", "/student/requests"),
    ("/library", "/student/library"), ("/profile", "/student/profile"),
]

# ── Backend API surface used for Phase 5 API validation ─────────────────────
# (endpoint, method, role required, expected status when called correctly)
API_CHECKS = [
    ("/auth/setup-status", "GET", None, 200),
    ("/auth/me", "GET", "student", 200),
    ("/auth/me", "GET", None, 401),
    ("/departments", "GET", None, 200),
    ("/requests", "GET", "student", 200),
    ("/requests/stats", "GET", "student", 200),
    ("/leave", "GET", "student", 200),
    ("/notices", "GET", "student", 200),
    ("/exam", "GET", "student", 200),
    ("/exam/schedule", "GET", "student", 200),
    ("/exam/practicals", "GET", "student", 200),
    ("/fees", "GET", "student", 200),
    ("/library", "GET", "student", 200),
    ("/library/borrowed", "GET", "student", 200),
    ("/library/hours", "GET", "student", 200),
    ("/timetable", "GET", "student", 200),
    ("/timetable/today", "GET", "student", 200),
    ("/attendance", "GET", "student", 200),
    ("/attendance/summary", "GET", "student", 200),
    ("/events", "GET", "student", 200),
    ("/marks", "GET", "student", 200),
    ("/marks/cgpa", "GET", "student", 200),
    ("/calendar", "GET", "student", 200),
    ("/conversations", "GET", "student", 200),
    ("/coursework/assignments", "GET", "student", 200),
    ("/coursework/materials", "GET", "student", 200),
    ("/faculty", "GET", "student", 200),
    ("/students", "GET", "admin", 200),
    ("/students/pending", "GET", "admin", 200),
    ("/audit", "GET", "admin", 200),
    ("/analytics", "GET", "admin", 200),
    ("/knowledge", "GET", "admin", 200),
    ("/knowledge/meta", "GET", "admin", 200),
    ("/knowledge/analytics", "GET", "admin", 200),
    ("/exam/all", "GET", "admin", 200),
    ("/timetable/all", "GET", "admin", 200),
    ("/fees/all", "GET", "admin", 200),
    ("/contact", "GET", "admin", 200),
    ("/faculty-portal/me", "GET", "faculty", 200),
    ("/faculty-portal/dashboard", "GET", "faculty", 200),
    ("/faculty-portal/subjects", "GET", "faculty", 200),
    ("/faculty-portal/students", "GET", "faculty", 200),
    ("/faculty-portal/leaves", "GET", "faculty", 200),
    ("/faculty-portal/notices", "GET", "faculty", 200),
    ("/faculty-portal/assignments", "GET", "faculty", 200),
    ("/faculty-portal/materials", "GET", "faculty", 200),
    ("/faculty-portal/analytics", "GET", "faculty", 200),
    ("/faculty-portal/notifications", "GET", "faculty", 200),
    ("/faculty-portal/timetable", "GET", "faculty", 200),
    # Authorisation boundaries — a student must never reach admin data.
    ("/students", "GET", "student", 403),
    ("/audit", "GET", "student", 403),
    ("/analytics", "GET", "student", 403),
    ("/knowledge", "GET", "student", 403),
    ("/faculty-portal/dashboard", "GET", "student", 403),
    # Unknown API paths must 404 as JSON, not fall through to the SPA shell.
    ("/does-not-exist", "GET", None, 404),
]

# ── Selenium tuning ─────────────────────────────────────────────────────────
HEADLESS = os.environ.get("CA_HEADLESS", "1") != "0"
PAGE_LOAD_TIMEOUT = 40
IMPLICIT_WAIT = 0          # explicit waits only — implicit waits mask timing bugs
EXPLICIT_WAIT = 15
WINDOW_SIZE = (1440, 900)

# Pages slower than this are flagged as a performance observation.
SLOW_PAGE_MS = 3000
