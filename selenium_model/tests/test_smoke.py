"""Phase 5 — Smoke tests. Fast build-verification of the deployed application."""
import pytest

import apiclient
import collectors
import config
from pages.base_page import BasePage

pytestmark = pytest.mark.smoke


def test_backend_reachable(case):
    case("Smoke", "Backend API responds to an unauthenticated probe",
         "GET /api/auth/setup-status returns HTTP 200 with JSON")
    res = apiclient.api("/auth/setup-status")
    case.actual(f"HTTP {res.status}")
    assert res.status == 200, f"backend not reachable: {res.status} {res.error}"


def test_spa_shell_served(case, driver):
    case("Smoke", "Express serves the built React SPA shell",
         "GET / returns index.html and the #root element mounts")
    page = BasePage(driver)
    page.go("/")
    case.actual(f"landed on {page.path}, title={driver.title!r}")
    assert page.find("#root") is not None, "React #root element missing"


def test_entry_point_redirects_to_login(case, driver):
    case("Smoke", "Unauthenticated entry point resolves to the unified login",
         "GET / redirects to /login and renders the login form")
    page = BasePage(driver)
    page.go("/")
    page.clear_session()
    page.go("/")
    ok = page.wait_for_path("/login", 10)
    case.actual(f"final path {page.path}")
    collectors.covers("authentication-unified-login-student-faculty-admin")
    assert ok, f"expected /login, got {page.path}"


def test_login_form_renders(case, driver):
    case("Smoke", "Login form exposes both credential fields and a submit control",
         "#ca-identifier, #ca-password and a submit button are present")
    page = BasePage(driver)
    page.go("/login")
    ident = page.find("#ca-identifier")
    pwd = page.find("#ca-password")
    btn = page.find("button[type='submit']")
    case.actual(f"identifier={ident is not None} password={pwd is not None} submit={btn is not None}")
    assert ident is not None and pwd is not None and btn is not None


@pytest.mark.parametrize("role", ["student", "admin", "faculty"])
def test_seeded_role_can_authenticate(case, role):
    case("Smoke", f"Seeded {role} credentials authenticate at the API layer",
         "POST /api/auth/login returns 200 with a JWT")
    token = apiclient.login_token(role)
    case.actual("token issued" if token else "no token returned")
    assert token, f"{role} login failed — check backend/dev-local.js seed data"


def test_static_assets_load(case, driver):
    case("Smoke", "Built JS/CSS bundles load without a 404",
         "Every <script src> and <link rel=stylesheet> returns HTTP 200")
    page = BasePage(driver)
    page.go("/login")
    urls = []
    for el in page.all("script[src]"):
        urls.append(el.get_attribute("src"))
    for el in page.all("link[rel='stylesheet']"):
        urls.append(el.get_attribute("href"))
    bad = []
    for u in [u for u in urls if u and u.startswith(config.BASE_URL)]:
        r = apiclient.request(u)
        if r.status != 200:
            bad.append(f"{u} -> {r.status}")
            collectors.broken_link(u, "/login", r.status, "Failed")
    case.actual(f"{len(urls)} asset(s) checked, {len(bad)} bad")
    assert not bad, "asset(s) failed to load: " + "; ".join(bad)
