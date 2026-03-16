/**
 * OpsMonitor Screenshot Script
 * Usage: node scripts/take-screenshots.js
 * Requires: playwright installed in node_modules
 */
const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const IMAGES_DIR = path.join(__dirname, '..', 'docs', 'images');
const VIEWPORT = { width: 1440, height: 900 };

// ── Sensitive data blur helper injected into every page ─────────────────────
// Blurs IPs, internal hostnames, email patterns without breaking Vue reactivity
const BLUR_SCRIPT = `
(function blurSensitiveData() {
  const IP_RE = /^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)(?::\\d+)?$/;
  const HOST_RE = /^(?:[a-z0-9][-a-z0-9]*\\.)+(?:local|internal|corp|lan|intranet|io|com|net|org|cn|dev)(?::\\d+)?$/i;
  const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  const EMAIL_INLINE = /[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/;

  document.querySelectorAll('*').forEach(el => {
    if (['SCRIPT','STYLE','HEAD','HTML','BODY','SVG','PATH'].includes(el.tagName)) return;
    if (el.children.length > 2) return;
    const txt = (el.textContent || '').trim();
    if (!txt || txt.length > 120) return;
    if (IP_RE.test(txt) || HOST_RE.test(txt) || EMAIL_RE.test(txt)) {
      el.style.filter = 'blur(6px)';
      el.style.userSelect = 'none';
      el.style.pointerEvents = 'none';
    }
  });

  // Blur URLs/IPs in paragraphs, spans, links
  document.querySelectorAll('p, span, .el-link, a').forEach(el => {
    const txt = (el.textContent || '').trim();
    if (/\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b/.test(txt) || /https?:\\/\\/[^\\s"'<>]+/.test(txt)) {
      el.style.filter = 'blur(6px)';
      el.style.userSelect = 'none';
      el.style.pointerEvents = 'none';
    }
  });

  // Blur input/textarea with sensitive values
  document.querySelectorAll('input, textarea').forEach(el => {
    const val = (el.value || '').trim();
    if (IP_RE.test(val) || EMAIL_RE.test(val) || EMAIL_INLINE.test(val)) {
      el.style.filter = 'blur(6px)';
      el.style.color = 'transparent';
      el.style.textShadow = '0 0 8px rgba(0,0,0,0.5)';
    }
  });

  // Catch inline email addresses in leaf nodes
  document.querySelectorAll('span,p,div,td,label,.el-form-item__content').forEach(el => {
    if (el.children.length > 0) return;
    const txt = (el.textContent || '').trim();
    if (EMAIL_INLINE.test(txt)) {
      el.style.filter = 'blur(6px)';
      el.style.userSelect = 'none';
    }
  });
})();
`;

async function shot(page, filename, { noBlur = false } = {}) {
  if (!noBlur) {
    await page.evaluate(BLUR_SCRIPT);
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: path.join(IMAGES_DIR, filename), fullPage: false });
  console.log('  ✓', filename);
}

async function settle(page, ms = 1200) {
  try { await page.waitForLoadState('networkidle', { timeout: ms + 1000 }); } catch {}
  await page.waitForTimeout(ms);
}

