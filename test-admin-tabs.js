const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });

  const errors = [];
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[console.error] ${m.text()}`); });

  // Login as admin
  await page.goto('http://localhost:5000/login.html', { waitUntil: 'networkidle' });
  await page.fill('#studentId', 'ADMIN01');
  await page.fill('#password', 'admin@123');
  await page.click('#loginBtn');
  await page.waitForURL('**/admin.html', { timeout: 15000 });
  await page.waitForTimeout(2500);
  console.log('LOGIN OK ->', page.url());

  // 1. EXAMS tab
  await page.click('#navExams');
  await page.waitForTimeout(500);
  const examSem = await page.inputValue('#exSemester');
  const schedRows = await page.locator('#exSchedRows .ex-sched-row').count();
  console.log(`EXAMS: prefilled semester="${examSem}", ${schedRows} theory rows`);
  await page.click('button:has-text("+ Add Row") >> nth=0');
  const schedRows2 = await page.locator('#exSchedRows .ex-sched-row').count();
  console.log(`EXAMS: after add-row -> ${schedRows2} rows`);
  await page.screenshot({ path: 'test-tab-exams.png' });

  // Save exam (round-trip)
  await page.click('button:has-text("Save & Publish Exam Schedule")');
  await page.waitForTimeout(1500);
  console.log('EXAMS: saved, badge =', await page.locator('#examModeBadge').innerText());

  // 2. ATTENDANCE tab
  await page.click('#navAttendance');
  await page.waitForTimeout(400);
  await page.selectOption('#attDept', 'IT');
  await page.selectOption('#attSem', '8th');
  await page.fill('#attSubject', 'Test Subject (E2E)');
  await page.click('text=Load Students');
  await page.waitForTimeout(600);
  const attRows = await page.locator('#attStudentRows .att-status').count();
  console.log(`ATTENDANCE: loaded ${attRows} students for IT/8th`);
  if (attRows > 0) {
    const firstSid = await page.locator('#attStudentRows .att-status').first().getAttribute('data-sid');
    await page.fill('#attLookupId', firstSid);
    await page.click('button:has-text("Check")');
    await page.waitForTimeout(1500);
    const summaryText = await page.locator('#attSummaryWrap').innerText();
    console.log(`ATTENDANCE lookup for ${firstSid}: ${summaryText.split('\n')[0]}`);
  }
  await page.screenshot({ path: 'test-tab-attendance.png' });

  // 3. EVENTS tab
  await page.click('#navEvents');
  await page.waitForTimeout(400);
  await page.fill('#evTitle', 'E2E Test Event');
  await page.selectOption('#evCategory', 'Technical');
  await page.fill('#evDate', '2026-07-15');
  await page.fill('#evTime', '10:00 AM');
  await page.fill('#evVenue', 'Test Hall');
  await page.fill('#evOrganizer', 'QA Dept');
  page.on('response', async r => {
    if (r.url().includes('/api/events') && r.request().method() === 'POST') {
      console.log(`EVENTS POST -> ${r.status()}: ${(await r.text()).slice(0, 300)}`);
    }
  });
  await page.click('button:has-text("Create Event")');
  await page.waitForTimeout(1500);
  const toasts = await page.locator('.toast').allInnerTexts();
  console.log('EVENTS toasts:', JSON.stringify(toasts));
  const evList = await page.locator('#adminEventsList').innerText();
  console.log(`EVENTS: list contains test event = ${evList.includes('E2E Test Event')}`);
  await page.screenshot({ path: 'test-tab-events.png' });
  // delete it again (accept confirm)
  page.on('dialog', d => d.accept());
  const evRow = page.locator('#adminEventsList > div').filter({ hasText: 'E2E Test Event' }).last();
  await evRow.locator('button:has-text("Delete")').click();
  await page.waitForTimeout(1200);
  const evList2 = await page.locator('#adminEventsList').innerText();
  console.log(`EVENTS: after delete, still present = ${evList2.includes('E2E Test Event')}`);

  // 4. TIMETABLE tab
  await page.click('#navTimetable');
  await page.waitForTimeout(400);
  const ttOptions = await page.locator('#ttExisting option').count();
  console.log(`TIMETABLE: ${ttOptions - 1} existing timetable(s) in selector`);
  if (ttOptions > 1) {
    await page.selectOption('#ttExisting', { index: 1 });
    await page.waitForTimeout(500);
    const cells = await page.locator('.tt-cell').count();
    const firstCell = await page.locator('.tt-cell').first().inputValue();
    console.log(`TIMETABLE: grid built with ${cells} cells, first cell = "${firstCell}"`);
    await page.click('button:has-text("Save Timetable")');
    await page.waitForTimeout(1500);
    console.log('TIMETABLE: save clicked');
  } else {
    await page.click('button:has-text("Build / Reset Grid")');
    await page.waitForTimeout(500);
    console.log(`TIMETABLE: new grid cells = ${await page.locator('.tt-cell').count()}`);
  }
  await page.screenshot({ path: 'test-tab-timetable.png' });

  console.log(errors.length ? `\nJS ERRORS:\n${errors.join('\n')}` : '\nNO JS ERRORS');
  await browser.close();
})();
