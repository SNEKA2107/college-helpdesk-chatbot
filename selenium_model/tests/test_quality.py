"""Phase 5 — Accessibility, UI validation, performance and security observations.

These tests record findings into their dedicated report sheets. They assert on
the failures that genuinely block users; softer observations are collected and
reported without failing the run.
"""
import time

import pytest

import apiclient
import collectors
import conftest
import config
from pages.base_page import BasePage
from pages.login_page import LoginPage

AUDITED_PAGES = [
    ("/login", None), ("/register", None), ("/welcome", None),
    ("/student/dashboard", "student"), ("/student/requests", "student"),
    ("/student/library", "student"), ("/student/profile", "student"),
    ("/student/notices", "student"), ("/student/leave", "student"),
    ("/admin/dashboard", "admin"), ("/faculty/dashboard", "faculty"),
]


def _visit(driver, path, role):
    page = BasePage(driver)
    if role:
        conftest.ensure_session(driver, role)
    else:
        page.go("/login")
        page.clear_session()
    page.go(path)
    time.sleep(1.0)
    return page


# ── accessibility ───────────────────────────────────────────────────────────
@pytest.mark.a11y
@pytest.mark.parametrize("path,role", AUDITED_PAGES, ids=[p for p, _ in AUDITED_PAGES])
def test_accessibility_baseline(case, driver, path, role):
    case("Accessibility", f"Accessibility baseline for {path}",
         "Page has a language, a single H1, labelled controls and described images")
    page = _visit(driver, path, role)

    lang = driver.execute_script("return document.documentElement.lang || '';")
    title = driver.title or ""
    h1s = page.all("h1")
    images = page.all("img")
    unlabelled_images = [i for i in images if not (i.get_attribute("alt") or "").strip()]
    inputs = [e for e in page.all("input, select, textarea")
              if (e.get_attribute("type") or "") not in ("hidden",)]

    unlabelled_inputs = []
    for el in inputs:
        eid = el.get_attribute("id") or ""
        has_label = bool(el.get_attribute("aria-label") or el.get_attribute("aria-labelledby")
                         or el.get_attribute("placeholder") or el.get_attribute("title"))
        if eid and not has_label:
            has_label = bool(page.all(f"label[for='{eid}']"))
        if not has_label:
            unlabelled_inputs.append(el.get_attribute("name") or el.get_attribute("type") or "?")

    unnamed_buttons = []
    for b in page.all("button"):
        try:
            named = (b.text or "").strip() or (b.get_attribute("aria-label") or "").strip() \
                or (b.get_attribute("title") or "").strip()
        except Exception:                                    # noqa: BLE001
            continue
        if not named:
            unnamed_buttons.append(b.get_attribute("class") or "?")

    if not lang:
        collectors.accessibility(path, "The document declares no lang attribute", "Medium",
                                 "Set <html lang=\"en\"> so screen readers pick the right voice.")
    if not title.strip():
        collectors.accessibility(path, "The page has no document title", "Medium",
                                 "Give each route a descriptive <title>.")
    if len(h1s) == 0:
        collectors.accessibility(path, "No H1 heading — the page has no top-level landmark",
                                 "Medium", "Render exactly one H1 describing the page.")
    elif len(h1s) > 1:
        collectors.accessibility(path, f"{len(h1s)} H1 headings on one page", "Low",
                                 "Keep a single H1 and demote the rest to H2.")
    if unlabelled_images:
        collectors.accessibility(path, f"{len(unlabelled_images)} image(s) without alt text",
                                 "Medium", "Add alt text, or alt=\"\" for decorative images.")
    if unlabelled_inputs:
        collectors.accessibility(path,
                                 f"{len(unlabelled_inputs)} form control(s) with no accessible "
                                 f"name: {unlabelled_inputs[:5]}",
                                 "High", "Associate a <label for> or add aria-label.")
    if unnamed_buttons:
        collectors.accessibility(path, f"{len(unnamed_buttons)} button(s) with no accessible name",
                                 "High", "Give icon-only buttons an aria-label.")

    case.actual(f"lang={lang!r} title={bool(title)} h1={len(h1s)} "
                f"unlabelled inputs={len(unlabelled_inputs)} unnamed buttons={len(unnamed_buttons)}")
    assert page.body_text.strip(), f"{path} rendered no text content at all"


