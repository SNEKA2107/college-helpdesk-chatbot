"""Phase 5 — API validation and broken-link validation."""
import time

import pytest

import apiclient
import collectors
import config
from pages.base_page import BasePage
from pages.login_page import LoginPage


# ── API validation ──────────────────────────────────────────────────────────
@pytest.mark.api
@pytest.mark.parametrize("endpoint,method,role,expected", config.API_CHECKS,
                         ids=[f"{m}_{e}_{r or 'anon'}" for e, m, r, _ in config.API_CHECKS])
def test_api_contract(case, endpoint, method, role, expected):
    label = f"{method} {endpoint} as {role or 'anonymous'}"
    case("API", label, f"Returns HTTP {expected}")
    token = apiclient.login_token(role) if role else None
    res = apiclient.api(endpoint, method, token=token)
    result = "Pass" if res.status == expected else "Fail"
    collectors.api_result(endpoint, method, expected, res.status, result,
                          f"as {role or 'anonymous'} ({res.elapsed_ms}ms)")
    if res.elapsed_ms > 2000:
        collectors.performance(f"API {endpoint}", res.elapsed_ms,
                               "API response slower than 2s",
                               "Add an index or trim the aggregation for this route.")
    case.actual(f"HTTP {res.status} in {res.elapsed_ms}ms")
    assert res.status == expected, f"{label}: expected {expected}, got {res.status}"


@pytest.mark.api
def test_api_responses_are_json(case):
    case("API", "Protected endpoints answer with JSON",
         "Every sampled endpoint returns a Content-Type of application/json")
    token = apiclient.login_token("student")
    bad = []
    for ep in ("/auth/me", "/requests", "/notices", "/library", "/attendance/summary"):
        res = apiclient.api(ep, "GET", token=token)
        ctype = res.headers.get("Content-Type", "")
        if "application/json" not in ctype:
            bad.append(f"{ep} -> {ctype!r}")
    case.actual(f"{len(bad)} non-JSON response(s)")
    assert not bad, "non-JSON responses: " + "; ".join(bad)


@pytest.mark.api
def test_unknown_api_path_returns_json_404(case):
    case("API", "An unknown /api path 404s as JSON",
         "It must not fall through to the SPA shell with HTTP 200")
    res = apiclient.api("/nope/definitely-not-a-route", "GET")
    body = res.body[:60].lower()
    is_html = "<!doctype" in body or "<html" in body
    collectors.api_result("/api/nope/*", "GET", 404, res.status,
                          "Pass" if res.status == 404 and not is_html else "Fail",
                          "unknown API route")
    case.actual(f"HTTP {res.status}, html={is_html}")
    assert res.status == 404, f"unknown API path returned HTTP {res.status}"
    assert not is_html, "an unknown API path served the SPA shell instead of a JSON 404"


@pytest.mark.api
def test_dead_legacy_asset_returns_404(case):
    case("API", "A dead legacy asset path 404s rather than serving the SPA",
         "GET /attendance.html returns HTTP 404")
    res = apiclient.request(config.BASE_URL + "/attendance.html")
    case.actual(f"HTTP {res.status}")
    assert res.status == 404, f"legacy asset returned HTTP {res.status}"


