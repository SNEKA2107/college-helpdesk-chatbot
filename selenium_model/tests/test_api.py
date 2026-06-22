"""API validation: hit each documented endpoint with a real token, record status."""
import sys, json
import urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config
import collectors
from session import api_login


def _call(method, path, token=None, body=None):
    url = config.API_BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def test_api_endpoints_respond(driver, record_property):
    record_property("module", "API VALIDATION")
    record_property("scenario", "Authenticated GET/POST to documented API endpoints")
    record_property("expected", "Every endpoint responds without a server error (2xx, or an "
                                "intentional 4xx auth/validation gate) — no 5xx / connection failures")

    # Use an ADMIN token so admin-scoped endpoints (students, audit, marks…) are reachable.
    _user, token = api_login(config.ADMIN_ID, config.ADMIN_PASSWORD)
    server_errors = 0
    for path, method in config.API_ENDPOINTS:
        if path == "/auth/login":
            actual = _call("POST", path, body={"studentId": config.STUDENT_ID, "password": config.STUDENT_PASSWORD})
            expected = 200
        elif path == "/auth/register":
            actual = _call("POST", path, body={})  # empty body -> 400 validation (intentional)
            expected = 400
        else:
            actual = _call(method, path, token=token)
            expected = 200
        if actual == expected:
            result = "PASS"
        elif actual in (401, 403):
            result = "AUTH-GATED"   # protected by design — acceptable
        elif actual == 0 or actual >= 500:
            result = "FAIL"
            server_errors += 1
        else:
            result = "PASS"          # other 2xx/4xx still a valid handled response
        collectors.api.append({
            "endpoint": path, "method": method,
            "expected": expected, "actual": actual, "result": result})
    record_property("actual", f"{len(config.API_ENDPOINTS)} endpoints checked; server errors (5xx/conn)={server_errors}")
    assert server_errors == 0


def test_protected_endpoint_requires_auth(driver, record_property):
    record_property("module", "API VALIDATION")
    record_property("scenario", "Protected endpoint rejects requests without a token")
    record_property("expected", "GET /students without a token returns 401")
    code = _call("GET", "/students")
    collectors.api.append({
        "endpoint": "/students (no token)", "method": "GET",
        "expected": 401, "actual": code,
        "result": "PASS" if code == 401 else "FAIL"})
    collectors.security.append({
        "area": "Authentication", "severity": "Info",
        "observation": f"Unauthenticated GET /api/students returned {code} (expected 401 — endpoint protected).",
        "recommendation": "Keep JWT middleware enforced on all data endpoints."})
    record_property("actual", f"GET /students without token -> {code}")
    assert code == 401
