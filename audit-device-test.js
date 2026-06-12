/** Drive the installed APK on the Android emulator via CDP (puppeteer-core, adb forward tcp:9222). */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const SHOTS = 'C:/Users/LENOVO/OneDrive/Desktop/college-helpdesk-chatbot/device-screenshots';
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  (' + extra + ')' : ''}`);
  results.push({ label, pass: !!cond });
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const page = (await browser.pages())[0];
  const errors = [];
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

  const shot = n => page.screenshot({ path: `${SHOTS}/${n}.png` }).catch(e => console.log('  shot fail:', e.message));
  const path = () => page.evaluate(() => location.pathname);
  const clickText = (sel, txt) => page.evaluate((s, t) => {
    const el = [...document.querySelectorAll(s)].find(e => e.textContent.trim().includes(t));
    if (el) { el.click(); return true; } return false;
  }, sel, txt);
  // React controlled inputs need the native setter + input event
  const fill = (sel, val) => page.evaluate((s, v) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, sel, val);
  const waitForPath = async (want, ms) => {
    for (let t = 0; t < ms; t += 500) { if ((await path()) === want) return true; await sleep(500); }
    return false;
  };

  // Fresh start at landing
  await page.goto('https://localhost/');
  await sleep(6000); // landing loader
  ok('landing renders', await page.evaluate(() => !!document.querySelector('.hero h1')));
  await shot('01-landing');

  // 1. LOGIN (live Render API from the device)
  await clickText('a,button', 'Student Login');
  await sleep(2000);
  ok('navigated to /login', (await path()) === '/login', await path());
  await fill('input[type="text"]', '192221001');
  await fill('input[type="password"]', 'student123');
  await shot('02-login-filled');
  await clickText('button', 'Login');
  ok('login -> dashboard (live API)', await waitForPath('/dashboard', 90000), await path());
  await sleep(3000);
  await shot('03-dashboard');

  // 2. DASHBOARD content
  ok('dashboard stat cards render', await page.evaluate(() => document.querySelectorAll('.stat-card').length) >= 4);

  // 3. NAVIGATION via bottom nav (mobile UI)
  ok('bottom nav visible', await page.evaluate(() => {
    const el = document.querySelector('.bottom-nav');
    return !!el && getComputedStyle(el).display !== 'none';
  }));
  await clickText('.bottom-nav a', 'Requests');
  await sleep(2500);
  ok('bottom-nav -> /requests', (await path()) === '/requests', await path());

  // 4. REQUESTS: list + modal open/close (no prod write)
  const reqHeader = await page.evaluate(() => document.querySelector('.page-header h2')?.textContent || '');
  ok('requests page renders', reqHeader.includes('Request'), reqHeader.trim());
  await clickText('button', 'New Request');
  await sleep(1000);
  ok('new-request modal opens', await page.evaluate(() => {
    const m = [...document.querySelectorAll('.modal, [class*="modal"]')].find(e => getComputedStyle(e).display !== 'none');
    return !!m && !!m.querySelector('select');
  }));
  await shot('04-requests-modal');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button, .modal-close')].find(e => e.textContent.trim() === '✕' || e.className.includes('close'));
    if (btn) btn.click();
  });
  await sleep(600);

  // 5. CHATBOT round-trip (live API)
  await page.evaluate(() => document.querySelector('.bottom-nav .bn-fab')?.click());
  await sleep(2500);
  const msgsBefore = await page.evaluate(() => document.querySelectorAll('.msg').length);
  await fill('.chat-foot input, .chat-input input, input[placeholder]', 'library timings');
  await page.keyboard.press('Enter');
  await sleep(7000);
  const msgsAfter = await page.evaluate(() => document.querySelectorAll('.msg').length);
  ok('chatbot replies (live API)', msgsAfter >= msgsBefore + 2, `msgs ${msgsBefore} -> ${msgsAfter}`);
  await shot('05-chat');

  // 6. ADMIN
  await page.evaluate(() => { localStorage.removeItem('ca_user'); localStorage.removeItem('ca_token'); });
  await page.goto('https://localhost/login');
  await sleep(2000);
  await fill('input[type="text"]', 'ADMIN01');
  await fill('input[type="password"]', 'admin@123');
  await clickText('button', 'Login');
  ok('admin login -> /admin', await waitForPath('/admin', 60000), await path());
  await sleep(4000);
  ok('admin stats render (live DB)', await page.evaluate(() => document.querySelectorAll('.stat-card').length) >= 4);
  await shot('06-admin-overview');
  await page.evaluate(() => document.querySelector('.menu-btn')?.click());
  await sleep(800);
  await clickText('.sidebar-nav a', 'Students');
  await sleep(3000);
  const title = await page.evaluate(() => document.querySelector('.page-title')?.textContent || '');
  ok('admin Students tab loads', title.includes('Students'), title.trim());
  const rows = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
  ok('students table has live rows', rows > 0, `${rows} rows`);
  await shot('07-admin-students');
  const adminToken = await page.evaluate(() => localStorage.getItem('ca_token'));

  // 7. REGISTRATION (live write, clearly-labeled disposable account, deactivated after)
  await page.evaluate(() => { localStorage.removeItem('ca_user'); localStorage.removeItem('ca_token'); });
  await page.goto('https://localhost/register');
  await sleep(2000);
  const suffix = String(((rows * 137) % 9000) + 1000);
  const testId = `TEST${suffix}`;
  const formInfo = await page.evaluate(() => [...document.querySelectorAll('form input')].map(i => ({
    type: i.type, ph: i.placeholder || '',
  })));
  console.log('  register inputs:', JSON.stringify(formInfo));
  await page.evaluate(([id, sfx]) => {
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    document.querySelectorAll('form input').forEach(el => {
      const ph = (el.placeholder || '').toLowerCase();
      if (el.type === 'password') set(el, 'ApkTest@123');
      else if (el.type === 'email' || ph.includes('mail')) set(el, `apk.test.${sfx}@example.com`);
      else if (ph.includes('id') || ph.includes('roll')) set(el, id);
      else if (el.type === 'tel' || ph.includes('phone')) set(el, '9876500000');
      else set(el, 'APK Device Test DELETE ME');
    });
    document.querySelectorAll('form select').forEach(el => {
      if (el.options.length > 1) {
        el.selectedIndex = 1;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }, [testId, suffix]);
  await shot('08-register-filled');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('form button, button[type="submit"]')].find(x => /register|create|sign/i.test(x.textContent));
    (b || document.querySelector('button[type="submit"]'))?.click();
  });
  await sleep(15000);
  const postReg = await path();
  const regOk = postReg === '/dashboard' || postReg === '/login';
  ok('registration submits (live API)', regOk, postReg);
  await shot('09-after-register');

  // cleanup via admin API from host
  if (adminToken) {
    try {
      const list = await (await fetch('https://college-helpdesk-chatbot-l4bk.onrender.com/api/students/search/' + testId, {
        headers: { Authorization: `Bearer ${adminToken}` } })).json();
      const u = (list.students || [])[0];
      if (u) {
        const del = await fetch('https://college-helpdesk-chatbot-l4bk.onrender.com/api/students/' + (u._id || u.id), {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify({ isActive: false }) });
        ok('cleanup: test account deactivated', del.ok, testId);
      } else ok('cleanup: test account deactivated', false, `${testId} not found via search`);
    } catch (e) { ok('cleanup: test account deactivated', false, e.message); }
  }

  console.log('\nDEVICE CONSOLE ERRORS:', errors.length ? '\n' + errors.join('\n') : '(none)');
  const fails = results.filter(r => !r.pass);
  console.log(fails.length ? `\n${fails.length} FAILURES: ${fails.map(f => f.label).join('; ')}` : '\nALL DEVICE CHECKS PASSED');
  browser.disconnect();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