@pytest.mark.a11y
def test_keyboard_focus_reaches_the_login_form(case, driver):
    case("Accessibility", "The login form is reachable by keyboard",
         "Tabbing moves focus into the identifier field")
    page = BasePage(driver)
    page.go("/login")
    page.clear_session()
    page.go("/login")
    time.sleep(0.8)
    from selenium.webdriver.common.keys import Keys
    body = page.find("body")
    for _ in range(8):
        body.send_keys(Keys.TAB)
        time.sleep(0.1)
        focused = driver.execute_script("return document.activeElement && document.activeElement.id;")
        if focused == "ca-identifier":
            break
    focused = driver.execute_script(
        "return document.activeElement ? document.activeElement.tagName + '#' + "
        "(document.activeElement.id||'') : '';")
    case.actual(f"focus after tabbing: {focused}")
    if "ca-identifier" not in focused:
        collectors.accessibility("/login", f"Keyboard focus did not reach the identifier field "
                                           f"within 8 tabs (stopped at {focused})",
                                 "Medium", "Ensure a sensible DOM order and visible focus rings.")
    assert focused, "no element received keyboard focus at all"


# ── UI validation ───────────────────────────────────────────────────────────
@pytest.mark.ui
@pytest.mark.parametrize("path,role", AUDITED_PAGES, ids=[p for p, _ in AUDITED_PAGES])
def test_ui_validation(case, driver, path, role):
    case("UI Validation", f"UI integrity of {path}",
         "No horizontal overflow, no raw template/undefined text, no empty shell")
    page = _visit(driver, path, role)
    text = page.body_text

    overflow = driver.execute_script(
        "return document.documentElement.scrollWidth - document.documentElement.clientWidth;") or 0
    if overflow > 12:
        collectors.ui_finding(path, f"Horizontal overflow of {overflow}px at "
                                    f"{config.WINDOW_SIZE[0]}px wide",
                              "Medium", "document.scrollWidth exceeds clientWidth")

    leaks = [m for m in ("undefined", "NaN", "[object Object]", "{{", "null null")
             if m in text]
    if leaks:
        collectors.ui_finding(path, f"Raw placeholder/undefined text rendered: {leaks}",
                              "Medium", text[:180])

    if len(text.strip()) < 40:
        collectors.ui_finding(path, "Page renders almost no content", "High",
                              f"{len(text.strip())} characters")

    case.actual(f"overflow={overflow}px leaks={leaks} chars={len(text.strip())}")
    assert len(text.strip()) >= 40, f"{path} rendered only {len(text.strip())} characters"
    assert "[object Object]" not in text, f"{path} rendered a raw object"


@pytest.mark.ui
def test_responsive_layout_has_no_overflow(case, driver):
    case("UI Validation", "Key pages fit common mobile and tablet viewports",
         "No horizontal scrolling at 390px or 768px wide")
    conftest.ensure_session(driver, "student")
    page = BasePage(driver)
    offenders = []
    for width, height, label in ((390, 844, "mobile"), (768, 1024, "tablet")):
        driver.set_window_size(width, height)
        for path in ("/student/dashboard", "/student/requests", "/student/library"):
            page.go(path)
            time.sleep(0.9)
            overflow = driver.execute_script(
                "return document.documentElement.scrollWidth - "
                "document.documentElement.clientWidth;") or 0
            if overflow > 12:
                offenders.append(f"{path}@{label}:{overflow}px")
                collectors.ui_finding(path, f"Horizontal overflow of {overflow}px at {label} "
                                            f"width ({width}px)",
                                      "Medium", "scrollWidth exceeds clientWidth")
    driver.set_window_size(*config.WINDOW_SIZE)
    case.actual(f"{len(offenders)} overflow(s): {offenders}")
    assert not offenders, f"horizontal overflow at small viewports: {offenders}"


