/** Retest chat + registration on the device with exact selectors. */
const puppeteer = require('puppeteer-core');
const SHOTS = 'C:/Users/LENOVO/OneDrive/Desktop/college-helpdesk-chatbot/device-screenshots';

const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  (' + extra + ')' : ''}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const page = (await browser.pages())[0];
  const errors = [];
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

  const shot = n => page.screenshot({ path: `${SHOTS}/${n}.png` }).catch(() => {});
  const path = () => page.evaluate(() => location.pathname);
  const fillByPh = (ph, val) => page.evaluate(([p, v]) => {
    const el = [...document.querySelectorAll('input')].find(i => i.placeholder === p);
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, [ph, val]);
  const waitForPath = async (want, ms) => {
    for (let t = 0; t < ms; t += 500) { if ((await path()) === want) return true; await sleep(500); }
    return false;
  };

  // ── student login → CHAT ──
  await page.evaluate(() => { localStorage.removeItem('ca_user'); localStorage.removeItem('ca_token'); });
  await page.goto('https://localhost/login');
  await sleep(2000);
  await fillByPh('Enter your student ID', '192221001').then(r => r || page.evaluate(() => {
    const el = document.querySelector('input[type="text"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '192221001');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  await page.evaluate(() => {
    const el = document.querySelector('input[type="password"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'student123');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /login/i.test(b.textContent))?.click());
  ok('student login', await waitForPath('/dashboard', 60000));

  await page.goto('https://localhost/chat');
  await sleep(3000);
  const before = await page.evaluate(() => document.querySelectorAll('.msg').length);
  const filled = await page.evaluate(() => {
    const el = document.querySelector('.chat-input');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'library timings');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
  await page.evaluate(() => document.querySelector('.send-btn')?.click());
  await sleep(8000);
  const after = await page.evaluate(() => document.querySelectorAll('.msg').length);
  const lastBot = await page.evaluate(() => {
    const bots = [...document.querySelectorAll('.msg.bot .msg-bubble')];
    return (bots[bots.length - 1]?.textContent || '').slice(0, 80);
  });
  ok('chatbot replies (live API)', filled && after >= before + 2, `msgs ${before}->${after} | "${lastBot}"`);
  await shot('05-chat');

  // ── REGISTRATION ──
  await page.evaluate(() => { localStorage.removeItem('ca_user'); localStorage.removeItem('ca_token'); });
  await page.goto('https://localhost/register');
  await sleep(2500);
  const suffix = '7341';
  const testId = `TEST${suffix}`;
  ok('fill firstName', await fillByPh('Sneka', 'APKTest'));
  ok('fill lastName', await fillByPh('S', 'DeleteMe'));
  ok('fill studentId', await fillByPh('e.g. 22IT101', testId));
  ok('fill email', await fillByPh('you@college.edu', `apk.test.${suffix}@example.com`));
  ok('fill password', await fillByPh('Min 8 characters', 'ApkTest@123'));
  ok('fill confirm', await fillByPh('Repeat password', 'ApkTest@123'));
  await page.evaluate(() => {
    document.querySelectorAll('select').forEach(el => {
      if (el.options.length > 1) { el.selectedIndex = 1; el.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    const cb = document.querySelector('input[type="checkbox"]');
    if (cb && !cb.checked) cb.click();
  });
  await shot('08-register-filled');
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(b => /create|register|sign\s?up/i.test(b.textContent))?.click());
  // register may auto-login (→ /dashboard) or send to /login
  let landed = '/register';
  for (let t = 0; t < 45000; t += 1000) {
    landed = await path();
    if (landed !== '/register') break;
    await sleep(1000);
  }
  ok('registration submits (live API)', landed !== '/register', `landed on ${landed}`);
  await shot('09-after-register');

  // ── cleanup: deactivate test account via admin API from host ──
  const a = await (await fetch('https://college-helpdesk-chatbot-l4bk.onrender.com/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: 'ADMIN01', password: 'admin@123' }) })).json();
  const list = await (await fetch('https://college-helpdesk-chatbot-l4bk.onrender.com/api/students/search/' + testId, {
    headers: { Authorization: `Bearer ${a.token}` } })).json();
  const u = (list.students || [])[0];
  if (u) {
    const del = await fetch('https://college-helpdesk-chatbot-l4bk.onrender.com/api/students/' + (u._id || u.id), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` },
      body: JSON.stringify({ isActive: false }) });
    ok('cleanup: test account deactivated', del.ok, testId);
  } else ok('cleanup: test account deactivated', false, `${testId} not found`);

  console.log('\nDEVICE CONSOLE ERRORS:', errors.length ? '\n' + errors.join('\n') : '(none)');
  browser.disconnect();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
