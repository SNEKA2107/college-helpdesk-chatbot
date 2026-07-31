"""Comprehensive HTTP API validation matrix (no browser).

Exercises every documented endpoint for: reachability with a valid token,
auth enforcement without a token, and login/register input validation.
Each case also feeds the 'API Validation Results' report sheet.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
import config
import collectors
from httputil import request as _request
from session import api_login

PROTECTED = [(p, m) for p, m in config.API_ENDPOINTS if p not in ("/auth/login", "/auth/register")]
HANDLED = {200, 201, 204, 400, 401, 403, 404, 409, 422}


def status(path, method="GET", token=None, body=None):
    """Status of an /api call (paths in config.API_ENDPOINTS omit the /api prefix)."""
    return _request(path, method=method, token=token, body=body, base=config.API_BASE)[0]


def _meta(rp, scenario, expected):
    rp("module", "API VALIDATION"); rp("scenario", scenario); rp("expected", expected)


def _record(endpoint, method, expected, actual, result):
    collectors.api_result(endpoint, method, expected, actual, result)


@pytest.fixture(scope="module")
def admin_token():
    _u, t = api_login(config.ADMIN_ID, config.ADMIN_PASSWORD)
    return t


@pytest.mark.parametrize("path,method", config.API_ENDPOINTS)
def test_endpoint_responds_without_server_error(record_property, admin_token, path, method):
    _meta(record_property, f"{method} {path} responds (no 5xx) with admin token",
          f"{method} /api{path} returns a handled status (2xx/4xx), never 5xx/connection error")
    if path == "/auth/login":
        code = status(path, "POST", body={"studentId": config.STUDENT_ID, "password": config.STUDENT_PASSWORD})
    elif path == "/auth/register":
        code = status(path, "POST", body={})
    else:
        code = status(path, method, token=admin_token)
    ok = code in HANDLED
    _record(path, method, "2xx/4xx (no 5xx)", code, "PASS" if ok else "FAIL")
    record_property("actual", f"{method} /api{path} -> {code}")
    assert ok


@pytest.mark.parametrize("path,method", PROTECTED)
def test_protected_endpoint_requires_token(record_property, path, method):
    _meta(record_property, f"{method} {path} requires authentication",
          f"{method} /api{path} without a token returns 401/403")
    code = status(path, method)
    ok = code in (401, 403)
    _record(path + " (no token)", method, 401, code, "PASS" if ok else "FAIL")
    record_property("actual", f"{method} /api{path} (no token) -> {code}")
    assert ok


# ── Login validation ─────────────────────────────────────────────────────────
@pytest.mark.parametrize("desc,body,expected", [
    ("valid student", {"studentId": config.STUDENT_ID, "password": config.STUDENT_PASSWORD}, 200),
    ("valid admin", {"studentId": config.ADMIN_ID, "password": config.ADMIN_PASSWORD}, 200),
    ("wrong password", {"studentId": config.STUDENT_ID, "password": "nope-nope-1"}, 401),
    ("unknown user", {"studentId": "ZZ000", "password": "whatever12"}, 401),
    ("missing password", {"studentId": config.STUDENT_ID}, 400),
    ("missing studentId", {"password": "whatever12"}, 400),
    ("empty body", {}, 400),
])
def test_login_validation(record_property, desc, body, expected):
    _meta(record_property, f"Login — {desc}",
          f"POST /api/auth/login ({desc}) returns {expected}")
    code = status("/auth/login", "POST", body=body)
    _record(f"/auth/login [{desc}]", "POST", expected, code, "PASS" if code == expected else "FAIL")
    record_property("actual", f"-> {code}")
    assert code == expected


# ── Register validation ──────────────────────────────────────────────────────
@pytest.mark.parametrize("desc,body,expected", [
    ("empty body", {}, 400),
    ("short password", {"name": "X", "studentId": "ZZ1", "email": "a@b.co", "password": "short", "department": "IT"}, 400),
    ("invalid email", {"name": "X", "studentId": "ZZ2", "email": "bad", "password": "Goodpass1!", "department": "IT"}, 400),
    ("missing department", {"name": "X", "studentId": "ZZ3", "email": "a@b.co", "password": "Goodpass1!"}, 400),
])
def test_register_validation(record_property, desc, body, expected):
    _meta(record_property, f"Register — {desc}",
          f"POST /api/auth/register ({desc}) returns {expected}")
    code = status("/auth/register", "POST", body=body)
    _record(f"/auth/register [{desc}]", "POST", expected, code, "PASS" if code == expected else "FAIL")
    record_property("actual", f"-> {code}")
    assert code == expected


def test_unknown_api_route_404(record_property):
    _meta(record_property, "Unknown API route returns 404",
          "GET /api/this-does-not-exist returns 404 JSON")
    code = status("/this-does-not-exist")
    _record("/this-does-not-exist", "GET", 404, code, "PASS" if code == 404 else "FAIL")
    record_property("actual", f"-> {code}")
    assert code == 404


def test_me_endpoint_with_token(record_property):
    _meta(record_property, "GET /auth/me returns the current user with a token",
          "Authenticated GET /api/auth/me returns 200")
    _u, token = api_login(config.STUDENT_ID, config.STUDENT_PASSWORD)
    code = status("/auth/me", token=token)
    _record("/auth/me", "GET", 200, code, "PASS" if code == 200 else "FAIL")
    record_property("actual", f"-> {code}")
    assert code == 200
