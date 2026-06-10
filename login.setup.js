const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config();

function waitForEnter(promptText) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(promptText, () => {
    rl.close();
    resolve();
  }));
}

(async () => {
  const cdpUrl = process.env.CHROME_CDP_URL;
  const userDataDir =
    process.env.CHROME_USER_DATA_DIR ||
    path.join(process.env.HOME || process.env.USERPROFILE || '', 'Library', 'Application Support', 'Google', 'Chrome');
  const chromeProfileDir = process.env.CHROME_PROFILE_DIR || 'Default';
  const useChromeProfile = process.env.USE_EXISTING_CHROME_PROFILE === 'true';
  const sessionDir = path.join(__dirname, '.auth');

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const baseURL = process.env.FRONTEND_URL || 'https://uctalent.dev';
  const email = process.env.TEST_GOOGLE_EMAIL;
  const password = process.env.TEST_GOOGLE_PASSWORD;

  console.log('🔐 UCTalent E2E Tests - Auto Login Setup');
  console.log('═══════════════════════════════════════════');
  console.log('📍 Base URL:', baseURL);
  console.log('👤 Test Account:', email ? `${email.split('@')[0]}@...` : 'NOT SET');
  console.log('═══════════════════════════════════════════\n');

  if (!email || !password) {
    console.error('❌ ERROR: TEST_GOOGLE_EMAIL or TEST_GOOGLE_PASSWORD not set in .env file');
    process.exit(1);
  }

  let browser;
  let context;

  if (cdpUrl) {
    console.log('🔌 Connecting over CDP:', cdpUrl);
    browser = await chromium.connectOverCDP(cdpUrl);
    context = browser.contexts()[0];
    if (!context) {
      throw new Error('No existing browser context found on the connected Chrome instance.');
    }
  } else if (useChromeProfile) {
    const profilePath = path.join(userDataDir, chromeProfileDir);
    context = await chromium.launchPersistentContext(profilePath, {
      baseURL,
      headless: false,
      viewport: null,
      slowMo: 100,
      channel: 'chrome',
    });
    browser = context.browser();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  } else {
    context = await chromium.launchPersistentContext(sessionDir, {
      baseURL,
      headless: false,
      viewport: null,
      slowMo: 100,
      channel: 'chrome',
    });
    browser = context.browser();
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  const page = context.pages()[0] || await context.newPage();

  const waitForEither = async (selectors, timeout = 10000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      for (const selector of selectors) {
        const visible = await page.locator(selector).first().isVisible({ timeout: 500 }).catch(() => false);
        if (visible) return selector;
      }
      await page.waitForTimeout(250);
    }
    return null;
  };

  try {
    console.log('🌐 Navigating to signin page...');
    await page.goto('/?signin=true', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('⏳ Looking for Social Login button...');
    const socialLoginButton = page.getByRole('button', { name: /social login/i }).first();
    if (await socialLoginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('🔐 Opening Social Login...');
      await socialLoginButton.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('⚠️  Social Login button not visible yet. Continuing with current view.');
    }

    console.log('📧 Filling email...');
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    await emailInput.fill(email, { force: true });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const verifyStage = await waitForEither([
      'form:has-text("Enter the verification code")',
      'text=Enter the verification code',
      'button:has-text("Verify")',
      'input[autocomplete="one-time-code"]',
    ], 15000);

    if (verifyStage) {
      console.log('🧾 Verification screen detected.');
      console.log('   Enter the code in the browser, then press Enter here to continue.\n');
      await waitForEnter('Press Enter after you submit the verification code...');
      await page.waitForTimeout(3000);
    } else {
      console.log('⚠️  Verification screen did not appear immediately.');
    }

    console.log('🔍 Verifying login status...');
    const currentUrl = page.url();
    console.log('📍 Current page:', currentUrl);

    const hasLogoutBtn = await page.locator('button:has-text("Logout"), button:has-text("Disconnect")').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasProfile = await page.locator('[data-testid*="profile"], [data-testid*="account"], .user-menu').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasLogoutBtn || hasProfile) {
      console.log('✅ Login successful! User is authenticated.\n');
    } else {
      console.log('⚠️  Could not verify login status, but session may still be saved.\n');
    }
  } catch (error) {
    console.error('❌ Error during login setup:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   - FRONTEND_URL:', baseURL);
    console.log('   - TEST_GOOGLE_EMAIL:', email ? `${email.split('@')[0]}@...` : 'NOT SET');
    console.log('   - Check network connectivity');
    console.log('   - Verify Google account is not locked');
    console.log('   - Try again after a few moments\n');
    process.exitCode = 1;
  } finally {
    if (!cdpUrl) {
      console.log('ℹ️  Close the browser window when you are done reviewing the session.');
    }
    console.log('🚀 You can now run your tests: npm test\n');
    if (browser && !cdpUrl) {
      try {
        await browser.close();
      } catch (closeError) {}
    }
  }
})();
