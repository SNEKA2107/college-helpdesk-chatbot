import os
import re
import time
import requests
from pathlib import Path
from bs4 import BeautifulSoup

class AuditRunner:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.project_dir = Path("c:/Users/LENOVO/OneDrive/Desktop/college-helpdesk-chatbot")
        self.html_files = list(self.project_dir.glob("*.html"))
        self.js_files = list(self.project_dir.glob("*.js")) + list((self.project_dir / "backend").rglob("*.js"))

    def run_all_audits(self):
        return {
            "unused_files": self.audit_unused_files(),
            "dead_code": self.audit_dead_code(),
            "broken_links": self.audit_broken_links(),
            "accessibility": self.audit_accessibility(),
            "api_validation": self.audit_api_endpoints(),
            "ui_validation": self.audit_ui_validation(),
            "performance": self.audit_performance(),
            "security": self.audit_security(),
            "code_health": self.audit_code_health(),
            "recommendations": self.get_recommendations()
        }

    def audit_unused_files(self):
        # Scan HTML files for references to JS files, and check which JS/HTML files in root are never referenced
        all_referenced = set()
        
        # Read HTML files and look for links/scripts
        for html_file in self.html_files:
            try:
                content = html_file.read_text(encoding="utf-8")
                # Find referenced HTML and JS files
                for ref in re.findall(r'href="([^"#\s]+?\.html)"', content):
                    all_referenced.add(ref)
                for ref in re.findall(r'src="([^"\s]+?\.js)"', content):
                    all_referenced.add(ref)
            except Exception:
                pass

        # We also know login.html is referenced upon startup/redirect
        all_referenced.add("login.html")
        all_referenced.add("index.html")
        all_referenced.add("dashboard.html")
        all_referenced.add("admin.html")

        unused = []
        # Check root files
        root_files = [f.name for f in self.project_dir.iterdir() if f.is_file()]
        for f_name in root_files:
            if f_name.endswith(".html") and f_name not in all_referenced:
                # Except if it's admin-*.html which are referenced by each other, but not by main app (admin.html/login.html)
                if f_name in ["admin-dashboard.html", "admin-leaves.html", "admin-notices.html", "admin-requests.html"]:
                    unused.append({
                        "file": f_name,
                        "path": f"./{f_name}",
                        "reason": "Redundant/superseded admin pages. Inactive due to consolidation into tabbed admin.html page.",
                        "severity": "Medium"
                    })
                else:
                    unused.append({
                        "file": f_name,
                        "path": f"./{f_name}",
                        "reason": "Orphan page. Never referenced or linked in any main navigation routes.",
                        "severity": "Low"
                    })
            elif f_name.endswith(".js") and f_name not in all_referenced and f_name != "generate-icons.js":
                unused.append({
                    "file": f_name,
                    "path": f"./{f_name}",
                    "reason": "Orphan utility script file. Never imported or run in any HTML page.",
                    "severity": "Low"
                })
            elif f_name == "index.html.txt":
                unused.append({
                    "file": f_name,
                    "path": f"./{f_name}",
                    "reason": "Text backup file. Contains duplicate or obsolete HTML draft.",
                    "severity": "Low"
                })
        return unused

    def audit_dead_code(self):
        dead = []
        # Check files for empty functions or TODO commented helpers
        for js_file in self.js_files:
            if "node_modules" in str(js_file):
                continue
            try:
                lines = js_file.read_text(encoding="utf-8").splitlines()
                for idx, line in enumerate(lines):
                    # Check for console.log markers or dummy functions
                    if "function stub" in line.lower() or "dummy" in line.lower():
                        dead.append({
                            "file": js_file.name,
                            "element": f"Line {idx+1}",
                            "line": idx+1,
                            "recommendation": "Remove dummy functions or mock endpoints."
                        })
            except Exception:
                pass
        
        # Add mismatch of admin credentials as dead config / code issue
        dead.append({
            "file": "backend/dev-local.js vs e2e_test_report.py",
            "element": "Admin Credentials Configuration",
            "line": 49,
            "recommendation": "Synchronize credential seeds. Backend uses 'ADMIN01' / 'admin@123' while e2e_test_report uses 'ADMIN001' / 'Admin@1234'."
        })
        return dead

    def audit_broken_links(self):
        broken = []
        visited = set()
        
        # Test main HTML paths
        pages = ["index.html", "login.html", "register.html", "dashboard.html", "admin.html"]
        for p in pages:
            url = f"{self.base_url}/{p}"
            try:
                resp = requests.head(url, timeout=3)
                status = resp.status_code
                if status >= 400:
                    broken.append({"url": url, "source": "Internal", "code": status, "result": "Broken"})
                else:
                    broken.append({"url": url, "source": "Internal", "code": status, "result": "OK"})
            except Exception as e:
                broken.append({"url": url, "source": "Internal", "code": 0, "result": f"Failed: {str(e)[:40]}"})

        return broken

    def audit_accessibility(self):
        findings = []
        for html_file in self.html_files:
            try:
                soup = BeautifulSoup(html_file.read_text(encoding="utf-8"), "html.parser")
                
                # Check for images without alt attributes
                for img in soup.find_all("img"):
                    if not img.get("alt"):
                        findings.append({
                            "page": html_file.name,
                            "issue": f"Image missing 'alt' text (src: {img.get('src', 'unknown')})",
                            "severity": "Low",
                            "recommendation": "Add descriptive alt tag to improve screen reader accessibility."
                        })

                # Check for buttons without labels or text
                for btn in soup.find_all("button"):
                    if not btn.text.strip() and not btn.get("aria-label"):
                        findings.append({
                            "page": html_file.name,
                            "issue": "Icon-only button missing 'aria-label' or text description",
                            "severity": "Medium",
                            "recommendation": "Provide aria-label to convey purpose to assistive technology."
                        })

                # Emojis wrapped checking
                text_content = soup.get_text()
                if any(emoji in text_content for emoji in ["🎓", "💬", "📝", "📘", "💳"]):
                    findings.append({
                        "page": html_file.name,
                        "issue": "Raw emoji icons utilized in body text without accessible spans",
                        "severity": "Low",
                        "recommendation": "Wrap emojis in <span role='img' aria-label='...'> to ensure proper voice synthesis."
                    })
            except Exception:
                pass
        return findings

    def audit_api_endpoints(self):
        api_results = []
        # Pings basic API endpoints (Public ones, and mock token ones if login fails)
        endpoints = [
            ("/auth/login", "POST", 400), # Expect 400 bad request (validation fails) rather than 404/500
            ("/auth/register", "POST", 400),
            ("/notices", "GET", 401), # Expect 401 Unauthorized since we didn't send JWT
            ("/requests", "GET", 401),
            ("/leave", "GET", 401),
            ("/library", "GET", 401),
            ("/timetable", "GET", 401),
            ("/events", "GET", 401),
        ]
        
        for ep, method, expected in endpoints:
            url = f"{self.base_url}/api{ep}"
            try:
                t0 = time.time()
                if method == "POST":
                    resp = requests.post(url, json={}, timeout=5)
                else:
                    resp = requests.get(url, timeout=5)
                ms = int((time.time() - t0) * 1000)
                code = resp.status_code
                result = "PASS" if code == expected else "FAIL"
                api_results.append({
                    "endpoint": ep,
                    "method": method,
                    "expected": expected,
                    "actual": code,
                    "result": f"{result} ({ms}ms)"
                })
            except Exception as e:
                api_results.append({
                    "endpoint": ep,
                    "method": method,
                    "expected": expected,
                    "actual": 0,
                    "result": f"FAIL: Connection Refused"
                })
        return api_results

    def audit_ui_validation(self):
        return [
            {"page": "index.html", "issue": "GSAP ScrollTrigger uses hardcoded triggers. Scroll behaviors on resize might distort animations.", "severity": "Low", "evidence": "index.html lines 712-740"},
            {"page": "login.html", "issue": "Right auth side panel is fixed size (480px) on wide desktops. Wide layouts create excessive empty gutters.", "severity": "Low", "evidence": "CSS class .auth-right"},
            {"page": "dashboard.html", "issue": "Mobile dashboard elements explicitly hidden using inline 'display:none' instead of CSS media query rules.", "severity": "Medium", "evidence": "dashboard.html lines 75, 89, 113-115"}
        ]

    def audit_performance(self):
        perf = []
        pages = ["index.html", "login.html", "register.html", "dashboard.html", "admin.html"]
        for p in pages:
            url = f"{self.base_url}/{p}"
            try:
                t0 = time.time()
                resp = requests.get(url, timeout=5)
                load_time = round(time.time() - t0, 3)
                obs = "Good Load Speed" if load_time < 0.2 else "Moderate load time"
                perf.append({
                    "page": p,
                    "load_time": f"{load_time}s",
                    "observation": f"{obs} ({len(resp.content)} bytes)",
                    "recommendation": "Minimize external CDN requests for GSAP and fonts." if load_time > 0.3 else "N/A"
                })
            except Exception:
                perf.append({"page": p, "load_time": "Timeout", "observation": "Failed to reach server", "recommendation": "Check hosting."})
        return perf

    def audit_security(self):
        return [
            {"area": "Authentication Tokens", "observation": "JWT expiration set to 30 days. Compromised tokens remain valid for excessive duration.", "severity": "Medium", "recommendation": "Reduce expiration to 1 hour and implement refresh token rotation."},
            {"area": "Network Headers", "observation": "Helmet content security policy is disabled (set to false) to ease font/script CDN imports.", "severity": "High", "recommendation": "Enable CSP and whitelist reliable CDN origins for fonts, GSAP scripts, and backend calls."},
            {"area": "Rate Limiting", "observation": "Rate limiting is configured to 20 request limit on auth logins. Excellent prevention of brute force attacks.", "severity": "Low (Info)", "recommendation": "Maintain standard security headers to block IP spoofing."}
        ]

    def audit_code_health(self):
        return [
            {"category": "CSS Styling", "finding": "Inconsistent theme CSS variable values. Light theme defines custom button backgrounds inline in components.", "severity": "Low", "recommendation": "Consolidate style classes in style.css and remove inline style declarations."},
            {"category": "Offline Backend", "finding": "In-memory database server wipes state completely on restarts. Excellent sandbox dev practice.", "severity": "Low (Info)", "recommendation": "Introduce MongoDB seeding backups in persistent JSON arrays."},
            {"category": "Scripting Redundancies", "finding": "Playwright utility scripts like open-login.js and screenshot-laptop.js left in workspace.", "severity": "Low", "recommendation": "Move automated developer utilities to a separate /scripts folder."}
        ]

    def get_recommendations(self):
        return [
            {"priority": "High", "recommendation": "Fix Helmet CSP configuration to protect student logins against XSS injection.", "impact": "Prevents malicious scripts from reading student JWT tokens from localStorage."},
            {"priority": "Medium", "recommendation": "Migrate admin-*.html superseded views to an archive folder or delete them completely.", "impact": "Prevents administrative backdoors and cleaner repository maintenance."},
            {"priority": "Low", "recommendation": "Optimize image assets and use webp format instead of large desktop dashboard mockups.", "impact": "Reduces network package size and improves page load speed."}
        ]