async function tryClick(page, selector, timeout = 3000) {
  try {
    await page.locator(selector).first().click({ timeout });
    return true;
  } catch { return false; }
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  // dismiss spurious dialogs
  page.on('dialog', d => d.dismiss().catch(() => {}));

  // ── 1. Login page (empty) ────────────────────────────────────────────────
  console.log('[1/11] Login');
  await page.goto(`${BASE_URL}/login`);
  await settle(page, 800);
  await shot(page, 'ch01-login-page.png', { noBlur: true });

  // ── 2. Login page (filled) ───────────────────────────────────────────────
  await page.fill('input[placeholder="Enter your username or email"]', 'admin');
  await page.fill('input[placeholder="Enter your password"]', 'admin123');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(IMAGES_DIR, 'ch01-login-filled.png') });
  console.log('  ✓ ch01-login-filled.png');

  // ── Sign in ───────────────────────────────────────────────────────────────
  await page.click('button:has-text("Sign In")');
  await page.waitForURL(`${BASE_URL}/`);
  await settle(page, 1000);

  // ── 3. Overview Dashboard ────────────────────────────────────────────────
  console.log('[2/11] Dashboard');
  await page.goto(`${BASE_URL}/`);
  await settle(page, 1200);
  await shot(page, 'ch02-dashboard-overview.png');

  // ── 4. Projects list ─────────────────────────────────────────────────────
  console.log('[3/11] Projects');
  await page.goto(`${BASE_URL}/projects`);
  await settle(page, 1000);
  await shot(page, 'ch03-projects-list.png');

  // ── 5. Project selector dropdown ─────────────────────────────────────────
  // Click the .selector-button inside .project-selector (el-dropdown trigger)
  await page.locator('.project-selector .selector-button').click({ timeout: 4000 });
  await page.waitForTimeout(700);
  await shot(page, 'ch03-project-selector-dropdown.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ── 6. Add project dialog ─────────────────────────────────────────────────
  await page.locator('button:has-text("New Project")').first().click({ timeout: 3000 });
  await page.waitForTimeout(900);
  await shot(page, 'ch03-projects-add-dialog.png', { noBlur: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ── 7. Hosts card view ───────────────────────────────────────────────────
  console.log('[4/11] Hosts');
  await page.goto(`${BASE_URL}/hosts`);
  await settle(page, 1000);
  await shot(page, 'ch04-hosts-card-view.png');

  // ── 8. Add host dialog ───────────────────────────────────────────────────
  await page.locator('button:has-text("Add Host")').first().click({ timeout: 3000 });
  await page.waitForTimeout(900);
  await shot(page, 'ch04-hosts-add-dialog.png', { noBlur: true });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ── 9. Services list ─────────────────────────────────────────────────────
  console.log('[5/11] Services');
  await page.goto(`${BASE_URL}/services`);
  await settle(page, 1000);
  await shot(page, 'ch05-services-list.png');

  // ── 10. Add service wizard step 1 ─────────────────────────────────────────
  const addSvcClicked = await tryClick(page, 'button:has-text("Add Service")');
  if (addSvcClicked) {
    await page.waitForTimeout(900);
    await shot(page, 'ch05-add-service-wizard-step1.png', { noBlur: true });

    // Step 2 - click "Next →"
    const nextClicked = await tryClick(page, 'button:has-text("Next →")');
    if (nextClicked) {
      await page.waitForTimeout(700);
      await shot(page, 'ch05-add-service-wizard-step2.png', { noBlur: true });
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else { console.log('  ⚠ add service button not found'); }

  // ── 11. Service edit form ────────────────────────────────────────────────
  // Hover first data row to reveal action buttons, then click Edit
  await page.locator('table tbody tr').first().hover({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  const editClicked = await tryClick(page, 'button:has-text("Edit")');
  if (!editClicked) {
    // Try clicking row's contextual edit button
    await tryClick(page, '.el-button--small.el-button--primary:has-text("Edit"), [class*="service"] button:has-text("Edit")');
  }
  await page.waitForTimeout(900);
  const isDialogOpen = await page.locator('.el-dialog, [role="dialog"]').count() > 0;
  if (isDialogOpen) {
    await shot(page, 'ch05-service-edit-form.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } else { console.log('  ⚠ service edit form not opened'); }

  // ── 12. Dependency graph ─────────────────────────────────────────────────
  console.log('[6/11] Dependency Graph');
  await page.goto(`${BASE_URL}/graph`);
  await settle(page, 2000);
  await shot(page, 'ch06-dependency-graph.png');

  // ── 13. Alert configuration ──────────────────────────────────────────────
  console.log('[7/11] Alerts');
  await page.goto(`${BASE_URL}/alerts`);
  await settle(page, 1000);
  await shot(page, 'ch07-alerts-config.png');

  // ── 14. Security configuration ───────────────────────────────────────────
  console.log('[8/11] Security');
  await page.goto(`${BASE_URL}/security`);
  await settle(page, 1000);
  await shot(page, 'ch08-security-config.png');

  // ── 15. Grafana dashboards ───────────────────────────────────────────────
  console.log('[9/11] Grafana');
  await page.goto(`${BASE_URL}/grafana`);
  await settle(page, 1000);
  await shot(page, 'ch09-grafana-dashboards.png');

  // ── 16. System settings ──────────────────────────────────────────────────
  console.log('[10/11] Settings');
  await page.goto(`${BASE_URL}/settings`);
  await settle(page, 1000);
  await shot(page, 'ch10-settings.png');

  // ── 17. User management ──────────────────────────────────────────────────
  console.log('[11/11] Users');
  await page.goto(`${BASE_URL}/users`);
  await settle(page, 1000);
  await shot(page, 'ch11-users.png');

  await browser.close();
  console.log('\n✅ All screenshots saved to docs/images/');
})().catch(err => { console.error('❌', err.message); process.exit(1); });
