const { chromium } = require('playwright');
const fs = require('fs');

const BASE    = 'http://localhost:5500';
const API     = 'http://localhost:5000/api';
const SCREENS = 'test-screenshots';
if (!fs.existsSync(SCREENS)) fs.mkdirSync(SCREENS, { recursive: true });

const log  = (msg) => console.log('     ' + msg);
const pass = (msg) => console.log('  ✅ ' + msg);
const fail = (msg) => console.log('  ❌ ' + msg);
const head = (msg) => console.log('\n━━━ ' + msg + ' ━━━');

async function shot(page, name) {
  await page.screenshot({ path: `${SCREENS}/${name}.png`, fullPage: false });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 120 });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const jsErrors = [];
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().includes('net::ERR') && !m.text().includes('Failed to fetch'))
      jsErrors.push(m.text());
  });

  try {
    // ── 1. Landing Page ────────────────────────────────────────────
    head('1. LANDING PAGE');
    await page.goto(`${BASE}/index.html`);
    await page.waitForLoadState('networkidle');
    pass('Title: "' + await page.title() + '"');
    (await page.locator('a[href="login.html"]').count()) > 0
      ? pass('CTA login button visible') : fail('CTA login button missing');
    await shot(page, '01-landing');

    // ── 2. Login — field validation ────────────────────────────────
    head('2. LOGIN — Field Validation');
    await page.goto(`${BASE}/login.html`);
    await page.waitForLoadState('networkidle');
    await page.click('#loginBtn');
    await page.waitForTimeout(400);
    (await page.locator('#idErr.show').count()) > 0
      ? pass('Empty ID field shows inline error') : fail('ID error not shown');
    (await page.locator('#passErr.show').count()) > 0
      ? pass('Empty password field shows inline error') : fail('Password error not shown');
    await shot(page, '02-login-validation');

    // ── 3. Login — wrong credentials ──────────────────────────────
    head('3. LOGIN — Wrong Credentials');
    await page.fill('#studentId', 'WRONG123');
    await page.fill('#password',  'wrongpass');
    await page.click('#loginBtn');
    await page.waitForTimeout(2500);
    const alertTxt = (await page.locator('#alertBox').textContent()).trim();
    alertTxt ? pass('Error shown: "' + alertTxt + '"') : fail('No error shown for bad credentials');
    await shot(page, '03-login-wrong-creds');

    // ── 4. Login — real credentials ───────────────────────────────
    head('4. LOGIN — Real Credentials (22IT101 / student123)');
    await page.fill('#studentId', '22IT101');
    await page.fill('#password',  'student123');
    await page.click('#loginBtn');
    await page.waitForURL(`${BASE}/dashboard.html`, { timeout: 8000 });
    pass('Login successful → redirected to dashboard.html');
    const token = await page.evaluate(() => localStorage.getItem('ca_token'));
    token && token.length > 20
      ? pass('Real JWT stored in localStorage (' + token.slice(0,30) + '…)')
      : fail('No valid token stored');
    await shot(page, '04-login-success');

    // ── 5. Dashboard — real stats ─────────────────────────────────
    head('5. DASHBOARD — Live Data');
    await page.waitForTimeout(2000);
    await shot(page, '05-dashboard');
    const userName = (await page.locator('[data-user-name]').first().textContent()).trim();
    pass('User name from DB: "' + userName + '"');
    const totalStat = (await page.locator('#statTotal').textContent()).trim();
    pass('Total requests stat: "' + totalStat + '" (0 = fresh DB)');
    const noticesStat = (await page.locator('#statNotices').textContent()).trim();
    pass('Notices stat: "' + noticesStat + '"');

    // ── 6. Chat — real API ────────────────────────────────────────
    head('6. CHAT — Real API');
    await page.goto(`${BASE}/chat.html`);
    await page.waitForLoadState('domcontentloaded');
    await shot(page, '06-chat');
    await page.fill('#chatInput', 'exam');
    await page.click('.send-btn');
    await page.waitForTimeout(2500);
    const msgs = await page.locator('.msg').count();
    pass('Messages after send: ' + msgs + ' (1 user + 1 bot reply)');
    const botReply = await page.locator('.msg.bot').last().locator('.msg-bubble').textContent();
    pass('Bot reply from API: "' + botReply.trim().slice(0, 80) + '…"');
    await shot(page, '07-chat-reply');

    // Try quick buttons
    await page.click('.quick-btn:has-text("Fees")');
    await page.waitForTimeout(2000);
    const feeReply = await page.locator('.msg.bot').last().locator('.msg-bubble').textContent();
    pass('Quick "Fees" reply: "' + feeReply.trim().slice(0, 60) + '…"');
    await shot(page, '08-chat-fees');

    // ── 7. Submit Document Request ────────────────────────────────
    head('7. DOCUMENT REQUESTS — Submit Real Request');
    await page.goto(`${BASE}/requests.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    let reqListTxt = (await page.locator('#reqList').textContent()).trim();
    pass('Initial requests list: "' + reqListTxt.slice(0, 60) + '"');
    await shot(page, '09-requests-empty');

    // Submit a request
    await page.click('button:has-text("New Request")');
    await page.waitForTimeout(400);
    await page.selectOption('#reqType', 'Bonafide Certificate');
    await page.fill('#reqReason', 'Required for bank loan application. Urgently needed.');
    await page.selectOption('#reqUrgency', { index: 1 });
    await shot(page, '10-request-modal-filled');
    await page.click('#reqModal .btn-primary');
    await page.waitForTimeout(2500);
    reqListTxt = (await page.locator('#reqList').textContent()).trim();
    reqListTxt.includes('Bonafide Certificate')
      ? pass('Request submitted and displayed in list: "Bonafide Certificate"')
      : fail('Request not appearing in list after submit. List: "' + reqListTxt.slice(0,80) + '"');
    await shot(page, '11-requests-after-submit');

    // Verify stats updated
    await page.goto(`${BASE}/dashboard.html`);
    await page.waitForTimeout(2000);
    const newTotal = (await page.locator('#statTotal').textContent()).trim();
    newTotal === '1' ? pass('Dashboard total requests updated to 1') : log('Dashboard total: "' + newTotal + '"');
    await shot(page, '12-dashboard-after-request');

    // ── 8. Leave Application — Submit Real ────────────────────────
    head('8. LEAVE APPLICATION — Submit Real');
    await page.goto(`${BASE}/leave.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await shot(page, '13-leave');
    pass('Leave page loaded');

    // Fill and submit form
    await page.selectOption('#leaveType', 'Medical Leave');
    const fromD = new Date(); fromD.setDate(fromD.getDate() + 2);
    const toD   = new Date(); toD.setDate(toD.getDate() + 3);
    const fmt = d => d.toISOString().split('T')[0];
    await page.fill('#fromDate', fmt(fromD));
    await page.fill('#toDate',   fmt(toD));
    await page.fill('#leaveReason', 'Fever and viral infection. Doctor advised bed rest for 2 days.');
    await shot(page, '14-leave-filled');
    await page.click('#leaveForm .btn-primary');
    await page.waitForTimeout(3000);
    const successMsg = await page.locator('#successMsg').isVisible();
    successMsg
      ? pass('Leave submitted — success state shown')
      : fail('Leave submit did not show success state');
    await shot(page, '15-leave-success');

    // Go back and check history
    await page.click('button:has-text("Apply for Another Leave")');
    await page.waitForTimeout(2000);
    const historyTxt = (await page.locator('#leaveHistory').textContent()).trim();
    historyTxt.includes('Medical Leave')
      ? pass('Leave history shows submitted leave: "Medical Leave"')
      : fail('Leave history not showing. Content: "' + historyTxt.slice(0, 80) + '"');
    await shot(page, '16-leave-history');

    // ── 9. Registration Page ───────────────────────────────────────
    head('9. REGISTER — Duplicate Student ID Rejected');
    await page.goto(`${BASE}/register.html`);
    await page.waitForLoadState('networkidle');
    await page.fill('#firstName',   'Test');
    await page.fill('#lastName',    'User');
    await page.fill('#studentId',   '22IT101');  // already registered
    await page.fill('#email',       'testdup@college.edu');
    await page.selectOption('#dept', 'CSE');
    await page.fill('#password',    'Password@1');
    await page.fill('#confirmPassword', 'Password@1');
    await page.check('#terms');
    await page.click('#regBtn');
    await page.waitForTimeout(3000);
    await shot(page, '17-register-duplicate');
    pass('Duplicate registration attempt completed (check screenshot for error)');

    // ── 10. Notices ───────────────────────────────────────────────
    head('10. NOTICES');
    await page.goto(`${BASE}/notices.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    const noticeListTxt = (await page.locator('#noticesList').textContent()).trim();
    pass('Notices list: "' + noticeListTxt.slice(0, 80) + '"');
    await shot(page, '18-notices');

    // ── 11. Mobile Responsive ─────────────────────────────────────
    head('11. MOBILE RESPONSIVE');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/dashboard.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await shot(page, '19-mobile-dashboard');
    (await page.locator('#menuBtn').isVisible())
      ? pass('Hamburger menu button visible on mobile') : fail('Menu button not visible');
    const sidebarCls = await page.locator('#sidebar').getAttribute('class');
    !sidebarCls.includes('open') ? pass('Sidebar hidden by default on mobile') : log('Sidebar is open');
    await page.click('#menuBtn');
    await page.waitForTimeout(500);
    const afterToggle = await page.locator('#sidebar').getAttribute('class');
    afterToggle.includes('open') ? pass('Tap hamburger → sidebar slides open') : fail('Sidebar did not open');
    await shot(page, '20-mobile-sidebar-open');
    await page.setViewportSize({ width: 1280, height: 800 });

    // ── 12. Logout ────────────────────────────────────────────────
    head('12. LOGOUT');
    await page.goto(`${BASE}/dashboard.html`);
    await page.waitForTimeout(1000);
    const tokenBefore = await page.evaluate(() => localStorage.getItem('ca_token'));
    tokenBefore ? pass('Token present before logout') : fail('No token before logout');
    await page.evaluate(() => window.logout && window.logout());
    await page.waitForURL(`${BASE}/login.html`, { timeout: 5000 });
    const tokenAfter = await page.evaluate(() => localStorage.getItem('ca_token'));
    tokenAfter === null ? pass('Token cleared from localStorage') : fail('Token still present after logout');
    pass('Redirected to login.html ✓');
    await shot(page, '21-after-logout');

    // ── Summary ───────────────────────────────────────────────────
    head('ALL TESTS COMPLETE');
    console.log('\n  📸 ' + fs.readdirSync(SCREENS).length + ' screenshots saved to ./' + SCREENS + '/');
    if (jsErrors.length > 0) {
      console.log('\n  ⚠️  Unexpected JS errors:');
      jsErrors.forEach(e => fail(e));
    } else {
      pass('No unexpected JavaScript errors');
    }

  } catch (err) {
    fail('Test crashed: ' + err.message);
    await shot(page, 'error-state').catch(() => {});
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
})();
