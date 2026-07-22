"""HTTP security-header & hardening checks (no browser).

The backend uses Helmet; these assert the hardening headers are actually
emitted, plus SPA-fallback and API 404 behaviour. Findings feed the
'Security Observations' report sheet.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
import config
import collectors
from httputil import request, status

# (header, expected-substring or None for 'present')
SECURITY_HEADERS = [
    ("Content-Security-Policy", "default-src 'self'"),
    ("X-Content-Type-Options", "nosniff"),
    ("X-Frame-Options", "SAMEORIGIN"),
    ("Strict-Transport-Security", "max-age"),
    ("Referrer-Policy", None),
    ("X-DNS-Prefetch-Control", None),
    ("X-Download-Options", None),
]


def _meta(rp, scenario, expected):
    rp("module", "SECURITY"); rp("scenario", scenario); rp("expected", expected)


@pytest.mark.parametrize("header,substr", SECURITY_HEADERS)
def test_security_header_present(record_property, header, substr):
    _meta(record_property, f"Response sets {header}",
          f"Root response includes the {header} security header"
          + (f" containing '{substr}'" if substr else ""))
    _code, headers, _ = request("/")
    val = headers.get(header)
    present = val is not None and (substr is None or substr.lower() in val.lower())
    collectors.security.append({
        "area": "HTTP headers", "severity": "Info",
        "observation": f"{header}: {val if val else 'MISSING'}",
        "recommendation": "Keep Helmet hardening headers enabled." if present
                          else f"Enable the {header} header."})
    record_property("actual", f"{header}={val!r}")
    assert present


def test_csp_blocks_framing(record_property):
    _meta(record_property, "CSP forbids framing (clickjacking defense)",
          "Content-Security-Policy includes frame-ancestors 'none'")
    _c, headers, _ = request("/")
    csp = headers.get("Content-Security-Policy", "")
    ok = "frame-ancestors 'none'" in csp
    record_property("actual", f"frame-ancestors present={ok}")
    assert ok


def test_api_404_is_json(record_property):
    _meta(record_property, "Unknown API route returns JSON 404",
          "GET /api/does-not-exist returns 404 with a JSON error body")
    code, headers, text = request("/api/does-not-exist", base=config.BASE_URL)
    is_json = "application/json" in headers.get("Content-Type", "")
    record_property("actual", f"status={code}, content-type json={is_json}")
    assert code == 404 and is_json


def test_spa_fallback_for_unknown_path(record_property):
    _meta(record_property, "Unknown non-API path falls back to SPA shell",
          "GET /totally/unknown/path returns 200 HTML (client-side routing)")
    code, _h, text = request("/totally/unknown/path")
    ok = code == 200 and ('id="root"' in text.lower() or "<!doctype html" in text.lower())
    record_property("actual", f"status={code}, spa shell={ok}")
    assert ok


def test_login_rate_limit_headers(record_property):
    _meta(record_property, "Auth endpoint exposes rate-limit headers",
          "POST /api/auth/login returns RateLimit standard headers")
    _c, headers, _ = request("/api/auth/login", method="POST",
                             body={"studentId": "x", "password": "y"}, base=config.BASE_URL)
    has = any(k.lower().startswith("ratelimit") for k in headers)
    collectors.security.append({
        "area": "Rate limiting", "severity": "Info",
        "observation": f"RateLimit headers on /auth/login present={has}",
        "recommendation": "Keep express-rate-limit on auth + global API routes."})
    record_property("actual", f"ratelimit headers present={has}")
    assert has
