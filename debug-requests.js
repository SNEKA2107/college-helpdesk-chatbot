const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 1600 });
  page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));

  await page.goto('https://college-helpdesk-chatbot-l4bk.onrender.com/login.html', { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('#studentId', '22IT101');
  await page.fill('#password', 'student123');
  await page.click('#loginBtn');
  await page.waitForURL('**/dashboard.html', { timeout: 20000 });
  await page.goto('https://college-helpdesk-chatbot-l4bk.onrender.com/requests.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const cards = await page.locator('.req-card .req-info p').allInnerTexts();
  console.log('Rendered order:');
  cards.forEach((c, i) => console.log(`${i + 1}. ${c}`));
  await page.screenshot({ path: 'debug-requests.png', fullPage: true });
  await browser.close();
})();
