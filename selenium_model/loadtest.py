"""Phase 5b — baseline / load testing.

Drives the backend under a normal, expected level of concurrency and records
throughput and latency so the workbook can answer "does it stay fast under
real classroom load?".

Profile (overridable via environment):
    CA_LOAD_USERS      100    virtual users, all active at the same time
    CA_LOAD_DURATION    60    seconds of sustained traffic
    CA_LOAD_THINK      0.10   seconds a virtual user pauses between requests

Each virtual user authenticates once (tokens are minted up-front and shared so
the login endpoint is not the thing being benchmarked), then loops over a
realistic browsing mix for the whole window. Every single request is timed.

Outputs
-------
    data/load.jsonl   one summary row plus one row per endpoint
    Load Test sheet in MASTER_TEST_AUDIT_REPORT.xlsx

Run standalone:
    python selenium_model/loadtest.py
"""
from __future__ import annotations

import os
import statistics
import threading
import time

import apiclient
import collectors
import config

USERS = int(os.environ.get("CA_LOAD_USERS", "100"))
DURATION_S = int(os.environ.get("CA_LOAD_DURATION", "60"))
THINK_S = float(os.environ.get("CA_LOAD_THINK", "0.10"))

# Response-time budgets used to turn raw numbers into a verdict.
AVG_BUDGET_MS = 500
P95_BUDGET_MS = 1000

# The browsing mix. Each entry is (path, role) — the endpoints a real user hits
# on a normal day, weighted by how often they are actually requested.
SCENARIO = [
    ("/auth/me", "student"),
    ("/timetable/today", "student"),
    ("/attendance/summary", "student"),
    ("/notices", "student"),
    ("/requests", "student"),
    ("/requests/stats", "student"),
    ("/marks/cgpa", "student"),
    ("/events", "student"),
    ("/library", "student"),
    ("/fees", "student"),
    ("/exam/schedule", "student"),
    ("/calendar", "student"),
    ("/departments", None),
    ("/faculty", "student"),
    ("/coursework/assignments", "student"),
    # A minority of concurrent staff traffic — heavier, aggregate-style reads.
    ("/faculty-portal/dashboard", "faculty"),
    ("/faculty-portal/students", "faculty"),
    ("/students", "admin"),
    ("/analytics", "admin"),
    ("/audit", "admin"),
]

_samples: list[tuple[str, int, float]] = []      # (path, status, elapsed_ms)
_lock = threading.Lock()


def _virtual_user(index: int, tokens: dict, stop_at: float, barrier: threading.Barrier):
    """One virtual user: wait for the starting gun, then browse until time is up."""
    local: list[tuple[str, int, float]] = []
    # Stagger the entry point into the scenario so 100 users do not march in
    # lockstep through the same endpoint — that would measure one route, not a mix.
    cursor = index % len(SCENARIO)
    try:
        barrier.wait(timeout=60)
    except threading.BrokenBarrierError:
        pass

    while time.time() < stop_at:
        path, role = SCENARIO[cursor % len(SCENARIO)]
        cursor += 1
        token = tokens.get(role) if role else None
        started = time.perf_counter()
        res = apiclient.api(path, "GET", token=token)
        elapsed_ms = (time.perf_counter() - started) * 1000
        local.append((path, res.status, elapsed_ms))
        if THINK_S:
            time.sleep(THINK_S)

    with _lock:
        _samples.extend(local)


def _pct(sorted_values: list[float], pct: float) -> float:
    """Nearest-rank percentile — no interpolation, so the number is a real sample."""
    if not sorted_values:
        return 0.0
    k = max(0, min(len(sorted_values) - 1, int(round(pct / 100 * len(sorted_values) + 0.5)) - 1))
    return sorted_values[k]


def run(users: int = USERS, duration_s: int = DURATION_S) -> dict:
    print(f"  Profile    : {users} virtual users, {duration_s}s sustained, "
          f"{int(THINK_S * 1000)}ms think time")

    if not apiclient.backend_up():
        print("  Backend is not reachable — load test skipped.")
        collectors.load_result({
            "metric": "Status", "value": "SKIPPED",
            "observation": "Backend not reachable at " + config.BASE_URL,
        })
        return {}

    tokens = {role: apiclient.login_token(role) for role in ("student", "admin", "faculty")}
    missing = [r for r, t in tokens.items() if not t]
    if missing:
        print(f"  Warning    : could not authenticate {missing} — those endpoints will 401.")

    _samples.clear()
    barrier = threading.Barrier(users + 1)
    stop_at = time.time() + duration_s + 1        # +1 covers the barrier release
    threads = [threading.Thread(target=_virtual_user, args=(i, tokens, stop_at, barrier),
                                daemon=True, name=f"vu-{i:03d}")
               for i in range(users)]
    for t in threads:
        t.start()

    print(f"  Ramping    : {users} users starting simultaneously ...")
    barrier.wait(timeout=60)                       # release every user at once
    wall_started = time.perf_counter()
    for t in threads:
        t.join(timeout=duration_s + 60)
    wall_s = time.perf_counter() - wall_started

    return summarise(wall_s, users, duration_s)


