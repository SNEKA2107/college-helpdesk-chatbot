/**
 * Debug script: capture console logs and errors from admin page
 */
const { chromium } = require('playwright');
const BASE  = 'http://127.0.0.1:5500';
const ADMIN = { id: 'ADMIN01', pw: 'admin@123' };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Capture page console messages and errors
  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
  page.on('requestfailed', req => console.log(`[REQ FAILED] ${req.url()} — ${req.failure()?.errorText}`));

  console.log('Navigating to login page...');
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#studentId', ADMIN.id);
  await page.fill('#password', ADMIN.pw);

  console.log('Clicking login...');
  await page.click('#loginBtn');
  await page.waitForTimeout(5000);

  console.log(`Current URL: ${page.url()}`);
  await page.screenshot({ path: 'debug-admin-after-login.png' });
  console.log('Screenshot saved: debug-admin-after-login.png');

  // Check localStorage
  const token = await page.evaluate(() => localStorage.getItem('ca_token'));
  const user  = await page.evaluate(() => localStorage.getItem('ca_user'));
  console.log('Token present:', !!token);
  console.log('User role:', JSON.parse(user || '{}').role);

  // Check stat values
  const statStudents = await page.textContent('#aStatStudents').catch(() => 'ELEMENT NOT FOUND');
  const statRequests = await page.textContent('#aStatRequests').catch(() => 'ELEMENT NOT FOUND');
  console.log('aStatStudents:', statStudents);
  console.log('aStatRequests:', statRequests);

  // Check if showTab exists
  const hasShowTab = await page.evaluate(() => typeof showTab === 'function');
  console.log('showTab exists:', hasShowTab);

  // Try calling showTab('requests') manually
  if (hasShowTab) {
    await page.evaluate(() => showTab('requests'));
    const tabDisplay = await page.evaluate(() => document.getElementById('tab-requests')?.style.display);
    console.log('tab-requests.style.display after showTab:', JSON.stringify(tabDisplay));
  }

  // Wait more and re-check stats
  console.log('Waiting additional 5s...');
  await page.waitForTimeout(5000);
  const statStudents2 = await page.textContent('#aStatStudents').catch(() => 'NOT FOUND');
  console.log('aStatStudents (after 10s total):', statStudents2);

  await page.screenshot({ path: 'debug-admin-10s.png' });
  console.log('Screenshot saved: debug-admin-10s.png');

  await browser.close();
})();
