/** Re-take ch06-dependency-graph.png with project-001 selected */
const { chromium } = require('playwright');

const IMAGES_DIR = require('path').join(__dirname, '..', 'docs', 'images');
const BLUR_SCRIPT = `(function(){
  const IP_RE=/^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)(?::\\d+)?$/;
  const HOST_RE=/^(?:[a-z0-9][-a-z0-9]*\\.)+(?:local|internal|corp|lan|io|com|net|org|cn|dev)(?::\\d+)?$/i;
  document.querySelectorAll('*').forEach(el=>{
    if(['SCRIPT','STYLE','HEAD','HTML','BODY','SVG','PATH'].includes(el.tagName))return;
    if(el.children.length>2)return;
    const txt=(el.textContent||'').trim();
    if(!txt||txt.length>80)return;
    if(IP_RE.test(txt)||HOST_RE.test(txt)){el.style.filter='blur(6px)';el.style.userSelect='none';}
  });
  document.querySelectorAll('p,span,.el-link,a').forEach(el=>{
    const txt=(el.textContent||'').trim();
    if(/\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b/.test(txt)||/https?:\\/\\/[^\\s"'<>]+/.test(txt)){
      el.style.filter='blur(6px)';el.style.userSelect='none';
    }
  });
})();`;

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));

  // Login
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  await page.fill('input[placeholder="Enter your username or email"]', 'admin');
  await page.fill('input[placeholder="Enter your password"]', 'admin123');
  await page.click('button:has-text("Sign In")');
  await page.waitForURL('http://localhost:5173/');
  await page.waitForTimeout(1000);

  // Go to graph page with All Projects first
  await page.goto('http://localhost:5173/graph');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // Open project selector dropdown
  await page.locator('.project-selector .selector-button').click({ timeout: 5000 });
  await page.waitForTimeout(700);

  // Click "project-001" in dropdown
  await page.locator('li.el-dropdown-menu__item').filter({ hasText: 'project-001' }).click({ timeout: 5000 });
  await page.waitForTimeout(3000); // wait for graph to fully render

  // Blur sensitive data
  await page.evaluate(BLUR_SCRIPT);
  await page.waitForTimeout(300);

  await page.screenshot({ path: require('path').join(IMAGES_DIR, 'ch06-dependency-graph.png') });
  console.log('✓ ch06-dependency-graph.png saved');

  await browser.close();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