def summarise(wall_s: float, users: int, duration_s: int) -> dict:
    if not _samples:
        print("  No samples collected.")
        return {}

    latencies = sorted(s[2] for s in _samples)
    total = len(_samples)
    ok = sum(1 for s in _samples if 200 <= s[1] < 400)
    errors = total - ok
    rps = total / wall_s if wall_s else 0.0

    avg = statistics.fmean(latencies)
    summary = {
        "users": users,
        "duration_s": duration_s,
        "wall_s": round(wall_s, 1),
        "requests": total,
        "ok": ok,
        "errors": errors,
        "error_pct": round(errors / total * 100, 2),
        "rps": round(rps, 1),
        "min_ms": round(latencies[0], 1),
        "avg_ms": round(avg, 1),
        "median_ms": round(statistics.median(latencies), 1),
        "p90_ms": round(_pct(latencies, 90), 1),
        "p95_ms": round(_pct(latencies, 95), 1),
        "p99_ms": round(_pct(latencies, 99), 1),
        "max_ms": round(latencies[-1], 1),
    }

    within_budget = avg <= AVG_BUDGET_MS and summary["p95_ms"] <= P95_BUDGET_MS
    verdict = ("PASS — response times stayed within budget under normal load"
               if within_budget and summary["error_pct"] < 1 else
               "REVIEW — response times or error rate exceeded the baseline budget")
    summary["verdict"] = verdict

    # ── per-endpoint breakdown ──────────────────────────────────────────────
    by_endpoint: dict[str, list] = {}
    for path, status, ms in _samples:
        by_endpoint.setdefault(path, []).append((status, ms))

    endpoints = []
    for path, rows in sorted(by_endpoint.items()):
        lat = sorted(r[1] for r in rows)
        e_ok = sum(1 for r in rows if 200 <= r[0] < 400)
        endpoints.append({
            "endpoint": path,
            "requests": len(rows),
            "ok": e_ok,
            "errors": len(rows) - e_ok,
            "avg_ms": round(statistics.fmean(lat), 1),
            "min_ms": round(lat[0], 1),
            "p95_ms": round(_pct(lat, 95), 1),
            "max_ms": round(lat[-1], 1),
            "rps": round(len(rows) / wall_s, 1) if wall_s else 0.0,
        })
    summary["endpoints"] = endpoints

    _persist(summary)
    _print(summary)
    return summary


def _persist(s: dict):
    collectors.reset_load()

    def row(metric, value, observation, recommendation=""):
        collectors.load_result({"metric": metric, "value": value,
                                "observation": observation, "recommendation": recommendation})

    row("Concurrent Virtual Users", s["users"],
        "Normal expected classroom concurrency held for the full window", "")
    row("Test Duration", f"{s['duration_s']} s",
        f"Traffic sustained continuously for {s['wall_s']}s of wall-clock time", "")
    row("Total Requests", f"{s['requests']:,}",
        f"{s['ok']:,} successful, {s['errors']:,} errors", "")
    row("Throughput (RPS)", f"{s['rps']} req/sec",
        f"The API served roughly {int(s['rps'])} requests every second", "")
    row("Error Rate", f"{s['error_pct']}%",
        "Share of responses outside the 2xx/3xx range",
        "Investigate any endpoint below with a non-zero error count"
        if s["errors"] else "None — every request returned a success status")
    row("Response Time — Min", f"{s['min_ms']} ms", "Fastest single response", "")
    row("Response Time — Average", f"{s['avg_ms']} ms",
        f"Budget {AVG_BUDGET_MS} ms — "
        + ("within budget" if s["avg_ms"] <= AVG_BUDGET_MS else "OVER budget"),
        "" if s["avg_ms"] <= AVG_BUDGET_MS else "Profile the slowest endpoints below")
    row("Response Time — Median (p50)", f"{s['median_ms']} ms", "Typical user experience", "")
    row("Response Time — p90", f"{s['p90_ms']} ms", "9 in 10 requests were faster than this", "")
    row("Response Time — p95", f"{s['p95_ms']} ms",
        f"Budget {P95_BUDGET_MS} ms — "
        + ("within budget" if s["p95_ms"] <= P95_BUDGET_MS else "OVER budget"), "")
    row("Response Time — p99", f"{s['p99_ms']} ms", "Worst-case tail for 1 in 100 requests", "")
    row("Response Time — Max", f"{s['max_ms']} ms", "Slowest single response observed", "")
    row("Rate Limiter During Test",
        f"{os.environ.get('GLOBAL_RATE_LIMIT', '150')} req/min per IP",
        "The API rate-limits per source IP. Every virtual user here shares one IP, "
        "so the ceiling was raised for the benchmark; the production default is 150.",
        "Keep the 150 req/min production default — it is a deliberate abuse control, "
        "not a throughput limit, because real users arrive on distinct IPs.")
    row("Baseline Verdict", s["verdict"].split(" — ")[0], s["verdict"], "")

    for e in s["endpoints"]:
        collectors.load_endpoint(e)


def _print(s: dict):
    print(f"  Requests   : {s['requests']:,} in {s['wall_s']}s "
          f"({s['ok']:,} ok / {s['errors']:,} errors)")
    print(f"  Throughput : {s['rps']} req/sec")
    print(f"  Latency    : min {s['min_ms']}ms · avg {s['avg_ms']}ms · "
          f"p95 {s['p95_ms']}ms · max {s['max_ms']}ms")
    print(f"  Verdict    : {s['verdict']}")


if __name__ == "__main__":
    run()
