import { expect, Page } from '@playwright/test';

export const guestStorageState = { cookies: [], origins: [] };

async function clickFirstVisible(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
      const clicked = await locator
        .click({ timeout: 5000, force: true })
        .then(() => true)
        .catch(() => false);
      if (clicked) {
        return true;
      }
    }
  }
  return false;
}

async function clickFirstVisibleRoleButton(page: Page, names: RegExp[]) {
  for (const name of names) {
    const locator = page.getByRole('button', { name }).first();
    if (await clickIfVisible(locator, 5000)) {
      return true;
    }
  }
  return false;
}

async function clickIfVisible(locator: ReturnType<Page['locator']>, timeout = 3000) {
  if (!(await locator.isVisible({ timeout }).catch(() => false))) {
    return false;
  }

  return locator
    .click({ timeout, force: true })
    .then(() => true)
    .catch(() => false);
}

async function openSocialOptions(modal: ReturnType<Page['locator']>) {
  const socialLogin = modal.getByRole('button', { name: /social login/i }).first();
  if (await clickIfVisible(socialLogin)) {
    return true;
  }

  const firstWalletOption = modal.locator('li button').first();
  return clickIfVisible(firstWalletOption);
}

function socialLoginReadyLocator(modal: ReturnType<Page['locator']>) {
  return modal
    .locator('input[type="email"], input[placeholder*="email" i]')
    .or(modal.getByRole('button', { name: /email|social login|google|github|discord|telegram|wallet|connect/i }))
    .first();
}

export async function openAuthModal(page: Page) {
  await page.goto('/?signin=true', { waitUntil: 'domcontentloaded' });

  const modal = page.getByRole('dialog').or(page.locator('.tw-modal')).first();

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await modal.isVisible({ timeout: 1500 }).catch(() => false)) {
      const hasModalContent =
        (await modal.getByRole('button').first().isVisible({ timeout: 1000 }).catch(() => false)) ||
        (await modal.locator('input[type="email"], input[placeholder*="email" i]').first().isVisible({ timeout: 1000 }).catch(() => false));
      if (hasModalContent) {
        return modal;
      }
    }

    const opened =
      (await clickFirstVisibleRoleButton(page, [/^Sign In$/i, /^Sign in$/i, /Connect Wallet/i])) ||
      (await clickFirstVisible(page, [
        'button:has-text("Sign In")',
        'button:has-text("Sign in")',
        'button:has-text("Connect Wallet")',
        '#connect-button-thirdweb button',
        'header img',
        '[role="banner"] img',
        'body > div:first-child img',
      ]));
    expect(opened, 'Connect/sign-in trigger should be visible').toBeTruthy();
    await page.waitForTimeout(500);
  }

  await expect(modal).toBeVisible({ timeout: 15000 });
  return modal;
}

export async function openSocialLogin(page: Page) {
  const modal = await openAuthModal(page);
  const ready = socialLoginReadyLocator(modal);
  if (await ready.isVisible({ timeout: 1000 }).catch(() => false)) {
    return modal;
  }

  if (!(await openSocialOptions(modal))) {
    await page.getByRole('button', { name: /^Sign In$/i }).first().click({ timeout: 5000, force: true }).catch(() => {});
    await expect(modal).toBeVisible({ timeout: 10000 });
    expect(await openSocialOptions(modal), 'Social login option should be reachable').toBeTruthy();
  }
  await expect(ready, 'Social login form or provider options should be visible').toBeVisible({ timeout: 10000 });
  return modal;
}

export async function expectAuthProvider(page: Page, providerName: RegExp) {
  const modal = await openSocialLogin(page);
  const provider = modal.getByRole('button', { name: providerName }).first();
  if (!(await provider.isVisible({ timeout: 3000 }).catch(() => false))) {
    await openSocialOptions(modal);
  }
  await expect(provider).toBeVisible({ timeout: 10000 });
}
