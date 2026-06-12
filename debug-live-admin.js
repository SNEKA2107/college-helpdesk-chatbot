const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));

  await page.goto('https://college-helpdesk-chatbot-l4bk.onrender.com/login.html', { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('#studentId', 'ADMIN01');
  await page.fill('#password', 'admin@123');
  await page.click('#loginBtn');
  await page.waitForURL('**/admin.html', { timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log('ADMIN LOGIN OK');

  for (const tab of ['Exams', 'Attendance', 'Events', 'Timetable']) {
    await page.click(`#nav${tab}`);
    await page.waitForTimeout(500);
    console.log(`${tab} tab: visible = ${await page.locator(`#tab-${tab.toLowerCase()}`).isVisible()}`);
  }
  await page.click('#navExams');
  await page.waitForTimeout(500);
  console.log('Exam prefill semester =', await page.inputValue('#exSemester'));
  await page.screenshot({ path: 'live-admin-exams.png' });
  await browser.close();
})();
