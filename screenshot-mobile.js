const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 size
  await page.goto('https://college-helpdesk-chatbot-l4bk.onrender.com/login.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.fill('#studentId', '22IT101');
  await page.fill('#password', 'student123');
  await page.click('#loginBtn');
  await page.waitForURL('**/dashboard.html', { timeout: 10000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'mobile-dashboard.png', fullPage: false });
  console.log('Screenshot saved');
  await browser.close();
})();
