"""Tiny HTTP client used by the no-browser test matrix (route/API/security)."""
import json
import urllib.request
import urllib.error

import config


def request(path, method="GET", token=None, body=None, base=None):
    """Return (status, headers_dict, text). Never raises on HTTP errors."""
    url = (base or config.BASE_URL) + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, dict(r.headers), r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "ignore")
    except Exception as e:
        return 0, {}, str(e)


def status(path, method="GET", token=None, body=None):
    return request(path, method=method, token=token, body=body)[0]
