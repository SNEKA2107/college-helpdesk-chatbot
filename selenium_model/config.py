"""Central configuration for the CampusAssist Selenium audit suite."""
from pathlib import Path

BASE_URL = "http://localhost:5000"
API_BASE = BASE_URL + "/api"

# Seeded demo credentials (see backend/dev-local.js / seed.js)
STUDENT_ID = "22IT101"
STUDENT_PASSWORD = "student123"
ADMIN_ID = "ADMIN01"
ADMIN_PASSWORD = "admin@123"

# Directory layout
ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
SCREENSHOT_DIR = ROOT / "screenshots"
DATA_DIR = ROOT / "data"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# All student-facing routes (from frontend/src/routes/AppRoutes.jsx)
STUDENT_ROUTES = [
    "/dashboard", "/chat", "/requests", "/attendance", "/status", "/exam",
    "/fees", "/timetable", "/cgpa", "/leave", "/od", "/events",
    "/notices", "/library", "/contact", "/profile", "/calendar",
]
PUBLIC_ROUTES = ["/", "/login", "/register"]
ADMIN_ROUTES = ["/admin"]

# Backend API surface (from backend/server.js)
API_ENDPOINTS = [
    ("/auth/login", "POST"), ("/auth/register", "POST"), ("/auth/me", "GET"),
    ("/students", "GET"), ("/requests", "GET"), ("/leave", "GET"),
    ("/notices", "GET"), ("/exam", "GET"), ("/fees", "GET"),
    ("/library", "GET"), ("/timetable", "GET"), ("/attendance", "GET"),
    ("/events", "GET"), ("/marks", "GET"), ("/calendar", "GET"),
    ("/audit", "GET"),
]

PAGE_LOAD_TIMEOUT = 30
IMPLICIT_WAIT = 5
