/** Render CampusAssist branding source assets (icon + splash) via headless Chromium.
 *  Colors/gradient/glyph match the in-app .logo-icon (global.css). */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = 'C:/Users/LENOVO/OneDrive/Desktop/college-helpdesk-chatbot/frontend/assets';
fs.mkdirSync(OUT, { recursive: true });

const GRAD = 'linear-gradient(135deg, #89AACC 0%, #4E85BF 55%, #2D6499 100%)';
const html = `<!doctype html><meta charset="utf-8"><style>
  * { margin:0; padding:0; }
  body { background:transparent; font-family:'Segoe UI',system-ui,sans-serif; }
  .stage { position:relative; }
  /* full icon: gradient bleed + glyph */
  #icon { width:1024px; height:1024px; background:${GRAD};
          display:flex; align-items:center; justify-content:center; }
  #icon .glyph { font-size:560px; line-height:1; filter:drop-shadow(0 24px 48px rgba(13,32,54,.35)); }
  /* adaptive foreground: transparent, glyph inside ~52% safe zone */
  #fg { width:1024px; height:1024px; background:transparent;
        display:flex; align-items:center; justify-content:center; }
  #fg .glyph { font-size:430px; line-height:1; filter:drop-shadow(0 18px 36px rgba(13,32,54,.35)); }
  /* adaptive background: gradient only */
  #bg { width:1024px; height:1024px; background:${GRAD}; }
  /* splash 2732x2732: app dark theme bg, logo tile + wordmark */
  #splash { width:2732px; height:2732px; background:#0b1320;
            display:flex; flex-direction:column; align-items:center; justify-content:center; gap:96px; }
  #splash .tile { width:560px; height:560px; border-radius:128px; background:${GRAD};
                  display:flex; align-items:center; justify-content:center;
                  box-shadow:0 48px 140px rgba(78,133,191,.45); }
  #splash .tile .glyph { font-size:330px; line-height:1; }
  #splash h1 { color:#f4f7fb; font-size:170px; font-weight:800; letter-spacing:-2px; }
  #splash p  { color:#89AACC; font-size:64px; font-weight:500; letter-spacing:10px; text-transform:uppercase; }
  #splash .text { text-align:center; display:flex; flex-direction:column; gap:40px; }
</style>
<div class="stage" id="icon"><div class="glyph">🎓</div></div>
<div class="stage" id="fg"><div class="glyph">🎓</div></div>
<div class="stage" id="bg"></div>
<div class="stage" id="splash">
  <div class="tile"><div class="glyph">🎓</div></div>
  <div class="text"><h1>CampusAssist</h1><p>Smart Campus Management System</p></div>
</div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2800, height: 2800 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.waitForTimeout(800);
  const grab = async (sel, file, transparent = false) => {
    await page.locator(sel).screenshot({ path: `${OUT}/${file}`, omitBackground: transparent });
    console.log('wrote', file);
  };
  await grab('#icon', 'icon-only.png');
  await grab('#fg', 'icon-foreground.png', true);
  await grab('#bg', 'icon-background.png');
  await grab('#splash', 'splash.png');
  await grab('#splash', 'splash-dark.png');
  await browser.close();
})();
