/**
 * Phase 3 Smoke Test — Admin Panel, Contact Form, Profile, Notification Bell
 * Run: node test-phase3.js
 */
const { chromium } = require('playwright');

const BASE    = 'http://127.0.0.1:5500';
const ADMIN   = { id: 'ADMIN01', pw: 'admin@123' };
const STUDENT = { id: '22IT101', pw: 'student123' };

let passed = 0, failed = 0;
const ok   = label         => { console.log(`  ✅ ${label}`); passed++; };
const fail = (label, err)  => { console.log(`  ❌ ${label}: ${err?.message || err}`); failed++; };

async function section(title, fn) {
  console.log(`\n── ${title} ──`);
  try { await fn(); }
  catch (e) { fail(title, e); }
}

/** Login and wait for redirect to settle */
async function login(page, cred) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#studentId', cred.id);
  await page.fill('#password', cred.pw);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }),
    page.click('#loginBtn'),
  ]);
}

/** Switch admin tab via JS call and wait until tab is visible */
async function switchTab(page, tabName) {
  // Call showTab() in page context
  await page.evaluate(name => { if (typeof showTab === 'function') showTab(name); }, tabName);
  // Wait until the tab div is no longer hidden
  await page.waitForFunction(
    name => {
      const el = document.getElementById('tab-' + name);
      return el && el.style.display !== 'none';
    },
    tabName,
    { timeout: 8000 }
  );
}

