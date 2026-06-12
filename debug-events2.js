const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));
  page.on('dialog', d => d.accept());

  await page.goto('http://localhost:5000/login.html', { waitUntil: 'networkidle' });
  await page.fill('#studentId', 'ADMIN01');
  await page.fill('#password', 'admin@123');
  await page.click('#loginBtn');
  await page.waitForURL('**/admin.html', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // EVENTS: verify the E2E event exists, then delete it via its button
  await page.click('#navEvents');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-tab-events.png' });
  const before = await page.locator('#adminEventsList').innerText();
  console.log('EVENTS: E2E event present before delete =', before.includes('E2E Test Event'));
  const delBtn = page.locator('#adminEventsList button', { hasText: 'Delete' }).first();
  await delBtn.click();
  await page.waitForTimeout(1500);
  const after = await page.locator('#adminEventsList').innerText();
  console.log('EVENTS: E2E event present after delete =', after.includes('E2E Test Event'));

  // TIMETABLE: load existing, edit round-trip
  await page.click('#navTimetable');
  await page.waitForTimeout(400);
  const opts = await page.locator('#ttExisting option').count();
  console.log(`TIMETABLE: ${opts - 1} existing timetable(s)`);
  await page.selectOption('#ttExisting', { index: 1 });
  await page.waitForTimeout(600);
  const cells = await page.locator('.tt-cell').count();
  const firstCell = await page.locator('.tt-cell').first().inputValue();
  console.log(`TIMETABLE: grid ${cells} cells, first cell = "${firstCell}"`);
  await page.screenshot({ path: 'test-tab-timetable.png' });
  await page.evaluate(() => saveTimetable());
  await page.waitForTimeout(1500);
  const toasts = await page.locator('.toast').allInnerTexts();
  console.log('TIMETABLE: save toasts =', JSON.stringify(toasts));

  await browser.close();
})();
