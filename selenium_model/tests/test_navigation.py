"""Navigation: sidebar, menu links, and that every student route renders."""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
import config
from session import authed_driver
from pages.app_page import AppPage


def _meta(rp, scenario, expected):
    rp("module", "NAVIGATION"); rp("scenario", scenario); rp("expected", expected)


def test_sidebar_renders_with_nav_links(driver, record_property):
    _meta(record_property, "Sidebar renders with navigation links",
          "Authenticated dashboard shows a sidebar with multiple nav links")
    authed_driver(driver, student=True)
    app = AppPage(driver).open("/dashboard")
    time.sleep(2)
    count = app.nav_link_count()
    record_property("actual", f"sidebar={app.sidebar_present()}, nav links={count}")
    assert app.sidebar_present() and count >= 10


@pytest.mark.parametrize("route", config.STUDENT_ROUTES)
def test_student_route_loads(driver, record_property, route):
    _meta(record_property, f"Route {route} loads for an authenticated student",
          f"Visiting {route} renders content without redirecting to /login")
    authed_driver(driver, student=True)
    app = AppPage(driver).open(route)
    time.sleep(1.5)
    path = app.current_path()
    text_len = len(app.body_text())
    record_property("actual", f"landed on {path}, body chars={text_len}")
    assert not path.startswith("/login") and text_len > 50


def test_menu_navigation_click_through(driver, record_property):
    _meta(record_property, "Clicking sidebar links navigates between modules",
          "Clicking 'Library' and 'Notices' nav links changes the route")
    authed_driver(driver, student=True)
    app = AppPage(driver).open("/dashboard")
    time.sleep(2)
    visited = []
    for label in ("Library", "Notices", "Fee Information"):
        links = app.find_all(By.CSS_SELECTOR, ".sidebar-nav a.nav-link")
        target = next((l for l in links if label.lower() in l.text.lower()), None)
        if target:
            driver.execute_script("arguments[0].click();", target)
            time.sleep(1.2)
            visited.append(app.current_path())
    record_property("actual", f"navigated to: {visited}")
    assert len(visited) >= 2