@pytest.mark.api
def test_malformed_json_is_handled(case):
    case("API", "Malformed JSON is rejected cleanly",
         "The server answers with a 4xx, never a 500")
    import urllib.request
    req = urllib.request.Request(config.API_BASE + "/auth/login", data=b"{not json",
                                 method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            status = r.status
    except Exception as e:                                   # noqa: BLE001
        status = getattr(e, "code", 0)
    collectors.api_result("/auth/login", "POST", "4xx", status,
                          "Pass" if 400 <= status < 500 else "Fail", "malformed JSON body")
    case.actual(f"HTTP {status}")
    assert 400 <= status < 500, f"malformed JSON produced HTTP {status}"


@pytest.mark.api
def test_invalid_object_id_is_handled(case):
    case("API", "An invalid Mongo ObjectId is handled",
         "A malformed id returns a 4xx, never an unhandled 500")
    token = apiclient.login_token("admin")
    res = apiclient.api("/students/not-a-valid-object-id", "GET", token=token)
    collectors.api_result("/students/:id", "GET", "4xx", res.status,
                          "Pass" if res.status < 500 else "Fail", "malformed ObjectId")
    if res.status >= 500:
        collectors.defect("API / Input handling",
                          "A malformed ObjectId reaches the database layer and produces an "
                          f"unhandled HTTP {res.status}.",
                          "1. GET /api/students/not-a-valid-object-id as an admin",
                          "Medium", "backend/routes/students.js")
    case.actual(f"HTTP {res.status}")
    assert res.status < 500, f"malformed id caused HTTP {res.status}"


@pytest.mark.api
def test_api_error_bodies_do_not_leak_internals(case):
    case("Security", "Error responses do not leak stack traces or internals",
         "4xx/5xx bodies contain no stack trace, file path or driver text")
    token = apiclient.login_token("admin")
    leaks = []
    for ep in ("/students/not-a-valid-object-id", "/nope/route",
               "/notices/000000000000000000000000"):
        body = apiclient.api(ep, "GET", token=token).body.lower()
        for marker in ("at object.", "node_modules", "\\backend\\", "/backend/",
                       "mongoservererror", "castError".lower()):
            if marker in body:
                leaks.append(f"{ep}: {marker}")
    collectors.security(
        "API / Error handling",
        "Error responses expose no stack traces, file paths or driver internals."
        if not leaks else f"Error responses leak internals: {leaks}",
        "Low" if not leaks else "High",
        "Return a generic message and log the detail server-side.")
    case.actual(f"{len(leaks)} leak(s)")
    assert not leaks, f"internal detail leaked: {leaks}"


# ── broken link validation ──────────────────────────────────────────────────
def _collect_links(page: BasePage) -> list[str]:
    urls = []
    for el in page.all("a[href]"):
        try:
            href = el.get_attribute("href") or ""
        except Exception:                                    # noqa: BLE001
            continue
        if href and not href.startswith(("javascript:", "mailto:", "tel:")) \
                and not href.endswith("#"):
            urls.append(href.split("#")[0])
    return sorted(set(urls))


@pytest.mark.nav
def test_public_page_links_resolve(case, driver):
    case("Broken Links", "Every link on the public pages resolves",
         "No link returns a 4xx/5xx status")
    page = BasePage(driver)
    page.go("/login")
    page.clear_session()
    broken = []
    checked = 0
    for source in ("/login", "/register", "/welcome"):
        page.go(source)
        time.sleep(1.0)
        for url in _collect_links(page):
            checked += 1
            if url.startswith(config.BASE_URL):
                res = apiclient.request(url)
                status, ok = res.status, res.status < 400
            else:
                status, ok = "external", True     # not fetched — third-party host
                collectors.broken_link(url, source, "external", "Skipped (external host)")
                continue
            collectors.broken_link(url, source, status, "OK" if ok else "Broken")
            if not ok:
                broken.append(f"{source} -> {url} ({status})")
    case.actual(f"{checked} link(s) checked, {len(broken)} broken")
    assert not broken, "broken links: " + "; ".join(broken)


@pytest.mark.nav
def test_authenticated_navigation_links_resolve(case, driver):
    case("Broken Links", "Every navigation link in the student portal resolves",
         "No sidebar, topbar or in-page link returns a 4xx/5xx status")
    LoginPage(driver).login_as("student")
    page = BasePage(driver)
    broken = []
    checked = 0
    for source in ("/student/dashboard", "/student/requests", "/student/library",
                   "/student/profile", "/student/notices"):
        page.go(source)
        time.sleep(0.9)
        for url in _collect_links(page):
            if not url.startswith(config.BASE_URL):
                collectors.broken_link(url, source, "external", "Skipped (external host)")
                continue
            checked += 1
            res = apiclient.request(url)
            ok = res.status < 400
            collectors.broken_link(url, source, res.status, "OK" if ok else "Broken")
            if not ok:
                broken.append(f"{source} -> {url} ({res.status})")
    case.actual(f"{checked} link(s) checked, {len(broken)} broken")
    assert not broken, "broken links: " + "; ".join(broken)


@pytest.mark.nav
def test_favicon_and_manifest_resolve(case):
    case("Broken Links", "Site icons and the PWA manifest resolve",
         "favicon and manifest.json return HTTP 200")
    results = {}
    for path in ("/favicon.ico", "/manifest.json", "/icons/icon-192.png"):
        res = apiclient.request(config.BASE_URL + path)
        results[path] = res.status
        ok = res.status == 200
        collectors.broken_link(config.BASE_URL + path, "/", res.status, "OK" if ok else "Broken")
        if not ok:
            collectors.ui_finding(path, f"Site asset missing (HTTP {res.status})", "Low",
                                  "Browsers request this on every page load, producing "
                                  "console noise and a default icon.")
    case.actual(str(results))
    assert results["/manifest.json"] == 200, \
        f"PWA manifest missing (HTTP {results['/manifest.json']})"
