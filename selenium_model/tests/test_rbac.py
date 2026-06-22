"""Role-based access control and route guards."""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import config
from session import authed_driver, ensure_anonymous
from pages.base_page import BasePage
from pages.admin_page import AdminPage


def _meta(rp, scenario, expected):
    rp("module", "RBAC"); rp("scenario", scenario); rp("expected", expected)


def test_unauthenticated_user_redirected_to_login(driver, record_property):
    _meta(record_property, "Unauthenticated access to /dashboard redirects to /login",
          "Guard RequireAuth bounces anonymous users to /login")
    bp = BasePage(driver)
    ensure_anonymous(driver)
    driver.get(config.BASE_URL + "/dashboard")
    time.sleep(1.5)
    path = bp.current_path()
    record_property("actual", f"landed on {path}")
    assert path.startswith("/login")


def test_student_cannot_access_admin(driver, record_property):
    _meta(record_property, "Student is blocked from /admin (redirected to dashboard)",
          "Guard RequireAdmin redirects non-admins away from /admin")
    authed_driver(driver, student=True)
    driver.get(config.BASE_URL + "/admin")
    time.sleep(1.5)
    path = BasePage(driver).current_path()
    record_property("actual", f"landed on {path}")
    assert not path.startswith("/admin")


def test_admin_can_access_admin_console(driver, record_property):
    _meta(record_property, "Admin can access the admin console",
          "Authenticated admin reaches /admin and sees the console")
    authed_driver(driver, student=False)
    ap = AdminPage(driver).load()
    time.sleep(2)
    path = ap.current_path()
    chars = len(ap.body_text())
    record_property("actual", f"path={path}, body chars={chars}")
    assert path.startswith("/admin") and chars > 100


def test_authed_user_redirected_away_from_login(driver, record_property):
    _meta(record_property, "Logged-in student is bounced away from /login",
          "Guard RedirectIfAuthed sends authed users to their home page")
    authed_driver(driver, student=True)
    driver.get(config.BASE_URL + "/login")
    time.sleep(1.5)
    path = BasePage(driver).current_path()
    record_property("actual", f"landed on {path}")
    assert not path.startswith("/login")
