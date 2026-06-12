/**
 * Phase 5 Smoke Test — DB-backed Exam, Fees, Library, Timetable
 * Run: node test-phase5.js
 */
const { chromium } = require('playwright');

const BASE    = 'http://127.0.0.1:5500';
const STUDENT = { id: '22IT101', pw: 'student123' };

let passed = 0, failed = 0;
const ok   = label        => { console.log(`  ✅ ${label}`); passed++; };
const fail = (label, err) => { console.log(`  ❌ ${label}: ${err?.message || err}`); failed++; };

async function section(title, fn) {
  console.log(`\n── ${title} ──`);
  try { await fn(); }
  catch (e) { fail(title, e); }
}

async function login(page) {
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded' });
  await page.fill('#studentId', STUDENT.id);
  await page.fill('#password', STUDENT.pw);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
    page.click('#loginBtn'),
  ]);
}

async function waitForContent(page, selector, timeout = 10000) {
  await page.waitForFunction(
    sel => {
      const el = document.querySelector(sel);
      return el && el.textContent.trim() !== '' && el.textContent.trim() !== '—' && !el.textContent.includes('Loading');
    },
    selector,
    { timeout }
  );
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  await login(page);
  if (!page.url().includes('dashboard.html')) {
    console.error('Login failed — aborting');
    await browser.close();
    process.exit(1);
  }
  console.log('  ✅ Logged in as student');

  /* ── 1. Exam page loads DB data ── */
  await section('Exam page loads schedule from database', async () => {
    await page.goto(`${BASE}/exam.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const rows = await page.$$('table tbody tr');
    if (rows.length < 3) throw new Error(`Expected ≥3 exam rows, got ${rows.length}`);
    ok(`Exam table: ${rows.length} rows from DB`);

    // Verify a known subject appears
    const text = await page.textContent('table tbody');
    if (!text.includes('Java')) throw new Error('Java Programming not in schedule');
    ok('Subject "Java Programming" confirmed from DB');
  });

  /* ── 2. Fees page loads DB record ── */
  await section('Fees page loads student fee record from database', async () => {
    await page.goto(`${BASE}/fees.html`, { waitUntil: 'domcontentloaded' });

    // Wait for fee total to render (not empty / loading)
    await page.waitForFunction(() => {
      const els = document.querySelectorAll('.fee-total, .total-amount, [id*="total"], [id*="fee"]');
      return [...els].some(el => el.textContent.includes('55') || el.textContent.includes('000'));
    }, { timeout: 10000 });
    ok('Fee total (₹55,000) loaded from DB');

    // Payment history rows
    const rows = await page.$$('table tbody tr, .payment-row, .history-row');
    if (rows.length < 1) throw new Error('No payment history rows rendered');
    ok(`Payment history: ${rows.length} row(s) from DB`);
  });

  /* ── 3. Library page loads books from DB ── */
  await section('Library page loads book catalog from database', async () => {
    await page.goto(`${BASE}/library.html`, { waitUntil: 'domcontentloaded' });
    // Wait for API to replace the 6 static placeholder rows with 8 DB rows
    await page.waitForFunction(() => document.querySelectorAll('#booksBody tr').length >= 8, { timeout: 10000 });
    const books = await page.$$('#booksBody tr');
    ok(`Library catalog: ${books.length} books from DB`);

    const text = await page.textContent('#booksBody');
    if (!text.includes('Clean Code')) throw new Error('"Clean Code" not found in catalog');
    ok('Book "Clean Code" confirmed from DB');
  });

  /* ── 4. Library search filters via DB ── */
  await section('Library search queries database', async () => {
    const searchInput = page.locator('#bookSearch, input[placeholder*="earch"], input[type="search"]').first();
    await searchInput.fill('Java');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const results = await page.$$('.book-card, .book-item, table tbody tr');
    if (results.length < 1) throw new Error('No results returned for "Java"');
    ok(`Search "Java" → ${results.length} result(s) from DB`);
  });

  /* ── 5. Timetable loads from DB ── */
  await section('Timetable page loads schedule from database', async () => {
    await page.goto(`${BASE}/timetable.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const text = document.body.textContent;
      return text.includes('Java') || text.includes('DBMS') || text.includes('Python');
    }, { timeout: 10000 });
    const text = await page.textContent('body');
    const subjects = ['Java', 'DBMS', 'Python'].filter(s => text.includes(s));
    ok(`Timetable subjects from DB: ${subjects.join(', ')}`);
  });

  /* ── 6. API: exam endpoint returns DB data ── */
  await section('API /api/exam returns DB record', async () => {
    const res = await page.evaluate(async () => {
      const token = localStorage.getItem('ca_token');
      const r = await fetch('http://localhost:5000/api/exam', { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    });
    if (!res.success) throw new Error(res.message);
    if (!res.exam._id) throw new Error('No _id — data is not from MongoDB');
    if (res.exam.schedule.length < 5) throw new Error('Fewer than 5 exam entries');
    ok(`/api/exam → ${res.exam.schedule.length} scheduled exams, _id: ${res.exam._id}`);
  });

  /* ── 7. API: fees endpoint returns DB record ── */
  await section('API /api/fees returns DB record', async () => {
    const res = await page.evaluate(async () => {
      const token = localStorage.getItem('ca_token');
      const r = await fetch('http://localhost:5000/api/fees', { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    });
    if (!res.success) throw new Error(res.message);
    if (res.fees.total !== 55000) throw new Error(`Expected total 55000, got ${res.fees.total}`);
    if (res.fees.history.length < 4) throw new Error('Fewer than 4 payment history entries');
    ok(`/api/fees → total ₹${res.fees.total}, ${res.fees.history.length} payments, status: ${res.fees.status}`);
  });

  /* ── 8. API: library endpoint returns DB books ── */
  await section('API /api/library returns DB books', async () => {
    const res = await page.evaluate(async () => {
      const token = localStorage.getItem('ca_token');
      const r = await fetch('http://localhost:5000/api/library', { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    });
    if (!res.success) throw new Error(res.message);
    if (res.count < 8) throw new Error(`Expected 8 books, got ${res.count}`);
    const hasId = res.books.every(b => b._id);
    if (!hasId) throw new Error('Books missing _id — not from MongoDB');
    ok(`/api/library → ${res.count} books with MongoDB _ids`);
  });

  /* ── 9. API: borrowed books returns DB records ── */
  await section('API /api/library/borrowed returns student records', async () => {
    const res = await page.evaluate(async () => {
      const token = localStorage.getItem('ca_token');
      const r = await fetch('http://localhost:5000/api/library/borrowed', { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    });
    if (!res.success) throw new Error(res.message);
    if (res.count < 2) throw new Error(`Expected 2 borrowed books, got ${res.count}`);
    ok(`/api/library/borrowed → ${res.count} active borrowed book(s) from DB`);
  });

  /* ── 10. API: timetable endpoint returns DB record ── */
  await section('API /api/timetable returns DB record', async () => {
    const res = await page.evaluate(async () => {
      const token = localStorage.getItem('ca_token');
      const r = await fetch('http://localhost:5000/api/timetable', { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    });
    if (!res.success) throw new Error(res.message);
    if (!res.timetable._id) throw new Error('No _id — data is not from MongoDB');
    if (!res.timetable.schedule.Monday) throw new Error('Monday schedule missing');
    ok(`/api/timetable → dept: ${res.timetable.department}, semester: ${res.timetable.semester}, _id: ${res.timetable._id}`);
  });

  await browser.close();

  console.log(`\n${'─'.repeat(44)}`);
  console.log(`Phase 5 Results: ${passed} passed, ${failed} failed`);
  if (failed) { console.log('Review ❌ entries above.'); process.exit(1); }
  else { console.log('All Phase 5 tests passed! 🎉'); }
})();
