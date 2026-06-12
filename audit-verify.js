/** Migration audit: route refresh, legacy redirects, responsive, functional checks. */
const { chromium } = require('playwright');

const BASE = 'http://localhost:5000'; // backend-served production build

const STUDENT_ROUTES = ['/dashboard','/chat','/requests','/attendance','/status','/exam','/fees',
  '/timetable','/cgpa','/leave','/od','/events','/notices','/library','/contact','/profile'];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const fails = [];
  const ok = (label, cond, extra = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  (' + extra + ')' : ''}`);
    if (!cond) fails.push(label);
  };

  // Login via API to get real session
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: '22IT101', password: 'student123' }),
  });
  const login = await loginRes.json();
  ok('API login', loginRes.ok && !!login.token);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(([u, t]) => {
    localStorage.setItem('ca_user', JSON.stringify(u));
    localStorage.setItem('ca_token', t);
  }, [login.user, login.token]);
  const page = await ctx.newPage();
  let consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) consoleErrors.push(`[http ${r.status()}] ${r.url()}`); });

  // 1. Direct load (refresh) on every student route via backend
  for (const route of STUDENT_ROUTES) {
    consoleErrors = [];
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(600);
    const hasContent = await page.locator('.main-content').count() > 0;
    ok(`refresh ${route}`, res.status() === 200 && hasContent && consoleErrors.length === 0,
       consoleErrors.slice(0, 2).join(' | '));
  }

  // 2. Legacy .html redirects
  for (const [legacy, target] of [['/dashboard.html','/dashboard'],['/cgpa.html','/cgpa'],
      ['/admin-requests.html','/admin'],['/index.html','/'],['/nonexistent-page','/']]) {
    await page.goto(BASE + legacy, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const path = new URL(page.url()).pathname;
    // /admin redirects to /dashboard for student session
    const expected = legacy === '/admin-requests.html' ? '/dashboard' : target;
    ok(`legacy ${legacy} -> ${expected}`, path === expected, `got ${path}`);
  }

  // 3. Functional: submit a request
  consoleErrors = [];
  await page.goto(BASE + '/requests', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const before = await page.locator('.req-card').count();
  await page.click('text=+ New Request');
  await page.waitForTimeout(400);
  await page.selectOption('select >> visible=true', { index: 1 });
  await page.fill('textarea', 'Audit verification request');
  await page.click('button:has-text("Submit Request")');
  await page.waitForTimeout(1500);
  const after = await page.locator('.req-card').count();
  ok('submit request adds card', after === before + 1, `before=${before} after=${after} errs=${consoleErrors.join('|')}`);

  // 4. Functional: chatbot replies
  await page.goto(BASE + '/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const msgSel = '.message, .msg, .chat-msg, [class*="bubble"]';
  const beforeMsgs = await page.locator(msgSel).count();
  await page.fill('input[type="text"], textarea', 'library timings');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  const afterMsgs = await page.locator(msgSel).count();
  ok('chatbot replies', afterMsgs >= beforeMsgs + 2, `before=${beforeMsgs} after=${afterMsgs}`);

  // 5. Responsive: mobile + tablet, no horizontal scroll
  for (const [w, h, name] of [[375, 812, 'mobile'], [768, 1024, 'tablet']]) {
    const mctx = await browser.newContext({ viewport: { width: w, height: h } });
    await mctx.addInitScript(([u, t]) => {
      localStorage.setItem('ca_user', JSON.stringify(u));
      localStorage.setItem('ca_token', t);
    }, [login.user, login.token]);
    const mp = await mctx.newPage();
    for (const route of ['/', '/dashboard', '/requests', '/profile']) {
      await mp.goto(BASE + route, { waitUntil: 'networkidle' });
      await mp.waitForTimeout(800);
      const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(`${name} ${route} no h-scroll`, overflow <= 1, `overflow=${overflow}px`);
    }
    if (name === 'mobile') {
      await mp.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
      await mp.waitForTimeout(600);
      const bottomNavVisible = await mp.locator('.bottom-nav').isVisible().catch(() => false);
      ok('mobile bottom nav visible', bottomNavVisible);
    }
    await mctx.close();
  }

  // 6. Admin direct refresh with admin session
  const aRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'ADMIN01', password: 'admin@123' }),
  });
  const aLogin = await aRes.json();
  const actx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await actx.addInitScript(([u, t]) => {
    localStorage.setItem('ca_user', JSON.stringify(u));
    localStorage.setItem('ca_token', t);
  }, [aLogin.user, aLogin.token]);
  const ap = await actx.newPage();
  let adminErrs = [];
  ap.on('pageerror', e => adminErrs.push(e.message));
  ap.on('console', m => { if (m.type() === 'error') adminErrs.push(m.text()); });
  await ap.goto(BASE + '/admin', { waitUntil: 'networkidle' });
  await ap.waitForTimeout(1500);
  const statCards = await ap.locator('.stat-card, .card').count();
  ok('admin refresh loads', statCards > 0 && adminErrs.length === 0, adminErrs.slice(0,2).join('|'));

  // 7. Guard: unauthenticated user hitting /dashboard goes to /login
  const gctx = await browser.newContext();
  const gp = await gctx.newPage();
  await gp.goto(BASE + '/dashboard', { waitUntil: 'networkidle' });
  await gp.waitForTimeout(400);
  ok('guard redirects anon to /login', new URL(gp.url()).pathname === '/login', gp.url());

  await browser.close();
  console.log(fails.length ? `\n${fails.length} FAILURES:\n- ${fails.join('\n- ')}` : '\nALL CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})();
