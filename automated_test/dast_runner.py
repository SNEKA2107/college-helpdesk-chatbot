#!/usr/bin/env python3
"""
CampusAssist DAST Runner
Reads input.json for baseUrl + tokens, runs all test categories,
writes results to report.json.
"""
import json, time, sys, os, re, base64, hashlib, hmac, io
from pathlib import Path
import requests
requests.packages.urllib3.disable_warnings()
# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ── Load config ──────────────────────────────────────────────────────────────
INPUT  = Path(__file__).parent.parent / "input.json"
REPORT = Path(__file__).parent / "report.json"
SAVE   = Path(__file__).parent / "savepoint.json"

if not INPUT.exists():
    print("❌  input.json not found. Copy input.json.template → input.json and fill in your tokens.")
    sys.exit(1)

cfg = json.loads(INPUT.read_text())
BASE = cfg["baseUrl"].rstrip("/")
STUDENT_TOKEN = cfg.get("student", "")
ADMIN_TOKEN   = cfg.get("admin", "")

if not STUDENT_TOKEN or not ADMIN_TOKEN:
    print("❌  input.json is missing 'student' or 'admin' token.")
    sys.exit(1)

print(f"✅  Loaded config — targeting: {BASE}")
print(f"✅  Student token: ...{STUDENT_TOKEN[-8:]}")
print(f"✅  Admin   token: ...{ADMIN_TOKEN[-8:]}")

HEADERS_NONE    = {"Content-Type": "application/json"}
HEADERS_STUDENT = {"Content-Type": "application/json", "Authorization": f"Bearer {STUDENT_TOKEN}"}
HEADERS_ADMIN   = {"Content-Type": "application/json", "Authorization": f"Bearer {ADMIN_TOKEN}"}

results = []

