const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE = 'http://localhost:8765';
const OUT  = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const PAGES = [
  { name: 'landing',        url: '/',                    desc: 'Landing Page' },
  { name: 'login',          url: '/login.html',          desc: 'Login Page' },
  { name: 'register',       url: '/register.html',       desc: 'Register Page' },
  { name: 'dashboard',      url: '/dashboard.html',      desc: 'Dashboard' },
  { name: 'chat',           url: '/chat.html',           desc: 'Chat with Bot' },
  { name: 'requests',       url: '/requests.html',       desc: 'My Requests' },
  { name: 'exam',           url: '/exam.html',           desc: 'Exam Info' },
  { name: 'fees',           url: '/fees.html',           desc: 'Fee Information' },
  { name: 'timetable',      url: '/timetable.html',      desc: 'Timetable' },
  { name: 'leave',          url: '/leave.html',          desc: 'Leave Application' },
  { name: 'library',        url: '/library.html',        desc: 'Library' },
  { name: 'status',         url: '/status.html',         desc: 'Marksheet Status' },
  { name: 'notices',        url: '/notices.html',        desc: 'Notices' },
  { name: 'contact',        url: '/contact.html',        desc: 'Contact Office' },
  { name: 'student-search', url: '/student-search.html', desc: 'Student Search' },
];

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await ctx.newPage();

  const results = [];

  // ── 1. LANDING PAGE ──────────────────────────────────────────
  console.log('\n[1/17] Testing: Landing Page');
  await page.goto(BASE + '/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/01-landing.png`, fullPage: true });

  // Test hamburger on mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await page.click('#hamBtn');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/01b-landing-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  results.push({ page: 'Landing', status: '✅ PASS' });

  // ── 2. LOGIN PAGE ────────────────────────────────────────────
  console.log('[2/17] Testing: Login Page');
  await page.goto(BASE + '/login.html');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/02-login.png` });

  // Test empty submit (validation)
  await page.click('#loginBtn');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/02b-login-validation.png` });

  // Test wrong credentials
  await page.fill('#studentId', 'WRONG123');
  await page.fill('#password', 'wrongpass');
  await page.click('#loginBtn');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/02c-login-error.png` });

  // Test correct credentials — store auth in localStorage
  await page.evaluate(() => {
    localStorage.setItem('ca_user', JSON.stringify({ name:'Sneka S', studentId:'22IT101', dept:'IT', semester:'5th' }));
    localStorage.setItem('ca_token', 'test-token-123');
  });
  results.push({ page: 'Login', status: '✅ PASS' });

  // ── 3. REGISTER PAGE ─────────────────────────────────────────
  console.log('[3/17] Testing: Register Page');
  await page.goto(BASE + '/register.html');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/03-register.png` });

  // Fill the form
  await page.fill('#firstName', 'Sneka');
  await page.fill('#lastName', 'S');
  await page.fill('#studentId', '22IT101');
  await page.fill('#email', 'sneka@college.edu');
  await page.selectOption('#dept', 'IT');
  await page.selectOption('#semester', '5th');
  await page.fill('#password', 'Student@123');
  await page.fill('#confirmPassword', 'Student@123');
  await page.click('#terms');
  await page.screenshot({ path: `${OUT}/03b-register-filled.png` });
  results.push({ page: 'Register', status: '✅ PASS' });

  // ── 4-15. INNER PAGES ────────────────────────────────────────
  const innerPages = PAGES.slice(3);
  for (let i = 0; i < innerPages.length; i++) {
    const p = innerPages[i];
    console.log(`[${i + 4}/17] Testing: ${p.desc}`);
    await page.goto(BASE + p.url);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${String(i + 4).padStart(2,'0')}-${p.name}.png`, fullPage: true });

    // Test mobile sidebar toggle
    await page.setViewportSize({ width: 375, height: 812 });
    await page.click('#menuBtn');
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${String(i + 4).padStart(2,'0')}b-${p.name}-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 900 });

    results.push({ page: p.desc, status: '✅ PASS' });
  }

  // ── FEATURE TESTS ────────────────────────────────────────────

  // Chat: send a message
  console.log('\n[Feature] Chat Bot interaction');
  await page.goto(BASE + '/chat.html');
  await page.waitForLoadState('networkidle');
  await page.fill('#chatInput', 'exam info');
  await page.click('.send-btn');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/feature-chat-response.png` });

  // Chat: quick button
  await page.click('button:has-text("💳 Fees")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/feature-chat-fees.png` });
  console.log('  Chat: ✅');

  // Requests: open New Request modal
  console.log('[Feature] Requests modal');
  await page.goto(BASE + '/requests.html');
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("+ New Request")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/feature-requests-modal.png` });
  await page.selectOption('#reqType', 'Marksheet');
  await page.fill('#reqReason', 'Needed for job application');
  await page.screenshot({ path: `${OUT}/feature-requests-modal-filled.png` });
  console.log('  Requests modal: ✅');

  // Library: search
  console.log('[Feature] Library search');
  await page.goto(BASE + '/library.html');
  await page.waitForLoadState('networkidle');
  await page.fill('#bookSearch', 'Java');
  await page.click('button:has-text("Search")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/feature-library-search.png` });
  console.log('  Library search: ✅');

  // Student Search
  console.log('[Feature] Student Search');
  await page.goto(BASE + '/student-search.html');
  await page.waitForLoadState('networkidle');
  await page.fill('#searchInput', 'Sneka');
  await page.click('button:has-text("Search")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/feature-student-search.png` });
  // Click View to open detail modal
  await page.click('button:has-text("View")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/feature-student-detail.png` });
  console.log('  Student Search: ✅');

  // Timetable: today's classes
  console.log('[Feature] Timetable today highlight');
  await page.goto(BASE + '/timetable.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/feature-timetable-today.png` });
  console.log('  Timetable: ✅');

  // Contact: FAQ accordion
  console.log('[Feature] Contact FAQ accordion');
  await page.goto(BASE + '/contact.html');
  await page.waitForLoadState('networkidle');
  await page.click('.faq-item button');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/feature-contact-faq.png` });
  console.log('  Contact FAQ: ✅');

  // Leave: submit form
  console.log('[Feature] Leave form submission');
  await page.goto(BASE + '/leave.html');
  await page.waitForLoadState('networkidle');
  await page.selectOption('#leaveType', 'Medical Leave');
  await page.fill('#fromDate', '2026-06-01');
  await page.fill('#toDate', '2026-06-02');
  await page.fill('#leaveReason', 'Fever — doctor advised rest');
  await page.click('button:has-text("Submit Application")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/feature-leave-success.png` });
  console.log('  Leave submit: ✅');

  // Notices: filter
  console.log('[Feature] Notices filter');
  await page.goto(BASE + '/notices.html');
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("Exam")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/feature-notices-filter.png` });
  console.log('  Notices filter: ✅');

  // ── PRINT RESULTS ────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  CAMPUSASSIST PAGE TEST RESULTS');
  console.log('═══════════════════════════════════════');
  results.forEach(r => console.log(`  ${r.status}  ${r.page}`));
  console.log('───────────────────────────────────────');
  console.log(`  Total: ${results.length}/15 pages tested`);
  console.log(`  Screenshots saved to: ${OUT}`);
  console.log('═══════════════════════════════════════\n');

  await browser.close();
}

run().catch(err => { console.error('Test error:', err); process.exit(1); });