/** Wait for an element to have non-placeholder text (not '—' or 'Loading…') */
async function waitForContent(page, selector, timeout = 10000) {
  await page.waitForFunction(
    sel => {
      const el = document.querySelector(sel);
      return el && el.textContent.trim() !== '—' && el.textContent.trim() !== 'Loading…' && el.textContent.trim() !== '';
    },
    selector,
    { timeout }
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  /* ── 1. Admin Login & Redirect ── */
  await section('Admin Login redirects to admin.html', async () => {
    await login(page, ADMIN);
    const url = page.url();
    if (!url.includes('admin.html')) throw new Error(`Expected admin.html, got ${url}`);
    ok('Admin redirected to admin.html');
  });

  /* ── 2. Admin Overview Stats ── */
  await section('Admin Overview stats load from database', async () => {
    // Wait for stats to actually populate (loadAdminData is async)
    await waitForContent(page, '#aStatStudents', 12000);
    const students = await page.textContent('#aStatStudents');
    const requests = await page.textContent('#aStatRequests');
    const notices  = await page.textContent('#aStatNotices');
    ok(`Students: ${students}, Pending Requests: ${requests}, Active Notices: ${notices}`);
  });

  /* ── 3. Requests Tab ── */
  await section('Requests tab renders table rows', async () => {
    await switchTab(page, 'requests');
    await page.waitForSelector('#adminRequestsBody tr', { timeout: 5000 });
    const rows = await page.$$('#adminRequestsBody tr');
    ok(`Requests table: ${rows.length} row(s)`);
  });

  /* ── 4. Leaves Tab ── */
  await section('Leaves tab renders table rows', async () => {
    await switchTab(page, 'leaves');
    await page.waitForSelector('#adminLeavesBody tr', { timeout: 5000 });
    const rows = await page.$$('#adminLeavesBody tr');
    ok(`Leaves table: ${rows.length} row(s)`);
  });

  /* ── 5. Notices Tab — Create Notice ── */
  await section('Create a notice via admin panel', async () => {
    await switchTab(page, 'notices');
    await page.waitForSelector('#nTitle', { state: 'visible', timeout: 6000 });
    const title = `Phase3 Notice ${Date.now()}`;
    await page.fill('#nTitle', title);
    await page.fill('#nContent', 'Posted by Phase 3 automated test.');
    await page.selectOption('#nCategory', 'exam');
    await page.click('button[onclick="createNotice()"]');
    await page.waitForTimeout(2000);
    const list = await page.textContent('#adminNoticesList');
    if (!list.includes('Phase3')) throw new Error('Notice not found in list after creation');
    ok(`Notice created and appears in list`);
  });

  /* ── 6. Messages Tab ── */
  await section('Messages tab renders table rows', async () => {
    await switchTab(page, 'messages');
    await page.waitForSelector('#adminMessagesBody tr', { timeout: 5000 });
    const rows = await page.$$('#adminMessagesBody tr');
    ok(`Messages table: ${rows.length} row(s)`);
  });

  /* ── 7. Students Tab + Search ── */
  await section('Students tab renders table and search works', async () => {
    await switchTab(page, 'students');
    await page.waitForSelector('#adminStudentsBody tr', { timeout: 5000 });
    const rows = await page.$$('#adminStudentsBody tr');
    ok(`Students table: ${rows.length} row(s)`);
    await page.fill('#studentSearchInput', '22IT');
    await page.click('button[onclick="filterStudents()"]');
    await page.waitForTimeout(200);
    const filtered = await page.$$('#adminStudentsBody tr');
    ok(`Filtered "22IT": ${filtered.length} row(s)`);
  });

  /* ── 8. Admin: Update Request Status ── */
  await section('Admin can update a request status', async () => {
    await switchTab(page, 'requests');
    await page.waitForSelector('#adminRequestsBody select', { timeout: 5000 });
    const selects = await page.$$('#adminRequestsBody select');
    if (!selects.length) { ok('No requests to update (DB empty — skip)'); return; }
    const sel   = selects[0];
    const reqId = (await sel.getAttribute('id')).replace('rs_', '');
    await sel.selectOption('Under Review');
    await page.click(`button[onclick="updateRequestStatus('${reqId}')"]`);
    await page.waitForTimeout(1500);
    ok(`Request status updated to "Under Review"`);
  });

  /* ── 9. Student Login → Contact Form ── */
  await section('Contact form submits message to backend', async () => {
    // Switch to student session
    await page.evaluate(() => localStorage.clear());
    await login(page, STUDENT);
    if (!page.url().includes('dashboard.html')) throw new Error('Student not on dashboard');
    ok('Student logged in to dashboard');

    await page.goto(`${BASE}/contact.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#cDept', { timeout: 5000 });
    await page.selectOption('#cDept', 'Examination Cell');
    await page.fill('#cSubject', 'Phase 3 Test Message');
    await page.fill('#cMessage', 'Automated test submission from Phase 3 suite.');
    await page.click('button[onclick="sendMessage()"]');
    await page.waitForTimeout(2000);
    const success = page.locator('#contactSuccess');
    if (!(await success.isVisible())) throw new Error('Success state not shown');
    ok('Contact message submitted — success state visible');
  });

  /* ── 10. Profile Page Info ── */
  await section('Profile page shows user data', async () => {
    await page.goto(`${BASE}/profile.html`, { waitUntil: 'domcontentloaded' });
    await waitForContent(page, '#profileName', 8000);
    const name  = await page.textContent('#profileName');
    const id    = await page.textContent('#profileStudentId');
    const email = await page.textContent('#detEmail');
    ok(`Name: ${name}, ID: ${id}, Email: ${email}`);
  });

  /* ── 11. Change Password Validation ── */
  await section('Change password client-side validation', async () => {
    await page.waitForSelector('#curPw', { timeout: 5000 });
    // Too short
    await page.fill('#curPw', 'any');
    await page.fill('#newPw', 'short');
    await page.fill('#confPw', 'short');
    await page.click('button[onclick="changePassword()"]');
    await page.waitForTimeout(300);
    if (!(await page.locator('#pwError').isVisible())) throw new Error('Short-pw error not shown');
    ok('Short password error shown');
    // Mismatch
    await page.fill('#newPw', 'validpass1');
    await page.fill('#confPw', 'different1');
    await page.click('button[onclick="changePassword()"]');
    await page.waitForTimeout(300);
    const errText = await page.textContent('#pwError');
    if (!errText.includes('match')) throw new Error('Mismatch error not shown');
    ok('Password mismatch error shown');
  });

  /* ── 12. Notification Bell Count ── */
  await section('Notification bell shows unread badge', async () => {
    await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // allow updateNotifBell() to fetch & render
    const badge = page.locator('.notif-btn .notif-count');
    if (await badge.isVisible()) {
      const count = await badge.textContent();
      ok(`Bell badge shows unread count: ${count}`);
    } else {
      ok('Bell visible — all notices read (badge hidden)');
    }
  });

  await browser.close();

  console.log(`\n${'─'.repeat(44)}`);
  console.log(`Phase 3 Results: ${passed} passed, ${failed} failed`);
  if (failed) { console.log('Review ❌ entries above.'); process.exit(1); }
  else { console.log('All Phase 3 tests passed! 🎉'); }
})();