def record(endpoint, method, role, status, expected, finding, severity, rt, category, note=""):
    results.append({
        "endpoint":          endpoint,
        "method":            method,
        "role":              role,
        "status":            status,
        "expected_status":   expected,
        "finding":           finding,
        "severity":          severity,
        "response_time_ms":  round(rt * 1000),
        "test_category":     category,
        "note":              note,
        "timestamp":         time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    mark = "✗ FINDING" if finding else "✓"
    sev  = f"[{severity}]" if finding else ""
    print(f"  {mark} {sev:10s} {method:7s} {endpoint:50s} → {status}  (role={role})")

def req(method, path, headers, body=None, timeout=10):
    url = BASE + path
    t0  = time.time()
    try:
        r = requests.request(
            method, url,
            headers=headers,
            json=body,
            timeout=timeout,
            verify=False,
            allow_redirects=False,
        )
        return r.status_code, time.time() - t0, r.text[:500]
    except requests.exceptions.ConnectionError:
        return 0, time.time() - t0, "CONNECTION_ERROR"
    except requests.exceptions.Timeout:
        return 0, time.time() - t0, "TIMEOUT"

def delay():
    time.sleep(0.3)

# ── SHARED dummy IDs ─────────────────────────────────────────────────────────
FAKE_ID   = "000000000000000000000001"   # valid mongo ObjectId format, won't exist
FAKE_ID2  = "aaaaaaaaaaaaaaaaaaaaaaaa"

# ════════════════════════════════════════════════════════════════════════════
# CATEGORY 1 — Authentication Bypass
# ════════════════════════════════════════════════════════════════════════════
print("\n══════════════════════════════════════")
print("CATEGORY 1 — AuthN Bypass")
print("══════════════════════════════════════")

PROTECTED_ENDPOINTS = [
    ("GET",  "/api/auth/me"),
    ("PUT",  "/api/auth/change-password"),
    ("PUT",  "/api/auth/profile"),
    ("GET",  "/api/requests/stats"),
    ("GET",  "/api/requests"),
    ("GET",  "/api/leave"),
    ("GET",  "/api/notices"),
    ("POST", "/api/chat"),
    ("GET",  "/api/exam"),
    ("GET",  "/api/exam/schedule"),
    ("GET",  "/api/exam/practicals"),
    ("GET",  "/api/fees"),
    ("GET",  "/api/library"),
    ("GET",  "/api/library/borrowed"),
    ("GET",  "/api/library/hours"),
    ("GET",  "/api/timetable"),
    ("GET",  "/api/timetable/today"),
    ("GET",  "/api/attendance/summary"),
    ("GET",  "/api/attendance"),
    ("GET",  "/api/events"),
    ("GET",  "/api/students/search/test"),
    ("GET",  f"/api/students/{FAKE_ID}"),
]

for method, path in PROTECTED_ENDPOINTS:
    # 1a — No token at all
    sc, rt, body = req(method, path, HEADERS_NONE); delay()
    finding = (sc == 200 or sc == 201)
    sev = "CRITICAL" if finding else "INFO"
    record(path, method, "none", sc, 401, finding, sev, rt, "authn-bypass", "no token")

    # 1b — Malformed token (garbage string)
    bad_headers = {"Content-Type":"application/json","Authorization":"Bearer not.a.valid.jwt"}
    sc, rt, body = req(method, path, bad_headers); delay()
    finding = (sc == 200 or sc == 201)
    sev = "CRITICAL" if finding else "INFO"
    record(path, method, "malformed", sc, 401, finding, sev, rt, "authn-bypass", "malformed token")

    # 1c — Expired token (a previously valid JWT-shaped token with obviously wrong sig)
    # We craft a token that looks valid but has an altered signature
    expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMSIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ.INVALIDSIGNATUREXXXXXXXXXXXX"
    exp_headers = {"Content-Type":"application/json","Authorization":f"Bearer {expired_token}"}
    sc, rt, body = req(method, path, exp_headers); delay()
    finding = (sc == 200 or sc == 201)
    sev = "CRITICAL" if finding else "INFO"
    record(path, method, "expired", sc, 401, finding, sev, rt, "authn-bypass", "expired/invalid token")

# ════════════════════════════════════════════════════════════════════════════
# CATEGORY 2 — AuthZ / Privilege Escalation (student calling admin endpoints)
# ════════════════════════════════════════════════════════════════════════════
print("\n══════════════════════════════════════")
print("CATEGORY 2 — AuthZ / Privilege Escalation")
print("══════════════════════════════════════")

ADMIN_ONLY_ENDPOINTS = [
    ("GET",    "/api/students",              None),
    ("GET",    "/api/fees/all",              None),
    ("GET",    "/api/contact",               None),
    ("POST",   "/api/notices",               {"title":"DAST-test","content":"probe"}),
    ("PUT",    f"/api/notices/{FAKE_ID}",    {"title":"probe"}),
    ("DELETE", f"/api/notices/{FAKE_ID}",    None),
    ("PUT",    f"/api/requests/{FAKE_ID}/status", {"status":"Completed"}),
    ("PUT",    f"/api/leave/{FAKE_ID}/status",    {"status":"Approved"}),
    ("PUT",    f"/api/contact/{FAKE_ID}/resolve", None),
    ("POST",   "/api/exam",                  {"semester":"5"}),
    ("PUT",    f"/api/exam/{FAKE_ID}",       {"semester":"5"}),
    ("POST",   "/api/library",               {"title":"probe","author":"probe","isbn":"0000000000","category":"IT","status":"Available"}),
    ("PUT",    f"/api/library/{FAKE_ID}",    {"title":"probe"}),
    ("POST",   "/api/timetable",             {"department":"IT","semester":"5th","slots":[],"schedule":{}}),
    ("PUT",    f"/api/timetable/{FAKE_ID}",  {"department":"IT"}),
    ("POST",   "/api/attendance",            {"studentId":"TEST001","subject":"OS","date":"2025-01-01"}),
    ("POST",   "/api/attendance/bulk",       {"records":[]}),
    ("POST",   "/api/events",                {"title":"probe","date":"2025-01-01","seats":10,"organizer":"probe","venue":"probe","category":"Technical"}),
    ("PUT",    f"/api/events/{FAKE_ID}",     {"title":"probe"}),
    ("DELETE", f"/api/events/{FAKE_ID}",     None),
]

for method, path, body in ADMIN_ONLY_ENDPOINTS:
    sc, rt, _ = req(method, path, HEADERS_STUDENT, body); delay()
    finding = sc in (200, 201)
    sev = "HIGH" if finding else "INFO"
    record(path, method, "student", sc, 403, finding, sev, rt, "authz-privesc",
           "student calling admin-only endpoint")

# ════════════════════════════════════════════════════════════════════════════
# CATEGORY 3 — IDOR
# ════════════════════════════════════════════════════════════════════════════
print("\n══════════════════════════════════════")
print("CATEGORY 3 — IDOR")
print("══════════════════════════════════════")

# 3a — GET /api/students/:id — any student can fetch any other user's full record
sc, rt, body = req("GET", f"/api/students/6a1de0dcd18131d6837c8e88", HEADERS_STUDENT); delay()
# Even 404 is notable because the route returns full profile without ownership check
# A 200 would mean genuine IDOR; 404 just means no document but the route still allows the attempt
note = "no ownership check — route allows any-auth access to any student profile (IDOR design)"
finding = sc != 403   # 403 would mean properly blocked; anything else (200,404,500) is a concern
sev = "MEDIUM" if finding else "INFO"
record("/api/students/:id", "GET", "student", sc, 403, finding, sev, rt, "idor", note)

# 3b — PUT /api/students/:id (another user's id)
# Using FAKE_ID2 so we're clearly targeting a different user
sc, rt, _ = req("PUT", f"/api/students/{FAKE_ID2}", HEADERS_STUDENT, {"name":"IDORtest"}); delay()
finding = sc in (200, 201)
sev = "HIGH" if finding else "INFO"
record("/api/students/:id", "PUT", "student", sc, 403, finding, sev, rt, "idor",
       "student trying to update another user's profile")

# 3c — DELETE /api/requests/:id (another user's request)
sc, rt, _ = req("DELETE", f"/api/requests/{FAKE_ID}", HEADERS_STUDENT); delay()
finding = sc in (200, 204)
sev = "HIGH" if finding else "INFO"
record(f"/api/requests/{FAKE_ID}", "DELETE", "student", sc, 403, finding, sev, rt, "idor",
       "student trying to delete another user's request")

# 3d — DELETE /api/leave/:id (another user's leave)
sc, rt, _ = req("DELETE", f"/api/leave/{FAKE_ID}", HEADERS_STUDENT); delay()
finding = sc in (200, 204)
sev = "HIGH" if finding else "INFO"
record(f"/api/leave/{FAKE_ID}", "DELETE", "student", sc, 403, finding, sev, rt, "idor",
       "student trying to delete another user's leave")

# 3e — GET /api/students/search/:query — data exposure (all students visible to any auth user)
sc, rt, body = req("GET", "/api/students/search/a", HEADERS_STUDENT); delay()
# This is by design but worth flagging — any student can enumerate all other students
finding = sc == 200  # If 200, any student sees all other students' data
sev = "MEDIUM" if finding else "INFO"
record("/api/students/search/:query", "GET", "student", sc, 200, finding, sev, rt, "idor",
       "any auth student can search/enumerate all other student profiles — data exposure")

# ════════════════════════════════════════════════════════════════════════════
# CATEGORY 4 — RBAC Matrix
# ════════════════════════════════════════════════════════════════════════════
print("\n══════════════════════════════════════")
print("CATEGORY 4 — RBAC Matrix")
print("══════════════════════════════════════")

# Public endpoints called with no token (should succeed for login/register)
PUBLIC = [
    ("POST", "/api/auth/login",    {"studentId":"NOTEXIST","password":"wrongpass"}),
    ("POST", "/api/auth/register", {"name":"x","studentId":"DAST999","email":"dast@test.com","password":"dastpass1","department":"IT"}),
]
for method, path, body in PUBLIC:
    sc, rt, _ = req(method, path, HEADERS_NONE, body); delay()
    # For login with wrong creds we expect 400/401; register might succeed (200/201) or conflict (409)
    finding = sc == 403  # public endpoint returning 403 would be wrong
    sev = "MEDIUM" if finding else "INFO"
    record(path, method, "none", sc, "2xx/4xx", finding, sev, rt, "rbac-matrix",
           "public endpoint — no token required")

# Admin token on student endpoints (admin should be able to do everything student can)
STUDENT_ENDPOINTS = [
    ("GET",  "/api/auth/me",           None),
    ("GET",  "/api/requests/stats",    None),
    ("GET",  "/api/requests",          None),
    ("GET",  "/api/leave",             None),
    ("GET",  "/api/notices",           None),
    ("GET",  "/api/exam",              None),
    ("GET",  "/api/fees",              None),
    ("GET",  "/api/library",           None),
    ("GET",  "/api/timetable",         None),
    ("GET",  "/api/attendance/summary",None),
    ("GET",  "/api/events",            None),
]
for method, path, body in STUDENT_ENDPOINTS:
    sc, rt, _ = req(method, path, HEADERS_ADMIN, body); delay()
    finding = sc == 403  # admin should NOT be blocked from student endpoints
    sev = "LOW" if finding else "INFO"
    record(path, method, "admin", sc, 200, finding, sev, rt, "rbac-matrix",
           "admin calling student endpoint — should always succeed")

# ════════════════════════════════════════════════════════════════════════════
# CATEGORY 5 — JWT Token Tampering
# ════════════════════════════════════════════════════════════════════════════
print("\n══════════════════════════════════════")
print("CATEGORY 5 — JWT Token Tampering")
print("══════════════════════════════════════")

def decode_b64(s):
    s += "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)

def encode_b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()

def tamper_jwt_role(token, new_role):
    """Flip the role claim in the payload without re-signing."""
    parts = token.split(".")
    if len(parts) != 3:
        return token
    try:
        payload = json.loads(decode_b64(parts[1]))
        payload["role"] = new_role
        new_payload = encode_b64(json.dumps(payload, separators=(",",":")).encode())
        return f"{parts[0]}.{new_payload}.{parts[2]}"
    except Exception:
        return token

def tamper_jwt_alg_none(token):
    """Set algorithm to 'none' and strip the signature."""
    parts = token.split(".")
    if len(parts) != 3:
        return token
    try:
        header = json.loads(decode_b64(parts[0]))
        header["alg"] = "none"
        new_header = encode_b64(json.dumps(header, separators=(",",":")).encode())
        return f"{new_header}.{parts[1]}."
    except Exception:
        return token

# 5a — Student token with role flipped to "admin"
tampered_role = tamper_jwt_role(STUDENT_TOKEN, "admin")
t_headers = {"Content-Type":"application/json","Authorization":f"Bearer {tampered_role}"}
for path, expected_block in [("/api/students", 403), (f"/api/notices/{FAKE_ID}", 403)]:
    sc, rt, _ = req("GET", path, t_headers); delay()
    finding = sc in (200, 201)
    sev = "CRITICAL" if finding else "INFO"
    record(path, "GET", "tampered-role→admin", sc, 403, finding, sev, rt, "token-tampering",
           "student token with role flipped to admin (unsigned)")

# 5b — alg=none bypass
none_token = tamper_jwt_alg_none(STUDENT_TOKEN)
n_headers = {"Content-Type":"application/json","Authorization":f"Bearer {none_token}"}
sc, rt, _ = req("GET", "/api/auth/me", n_headers); delay()
finding = sc in (200, 201)
sev = "CRITICAL" if finding else "INFO"
record("/api/auth/me", "GET", "alg-none", sc, 401, finding, sev, rt, "token-tampering",
       "JWT with alg=none and empty signature")

# 5c — Empty signature (keep header+payload, strip sig)
parts = STUDENT_TOKEN.split(".")
stripped = f"{parts[0]}.{parts[1]}."
s_headers = {"Content-Type":"application/json","Authorization":f"Bearer {stripped}"}
sc, rt, _ = req("GET", "/api/auth/me", s_headers); delay()
finding = sc in (200, 201)
sev = "CRITICAL" if finding else "INFO"
record("/api/auth/me", "GET", "empty-sig", sc, 401, finding, sev, rt, "token-tampering",
       "valid header+payload, empty signature")

# 5d — Static dev JWT secret test (try to sign with known weak secret)
def hs256_sign(data, secret):
    return encode_b64(hmac.new(secret.encode(), data.encode(), hashlib.sha256).digest())

KNOWN_WEAK_SECRETS = ["local-dev-secret-2026", "secret", "campusassist", "jwt_secret", "your_super_secret_jwt_key_change_this_in_production"]
parts = STUDENT_TOKEN.split(".")
try:
    payload = json.loads(decode_b64(parts[1]))
    payload["role"] = "admin"
    header_b64  = parts[0]
    payload_b64 = encode_b64(json.dumps(payload, separators=(",",":")).encode())
    data_to_sign = f"{header_b64}.{payload_b64}"
    for weak_secret in KNOWN_WEAK_SECRETS:
        sig = hs256_sign(data_to_sign, weak_secret)
        forged = f"{data_to_sign}.{sig}"
        f_headers = {"Content-Type":"application/json","Authorization":f"Bearer {forged}"}
        sc, rt, _ = req("GET", "/api/students", f_headers); delay()
        finding = sc in (200, 201)
        sev = "CRITICAL" if finding else "INFO"
        record("/api/students", "GET", f"forged-{weak_secret}", sc, 401, finding, sev, rt,
               "token-tampering", f"admin token forged with weak secret: {weak_secret}")
except Exception as e:
    print(f"  ⚠ JWT forge test skipped: {e}")

# ════════════════════════════════════════════════════════════════════════════
# CATEGORY 6 — Injection Probes (detection only, no data extraction)
# ════════════════════════════════════════════════════════════════════════════
print("\n══════════════════════════════════════")
print("CATEGORY 6 — Injection Probes")
print("══════════════════════════════════════")

# 6a — NoSQL injection in login (operator injection)
NOSQL_PAYLOADS = [
    {"studentId": {"$ne": None},  "password": {"$ne": None}},
    {"studentId": {"$gt": ""},    "password": {"$gt": ""}},
    {"studentId": {"$regex": ".*"}, "password": {"$gt": ""}},
]
for payload in NOSQL_PAYLOADS:
    sc, rt, body = req("POST", "/api/auth/login", HEADERS_NONE, payload); delay()
    finding = sc == 200  # login succeeded without valid creds = injection bypass
    sev = "CRITICAL" if finding else "INFO"
    note = f"NoSQLi operator injection in login: {list(payload['studentId'].keys())}"
    record("/api/auth/login", "POST", "none", sc, 400, finding, sev, rt, "injection", note)

# 6b — NoSQL injection via query string (search)
REGEX_PAYLOADS = [
    "/api/library?search=(?:a%2B){50}",          # ReDoS probe
    "/api/library?search=.*",                     # wildcard regex
    "/api/students?search=[$where]=1==1",         # MongoDB operator injection via QS
    "/api/students/search/[$ne]",                 # operator in path segment
]
for path in REGEX_PAYLOADS:
    sc, rt, body = req("GET", path, HEADERS_STUDENT); delay()
    # 500 = server error (potential injection); anomalous timing = ReDos
    finding = sc == 500 or rt > 5
    sev = "MEDIUM" if sc == 500 else ("HIGH" if rt > 5 else "INFO")
    note = f"ReDoS/NoSQLi probe — status={sc}, time={rt*1000:.0f}ms"
    record(path.split("?")[0], "GET", "student", sc, 200, finding, sev, rt, "injection", note)

# 6c — SQL/Command injection chars in body fields (detecting 500 errors)
INJ_BODIES = [
    ("/api/contact", "POST", {"department":"IT","subject":"';DROP TABLE;--","message":"probe"}),
    ("/api/leave",   "POST", {"leaveType":"Medical Leave","fromDate":"2025-01-01","toDate":"2025-01-02",
                               "reason":"x' OR '1'='1"}),
    ("/api/requests","POST", {"type":"Bonafide Certificate","purpose":"'; exec xp_cmdshell('id');--"}),
]
for path, method, body in INJ_BODIES:
    sc, rt, resp = req(method, path, HEADERS_STUDENT, body); delay()
    finding = sc == 500 or "stack" in resp.lower() or "syntax error" in resp.lower()
    sev = "MEDIUM" if finding else "INFO"
    note = "SQL/command injection chars in body — looking for 500/stack-traces"
    record(path, method, "student", sc, 201, finding, sev, rt, "injection", note)

# 6d — XSS payloads stored (check if reflected back verbatim)
xss_payload = "<script>alert(1)</script>"
sc, rt, resp = req("POST", "/api/notices", HEADERS_ADMIN,
                   {"title": xss_payload, "content": "probe"}); delay()
# If created, check if XSS payload was stored/reflected raw
if sc == 201:
    try:
        notice_id = json.loads(resp)["notice"]["_id"]
        sc2, rt2, resp2 = req("GET", "/api/notices", HEADERS_STUDENT); delay()
        finding = xss_payload in resp2
        sev = "MEDIUM" if finding else "INFO"
        record("/api/notices (stored-XSS)", "POST→GET", "admin", sc, 201, finding, sev, rt, "injection",
               "XSS payload stored without sanitization — backend stores verbatim")
        # Clean up: delete the test notice
        req("DELETE", f"/api/notices/{notice_id}", HEADERS_ADMIN); delay()
    except Exception:
        pass

# ════════════════════════════════════════════════════════════════════════════
# CATEGORY 7 — Rate Limiting
# ════════════════════════════════════════════════════════════════════════════
print("\n══════════════════════════════════════")
print("CATEGORY 7 — Rate Limiting")
print("══════════════════════════════════════")

def burst_test(path, method, headers, body, burst=35, label=""):
    statuses = []
    for i in range(burst):
        sc, rt, _ = req(method, path, headers, body)
        statuses.append(sc)
        time.sleep(0.05)   # 50ms between requests = ~20 req/s
    has_429 = 429 in statuses
    rate_limited_at = next((i+1 for i,s in enumerate(statuses) if s == 429), None)
    finding = not has_429
    sev = "MEDIUM" if finding else "INFO"
    note = f"burst={burst}, got 429 at req#{rate_limited_at}" if has_429 else f"NO 429 in {burst} requests — rate limiting absent"
    record(path, method, label, statuses[-1], 429, finding, sev, 0, "rate-limiting", note)
    print(f"    {'✗ No 429 found' if finding else f'✓ 429 at req #{rate_limited_at}'} — {path}")
    return has_429

# Auth endpoints (should have explicit rate limiting)
burst_test("/api/auth/login",    "POST", HEADERS_NONE,
           {"studentId":"NOSUCHUSER","password":"wrongpass"}, label="none")

# Non-auth endpoint (should still have some protection or return 429 eventually)
burst_test("/api/events",        "GET",  HEADERS_STUDENT, None, label="student")
burst_test("/api/notices",       "GET",  HEADERS_STUDENT, None, label="student")

# ════════════════════════════════════════════════════════════════════════════
# CATEGORY 8 — Hardcoded Creds (static analysis — already run, record results)
# ════════════════════════════════════════════════════════════════════════════
print("\n══════════════════════════════════════")
print("CATEGORY 8 — Hardcoded Credentials (static)")
print("══════════════════════════════════════")

STATIC_FINDINGS = [
    ("backend/.env",             "hardcoded-mongo-uri",     "CRITICAL",  "Real MongoDB Atlas URI with credentials in backend/.env — file NOT in .gitignore exclusion is n/a here but credentials are real and should be rotated if ever exposed"),
    ("backend/create-admin.js",  "hardcoded-password",      "HIGH",      "Admin password 'Admin@1234' hardcoded — utility script"),
    ("backend/reset-admin.js",   "hardcoded-password",      "HIGH",      "Admin password 'Admin1234' hardcoded — utility script"),
    ("backend/dev-local.js",     "hardcoded-password",      "MEDIUM",    "Dev passwords hardcoded: admin@123, student123"),
    ("backend/dev-local.js",     "hardcoded-jwt-secret",    "HIGH",      "JWT secret 'local-dev-secret-2026' hardcoded — if used in prod, any token can be forged"),
    ("backend/seed.js",          "hardcoded-password",      "LOW",       "Seed data passwords hardcoded (admin@123, student123) — seed-only, not production"),
]

for fpath, ctype, sev, note in STATIC_FINDINGS:
    record(fpath, "STATIC", "n/a", "n/a", "n/a", True, sev, 0, "hardcoded-creds", note)
    print(f"  ✗ [{sev:8s}]  {ctype:30s} in {fpath}")

# ════════════════════════════════════════════════════════════════════════════
# WRITE REPORT
# ════════════════════════════════════════════════════════════════════════════
REPORT.write_text(json.dumps(results, indent=2))

findings_only  = [r for r in results if r["finding"]]
by_severity    = {}
for r in findings_only:
    by_severity.setdefault(r["severity"], []).append(r)

print("\n" + "═"*60)
print("SUMMARY")
print("═"*60)
print(f"  Total tests run : {len(results)}")
print(f"  Total findings  : {len(findings_only)}")
for sev in ["CRITICAL","HIGH","MEDIUM","LOW","INFO"]:
    cnt = len(by_severity.get(sev,[]))
    if cnt:
        print(f"    {sev:10s}: {cnt}")

print("\n  TOP FINDINGS:")
for sev in ["CRITICAL","HIGH","MEDIUM"]:
    for r in by_severity.get(sev, []):
        print(f"    ✗ [{r['severity']:8s}] {r['test_category']:20s} {r['method']:7s} {r['endpoint']}")
        print(f"           → {r['note']}")

print(f"\n  Report written to: {REPORT}")
