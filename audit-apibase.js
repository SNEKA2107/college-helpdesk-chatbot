/** Smoke: web login still works after API_BASE hardening, and a simulated
 *  Capacitor origin (https://localhost equivalent) resolves to the hosted API. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

  // Web path: backend-served build at localhost:5000 must still use same-origin /api
  await page.goto('http://localhost:5000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="text"]', '22IT101');
  await page.fill('input[type="password"]', 'student123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 20000 });
  console.log('WEB LOGIN OK ->', page.url(), '| console errors:', errs.length);

  // Simulated device check: evaluate the resolver logic for each origin shape
  const matrix = await page.evaluate(() => {
    const PROD = 'https://college-helpdesk-chatbot-l4bk.onrender.com/api';
    function resolve(protocol, hostname, port, hasCapacitor) {
      if (hasCapacitor) return PROD;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      if (isLocal && (protocol === 'https:' || protocol === 'capacitor:')) return PROD;
      if (isLocal && port !== '5000') return 'http://localhost:5000/api';
      return '/api';
    }
    return {
      androidNormal:   resolve('https:', 'localhost', '', true),
      androidNoBridge: resolve('https:', 'localhost', '', false),
      iosNoBridge:     resolve('capacitor:', 'localhost', '', false),
      viteDev:         resolve('http:', 'localhost', '5173', false),
      backendServed:   resolve('http:', 'localhost', '5000', false),
      render:          resolve('https:', 'college-helpdesk-chatbot-l4bk.onrender.com', '', false),
    };
  });
  console.log(JSON.stringify(matrix, null, 2));
  await browser.close();
})();
