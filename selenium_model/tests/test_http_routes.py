"""HTTP-level route & static-asset availability (no browser).

The Express server serves the React build and falls back to index.html for any
unknown path (SPA routing), so every app route + legacy *.html path must return
200 with the SPA shell. Static assets referenced by the build must also resolve.
"""
import re
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
import config
from httputil import request

ALL_ROUTES = config.PUBLIC_ROUTES + config.STUDENT_ROUTES + config.ADMIN_ROUTES

LEGACY_HTML = [
    "/index.html", "/login.html", "/register.html", "/dashboard.html", "/admin.html",
    "/chat.html", "/requests.html", "/attendance.html", "/status.html", "/exam.html",
    "/fees.html", "/timetable.html", "/cgpa.html", "/leave.html", "/od.html",
    "/events.html", "/notices.html", "/library.html", "/contact.html", "/profile.html",
    "/admin-notices.html", "/admin-requests.html", "/admin-leaves.html", "/student-search.html",
]

# Static assets parsed from the built index.html at collection time
_DIST = config.PROJECT_ROOT / "frontend" / "dist" / "index.html"
_assets = ["/manifest.json", "/sw.js"]
if _DIST.exists():
    _assets += re.findall(r'(?:src|href)="(/[^"]+)"', _DIST.read_text(encoding="utf-8"))
STATIC_ASSETS = sorted(set(_assets))


def _meta(rp, scenario, expected):
    rp("module", "HTTP ROUTES"); rp("scenario", scenario); rp("expected", expected)


@pytest.mark.parametrize("route", ALL_ROUTES)
def test_route_returns_200(record_property, route):
    _meta(record_property, f"Route {route} is served (HTTP 200)",
          f"GET {route} returns HTTP 200 (SPA shell)")
    code, _, _ = request(route)
    record_property("actual", f"GET {route} -> {code}")
    assert code == 200


@pytest.mark.parametrize("route", ALL_ROUTES)
def test_route_serves_spa_shell(record_property, route):
    _meta(record_property, f"Route {route} serves the SPA HTML shell",
          f"GET {route} response contains the #root mount / HTML doctype")
    code, _, text = request(route)
    low = text.lower()
    ok = ('id="root"' in low) or ("<!doctype html" in low) or ("<div id=root" in low)
    record_property("actual", f"status={code}, shell markers present={ok}")
    assert code == 200 and ok


@pytest.mark.parametrize("path", LEGACY_HTML)
def test_legacy_html_path_resolves(record_property, path):
    _meta(record_property, f"Legacy path {path} resolves (no hard 404)",
          f"GET {path} returns 200 (served file or SPA fallback)")
    code, _, _ = request(path)
    record_property("actual", f"GET {path} -> {code}")
    assert code == 200


@pytest.mark.parametrize("asset", STATIC_ASSETS)
def test_static_asset_available(record_property, asset):
    _meta(record_property, f"Static asset {asset} is available",
          f"GET {asset} returns 200")
    code, _, _ = request(asset)
    record_property("actual", f"GET {asset} -> {code}")
    assert code == 200
