const { chromium } = require('playwright');

const BASE = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  const errors = [];
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });

  // 1. Landing
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000); // loader counts to 100
  const heroVisible = await page.locator('.hero h1').isVisible();
  console.log(`LANDING: hero visible = ${heroVisible}`);
  await page.screenshot({ path: 'react-e2e-landing.png' });

  // 2. Student login
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.fill('input[type="text"]', '192221001');
  await page.fill('input[type="password"]', 'student123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  console.log(`LOGIN OK -> ${page.url()}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'react-e2e-dashboard.png' });

  // 3. Profile page
  await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const profileName = await page.locator('.main-content h2').nth(1).textContent().catch(() => null);
  console.log(`PROFILE: name shown = ${JSON.stringify(profileName)}`);
  await page.screenshot({ path: 'react-e2e-profile.png', fullPage: true });

  // 4. Logout via the mobile logout button at page bottom, then admin login
  await page.evaluate(() => { localStorage.removeItem('ca_user'); localStorage.removeItem('ca_token'); });
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.fill('input[type="text"]', 'ADMIN01');
  await page.fill('input[type="password"]', 'admin@123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin', { timeout: 20000 });
  console.log(`ADMIN LOGIN OK -> ${page.url()}`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'react-e2e-admin-overview.png' });

  // 5. Spot-check admin tabs
  for (const tab of ['Requests', 'Notices', 'Students', 'Exams', 'Attendance', 'Events', 'Timetable']) {
    await page.click(`.sidebar-nav >> text=${tab}`);
    await page.waitForTimeout(700);
    const title = await page.locator('.page-title').textContent();
    console.log(`TAB ${tab}: page title = "${title}"`);
  }
  await page.screenshot({ path: 'react-e2e-admin-timetable.png' });

  console.log('\n--- ERRORS ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
  await browser.close();
})();
