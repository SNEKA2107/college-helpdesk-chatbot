const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', m => console.log(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5000/login.html', { waitUntil: 'networkidle' });
  await page.fill('#studentId', 'ADMIN01');
  await page.fill('#password', 'admin@123');
  await page.click('#loginBtn');
  await page.waitForURL('**/admin.html', { timeout: 15000 });
  await page.waitForTimeout(2000);

  await page.click('#navEvents');
  await page.fill('#evTitle', 'E2E Test Event');
  await page.fill('#evDate', '2026-07-15');
  await page.fill('#evVenue', 'Test Hall');
  await page.fill('#evOrganizer', 'QA Dept');

  const out = await page.evaluate(async () => {
    const info = {};
    info.typeofCreateEvent = typeof createEvent;
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create Event');
    info.btnFound = !!btn;
    info.btnOnclickAttr = btn ? btn.getAttribute('onclick') : null;
    try {
      const r = await createEvent();
      info.callResult = 'returned ok';
    } catch (e) {
      info.callResult = 'THREW: ' + e.message;
    }
    return info;
  });
  console.log(JSON.stringify(out, null, 2));
  await page.waitForTimeout(1500);
  console.log('events list:', (await page.locator('#adminEventsList').innerText()).slice(0, 200));
  await browser.close();
})();
