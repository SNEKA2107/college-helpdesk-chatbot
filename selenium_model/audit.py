"""Phase 2 — Static code audit.

Detects unused files, dead code, duplicate implementations, orphan components,
TODO/FIXME placeholders, suspicious files, oversized files and likely defects,
each with a High / Medium / Low severity.

Output: data/audit.json
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import config
from discover import iter_files, rel, read, SKIP_DIRS, CLONE_DIRS

LARGE_FILE_LINES = 400
HUGE_FILE_LINES = 800


# ── file resolution for the JS import graph ─────────────────────────────────
def resolve_import(spec: str) -> str | None:
    p = Path(spec)
    for cand in (p, p.with_suffix(".jsx"), p.with_suffix(".js"),
                 p.with_suffix(".json"), p / "index.jsx", p / "index.js"):
        if cand.is_file():
            return str(cand.resolve()).replace("\\", "/")
    for ext in (".jsx", ".js", ".css", ".json"):
        cand = Path(str(p) + ext)
        if cand.is_file():
            return str(cand.resolve()).replace("\\", "/")
    return None


# ── orphan / unused frontend modules ────────────────────────────────────────
def frontend_orphans(discovery: dict) -> list[dict]:
    graph = discovery["imports_graph"]
    reachable: set[str] = set()
    entry = str((config.FRONTEND_SRC / "main.jsx").resolve()).replace("\\", "/")

    stack = [entry]
    while stack:
        cur = stack.pop()
        if cur in reachable:
            continue
        reachable.add(cur)
        for dep in graph.get(cur, []):
            resolved = resolve_import(dep)
            if resolved and resolved not in reachable:
                stack.append(resolved)

    findings = []
    for f in iter_files(config.FRONTEND_SRC, {".jsx", ".js"}):
        key = str(f.resolve()).replace("\\", "/")
        if key in reachable:
            continue
        text = read(f)
        lines = text.count("\n") + 1
        is_component = bool(re.search(r"export default function|export default \w+", text))
        findings.append({
            "file": f.stem, "path": rel(f),
            "reason": ("Orphan React component — never imported from the main.jsx module graph"
                       if is_component else
                       "Unreferenced module — never imported from the main.jsx module graph"),
            "severity": "Medium" if lines > 80 else "Low",
            "lines": lines,
            "kind": "orphan-component" if is_component else "unused-module",
        })
    return findings


# ── unused backend modules ──────────────────────────────────────────────────
def backend_unused() -> list[dict]:
    """Backend files never required by server.js's transitive require graph."""
    root = config.BACKEND_DIR
    req_re = re.compile(r"""require\(\s*['"](\.[^'"]+)['"]""")

    reachable: set[str] = set()
    stack = [str((root / "server.js").resolve()).replace("\\", "/")]
    while stack:
        cur = stack.pop()
        if cur in reachable:
            continue
        reachable.add(cur)
        p = Path(cur)
        if not p.is_file():
            continue
        for spec in req_re.findall(read(p)):
            resolved = resolve_import(str((p.parent / spec)))
            if resolved:
                stack.append(resolved)

    findings = []
    for f in iter_files(root, {".js"}):
        if "node_modules" in f.parts or "tests" in f.parts:
            continue
        key = str(f.resolve()).replace("\\", "/")
        if key in reachable:
            continue
        lines = read(f).count("\n") + 1
        # Standalone operational scripts are intentionally not required by the server.
        script_like = any(part in ("scripts", "migrations") for part in f.parts) or \
            f.stem in ("seed", "seed-students", "create-admin", "reset-admin",
                       "export-students", "renumber-requests", "dev-local", "test-seq")
        findings.append({
            "file": f.stem, "path": rel(f),
            "reason": ("Standalone maintenance/seed script — not part of the server require graph "
                       "(expected, but verify it is still needed)" if script_like else
                       "Backend module never required by server.js"),
            "severity": "Low" if script_like else "Medium",
            "lines": lines,
            "kind": "backend-script" if script_like else "unused-module",
        })
    return findings


