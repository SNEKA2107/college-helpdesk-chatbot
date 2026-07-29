"""One-shot orchestrator for the complete CampusAssist audit.

Runs every phase in order and never aborts on a test failure:

  Phase 1  Project discovery          -> data/discovery.json
  Phase 2  Static code audit          -> data/audit.json
  Phase 3  Selenium framework         (this package)
  Phase 4  E2E functional testing     ) pytest
  Phase 5  Smoke/regression/API/a11y/ )
           perf/UI/security/links     )
  Phase 6  Functional coverage        ) report_generator
  Phase 7  Master Excel + MD report   )

Prerequisites
-------------
  pip install -r selenium_model/requirements.txt
  node backend/dev-local.js        # seeded in-memory backend on http://localhost:5000

Usage
-----
  python selenium_model/run.py                 # everything
  python selenium_model/run.py --report-only   # rebuild reports from the last run
  python selenium_model/run.py -k authentication   # pass a filter through to pytest
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import apiclient          # noqa: E402
import audit              # noqa: E402
import collectors         # noqa: E402
import config             # noqa: E402
import discover           # noqa: E402
import loadtest           # noqa: E402
import report_generator   # noqa: E402


def banner(text):
    print("\n" + "=" * 76)
    print(text)
    print("=" * 76)


def main(argv):
    report_only = "--report-only" in argv
    extra = [a for a in argv if a != "--report-only"]

    banner("CampusAssist — Automated Audit & End-to-End Test Suite")
    print(f"Target      : {config.BASE_URL}")
    print(f"Output      : {config.REPORT_XLSX}")
    print(f"Browser     : Chrome ({'headless' if config.HEADLESS else 'headed'})")

    reachable = apiclient.backend_up()
    print(f"Backend     : {'reachable' if reachable else 'NOT REACHABLE'}")
    if not reachable and not report_only:
        print("\n  The backend is not answering at " + config.BASE_URL)
        print("  Start it first:  node backend/dev-local.js")
        print("  Continuing anyway — failures will be recorded rather than hidden.\n")

    started = time.time()

    if not report_only:
        banner("Phase 1 — Project Discovery")
        discover.discover()

        banner("Phase 2 — Static Code Audit")
        audit.audit()

        banner("Phases 3-5 — Selenium E2E, API, Security, A11y, Performance")
        collectors.reset()
        cmd = [sys.executable, "-m", "pytest", str(ROOT / "tests"),
               "-c", str(ROOT / "pytest.ini"), "--rootdir", str(ROOT)] + extra
        proc = subprocess.run(cmd, cwd=str(ROOT))
        print(f"\npytest exit code: {proc.returncode} "
              "(a non-zero code is expected when defects are found — results are still reported)")

        banner("Phase 5b — Baseline / Load Test")
        loadtest.run()
    else:
        banner("Report-only mode — reusing the previous run's data")

    banner("Phases 6-7 — Coverage Analysis & Master Report")
    report_generator.generate()

    elapsed = round((time.time() - started) / 60, 1)
    banner("Done")
    print(f"Total time  : {elapsed} min")
    print(f"Workbook    : {config.REPORT_XLSX}")
    print(f"HTML report : {config.REPORT_HTML}")
    print(f"Markdown    : {ROOT / 'FINAL_AUDIT_REPORT.md'}")
    print(f"Screenshots : {len(list(config.SCREENSHOT_DIR.glob('*.png')))} captured")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
