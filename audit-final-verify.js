/** FINAL verification pass on freshly-installed APK: login, dashboard, requests,
 *  chat, profile, navigation, logout, admin. Read-only against prod (no writes). */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const SHOTS = 'C:/Users/LENOVO/OneDrive/Desktop/college-helpdesk-chatbot/device-screenshots/final';
fs.mkdirSync(SHOTS, { recursive: true });

const ok = (label, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  (' + extra + ')' : ''}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const page = (await browser.pages())[0];
  const errors = [];
  const apiCalls = { prod: 0, localhost: 0 };
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('response', r => {
    const u = r.url();
    if (u.includes('onrender.com/api')) apiCalls.prod++;
    if (/localhost:5000/.test(u)) apiCalls.localhost++;
    if (r.status() >= 400) errors.push(`[http ${r.status()}] ${u.slice(0, 100)}`);
  });

  const shot = n => page.screenshot({ path: `${SHOTS}/${n}.png` }).catch(() => {});
  const path = () => page.evaluate(() => location.pathname);
  const fill = (sel, val) => page.evaluate(([s, v]) => {
    const el = document.querySelector(s);
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }, [sel, val]);
  const clickText = (sel, txt) => page.evaluate(([s, t]) => {
    const el = [...document.querySelectorAll(s)].find(e => e.textContent.trim().includes(t));
    if (el) { el.click(); return true; } return false;
  }, [sel, txt]);
  const waitForPath = async (want, ms) => {
    for (let t = 0; t < ms; t += 500) { if ((await path()) === want) return true; await sleep(500); }
    return false;
  };

  // fresh app state — landing
  await sleep(1000);
  ok('fresh install: landing renders', await page.evaluate(() => !!document.querySelector('.hero h1')), await path());

  // LOGIN
  await clickText('a,button', 'Student Login');
  await sleep(2000);
  await fill('input[type="text"]', '192221001');
  await fill('input[type="password"]', 'student123');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /login/i.test(b.textContent))?.click());
  ok('LOGIN (fresh install, live API)', await waitForPath('/dashboard', 90000), await path());
  await sleep(3000);
  await shot('01-dashboard');

  // DASHBOARD
  const stats = await page.evaluate(() => document.querySelectorAll('.stat-card').length);
  const welcome = await page.evaluate(() => document.querySelector('.main-content h2, .welcome-card h2')?.textContent || '');
  ok('DASHBOARD stats + welcome', stats >= 4 && welcome.length > 0, `${stats} cards, "${welcome.trim().slice(0, 30)}"`);

  // NAVIGATION + REQUESTS
  await clickText('.bottom-nav a', 'Requests');
  await sleep(2500);
  ok('NAVIGATION bottom-nav -> /requests', (await path()) === '/requests');
  const reqCards = await page.evaluate(() => document.querySelectorAll('.req-card').length);
  ok('REQUESTS page renders (live data)', await page.evaluate(() => (document.querySelector('.page-header h2')?.textContent || '').includes('Request')), `${reqCards} request cards`);
  await shot('02-requests');

  // CHATBOT
  await page.evaluate(() => document.querySelector('.bottom-nav .bn-fab')?.click());
  await sleep(2500);
  const before = await page.evaluate(() => document.querySelectorAll('.msg').length);
  await fill('.chat-input', 'exam schedule');
  await page.evaluate(() => document.querySelector('.send-btn')?.click());
  await sleep(8000);
  const after = await page.evaluate(() => document.querySelectorAll('.msg').length);
  const reply = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.msg.bot .msg-bubble')];
    return (b[b.length - 1]?.textContent || '').slice(0, 60);
  });
  ok('CHATBOT live round-trip', after >= before + 2, `"${reply}"`);
  await shot('03-chat');

  // PROFILE
  await clickText('.bottom-nav a', 'Profile');
  await sleep(3000);
  ok('PROFILE page renders', (await path()) === '/profile');
  const profName = await page.evaluate(() => {
    const h = [...document.querySelectorAll('.main-content h2, .main-content h3')];
    return (h.find(e => e.textContent.trim().length > 2)?.textContent || '').trim();
  });
  ok('PROFILE shows student data (live API)', profName.length > 2, profName.slice(0, 40));
  await shot('04-profile');

  // LOGOUT (via UI)
  const loggedOut = await page.evaluate(() => {
    const el = [...document.querySelectorAll('a,button')].find(e => /logout/i.test(e.textContent) && e.offsetParent !== null);
    if (el) { el.click(); return true; } return false;
  });
  await sleep(3000);
  const tokenGone = await page.evaluate(() => !localStorage.getItem('ca_token'));
  ok('LOGOUT clears session -> /login', loggedOut && tokenGone && (await path()) === '/login', await path());
  await shot('05-after-logout');

  // ADMIN
  await fill('input[type="text"]', 'ADMIN01');
  await fill('input[type="password"]', 'admin@123');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /login/i.test(b.textContent))?.click());
  ok('ADMIN login -> /admin', await waitForPath('/admin', 60000), await path());
  await sleep(4000);
  ok('ADMIN overview stats (live DB reads)', await page.evaluate(() => document.querySelectorAll('.stat-card').length) >= 4);
  await page.evaluate(() => document.querySelector('.menu-btn')?.click());
  await sleep(800);
  await clickText('.sidebar-nav a', 'Requests');
  await sleep(2500);
  const adminRows = await page.evaluate(() => document.querySelectorAll('table tbody tr, .req-card').length);
  ok('ADMIN Requests tab (live data)', adminRows > 0, `${adminRows} rows`);
  await shot('06-admin');

  // token sanity: authed API reads worked the whole session
  console.log(`\nAPI TRAFFIC: ${apiCalls.prod} requests to production API, ${apiCalls.localhost} to localhost:5000`);
  console.log('DEVICE ERRORS:', errors.length ? '\n' + errors.join('\n') : '(none)');
  browser.disconnect();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
