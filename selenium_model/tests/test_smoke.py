"""
Smoke test: verify every student-facing HTML page loads and shows its heading.
Uses direct API login + localStorage token injection to avoid UI rate-limit exhaustion.
"""
import pytest
import time
import json
import requests as http_requests
from selenium.webdriver.common.by import By
from selenium_model.pages.login_page import LoginPage
from selenium_model.pages.dashboard_page import DashboardPage

BASE_URL   = "http://localhost:5000"
STUDENT_ID = "22IT101"
STUDENT_PW = "student123"

# (page_file, keyword_in_body) — keywords match the h1.page-title text
STUDENT_PAGES = [
    ("dashboard.html", "Dashboard"),
    ("chat.html",      "Chat"),
    ("requests.html",  "Requests"),
    ("leave.html",     "Leave"),
    ("od.html",        "OD"),
    ("fees.html",      "Fee"),
    ("timetable.html", "Timetable"),
    ("exam.html",      "Exam"),
    ("cgpa.html",      "CGPA"),
    ("notices.html",   "Notice"),
    ("library.html",   "Library"),
    ("events.html",    "Event"),
    ("contact.html",   "Contact"),
    ("profile.html",   "Profile"),
    ("status.html",    "Marksheet"),
]


def _get_student_token():
    """Login via API directly (bypasses browser rate-limit path) and return JWT."""
    try:
        resp = http_requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"studentId": STUDENT_ID, "password": STUDENT_PW},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("token"), data.get("user")
    except Exception:
        pass
    return None, None


def _inject_token_and_visit(driver, token, user_data, page):
    """Inject JWT into localStorage, then navigate to page (no login UI hit)."""
    # Navigate to any page on the origin first (to set localStorage on the right origin)
    driver.get(f"{BASE_URL}/login.html")
    time.sleep(0.5)
    user_json = json.dumps(user_data).replace("'", "\\'")
    driver.execute_script(
        f"localStorage.setItem('ca_token', '{token}');"
        f"localStorage.setItem('ca_user', JSON.stringify({json.dumps(user_data)}));"
    )
    driver.get(f"{BASE_URL}/{page}")
    time.sleep(1.5)


@pytest.mark.parametrize("page,heading_keyword", STUDENT_PAGES)
def test_smoke_page_loads(driver, page, heading_keyword):
    """Every protected page must load authenticated and show its heading."""
    token, user_data = _get_student_token()

    if token is None:
        # Fallback: use UI login (may fail if rate-limited)
        lp = LoginPage(driver)
        lp.navigate()
        lp.login(STUDENT_ID, STUDENT_PW)
        lp.wait_for_login_success()
        driver.get(f"{BASE_URL}/{page}")
        time.sleep(1.5)
    else:
        _inject_token_and_visit(driver, token, user_data, page)

    assert "login.html" not in driver.current_url, (
        f"{page} redirected to login — token invalid or server down"
    )

    body_text = driver.find_element(By.TAG_NAME, "body").text
    assert heading_keyword.lower() in body_text.lower(), (
        f"{page}: expected '{heading_keyword}' in body. Got (first 300): {body_text[:300]}"
    )

    try:
        DashboardPage(driver).logout_via_sidebar()
    except Exception:
        pass


def test_smoke_login_page(driver):
    lp = LoginPage(driver)
    lp.navigate()
    body = driver.find_element(By.TAG_NAME, "body").text
    assert "CampusAssist" in body or "Login" in body or "Student" in body


def test_smoke_unauthenticated_redirect(driver):
    """Protected page with no token must redirect to login."""
    driver.get(f"{BASE_URL}/login.html")
    time.sleep(0.3)
    driver.execute_script("localStorage.clear();")
    driver.get(f"{BASE_URL}/dashboard.html")
    time.sleep(2.0)
    assert "login.html" in driver.current_url, (
        "Expected redirect to login for unauthenticated user"
    )
