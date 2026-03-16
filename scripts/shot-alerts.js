/** Re-take ch07-alerts-config.png with emails/IPs blurred */
const { chromium } = require('playwright');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'docs', 'images');

const BLUR_SCRIPT = `(function(){
  const IP_RE=/^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)(?::\\d+)?$/;
  const EMAIL_RE=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  const HOST_RE=/^(?:[a-z0-9][-a-z0-9]*\\.)+(?:local|internal|corp|lan|io|com|net|org|cn|dev)(?::\\d+)?$/i;

  // Blur leaf elements whose trimmed text matches sensitive patterns
  document.querySelectorAll('*').forEach(el=>{
    if(['SCRIPT','STYLE','HEAD','HTML','BODY','SVG','PATH'].includes(el.tagName))return;
    if(el.children.length>2)return;
    const txt=(el.textContent||'').trim();
    if(!txt||txt.length>120)return;
    if(IP_RE.test(txt)||EMAIL_RE.test(txt)||HOST_RE.test(txt)){
      el.style.filter='blur(6px)';
      el.style.userSelect='none';
      el.style.pointerEvents='none';
    }
  });

  // Also blur input fields that contain emails or IPs
  document.querySelectorAll('input,textarea').forEach(el=>{
    const val=(el.value||'').trim();
    if(EMAIL_RE.test(val)||IP_RE.test(val)){
      el.style.filter='blur(6px)';
      el.style.color='transparent';
      el.style.textShadow='0 0 8px rgba(0,0,0,0.5)';
    }
    // Also blur by placeholder hint
    const ph=(el.placeholder||'').toLowerCase();
    if(ph.includes('email')||ph.includes('smtp')||ph.includes('server')){
      if(val.length>0){
        el.style.filter='blur(6px)';
        el.style.color='transparent';
        el.style.textShadow='0 0 8px rgba(0,0,0,0.5)';
      }
    }
  });

  // Catch inline text nodes containing email pattern
  const EMAIL_INLINE=/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/g;
  document.querySelectorAll('span,p,div,td,label,.el-form-item__content').forEach(el=>{
    if(el.children.length>0)return;
    const txt=(el.textContent||'').trim();
    if(EMAIL_INLINE.test(txt)){
      EMAIL_INLINE.lastIndex=0;
      el.style.filter='blur(6px)';
      el.style.userSelect='none';
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

  // Navigate to alerts page
  await page.goto('http://localhost:5173/alerts');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  // Apply blur
  await page.evaluate(BLUR_SCRIPT);
  await page.waitForTimeout(300);

  await page.screenshot({ path: path.join(IMAGES_DIR, 'ch07-alerts-config.png') });
  console.log('✓ ch07-alerts-config.png saved');

  await browser.close();
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