# ── repo-level dead weight ──────────────────────────────────────────────────
def repo_clutter() -> list[dict]:
    findings = []
    root = config.PROJECT_ROOT

    for p in sorted(root.iterdir()):
        if p.is_dir() and p.name in CLONE_DIRS:
            try:
                n = sum(1 for _ in iter_files(p))
            except OSError:
                n = 0
            findings.append({
                "file": p.name + "/", "path": rel(p),
                "reason": f"Duplicate/clone snapshot of the project checked into the repo ({n} files) — "
                          "diverges from source and inflates the working tree",
                "severity": "High", "lines": 0, "kind": "duplicate-tree",
            })

    for p in sorted(root.glob("*")):
        if not p.is_file():
            continue
        name = p.name
        size_kb = p.stat().st_size // 1024
        if re.match(r"^(debug|test|audit|verify|screenshot|open|branding)-.*\.js$", name) or \
           name in ("test-app.js", "test-pages.js", "test-login.js", "generate-icons.js"):
            if name == "generate-icons.js":
                continue  # referenced by the root build script
            findings.append({
                "file": name, "path": rel(p),
                "reason": "Ad-hoc Puppeteer/debug script at the repo root — not referenced by any "
                          "npm script or import",
                "severity": "Medium", "lines": read(p).count("\n") + 1, "kind": "suspicious-file",
            })
        elif p.suffix.lower() == ".png":
            findings.append({
                "file": name, "path": rel(p),
                "reason": f"Debug/verification screenshot committed at the repo root ({size_kb} KB)",
                "severity": "Low", "lines": 0, "kind": "artifact",
            })
        elif p.suffix.lower() == ".log":
            findings.append({
                "file": name, "path": rel(p),
                "reason": "Server/serve log file committed to the repo",
                "severity": "Low", "lines": 0, "kind": "artifact",
            })
        elif name in ("students data.txt", "students data copy.txt", "students-export.csv",
                      "students-export.sql"):
            findings.append({
                "file": name, "path": rel(p),
                "reason": f"Bulk student personal data ({size_kb} KB) stored in the repository — "
                          "PII should never live in version control",
                "severity": "High", "lines": 0, "kind": "sensitive-data",
            })

    md = [p for p in root.glob("*.md")]
    if len(md) > 40:
        findings.append({
            "file": f"{len(md)} root *.md files", "path": ".",
            "reason": f"{len(md)} status/report markdown files at the repo root — heavily overlapping "
                      "documentation with no single source of truth",
            "severity": "Medium", "lines": 0, "kind": "doc-sprawl",
        })
    return findings


# ── dead code inside live source ────────────────────────────────────────────
EXPORT_RE = re.compile(r"^export (?:async )?function (\w+)", re.M)
CONST_EXPORT_RE = re.compile(r"^export const (\w+)\s*=", re.M)
LOCAL_FN_RE = re.compile(r"^(?:async )?function (\w+)\s*\(", re.M)


def dead_code(discovery: dict) -> list[dict]:
    findings = []
    live_files = [config.FRONTEND_SRC, config.BACKEND_DIR]
    corpus = {}
    for base in live_files:
        for f in iter_files(base, {".js", ".jsx"}):
            if "node_modules" in f.parts:
                continue
            corpus[rel(f)] = read(f)

    all_text = "\n".join(corpus.values())

    for path, text in corpus.items():
        # Exported symbols never referenced anywhere else in the live source.
        for rx in (EXPORT_RE, CONST_EXPORT_RE):
            for m in rx.finditer(text):
                name = m.group(1)
                if len(name) < 3:
                    continue
                uses = len(re.findall(rf"\b{re.escape(name)}\b", all_text))
                if uses <= 1:
                    line = text[:m.start()].count("\n") + 1
                    findings.append({
                        "file": path, "symbol": name, "line": line,
                        "kind": "unused-export", "severity": "Low",
                        "recommendation": f"`{name}` is exported but never imported anywhere — "
                                          "remove it or document why it is public API.",
                    })

        # Local functions declared but never called within their own file.
        for m in LOCAL_FN_RE.finditer(text):
            name = m.group(1)
            if len(name) < 3 or text.count(f"export function {name}") or \
               text.count(f"export async function {name}"):
                continue
            if len(re.findall(rf"\b{re.escape(name)}\b", text)) <= 1:
                line = text[:m.start()].count("\n") + 1
                findings.append({
                    "file": path, "symbol": name, "line": line,
                    "kind": "unreachable-function", "severity": "Medium",
                    "recommendation": f"Local function `{name}` is declared but never called in this "
                                      "file — dead code, safe to delete.",
                })
    return findings


# ── TODO / FIXME ────────────────────────────────────────────────────────────
# Only count a marker that actually sits inside a comment — otherwise strings
# like the phone placeholder "+91 XXXXX XXXXX" and a fixture named 'HACK' would
# be reported as outstanding work.
TODO_RE = re.compile(r"(?://|/\*|\*|#)[^\n]*?\b(TODO|FIXME|HACK|XXX|WIP)\b[:\s-]?(.{0,110})")


