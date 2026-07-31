"""Thin HTTP client for API-level validation, security probes and link checks.

Uses only the standard library so the suite has no extra runtime dependency
beyond Selenium/pytest/pandas.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

import config


class Response:
    __slots__ = ("status", "body", "headers", "elapsed_ms", "error")

    def __init__(self, status, body, headers, elapsed_ms, error=None):
        self.status = status
        self.body = body
        self.headers = headers
        self.elapsed_ms = elapsed_ms
        self.error = error

    def json(self):
        try:
            return json.loads(self.body)
        except (ValueError, TypeError):
            return {}

    def __repr__(self):
        return f"<Response {self.status} {self.elapsed_ms}ms>"


def request(url: str, method: str = "GET", token: str | None = None,
            payload: dict | None = None, timeout: int = 25) -> Response:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method=method.upper())
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")

    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read().decode("utf-8", "ignore")
            return Response(r.status, body, dict(r.headers),
                            int((time.time() - started) * 1000))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")
        return Response(e.code, body, dict(e.headers),
                        int((time.time() - started) * 1000))
    except Exception as e:                                  # noqa: BLE001
        return Response(0, "", {}, int((time.time() - started) * 1000), error=str(e))


def api(path: str, method: str = "GET", token: str | None = None,
        payload: dict | None = None) -> Response:
    return request(config.API_BASE + path, method, token, payload)


_token_cache: dict[str, str] = {}


def login_token(role: str) -> str | None:
    """Authenticate a seeded role and cache its JWT.

    The cache is revalidated before reuse. POST /api/auth/logout increments the
    account's tokenVersion, which revokes every token ever issued to it, so the
    moment any test logs a role out the JWT cached here goes dead and every
    later call returns 401 "Session has expired". Caching it for the whole run
    without checking made ~190 tests fail downstream of the logout tests. A real
    client re-authenticates when its session is revoked; so does this one.
    """
    cached = _token_cache.get(role)
    if cached is not None:
        if api("/auth/me", token=cached).status == 200:
            return cached
        del _token_cache[role]
    if role not in config.ROLES:
        return None
    identifier, password, _ = config.ROLES[role]
    res = api("/auth/login", "POST", payload={"identifier": identifier, "password": password})
    token = res.json().get("token")
    if token:
        _token_cache[role] = token
    return token


def backend_up() -> bool:
    return request(config.BASE_URL + "/api/auth/setup-status").status == 200