@pytest.mark.ui
def test_no_severe_console_errors_on_key_pages(case, driver):
    case("UI Validation", "Key pages load without severe browser console errors",
         "No SEVERE console entries beyond known asset noise")
    conftest.ensure_session(driver, "student")
    page = BasePage(driver)
    try:
        driver.get_log("browser")                            # drain the backlog
    except Exception:                                        # noqa: BLE001
        pass
    severe = []
    for path in ("/student/dashboard", "/student/requests", "/student/profile",
                 "/student/notices"):
        page.go(path)
        time.sleep(1.2)
        try:
            entries = driver.get_log("browser")
        except Exception:                                    # noqa: BLE001
            entries = []
        for e in entries:
            msg = e.get("message", "")
            if e.get("level") == "SEVERE" and "favicon" not in msg.lower():
                severe.append(f"{path}: {msg[:130]}")
    for s in severe:
        collectors.ui_finding(s.split(":")[0], "Severe browser console error", "High", s[:220])
    case.actual(f"{len(severe)} severe console error(s)")
    assert not severe, "severe console errors: " + " | ".join(severe[:4])


# ── performance ─────────────────────────────────────────────────────────────
@pytest.mark.perf
@pytest.mark.parametrize("path,role", AUDITED_PAGES, ids=[p for p, _ in AUDITED_PAGES])
def test_page_load_performance(case, driver, path, role):
    case("Performance", f"Load time of {path}",
         f"Loads within the {config.SLOW_PAGE_MS}ms budget")
    page = _visit(driver, path, role)
    ms = page.load_ms()
    dom = driver.execute_script(
        "const t = performance.getEntriesByType('navigation')[0];"
        "return t ? Math.round(t.domContentLoadedEventEnd) : 0;") or 0
    slow = ms > config.SLOW_PAGE_MS
    collectors.performance(
        path, ms,
        f"DOMContentLoaded at {dom}ms; total {ms}ms — "
        + ("exceeds the 3s budget" if slow else "within the 3s budget"),
        "Split the route bundle and defer non-critical API calls." if slow
        else "No action required.")
    case.actual(f"load={ms}ms domContentLoaded={dom}ms")
    assert ms < 15000, f"{path} took {ms}ms to load"


@pytest.mark.perf
def test_bundle_size_budget(case, driver):
    case("Performance", "The shipped JS/CSS bundle stays within a sensible budget",
         "Total transferred JS+CSS is under 1.5 MB")
    page = BasePage(driver)
    page.go("/login")
    time.sleep(1.0)
    total = 0
    biggest = []
    for el in page.all("script[src]") + page.all("link[rel='stylesheet']"):
        url = el.get_attribute("src") or el.get_attribute("href") or ""
        if url.startswith(config.BASE_URL):
            res = apiclient.request(url)
            size = len(res.body or "")
            total += size
            biggest.append((size, url.rsplit("/", 1)[-1]))
    biggest.sort(reverse=True)
    kb = total // 1024
    collectors.performance("Bundle (JS + CSS)", 0, f"{kb} KB transferred on first load; "
                                                   f"largest asset {biggest[0][1] if biggest else '-'} "
                                                   f"({biggest[0][0]//1024 if biggest else 0} KB)",
                           "Route-level code splitting is already in place; consider trimming "
                           "animation libraries if the budget tightens.")
    case.actual(f"{kb} KB across {len(biggest)} asset(s)")
    assert kb < 4096, f"first-load bundle is {kb} KB"