def placeholders() -> list[dict]:
    findings = []
    for base in (config.FRONTEND_SRC, config.BACKEND_DIR):
        for f in iter_files(base, {".js", ".jsx", ".css"}):
            if "node_modules" in f.parts:
                continue
            text = read(f)
            for i, line in enumerate(text.splitlines(), 1):
                m = TODO_RE.search(line)
                if not m:
                    continue
                tag = m.group(1).upper()
                findings.append({
                    "file": rel(f), "symbol": tag, "line": i,
                    "kind": "placeholder",
                    "severity": "High" if tag in ("FIXME", "HACK", "XXX") else "Medium",
                    "recommendation": f"{tag} left in shipped code: {m.group(2).strip()[:100]}",
                })
    return findings


# ── duplicate implementations ───────────────────────────────────────────────
def normalise(text: str) -> str:
    text = re.sub(r"//.*|/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"\s+", " ", text).strip()


def duplicates() -> list[dict]:
    buckets = defaultdict(list)
    for base in (config.FRONTEND_SRC, config.BACKEND_DIR):
        for f in iter_files(base, {".js", ".jsx"}):
            if "node_modules" in f.parts:
                continue
            norm = normalise(read(f))
            if len(norm) < 400:
                continue
            buckets[hashlib.sha1(norm.encode()).hexdigest()].append(rel(f))

    findings = []
    for _, paths in buckets.items():
        if len(paths) > 1:
            findings.append({
                "file": paths[0], "symbol": "whole file", "line": 1,
                "kind": "duplicate", "severity": "High",
                "recommendation": "Byte-identical implementation also at: " + ", ".join(paths[1:]) +
                                  " — extract a single shared module.",
            })
    return findings


# ── oversized files ─────────────────────────────────────────────────────────
def large_files() -> list[dict]:
    findings = []
    for base in (config.FRONTEND_SRC, config.BACKEND_DIR):
        for f in iter_files(base, {".js", ".jsx", ".css"}):
            if "node_modules" in f.parts:
                continue
            n = read(f).count("\n") + 1
            if n < LARGE_FILE_LINES:
                continue
            findings.append({
                "file": rel(f), "symbol": "module", "line": n,
                "kind": "large-file",
                "severity": "High" if n >= HUGE_FILE_LINES else "Medium",
                "recommendation": f"{n} lines in a single module — split by responsibility to keep it "
                                  "reviewable and testable.",
            })
    return sorted(findings, key=lambda r: -r["line"])


# ── likely defects / risk signals ───────────────────────────────────────────
def defects() -> list[dict]:
    out = []

    def add(module, desc, steps, severity, evidence):
        out.append({"module": module, "description": desc, "steps": steps,
                    "severity": severity, "evidence": evidence, "status": "Open"})

    # --- testability ---
    testids = 0
    for f in iter_files(config.FRONTEND_SRC, {".jsx"}):
        testids += read(f).count("data-testid")
    if testids == 0:
        add("Frontend / Testability",
            "No data-testid attributes anywhere in the UI. Automation must bind to CSS "
            "classes and visible text, both of which change with styling and copy edits, "
            "making the E2E suite structurally brittle.",
            "1. grep -r 'data-testid' frontend/src  2. Observe zero matches",
            "Medium", "frontend/src/**/*.jsx (0 occurrences)")

    # --- hardcoded production URL in client bundle ---
    api = read(config.FRONTEND_SRC / "services" / "api.js")
    m = re.search(r"const PROD_API = '([^']+)'", api)
    if m:
        add("Frontend / Configuration",
            f"The production API origin ({m.group(1)}) is hardcoded into the client bundle "
            "rather than injected at build time, so a redeploy to a new host requires a code "
            "change instead of an environment variable.",
            "1. Open frontend/src/services/api.js  2. See the PROD_API constant",
            "Low", "frontend/src/services/api.js")

    # --- CSP unsafe-inline ---
    server = read(config.BACKEND_DIR / "server.js")
    if "'unsafe-inline'" in server and "scriptSrc" in server:
        add("Backend / Security headers",
            "Content-Security-Policy allows 'unsafe-inline' for scripts and permits a third-party "
            "CDN (cdnjs.cloudflare.com). This materially weakens the XSS protection CSP exists "
            "to provide.",
            "1. Open backend/server.js  2. Inspect the helmet contentSecurityPolicy directives",
            "High", "backend/server.js (scriptSrc directive)")

    if "scriptSrcAttr" in server and "'unsafe-inline'" in server:
        add("Backend / Security headers",
            "scriptSrcAttr is explicitly relaxed to 'unsafe-inline' to keep legacy inline onclick "
            "handlers working. The static site those handlers belonged to has been retired, so the "
            "exemption now buys nothing and only widens the XSS surface.",
            "1. Open backend/server.js  2. Note the scriptSrcAttr override and its comment",
            "Medium", "backend/server.js")

    # --- password reset ---
    auth = read(config.BACKEND_DIR / "routes" / "auth.js")
    if "forgot" not in auth.lower() and "reset-password" not in auth.lower():
        add("Authentication",
            "There is no self-service password reset. The login page's 'Forgot password?' control "
            "only displays a message telling the user to contact the admin office, so a locked-out "
            "user has no in-product recovery path.",
            "1. Go to /login  2. Click 'Forgot password?'  3. Only an informational message appears",
            "High", "frontend/src/pages/Login.jsx, backend/routes/auth.js")

    # --- rate limiting scope ---
    if "AUTH_RATE_LIMIT" in server:
        add("Backend / Abuse control",
            "The auth rate limit is configurable via AUTH_RATE_LIMIT and dev-local.js raises it to "
            "200 attempts per 15 minutes. If that value leaks into a production environment it "
            "effectively disables brute-force protection on login.",
            "1. Open backend/dev-local.js  2. See AUTH_RATE_LIMIT='200'",
            "Medium", "backend/server.js, backend/dev-local.js")

    # --- unrouted pages kept on disk ---
    routes_src = read(config.FRONTEND_SRC / "routes" / "AppRoutes.jsx")
    for page in ("RoleSelect", "FacultyLogin"):
        if (config.FRONTEND_SRC / "pages" / f"{page}.jsx").exists() and page not in routes_src:
            add("Routing",
                f"pages/{page}.jsx is still in the source tree but is no longer routed anywhere "
                "after the move to a unified login. It compiles, ships in the repo and misleads "
                "readers into thinking the flow is live.",
                f"1. Open frontend/src/routes/AppRoutes.jsx  2. Search for {page} — only a comment remains",
                "Medium", f"frontend/src/pages/{page}.jsx")

    # --- error handler placement ---
    if server.find("app.get('*'") < server.find("app.use((err, req, res, next)"):
        add("Backend / Error handling",
            "The SPA catch-all route (app.get('*')) is registered before the error-handling "
            "middleware. Any route registered after the catch-all is unreachable, which is a "
            "latent trap for future route additions.",
            "1. Open backend/server.js  2. Compare the order of the SPA fallback and error handler",
            "Low", "backend/server.js")

    # --- payload limit ---
    if "limit: '5mb'" in server:
        add("Backend / Resource limits",
            "JSON and urlencoded bodies accept up to 5 MB, and profile photos are stored as base64 "
            "strings inside user documents. That is an expensive request to serve and an easy way "
            "to bloat the database.",
            "1. Open backend/server.js  2. See express.json({ limit: '5mb' })  "
            "3. Compare with the photo handling in backend/routes/auth.js",
            "Medium", "backend/server.js, backend/routes/auth.js")

    # --- .env committed ---
    if (config.BACKEND_DIR / ".env").exists():
        gitignore = read(config.PROJECT_ROOT / ".gitignore")
        if ".env" not in gitignore:
            add("Security / Secrets",
                "backend/.env exists and is not covered by .gitignore, risking committed secrets "
                "(MONGO_URI, JWT_SECRET, API keys).",
                "1. Check .gitignore for a .env rule  2. Confirm backend/.env is tracked",
                "High", "backend/.env, .gitignore")

    return out


# ── entry point ─────────────────────────────────────────────────────────────
def audit() -> dict:
    discovery = json.loads((config.DATA_DIR / "discovery.json").read_text(encoding="utf-8"))

    unused = frontend_orphans(discovery) + backend_unused() + repo_clutter()
    dead = dead_code(discovery) + placeholders() + duplicates() + large_files()
    bugs = defects()

    result = {
        "unused_files": unused,
        "dead_code": dead,
        "defects": bugs,
        "summary": {
            "unused_files": len(unused),
            "dead_code_findings": len(dead),
            "defects": len(bugs),
            "high": sum(1 for r in unused + dead if r.get("severity") == "High")
                    + sum(1 for r in bugs if r["severity"] == "High"),
            "medium": sum(1 for r in unused + dead if r.get("severity") == "Medium")
                      + sum(1 for r in bugs if r["severity"] == "Medium"),
            "low": sum(1 for r in unused + dead if r.get("severity") == "Low")
                   + sum(1 for r in bugs if r["severity"] == "Low"),
        },
    }
    out = config.DATA_DIR / "audit.json"
    out.write_text(json.dumps(result, indent=2), encoding="utf-8")
    s = result["summary"]
    print(f"  Unused files       : {s['unused_files']}")
    print(f"  Dead-code findings : {s['dead_code_findings']}")
    print(f"  Potential defects  : {s['defects']}")
    print(f"  Severity H/M/L     : {s['high']}/{s['medium']}/{s['low']}")
    print(f"  -> {rel(out)}")
    return result


if __name__ == "__main__":
    audit()
