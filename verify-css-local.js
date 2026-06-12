const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1366, height: 768 });

  // Navigate to local file
  const filePath = 'file:///' + path.join('C:/Users/LENOVO/OneDrive/Desktop/college-helpdesk-chatbot', 'dashboard.html').replace(/\\/g, '/');

  // Inject fake auth before page loads
  await page.addInitScript(() => {
    localStorage.setItem('ca_token', 'fake-token');
    localStorage.setItem('ca_user', JSON.stringify({ name: 'Test Student', studentId: '22IT101', role: 'student' }));
    localStorage.setItem('ca_theme', 'dark');
  });

  await page.goto(filePath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Check computed display values
  const checks = await page.evaluate(() => {
    const get = sel => {
      const el = document.querySelector(sel);
      return el ? window.getComputedStyle(el).display : 'NOT FOUND';
    };
    return {
      'mobile-header':     get('.mobile-header'),
      'mobile-stats':      get('.mobile-stats'),
      'mobile-section-title': get('.mobile-section-title'),
      'mobile-actions':    get('.mobile-actions'),
      'desktop main':      get('main.desktop-only'),
    };
  });

  console.log('\n=== CSS Display Check (1366px desktop) ===');
  let pass = true;
  for (const [name, display] of Object.entries(checks)) {
    const expected = name.startsWith('desktop') ? 'block' : 'none';
    const ok = display === expected;
    if (!ok) pass = false;
    console.log(`${ok ? '✅' : '❌'} .${name}: "${display}" (expected "${expected}")`);
  }
  console.log(pass ? '\nRESULT: PASS' : '\nRESULT: FAIL');

  await page.screenshot({ path: 'verify-desktop-fold.png', fullPage: false });
  await page.screenshot({ path: 'verify-desktop-full.png', fullPage: true });
  console.log('\nScreenshots saved: verify-desktop-fold.png, verify-desktop-full.png');
  await browser.close();
})();
