const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });

  // Inject fake auth so dashboard doesn't redirect
  await page.addInitScript(() => {
    localStorage.setItem('ca_token', 'fake-token-for-visual-test');
    localStorage.setItem('ca_user', JSON.stringify({ name: 'Test Student', studentId: '22IT101', role: 'student' }));
    localStorage.setItem('ca_theme', 'dark');
  });

  // Go directly to dashboard
  await page.goto('http://localhost:8080/dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check that mobile sections are hidden on desktop
  const mobileHeaderVisible = await page.evaluate(() => {
    const el = document.querySelector('.mobile-header');
    if (!el) return 'not found';
    const style = window.getComputedStyle(el);
    return style.display;
  });
  const mobileStatsVisible = await page.evaluate(() => {
    const el = document.querySelector('.mobile-stats');
    if (!el) return 'not found';
    return window.getComputedStyle(el).display;
  });
  const mobileActionsVisible = await page.evaluate(() => {
    const el = document.querySelector('.mobile-actions');
    if (!el) return 'not found';
    return window.getComputedStyle(el).display;
  });
  const desktopMainVisible = await page.evaluate(() => {
    const el = document.querySelector('main.desktop-only');
    if (!el) return 'not found';
    return window.getComputedStyle(el).display;
  });

  console.log('mobile-header display:', mobileHeaderVisible, '(should be none)');
  console.log('mobile-stats display:', mobileStatsVisible, '(should be none)');
  console.log('mobile-actions display:', mobileActionsVisible, '(should be none)');
  console.log('desktop main display:', desktopMainVisible, '(should be block)');

  // Screenshot above the fold
  await page.screenshot({ path: 'verify-desktop-fold.png', fullPage: false });
  // Full page
  await page.screenshot({ path: 'verify-desktop-full.png', fullPage: true });
  console.log('Screenshots saved');

  await browser.close();
})();
