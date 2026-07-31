"""Helpers to drive the shared browser's auth state quickly.

Tokens are fetched once via the real login API and cached, so injecting a
session into the shared browser for 300 tests costs one extra navigation,
not 300 logins.
"""
import json
import urllib.request

import config

_TOKEN_CACHE = {}   # (student_id) -> (user_dict, token)


def _token_still_valid(token):
    """Is this cached JWT still accepted by the API?

    POST /api/auth/logout increments the account's tokenVersion, revoking every
    token issued to it. authed_driver injects the cached token straight into
    localStorage, so once the logout tests run, a stale token here makes the SPA
    treat the browser as signed out and every guarded route bounces to /login.
    """
    req = urllib.request.Request(
        config.API_BASE + "/auth/me",
        headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status == 200
    except Exception:                                        # noqa: BLE001
        return False


def api_login(student_id, password):
    """Return (user_dict, token) by calling the real login endpoint (cached).

    Revalidated before reuse — see _token_still_valid.
    """
    cached = _TOKEN_CACHE.get(student_id)
    if cached is not None:
        if _token_still_valid(cached[1]):
            return cached
        del _TOKEN_CACHE[student_id]
    data = json.dumps({"studentId": student_id, "password": password}).encode()
    req = urllib.request.Request(
        config.API_BASE + "/auth/login", data=data,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        body = json.loads(r.read().decode())
    _TOKEN_CACHE[student_id] = (body["user"], body["token"])
    return _TOKEN_CACHE[student_id]


def _ensure_origin(driver):
    """Make sure the browser is on the app origin so localStorage is writable."""
    if config.BASE_URL not in (driver.current_url or ""):
        driver.get(config.BASE_URL + "/login")


def authed_driver(driver, student=True):
    """Inject a valid (cached) session into the shared browser."""
    sid, pw = ((config.STUDENT_ID, config.STUDENT_PASSWORD) if student
               else (config.ADMIN_ID, config.ADMIN_PASSWORD))
    user, token = api_login(sid, pw)
    _ensure_origin(driver)
    driver.execute_script(
        "localStorage.setItem('ca_user', arguments[0]);"
        "localStorage.setItem('ca_token', arguments[1]);",
        json.dumps(user), token)
    return user, token


def ensure_anonymous(driver):
    """Clear any cached session so guards treat the browser as logged-out."""
    _ensure_origin(driver)
    driver.execute_script("localStorage.removeItem('ca_user');"
                          "localStorage.removeItem('ca_token');")


def goto(driver, route):
    """Navigate to any app route, authenticating appropriately for it."""
    import time
    if route in config.ADMIN_ROUTES:
        authed_driver(driver, student=False)
    elif route in config.STUDENT_ROUTES:
        authed_driver(driver, student=True)
    else:
        ensure_anonymous(driver)
    driver.get(config.BASE_URL + route)
    time.sleep(1.2)

