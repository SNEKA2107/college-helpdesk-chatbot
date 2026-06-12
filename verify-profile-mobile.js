const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('ca_token', 'fake-token');
    localStorage.setItem('ca_user', JSON.stringify({ name: 'Test Student', studentId: '22IT101', role: 'student' }));
    localStorage.setItem('ca_theme', 'dark');
  });
  const filePath = 'file:///C:/Users/LENOVO/OneDrive/Desktop/college-helpdesk-chatbot/profile.html';
  await page.goto(filePath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // Scroll to bottom to see logout button
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verify-profile-mobile-bottom.png', fullPage: false });
  await page.screenshot({ path: 'verify-profile-mobile-full.png', fullPage: true });
  console.log('Done');
  await browser.close();
})();
