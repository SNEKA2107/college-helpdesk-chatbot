"""One-shot orchestrator for the full CampusAssist audit.

Runs: Phase 1 discovery -> Phase 2 audit -> Phase 3-5 Selenium tests (pytest)
-> Phase 6 coverage + Phase 7 master report. Continues even if tests fail.

Prereq: backend running at http://localhost:5000 (node backend/dev-local.js).
Usage:  python selenium_model/run.py
"""
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import config
import discover
import audit
import report_generator


def _backend_up():
    try:
        with urllib.request.urlopen(config.BASE_URL + "/", timeout=5) as r:
            return r.status == 200
    except Exception:
        return False


def main():
    print("=" * 70)
    print("CampusAssist — Automated Audit & E2E Test Suite")
    print("=" * 70)

    if not _backend_up():
        print(f"⚠️  Backend not reachable at {config.BASE_URL}.")
        print("    Start it first:  node backend/dev-local.js")
        print("    (Continuing anyway — Selenium tests will fail and be recorded as such.)")
    else:
        print(f"✅ Backend reachable at {config.BASE_URL}")

    print("\n── Phase 1: Discovery ──")
    discover.discover()
    print("\n── Phase 2: Code Audit ──")
    audit.audit()

    print("\n── Phase 3-5: Selenium E2E + additional testing ──")
    # Reset console log for a clean run
    (ROOT / "browser_console.log").write_text("", encoding="utf-8")
    cmd = [sys.executable, "-m", "pytest", str(ROOT / "tests"),
           "-c", str(ROOT / "pytest.ini"), "--rootdir", str(ROOT)]
    proc = subprocess.run(cmd, cwd=str(ROOT))
    print(f"\npytest exit code: {proc.returncode} (non-zero is OK — failures are reported)")

    print("\n── Phase 6-7: Coverage + Master Report ──")
    report_generator.generate()

    print("\n✅ Done. See selenium_model/MASTER_TEST_AUDIT_REPORT.xlsx")


if __name__ == "__main__":
    main()
