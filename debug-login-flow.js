const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => console.log(`[pageerror] ${e.message}`));
  page.on('requestfailed', r => console.log(`[requestfailed] ${r.url()} -> ${r.failure() && r.failure().errorText}`));
  page.on('response', r => { if (r.status() >= 400) console.log(`[http ${r.status()}] ${r.url()}`); });
  page.on('framenavigated', f => { if (f === page.mainFrame()) console.log(`[nav] ${f.url()}`); });

  await page.goto('https://college-helpdesk-chatbot-l4bk.onrender.com/login.html', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.fill('#studentId', '192221001');
  await page.fill('#password', 'student123');
  await page.click('#loginBtn');
  await page.waitForTimeout(8000);

  console.log(`FINAL URL: ${page.url()}`);
  const alertText = await page.evaluate(() => {
    const a = document.getElementById('alertBox');
    return a && a.classList.contains('show') ? a.textContent : null;
  }).catch(() => null);
  if (alertText) console.log(`LOGIN ALERT: ${alertText}`);
  await page.screenshot({ path: 'debug-login-flow.png', fullPage: false });
  console.log('Screenshot saved: debug-login-flow.png');
  await browser.close();
})();