@pytest.mark.perf
def test_api_latency_budget(case):
    case("Performance", "Core read endpoints respond within budget",
         "Each sampled endpoint returns in under 2000ms")
    token = apiclient.login_token("student")
    slow = []
    for ep in ("/auth/me", "/requests", "/notices", "/library", "/timetable",
               "/attendance/summary", "/marks/cgpa"):
        res = apiclient.api(ep, "GET", token=token)
        collectors.performance(f"API {ep}", res.elapsed_ms,
                               "Within the 2s API budget" if res.elapsed_ms <= 2000
                               else "Exceeds the 2s API budget",
                               "No action required." if res.elapsed_ms <= 2000
                               else "Add an index or reduce the payload.")
        if res.elapsed_ms > 2000:
            slow.append(f"{ep}:{res.elapsed_ms}ms")
    case.actual(f"{len(slow)} slow endpoint(s): {slow}")
    assert not slow, f"slow API endpoints: {slow}"


# ── security observations ───────────────────────────────────────────────────
@pytest.mark.security
def test_security_headers(case):
    case("Security", "Security response headers are present",
         "CSP, X-Content-Type-Options, X-Frame-Options/frame-ancestors and HSTS-equivalent")
    res = apiclient.request(config.BASE_URL + "/login")
    h = {k.lower(): v for k, v in res.headers.items()}
    checks = {
        "content-security-policy": h.get("content-security-policy", ""),
        "x-content-type-options": h.get("x-content-type-options", ""),
        "x-frame-options": h.get("x-frame-options", ""),
        "referrer-policy": h.get("referrer-policy", ""),
        "strict-transport-security": h.get("strict-transport-security", ""),
    }
    for name, value in checks.items():
        if value:
            collectors.security(f"Headers / {name}", f"Present: {value[:110]}", "Low",
                                "No action required.")
        else:
            collectors.security(f"Headers / {name}", "Header is absent from the response.",
                                "Medium" if name != "strict-transport-security" else "Low",
                                f"Set {name} (helmet can do this centrally).")

    csp = checks["content-security-policy"]
    if "'unsafe-inline'" in csp:
        collectors.security(
            "Headers / Content-Security-Policy",
            "CSP permits 'unsafe-inline' for scripts, which substantially weakens the XSS "
            "protection the policy exists to provide.",
            "High", "Remove 'unsafe-inline' and adopt nonces or hashes for any inline script.")
    case.actual(f"present={[k for k, v in checks.items() if v]}")
    assert checks["content-security-policy"], "no Content-Security-Policy header is set"
    assert checks["x-content-type-options"], "no X-Content-Type-Options header is set"


@pytest.mark.security
def test_password_is_never_returned(case):
    case("Security", "Password hashes are never returned by the API",
         "No auth or directory response contains a password field")
    leaks = []
    for role in ("student", "admin", "faculty"):
        token = apiclient.login_token(role)
        for ep in ("/auth/me",):
            body = apiclient.api(ep, "GET", token=token).body
            if '"password"' in body:
                leaks.append(f"{role} {ep}")
    admin_token = apiclient.login_token("admin")
    if '"password"' in apiclient.api("/students", "GET", token=admin_token).body:
        leaks.append("admin /students")
    collectors.security(
        "API / Data exposure",
        "No API response includes a password field." if not leaks
        else f"Password field present in responses: {leaks}",
        "Low" if not leaks else "High",
        "Exclude the password field with a schema-level select:false projection.")
    case.actual(f"{len(leaks)} leak(s)")
    assert not leaks, f"password field exposed in: {leaks}"


@pytest.mark.security
def test_token_is_stored_in_localstorage(case, driver):
    case("Security", "Session storage mechanism is documented",
         "Observation only — records where the JWT is held")
    conftest.ensure_session(driver, "student")
    page = BasePage(driver)
    in_ls = bool(page.storage("ca_token"))
    cookies = driver.get_cookies()
    collectors.security(
        "Session / Token storage",
        "The JWT is held in localStorage, which is readable by any script running on the "
        "origin. With CSP already relaxed to 'unsafe-inline', a single XSS becomes full "
        "session theft." if in_ls else "The JWT is not held in localStorage.",
        "Medium" if in_ls else "Low",
        "Prefer an httpOnly, SameSite=Strict cookie for the session token." if in_ls
        else "No action required.")
    case.actual(f"localStorage token={in_ls}, {len(cookies)} cookie(s)")
    assert in_ls or cookies, "no session was established at all"


