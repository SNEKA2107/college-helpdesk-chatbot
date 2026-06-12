const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  await page.goto('https://college-helpdesk-chatbot-l4bk.onrender.com/login.html');
  await page.waitForLoadState('networkidle');
  await page.fill('#studentId', 'ADMIN01');
  await page.fill('#password', 'admin@123');
  await page.click('#loginBtn');
  await page.waitForURL('**/admin.html', { timeout: 10000 });
})();
