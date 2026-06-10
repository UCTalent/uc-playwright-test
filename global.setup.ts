/**
 * 🔐 Global Setup - Playwright Standard Authentication
 */

import { chromium, FullConfig, Browser, BrowserContext } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

const AUTH_MODE = (process.env.CI_AUTH_MODE || 'reuse').toLowerCase();

async function openBrowser(): Promise<{ browser: Browser; context: BrowserContext; cdpMode: boolean }> {
  const cdpUrl = process.env.CHROME_CDP_URL;
  if (cdpUrl) {
    console.log('🔌 Connecting over CDP:', cdpUrl);
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error('No existing browser context found on the connected Chrome instance.');
    }
    return { browser, context, cdpMode: true };
  }

  const browser = await chromium.launch({ headless: false, slowMo: 100, channel: 'chrome' });
  const context = await browser.newContext({ viewport: null });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return { browser, context, cdpMode: false };
}

async function waitForEither(page: any, selectors: string[], timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const selector of selectors) {
      const visible = await page.locator(selector).first().isVisible({ timeout: 500 }).catch(() => false);
      if (visible) return selector;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function waitForVerificationToComplete(page: any, timeout = 180000) {
  const verificationSelectors = [
    'form:has-text("Enter the verification code")',
    'text=Enter the verification code',
    'button:has-text("Verify")',
    'input[autocomplete="one-time-code"]',
  ];
  const end = Date.now() + timeout;

  while (Date.now() < end) {
    const stillVerifying = await waitForEither(page, verificationSelectors, 1000);
    if (!stillVerifying) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
      return;
    }
    await page.waitForTimeout(500);
  }

  throw new Error('Verification did not complete before timeout.');
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isStorageStateValid(baseURL: string, storageStatePath: string) {
  if (!(await fileExists(storageStatePath))) {
    return false;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: storageStatePath });
  const page = await context.newPage();

  try {
    await page.goto(`${baseURL}/review-jobs`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const adminText = page
      .getByText(/Review Jobs|Pending|Job Title|Recruitment Suite|Posted Jobs|ATS|Candidate/i)
      .first();
    const walletButton = page.locator('button').filter({ hasText: /0x[a-fA-F0-9]{4}/ }).first();
    const authButton = page.getByRole('button', { name: /sign in|login|connect wallet/i }).first();

    const hasSignedInUi =
      (await adminText.isVisible({ timeout: 1500 }).catch(() => false)) ||
      (await walletButton.isVisible({ timeout: 1500 }).catch(() => false));
    const hasAuthWall = await authButton.isVisible({ timeout: 1500 }).catch(() => false);

    return hasSignedInUi || (page.url().includes('/review-jobs') && !hasAuthWall);
  } catch (error) {
    console.warn(
      '⚠️  Existing auth state validation failed:',
      error instanceof Error ? error.message : error,
    );
    return false;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function globalSetup(_config: FullConfig) {
  console.log('\n🔐 Running Global Setup - Authentication...\n');

  const baseURL = process.env.FRONTEND_URL || process.env.BASE_URL || 'https://uctalent.dev';
  const storageStatePath = path.join(__dirname, 'storageState.json');
  const refreshAuth = AUTH_MODE === 'refresh';

  console.log('📍 Base URL:', baseURL);
  console.log('🔁 Auth mode:', refreshAuth ? 'refresh' : 'reuse');

  if (!refreshAuth && (await isStorageStateValid(baseURL, storageStatePath))) {
    console.log('✅ Existing storageState.json is valid. Skipping login.\n');
    return;
  }

  if (!refreshAuth) {
    throw new Error(
      [
        'Existing auth state is missing or expired.',
        `Expected file: ${storageStatePath}`,
        'Run CI_AUTH_MODE=refresh npm run auth:refresh once in playwright-tests, complete verification,',
        'then copy the refreshed storageState.json to the VPS test directory.',
      ].join('\n'),
    );
  }

  const adminEmail = process.env.TEST_GOOGLE_EMAIL || process.env.ADMIN_EMAIL;
  const adminPassword = process.env.TEST_GOOGLE_PASSWORD || process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('Missing TEST_GOOGLE_EMAIL/TEST_GOOGLE_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD');
  }

  console.log('👤 Email:', `${adminEmail.split('@')[0]}@...`);
  console.log('🔑 Password: [hidden]\n');

  const { browser, context, cdpMode } = await openBrowser();
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(`${baseURL}/?signin=true`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const socialLoginButton = page.getByRole('button', { name: /social login/i }).first();
    if (await socialLoginButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await socialLoginButton.click();
      await page.waitForTimeout(1000);
    }

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 30000 });
    await emailInput.fill(adminEmail, { force: true });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const verifyStage = await waitForEither(page, [
      'form:has-text("Enter the verification code")',
      'text=Enter the verification code',
      'button:has-text("Verify")',
      'input[autocomplete="one-time-code"]',
    ], 15000);

    if (verifyStage) {
      console.log('🧾 Verification screen detected. Waiting until manual verification completes...\n');
      await waitForVerificationToComplete(page);
    } else {
      console.log('⚠️  Verification screen did not appear immediately.');
    }

    await page.goto(`${baseURL}/review-jobs`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    const hasAdminAccess = currentUrl.includes('/review-jobs') && !currentUrl.endsWith('/');

    if (!hasAdminAccess) {
      throw new Error(`Authentication did not produce an admin session. Current URL: ${currentUrl}`);
    }

    await context.storageState({ path: storageStatePath });
    console.log('✅ Saved to:', storageStatePath);
    if (cdpMode) {
      console.log('ℹ️  Connected Chrome was used for verification only.');
    }
  } catch (error) {
    console.error('❌ Global setup failed:', error instanceof Error ? error.message : error);
    try {
      await fs.unlink(storageStatePath);
    } catch {}
    throw error;
  } finally {
    try {
      await context.close();
    } catch {}
    if (!cdpMode) {
      try {
        await browser.close();
      } catch {}
    }
  }

  console.log('\n✅ Global Setup Complete!\n');
}

export default globalSetup;