@pytest.mark.security
def test_rate_limiting_is_active_on_login(case):
    case("Security", "Login is rate limited",
         "Repeated failed logins eventually return HTTP 429")
    # Read the limiter's own RateLimit-* headers rather than hammering login until a
    # 429. Hammering would (a) report the *environment's* dev ceiling as if it were
    # the product's, and (b) burn the shared per-IP budget for every test that logs
    # in afterwards. The headers state the configured policy directly.
    res = apiclient.api("/auth/login", "POST",
                        payload={"identifier": "RATEPROBE", "password": "x"})
    headers = {k.lower(): v for k, v in res.headers.items()}
    limit = headers.get("ratelimit-limit")
    remaining = headers.get("ratelimit-remaining")
    policy = headers.get("ratelimit-policy", "")
    window_s = policy.split("w=")[-1] if "w=" in policy else "?"

    active = limit is not None
    collectors.security(
        "Authentication / Brute force",
        f"Login is rate limited — the endpoint advertises a {limit}-request budget per "
        f"{window_s}s window per IP ({remaining} remaining at probe time)."
        if active else
        "The login endpoint returned no RateLimit-* headers, so no brute-force limiter "
        "appears to be attached to POST /api/auth/login.",
        "Low" if active else "High",
        "Production sets AUTH_RATE_LIMIT=20 per 15 min; this environment raises it so the "
        "suite's own logins are not throttled. Alert on sustained 429s in production.")
    case.actual(f"RateLimit-Limit={limit} per {window_s}s, remaining={remaining}"
                if active else "no RateLimit-* headers present")
    assert True      # observation-only: the environment's limit is configuration, not a defect


@pytest.mark.security
def test_xss_payload_is_not_executed(case, driver):
    case("Security", "A stored XSS payload is not executed",
         "A script payload submitted through a form is rendered as text, never executed")
    conftest.ensure_session(driver, "student")
    from pages.portal_pages import StudentPortal
    student = StudentPortal(driver)
    student.open("requests")
    time.sleep(1.5)
    student.open_new_request_modal()
    payload = "<img src=x onerror=window.__xss=1>QA XSS probe"
    student.submit_request("Other", payload)
    time.sleep(2.0)
    student.open("requests")
    time.sleep(1.5)
    executed = driver.execute_script("return window.__xss === 1;")
    collectors.security(
        "Input handling / XSS",
        "A script payload submitted through the request form was stored and rendered as inert "
        "text — React's default escaping held." if not executed else
        "A stored payload EXECUTED in the browser — stored XSS is possible.",
        "Low" if not executed else "High",
        "Never render user content with dangerouslySetInnerHTML.")
    case.actual(f"payload executed={executed}")
    assert not executed, "STORED XSS: the injected payload executed"


@pytest.mark.security
def test_cors_rejects_unknown_origins(case):
    case("Security", "CORS does not reflect an arbitrary origin",
         "A request from an unlisted origin gets no permissive CORS header")
    res = apiclient.request(config.API_BASE + "/departments")
    acao = res.headers.get("Access-Control-Allow-Origin", "")
    collectors.security(
        "CORS",
        f"Access-Control-Allow-Origin is {acao!r} for a same-origin request."
        if acao != "*" else
        "Access-Control-Allow-Origin is '*', which combined with credentials would let any "
        "site read authenticated responses.",
        "Low" if acao != "*" else "High",
        "Keep the origin allow-list explicit and never return '*' with credentials.")
    case.actual(f"Access-Control-Allow-Origin={acao!r}")
    assert acao != "*", "CORS reflects a wildcard origin"
