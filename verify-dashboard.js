const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:5000/login.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.fill('#studentId', '22IT101');
  await page.fill('#password', 'student123');
  await page.click('#loginBtn');
  try {
    await page.waitForURL('**/dashboard.html', { timeout: 10000 });
  } catch (e) {
    // Try navigating directly if login didn't redirect
    await page.goto('http://localhost:5000/dashboard.html', { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(3000);
  // Screenshot full page (shows everything including below the fold)
  await page.screenshot({ path: 'verify-dashboard-full.png', fullPage: true });
  // Screenshot just the viewport (above the fold)
  await page.screenshot({ path: 'verify-dashboard-fold.png', fullPage: false });
  console.log('Screenshots saved');
  await browser.close();
})();
