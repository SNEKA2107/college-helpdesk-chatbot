"""Phase 1 — Project discovery.

Statically walks the repository and derives the application's functional
inventory: routes, components, forms, buttons, links, CRUD operations, search,
filters, uploads/downloads, tables, modals, APIs, roles and dashboard modules.

Every functionality is mapped back to the source file(s) that implement it, and
carries a stable `fid` so Phase 6 can join it against executed tests.

Output: data/discovery.json
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

import config

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "android", "__pycache__",
    ".pytest_cache", "releases", "coverage",
}

# Root-level directories that are snapshots/clones rather than live source.
CLONE_DIRS = {"demo-clone", "viva-clone", "viva-clone2", "college-helpdesk-chatbot",
              "repository-name", "example", "automated_test"}


# ── helpers ─────────────────────────────────────────────────────────────────
def iter_files(root: Path, exts=None):
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if exts and p.suffix.lower() not in exts:
            continue
        yield p


def rel(p: Path) -> str:
    try:
        return str(p.relative_to(config.PROJECT_ROOT)).replace("\\", "/")
    except ValueError:
        return str(p).replace("\\", "/")


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


# ── functionality inventory ─────────────────────────────────────────────────
class Inventory:
    """Accumulates discovered functionality rows with de-duplication."""

    def __init__(self):
        self._rows: dict[str, dict] = {}

    def add(self, module, page, functionality, category, sources, detail=""):
        fid = re.sub(r"[^a-z0-9]+", "-", f"{module}-{functionality}".lower()).strip("-")
        row = self._rows.setdefault(fid, {
            "fid": fid, "module": module, "page": page,
            "functionality": functionality, "category": category,
            "sources": [], "detail": detail,
        })
        for s in (sources if isinstance(sources, (list, tuple)) else [sources]):
            if s and s not in row["sources"]:
                row["sources"].append(s)
        if detail and not row["detail"]:
            row["detail"] = detail
        return fid

    def rows(self):
        return list(self._rows.values())


# ── frontend analysis ───────────────────────────────────────────────────────
UI_PATTERNS = [
    # (regex, category, functionality template)
    (re.compile(r'type="file"'), "Upload", "File upload"),
    (re.compile(r'<select\b|form-select'), "Form", "Dropdown/select input"),
    (re.compile(r'<textarea\b|form-textarea'), "Form", "Multi-line text input"),
    (re.compile(r'type="date"'), "Form", "Date input"),
    (re.compile(r'type="checkbox"'), "Form", "Checkbox input"),
    (re.compile(r'type="radio"'), "Form", "Radio input"),
    (re.compile(r'<Modal\b|modal-overlay'), "Modal", "Modal / popup dialog"),
    (re.compile(r'<table\b|data-table|<thead\b'), "Table", "Data table"),
    (re.compile(r'\bpage\b\s*[,)]|setPage\(|pagination|Pagination'), "Table", "Pagination"),
    (re.compile(r'sortBy|setSort\(|\.sort\('), "Sort", "Sorting"),
    (re.compile(r'search|Search'), "Search", "Search"),
    (re.compile(r'filter|Filter'), "Filter", "Filtering"),
    (re.compile(r'download|Download|createObjectURL|\.csv'), "Download", "Download / export"),
    (re.compile(r'showToast|useToast'), "Notification", "Toast notification"),
    (re.compile(r'Chart|Recharts|<canvas'), "Dashboard", "Chart / visualisation"),
]

API_CALL_RE = re.compile(r"""apiCall\(\s*[`'"]([^`'"]+)""")
FETCH_RE = re.compile(r"""fetch\(\s*[`'"]?\$?\{?[A-Z_]*API_BASE\}?([^`'")]+)""")
METHOD_RE = re.compile(r"""method:\s*['"](POST|PUT|DELETE|PATCH)['"]""")
IMPORT_RE = re.compile(r"""(?:import\s+[^;]*?from\s*|import\s*\(\s*)['"]([^'"]+)['"]""")


def module_for(path: Path) -> str:
    """Human-readable module name for a frontend source file."""
    name = path.stem
    parts = path.parts
    if "faculty" in parts:
        return "Faculty Portal"
    if "admin" in parts:
        return "Admin Panel"
    if "components" in parts:
        return "Shared Components"
    if "layouts" in parts or "routes" in parts:
        return "Routing & Layout"
    if "hooks" in parts or "utils" in parts or "services" in parts:
        return "Core Services"
    if "features" in parts:
        return "Feature Modules"
    if name in ("Login", "Register", "Setup", "Landing", "RoleSelect", "FacultyLogin"):
        return "Authentication"
    return "Student Portal"


def route_for(path: Path, route_index: dict) -> str:
    return route_index.get(path.stem, "—")


def build_route_index() -> dict:
    """Map page component name -> route path, from the configured route lists."""
    idx = {}
    for r in config.STUDENT_ROUTES:
        idx[r.rsplit("/", 1)[-1]] = r
    idx.update({
        "Dashboard": "/student/dashboard", "StudentCoursework": "/student/coursework",
        "Cgpa": "/student/cgpa", "Od": "/student/od", "Login": "/login",
        "Register": "/register", "Setup": "/setup", "Landing": "/welcome",
        "Admin": "/admin/dashboard",
    })
    for r in config.STUDENT_ROUTES:
        idx[r.rsplit("/", 1)[-1].capitalize()] = r
    for r in config.FACULTY_ROUTES:
        seg = r.rsplit("/", 1)[-1]
        idx["Faculty" + "".join(w.capitalize() for w in seg.split("-"))] = r
    return idx


def analyse_frontend(inv: Inventory) -> dict:
    src = config.FRONTEND_SRC
    route_index = build_route_index()
    files = list(iter_files(src, {".jsx", ".js"}))

    components, pages, api_usage = [], [], defaultdict(set)
    imports_graph: dict[str, list[str]] = {}

    for f in files:
        text = read(f)
        r = rel(f)
        mod = module_for(f)
        route = route_for(f, route_index)
        is_page = "pages" in f.parts or "features" in f.parts

        # ---- import graph (for the Phase 2 orphan analysis) ----
        deps = []
        for m in IMPORT_RE.finditer(text):
            spec = m.group(1)
            if spec.startswith("."):
                deps.append(str((f.parent / spec).resolve()).replace("\\", "/"))
        imports_graph[str(f.resolve()).replace("\\", "/")] = deps

        entry = {
            "file": r, "name": f.stem, "module": mod, "route": route,
            "lines": text.count("\n") + 1,
            "buttons": len(re.findall(r"<button\b|className=\"btn|<motion\.button", text)),
            "links": len(re.findall(r"<Link\b|<NavLink\b|<a\s", text)),
            "inputs": len(re.findall(r"<input\b|<select\b|<textarea\b", text)),
        }
        (pages if is_page else components).append(entry)

        # ---- API usage ----
        endpoints = set()
        for m in API_CALL_RE.finditer(text):
            endpoints.add(m.group(1).split("?")[0].split("$")[0].rstrip("/") or "/")
        for m in FETCH_RE.finditer(text):
            endpoints.add(m.group(1).split("?")[0].split("$")[0].rstrip("/") or "/")
        for e in endpoints:
            api_usage[e].add(r)
        entry["apis"] = sorted(endpoints)

        if not is_page:
            continue

        # ---- functionality extraction (pages only) ----
        title = f.stem
        if entry["inputs"]:
            inv.add(mod, route, f"{title} — form input handling", "Form", r,
                    f"{entry['inputs']} input control(s)")
        if entry["buttons"]:
            inv.add(mod, route, f"{title} — action buttons", "Button", r,
                    f"{entry['buttons']} button(s)")
        if entry["links"]:
            inv.add(mod, route, f"{title} — navigation links", "Link", r,
                    f"{entry['links']} link(s)")

        for rx, cat, label in UI_PATTERNS:
            if rx.search(text):
                inv.add(mod, route, f"{title} — {label}", cat, r)

        # CRUD from the HTTP verbs the page actually issues
        verbs = set(METHOD_RE.findall(text))
        if verbs or endpoints:
            crud = []
            if endpoints:
                crud.append("Read")
            if "POST" in verbs:
                crud.append("Create")
            if "PUT" in verbs or "PATCH" in verbs:
                crud.append("Update")
            if "DELETE" in verbs:
                crud.append("Delete")
            if crud:
                inv.add(mod, route, f"{title} — CRUD ({'/'.join(crud)})", "CRUD", r,
                        ", ".join(sorted(endpoints)))

    return {
        "components": components, "pages": pages,
        "api_usage": {k: sorted(v) for k, v in api_usage.items()},
        "imports_graph": imports_graph,
    }


# ── backend analysis ────────────────────────────────────────────────────────
ROUTE_RE = re.compile(r"""router\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]([^)]*)""")
MOUNT_RE = re.compile(r"""app\.use\(\s*['"](/api/[^'"]*)['"]\s*,\s*(?:[a-zA-Z]+\s*,\s*)?require\(['"]\./routes/(\w+)""")


def analyse_backend(inv: Inventory) -> dict:
    server = read(config.BACKEND_DIR / "server.js")
    mounts = {mod: base for base, mod in MOUNT_RE.findall(server)}

    endpoints = []
    for f in sorted((config.BACKEND_DIR / "routes").glob("*.js")):
        text = read(f)
        base = mounts.get(f.stem, "/api/" + f.stem)
        mod_name = f.stem.replace("facultyPortal", "faculty-portal").title()
        for verb, path, tail in ROUTE_RE.findall(text):
            full = (base.rstrip("/") + path).replace("//", "/")
            protected = "protect" in tail
            admin_only = "adminOnly" in tail
            role = "admin" if admin_only else ("authenticated" if protected else "public")
            # facultyPortal applies protect+facultyOnly router-wide, not per route.
            if f.stem == "facultyPortal":
                role = "faculty"
            endpoints.append({
                "endpoint": full, "method": verb.upper(), "role": role,
                "file": rel(f), "module": mod_name,
            })
            if verb.upper() in ("POST", "PUT", "DELETE", "PATCH"):
                op = {"post": "Create", "put": "Update", "patch": "Update", "delete": "Delete"}[verb]
                inv.add(f"API — {mod_name}", full, f"{op} {full}", "API-CRUD", rel(f), verb.upper())
            else:
                inv.add(f"API — {mod_name}", full, f"Read {full}", "API", rel(f), "GET")

    models = [rel(p) for p in sorted((config.BACKEND_DIR / "models").glob("*.js"))]
    services = [rel(p) for p in sorted((config.BACKEND_DIR / "services").glob("*.js"))]
    middleware = [rel(p) for p in sorted((config.BACKEND_DIR / "middleware").glob("*.js"))]
    return {"endpoints": endpoints, "models": models, "services": services,
            "middleware": middleware, "mounts": mounts}


# ── navigation / auth / roles ───────────────────────────────────────────────
def analyse_navigation(inv: Inventory):
    nav = {"student_sidebar": [], "admin_tabs": [], "faculty_sidebar": [], "bottom_nav": []}

    side = read(config.FRONTEND_SRC / "components" / "Sidebar.jsx")
    nav["student_sidebar"] = re.findall(r"to:\s*'([^']+)',\s*icon:[^,]+,\s*label:\s*'([^']+)'", side)
    fac = read(config.FRONTEND_SRC / "components" / "FacultySidebar.jsx")
    nav["faculty_sidebar"] = re.findall(r"to:\s*'([^']+)'[^}]*?label:\s*'([^']+)'", fac)
    bn = read(config.FRONTEND_SRC / "components" / "BottomNav.jsx")
    nav["bottom_nav"] = re.findall(r"to:\s*'([^']+)'", bn)
    nav["admin_tabs"] = [{"id": i, "label": l} for i, l in config.ADMIN_TABS]

    for to, label in nav["student_sidebar"]:
        inv.add("Navigation", to, f"Student sidebar link — {label}", "Navigation",
                "frontend/src/components/Sidebar.jsx")
    for to, label in nav["faculty_sidebar"]:
        inv.add("Navigation", to, f"Faculty sidebar link — {label}", "Navigation",
                "frontend/src/components/FacultySidebar.jsx")
    for i, l in config.ADMIN_TABS:
        inv.add("Navigation", "/admin/dashboard", f"Admin panel tab — {l}", "Navigation",
                "frontend/src/pages/Admin.jsx")

    inv.add("Navigation", "*", "Topbar (menu, theme, notices, profile, logout)", "Navigation",
            "frontend/src/components/Topbar.jsx")
    inv.add("Navigation", "*", "Mobile bottom navigation", "Navigation",
            "frontend/src/components/BottomNav.jsx")
    inv.add("Navigation", "/welcome", "Landing page sections & footer", "Navigation",
            "frontend/src/pages/Landing.jsx")
    return nav


def analyse_auth(inv: Inventory):
    inv.add("Authentication", "/login", "Unified login (student/faculty/admin)", "Auth",
            ["frontend/src/pages/Login.jsx", "backend/routes/auth.js"])
    inv.add("Authentication", "/login", "Invalid credential rejection", "Auth",
            "backend/routes/auth.js")
    inv.add("Authentication", "/login", "Mandatory field validation", "Auth",
            "frontend/src/pages/Login.jsx")
    inv.add("Authentication", "/login", "Forgot password guidance", "Auth",
            "frontend/src/pages/Login.jsx")
    inv.add("Authentication", "/login", "Remember me (identifier persistence)", "Auth",
            "frontend/src/pages/Login.jsx")
    inv.add("Authentication", "/login", "Show/hide password toggle", "Auth",
            "frontend/src/pages/Login.jsx")
    inv.add("Authentication", "*", "Logout / session teardown", "Auth",
            "frontend/src/services/auth.js")
    inv.add("Authentication", "/register", "Student self-registration (pending approval)", "Auth",
            ["frontend/src/pages/Register.jsx", "backend/routes/auth.js"])
    inv.add("Authentication", "/setup", "First-run administrator setup", "Auth",
            ["frontend/src/pages/Setup.jsx", "backend/routes/auth.js"])
    inv.add("Authentication", "*", "JWT bearer session + 401 auto-logout", "Auth",
            ["frontend/src/services/api.js", "backend/middleware/auth.js"])
    inv.add("Authentication", "/student/settings", "Change password", "Auth",
            "backend/routes/auth.js")

    guards = read(config.FRONTEND_SRC / "routes" / "guards.jsx")
    for g in re.findall(r"export function (Require\w+|RedirectIfAuthed)", guards):
        inv.add("Authorization", "*", f"Route guard — {g}", "RBAC",
                "frontend/src/routes/guards.jsx")
    inv.add("Authorization", "*", "Server-side adminOnly enforcement", "RBAC",
            "backend/middleware/auth.js")
    inv.add("Authorization", "*", "Server-side facultyOnly enforcement", "RBAC",
            "backend/routes/facultyPortal.js")


def analyse_integrations(inv: Inventory):
    pkg = read(config.BACKEND_DIR / "package.json")
    integrations = []
    for name, label in [
        ("@anthropic-ai/sdk", "Anthropic Claude API (AI assistant / analytics)"),
        ("nodemailer", "SMTP email delivery"),
        ("mongoose", "MongoDB Atlas persistence"),
        ("jsonwebtoken", "JWT authentication"),
        ("helmet", "Security headers"),
        ("express-rate-limit", "Rate limiting"),
    ]:
        if f'"{name}"' in pkg:
            integrations.append({"package": name, "purpose": label})
            inv.add("External Integrations", "—", label, "Integration", "backend/package.json")
    if "@capacitor/core" in read(config.PROJECT_ROOT / "frontend" / "package.json"):
        integrations.append({"package": "@capacitor/core", "purpose": "Android APK packaging"})
        inv.add("External Integrations", "—", "Capacitor Android packaging", "Integration",
                "frontend/package.json")
    # Payments: the fee module records payments but takes no card details.
    fees = read(config.BACKEND_DIR / "routes" / "fees.js")
    if "payment" in fees.lower():
        inv.add("Fees", "/student/fees", "Fee payment recording + admin verification", "Payment",
                ["backend/routes/fees.js", "frontend/src/pages/Fees.jsx"],
                "No external payment gateway — payments are recorded, then admin-verified")
    return integrations


def analyse_journeys(inv: Inventory):
    journeys = [
        ("Student document request lifecycle",
         "Login as student → open My Requests → submit a new request → verify it appears → open details"),
        ("Student leave application",
         "Login as student → Leave Application → fill mandatory fields → submit → verify in history"),
        ("Student library search",
         "Login as student → Library → search catalogue → filter by category → view borrowed books"),
        ("Student self-service navigation sweep",
         "Login as student → visit every sidebar destination → confirm each renders without error"),
        ("Admin moderation journey",
         "Login as admin → Overview → Requests → Students → Notices → Audit Log"),
        ("Faculty teaching journey",
         "Login as faculty → Dashboard → Classes → Students → Attendance → Marks"),
        ("Role isolation journey",
         "Student attempts /admin and /faculty; faculty attempts /student — each is redirected"),
        ("Unauthenticated access journey",
         "Request protected routes with no session → land on /login"),
        ("Session lifecycle journey",
         "Login → verify session token → logout → protected route bounces to /login"),
    ]
    for name, steps in journeys:
        inv.add("User Journeys", "—", name, "Journey", "selenium_model/tests/test_user_journeys.py", steps)
    return [{"name": n, "steps": s} for n, s in journeys]


# ── entry point ─────────────────────────────────────────────────────────────
def discover() -> dict:
    inv = Inventory()

    frontend = analyse_frontend(inv)
    backend = analyse_backend(inv)
    nav = analyse_navigation(inv)
    analyse_auth(inv)
    integrations = analyse_integrations(inv)
    journeys = analyse_journeys(inv)

    # Route inventory
    routes = []
    for r in config.PUBLIC_ROUTES:
        routes.append({"path": r, "access": "public"})
    for r in config.STUDENT_ROUTES:
        routes.append({"path": r, "access": "student"})
    for r in config.FACULTY_ROUTES:
        routes.append({"path": r, "access": "faculty"})
    for r in config.ADMIN_ROUTES:
        routes.append({"path": r, "access": "admin"})
    for a, b in config.LEGACY_REDIRECTS:
        routes.append({"path": a, "access": f"redirect → {b}"})

    all_files = [rel(p) for p in iter_files(config.PROJECT_ROOT)]
    src_files = [f for f in all_files
                 if f.startswith(("frontend/src/", "backend/"))
                 and not f.startswith("backend/node_modules")]

    result = {
        "project": config.PROJECT_NAME,
        "base_url": config.BASE_URL,
        "totals": {
            "files_scanned": len(all_files),
            "source_files": len(src_files),
            "pages": len(frontend["pages"]),
            "components": len(frontend["components"]),
            "routes": len(routes),
            "api_endpoints": len(backend["endpoints"]),
            "models": len(backend["models"]),
            "functionalities": len(inv.rows()),
        },
        "routes": routes,
        "pages": frontend["pages"],
        "components": frontend["components"],
        "api_usage": frontend["api_usage"],
        "endpoints": backend["endpoints"],
        "models": backend["models"],
        "services": backend["services"],
        "middleware": backend["middleware"],
        "navigation": nav,
        "integrations": integrations,
        "journeys": journeys,
        "functionalities": inv.rows(),
        "imports_graph": frontend["imports_graph"],
        "all_files": all_files,
    }

    out = config.DATA_DIR / "discovery.json"
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    t = result["totals"]
    print(f"  Files scanned      : {t['files_scanned']}")
    print(f"  Pages / components : {t['pages']} / {t['components']}")
    print(f"  Routes             : {t['routes']}")
    print(f"  API endpoints      : {t['api_endpoints']}")
    print(f"  Functionalities    : {t['functionalities']}")
    print(f"  -> {rel(out)}")
    return result


if __name__ == "__main__":
    discover()
