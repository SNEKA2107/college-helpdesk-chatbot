/** Capture React dev-mode console warnings/errors across key pages. */
const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });

  const login = await (await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: '22IT101', password: 'student123' }),
  })).json();
  const admin = await (await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'ADMIN01', password: 'admin@123' }),
  })).json();

  const issues = [];
  async function visit(routes, session) {
    const ctx = await browser.newContext();
    await ctx.addInitScript(([u, t]) => {
      localStorage.setItem('ca_user', JSON.stringify(u));
      localStorage.setItem('ca_token', t);
    }, [session.user, session.token]);
    const page = await ctx.newPage();
    page.on('console', m => {
      if (m.type() === 'warning' || m.type() === 'error') {
        const txt = m.text();
        if (!txt.includes('React DevTools')) issues.push(`[${m.type()}] ${page.url()} :: ${txt.slice(0, 200)}`);
      }
    });
    page.on('pageerror', e => issues.push(`[pageerror] ${page.url()} :: ${e.message}`));
    for (const r of routes) {
      await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1200);
    }
    await ctx.close();
  }

  await visit(['/', '/login', '/dashboard', '/chat', '/requests', '/attendance', '/status', '/exam',
    '/fees', '/timetable', '/cgpa', '/leave', '/od', '/events', '/notices', '/library', '/contact', '/profile'], login);
  await visit(['/admin'], admin);

  await browser.close();
  console.log(issues.length ? `${issues.length} WARNINGS/ERRORS:\n` + issues.join('\n') : 'NO REACT WARNINGS OR ERRORS in dev mode across all 19 routes');
})();
