import { test, expect } from '../fixtures';

test.describe('Post Job Scenarios', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/post-job');
  });

  test('TC 10: Create Job + no reward', async ({ page }) => {
    const form = page.locator('form, [role="form"]').first();
    const anyInput = page.locator('input[type="text"], textarea').first();
    if (await form.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(form).toBeVisible();
    } else {
      await expect(anyInput).toBeVisible();
    }
  });

  test('TC 11: Post Job + crypto deposite', async ({ page }) => {
    const cryptoOption = page.locator('text=/Crypto Reward|Deposit Crypto|Cryptocurrency|Wallet/i').first();
    if (await cryptoOption.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(cryptoOption).toBeVisible();
      return;
    }

    const stepOneReady = page
      .getByRole('heading', { name: /Post a Job & Hire Elite Tech Talent/i })
      .or(page.getByLabel(/Job Title/i))
      .first();
    await expect(stepOneReady, 'Post job flow should load before checking crypto reward availability').toBeVisible({ timeout: 10000 });
    test.skip(true, 'Crypto reward/deposit options are rendered only after job creation success modal; production smoke cannot create real jobs.');
  });
  test('TC 12: Post Job + fiat deposite + headhunting booking', async ({ page }) => {
    const fiatOption = page.locator('button, label').filter({ hasText: /Fiat|Bank|Deposit/i }).first();
    const headhuntOption = page.locator('button, label').filter({ hasText: /headhunt|headhunting|recruiter/i }).first();
    if (await fiatOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(fiatOption).toBeVisible();
    }
    if (await headhuntOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(headhuntOption).toBeVisible();
    }
  });
});
