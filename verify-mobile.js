const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 size

  await page.addInitScript(() => {
    localStorage.setItem('ca_token', 'fake-token');
    localStorage.setItem('ca_user', JSON.stringify({ name: 'Test Student', studentId: '22IT101', role: 'student' }));
    localStorage.setItem('ca_theme', 'dark');
  });

  const filePath = 'file:///C:/Users/LENOVO/OneDrive/Desktop/college-helpdesk-chatbot/dashboard.html';
  await page.goto(filePath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const checks = await page.evaluate(() => {
    const get = sel => {
      const el = document.querySelector(sel);
      return el ? window.getComputedStyle(el).display : 'NOT FOUND';
    };
    return {
      'mobile-header':        get('.mobile-header'),
      'mobile-stats':         get('.mobile-stats'),
      'mobile-section-title': get('.mobile-section-title'),
      'mobile-actions':       get('.mobile-actions'),
      'desktop main':         get('main.desktop-only'),
      'topbar':               get('.topbar'),
    };
  });

  console.log('\n=== CSS Display Check (390px mobile) ===');
  const expectations = {
    'mobile-header':        'block',
    'mobile-stats':         'grid',
    'mobile-section-title': 'block',
    'mobile-actions':       'grid',
    'desktop main':         'none',
    'topbar':               'none',
  };
  let pass = true;
  for (const [name, display] of Object.entries(checks)) {
    const expected = expectations[name];
    const ok = display === expected;
    if (!ok) pass = false;
    console.log(`${ok ? '✅' : '❌'} .${name}: "${display}" (expected "${expected}")`);
  }
  console.log(pass ? '\nRESULT: PASS' : '\nRESULT: FAIL');

  await page.screenshot({ path: 'verify-mobile-fold.png', fullPage: false });
  await page.screenshot({ path: 'verify-mobile-full.png', fullPage: true });
  console.log('Screenshots saved');
  await browser.close();
})();
