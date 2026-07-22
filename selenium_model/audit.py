"""Phase 2 — Static code audit.

Scans the repo for unused/legacy files, large modules, TODO/FIXME markers,
duplicate (legacy vs React) implementations and likely dead code. Writes
data/audit.json with severity-tagged findings.
"""
import json
import re
from pathlib import Path

import config

ROOT = config.PROJECT_ROOT
SKIP = {"node_modules", ".git", "dist", "android", "releases", "selenium_model"}


def _iter_files(exts):
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if SKIP & set(p.parts):
            continue
        if p.suffix.lower() in exts:
            yield p


def _rel(p):
    return str(p.relative_to(ROOT)).replace("\\", "/")


def audit():
    unused_files = []
    dead_code = []
    todos = []
    large_files = []
    code_health = []
    defects = []

    # ── 1. Legacy static site at repo root (superseded by React app) ──────────
    legacy_html = sorted(ROOT.glob("*.html"))
    for h in legacy_html:
        unused_files.append({
            "file": h.name, "path": _rel(h),
            "reason": "Legacy static-site page superseded by the React SPA in frontend/src/pages; "
                      "served only as fallback when frontend/dist is absent.",
            "severity": "Medium"})
    if legacy_html:
        code_health.append({
            "category": "Duplicate implementation",
            "finding": f"{len(legacy_html)} legacy root *.html pages duplicate React pages "
                       f"(e.g. login.html vs Login.jsx, admin.html vs Admin.jsx).",
            "severity": "Medium",
            "recommendation": "Archive the legacy static site to /legacy or delete; keep React as the single source of truth."})

    # ── 2. Root debug/throwaway scripts ──────────────────────────────────────
    debug_scripts = [p for p in ROOT.glob("*.js")
                     if re.match(r"^(audit-|debug-|test-|verify-|screenshot-|open-|branding-|generate-icons)", p.name)]
    for s in debug_scripts:
        unused_files.append({
            "file": s.name, "path": _rel(s),
            "reason": "Ad-hoc Puppeteer/debug/verification script not part of the app build or CI.",
            "severity": "Low"})
    if debug_scripts:
        code_health.append({
            "category": "Repo hygiene",
            "finding": f"{len(debug_scripts)} ad-hoc debug/verification *.js scripts at repo root.",
            "severity": "Low",
            "recommendation": "Move throwaway scripts under /scripts or remove; they clutter the project root."})

    # ── 3. Stray clone/duplicate working directories ─────────────────────────
    for d in ("demo-clone", "viva-clone", "viva-clone2", "college-helpdesk-chatbot", "repository-name", "example"):
        p = ROOT / d
        if p.exists():
            unused_files.append({
                "file": d + "/", "path": _rel(p) + "/",
                "reason": "Nested clone/scratch directory committed by mistake; not referenced by the app.",
                "severity": "Medium"})

    # ── 4. Image / report artifact sprawl ────────────────────────────────────
    png_count = len(list(ROOT.glob("*.png")))
    md_count = len(list(ROOT.glob("*.md")))
    if png_count:
        code_health.append({
            "category": "Artifact sprawl",
            "finding": f"{png_count} screenshot PNGs and {md_count} report markdowns committed at repo root.",
            "severity": "Low",
            "recommendation": "Relocate evidence/reports under /docs or /artifacts and gitignore generated screenshots."})

    # ── 5. Large source modules (refactor candidates) ────────────────────────
    for p in _iter_files({".jsx", ".js"}):
        if "frontend/src" not in _rel(p) and "backend/" not in _rel(p):
            continue
        if "/routes/" in _rel(p) or "/pages/" in _rel(p) or "/models/" in _rel(p):
            try:
                lines = len(p.read_text(encoding="utf-8", errors="ignore").splitlines())
            except Exception:
                continue
            if lines >= 300:
                sev = "Medium" if lines >= 350 else "Low"
                large_files.append({"file": _rel(p), "lines": lines, "severity": sev})

    # ── 6. TODO / FIXME markers in app source ────────────────────────────────
    marker = re.compile(r"\b(TODO|FIXME|XXX|HACK)\b")
    for p in _iter_files({".jsx", ".js"}):
        rel = _rel(p)
        if not (rel.startswith("frontend/src") or (rel.startswith("backend/") and "/routes/" in rel)):
            continue
        try:
            for i, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
                if marker.search(line) and "placeholder" not in line.lower() and "XXXXX" not in line:
                    todos.append({"file": rel, "function_or_class": "—", "line": i,
                                  "recommendation": f"Resolve marker: {line.strip()[:80]}"})
        except Exception:
            pass

    # ── 7. Dead-code / orphan heuristics (curated) ───────────────────────────
    # The legacy app.js + static HTML duplicate the React data layer.
    if (ROOT / "app.js").exists():
        dead_code.append({
            "file": "app.js", "function_or_class": "legacy global app bootstrap",
            "line": 1,
            "recommendation": "Legacy vanilla-JS bootstrap for the static site; unused by React build — remove."})
    if (ROOT / "automated_test").exists():
        code_health.append({
            "category": "Orphan tooling",
            "finding": "automated_test/ contains an older DAST runner separate from this Selenium suite.",
            "severity": "Low",
            "recommendation": "Consolidate security/DAST tooling or document its purpose."})

    # ── 8. Known defect-class observations (static) ──────────────────────────
    defects.append({
        "module": "Auth/UX", "severity": "Low",
        "description": "'Forgot password?' link is a non-functional placeholder (preventDefault, no flow).",
        "steps": "Login page → click 'Forgot password?' → nothing happens.",
        "evidence": "frontend/src/pages/Login.jsx (onClick e.preventDefault())",
        "status": "Open"})
    defects.append({
        "module": "Repo hygiene", "severity": "Medium",
        "description": "Legacy static HTML site and React SPA coexist, duplicating routes/logic.",
        "steps": "Inspect repo root *.html vs frontend/src/pages/*.jsx.",
        "evidence": "25 root *.html files duplicate React pages.",
        "status": "Open"})

    data = {
        "unused_files": unused_files,
        "dead_code": dead_code + todos,  # TODO markers rendered as dead-code rows
        "todos": todos,
        "large_files": large_files,
        "code_health": code_health,
        "defects": defects,
        "summary": {
            "unused_files": len(unused_files),
            "large_files": len(large_files),
            "todos": len(todos),
            "code_health_findings": len(code_health),
            "static_defects": len(defects),
        },
    }
    out = config.DATA_DIR / "audit.json"
    out.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"[audit] {len(unused_files)} unused/legacy, {len(large_files)} large files, "
          f"{len(todos)} TODOs, {len(code_health)} health findings -> {out}")
    return data


if __name__ == "__main__":
    audit()
