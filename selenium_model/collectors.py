"""Append-only result sinks shared by every test module.

Each sink is a JSON-Lines file under data/. Writing line-by-line means a run
that crashes half way still leaves every result recorded up to that point, which
is what lets the suite honour "continue even if failures occur".
"""
from __future__ import annotations

import json
import threading
from pathlib import Path

import config

_lock = threading.Lock()

SINKS = {
    "functional": config.DATA_DIR / "functional.jsonl",
    "defects": config.DATA_DIR / "defects.jsonl",
    "broken_links": config.DATA_DIR / "broken_links.jsonl",
    "accessibility": config.DATA_DIR / "accessibility.jsonl",
    "api": config.DATA_DIR / "api.jsonl",
    "ui": config.DATA_DIR / "ui.jsonl",
    "performance": config.DATA_DIR / "performance.jsonl",
    "journeys": config.DATA_DIR / "journeys.jsonl",
    "security": config.DATA_DIR / "security.jsonl",
    "coverage_hits": config.DATA_DIR / "coverage_hits.jsonl",
    "load": config.DATA_DIR / "load.jsonl",
    "load_endpoints": config.DATA_DIR / "load_endpoints.jsonl",
}


def reset():
    """Clear every sink — called once at the start of an orchestrated run."""
    for p in SINKS.values():
        p.write_text("", encoding="utf-8")
    config.CONSOLE_LOG.write_text("", encoding="utf-8")
    config.SELENIUM_LOG.write_text("", encoding="utf-8")


def _write(sink: str, row: dict):
    path = SINKS[sink]
    with _lock:
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, default=str) + "\n")


def read(sink: str) -> list[dict]:
    path = SINKS[sink]
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except ValueError:
                pass
    return out


# ── typed helpers ───────────────────────────────────────────────────────────
def defect(module, description, steps, severity, evidence="", status="Open"):
    _write("defects", {"module": module, "description": description, "steps": steps,
                       "severity": severity, "evidence": evidence, "status": status})


def broken_link(url, source_page, status_code, result):
    _write("broken_links", {"url": url, "source_page": source_page,
                            "status_code": status_code, "result": result})


def accessibility(page, issue, severity, recommendation):
    _write("accessibility", {"page": page, "issue": issue, "severity": severity,
                             "recommendation": recommendation})


def api_result(endpoint, method, expected, actual, result, note=""):
    _write("api", {"endpoint": endpoint, "method": method, "expected": expected,
                   "actual": actual, "result": result, "note": note})


def ui_finding(page, issue, severity, evidence):
    _write("ui", {"page": page, "issue": issue, "severity": severity, "evidence": evidence})


def performance(page, load_ms, observation, recommendation):
    _write("performance", {"page": page, "load_ms": load_ms, "observation": observation,
                           "recommendation": recommendation})


def journey(name, steps, result, evidence):
    _write("journeys", {"name": name, "steps": steps, "result": result, "evidence": evidence})


def security(area, observation, severity, recommendation):
    _write("security", {"area": area, "observation": observation, "severity": severity,
                        "recommendation": recommendation})


def load_result(row: dict):
    _write("load", row)


def load_endpoint(row: dict):
    _write("load_endpoints", row)


def reset_load():
    """Clear only the load-test sinks — a load run can be repeated on its own."""
    for name in ("load", "load_endpoints"):
        SINKS[name].write_text("", encoding="utf-8")


def covers(*fids: str):
    """Declare that the calling test exercises these discovered functionality ids."""
    for fid in fids:
        _write("coverage_hits", {"fid": fid})


def console(lines: list[str]):
    if not lines:
        return
    with _lock:
        with config.CONSOLE_LOG.open("a", encoding="utf-8") as fh:
            for line in lines:
                fh.write(line.rstrip() + "\n")
