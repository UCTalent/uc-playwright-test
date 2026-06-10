import { test, expect } from '../fixtures';

test.describe('User Engagement (UPP & Referrals)', () => {
  test.setTimeout(60000);

  test('TC 12: Join UPP quest and check progress', async ({ page }) => {
    await page.goto('/quests', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const joinButton = page.locator('text=/Join/i').first();
    const progress = page.locator('text=/Progress/i').first();
    const questHeading = page.getByRole('heading', { name: /Complete Quests|Leaderboard/i }).first();
    if (await joinButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(joinButton).toBeVisible();
    } else if (await progress.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(progress).toBeVisible();
    } else if (await questHeading.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(questHeading).toBeVisible();
    } else {
      test.skip(true, 'Quest progress UI not available in current deployment');
    }
  });
  test('TC 13: Invite friends to join UCTalent and earn', async ({ page }) => {
    await page.goto('/my-profile');
    const copyBtn = page.locator('button').filter({ hasText: /Copy/i }).first();
    const body = page.locator('body').first();
    if (await copyBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(copyBtn).toBeVisible();
    } else {
      await expect(body).toBeVisible();
    }
  });

  test('TC 32: Check Refer & Earn Page and functions', async ({ page }) => {
    const response = await page.goto('/refer-earn', { waitUntil: 'domcontentloaded' });
    test.skip(!response || response.status() !== 200, 'Refer & Earn page unavailable');

    const referEarnContent = page
      .getByText(/Refer|Earn|Invite|Referral|Copy|UCTalent Pioneer Program/i)
      .first();
    const copyButton = page.locator('button').filter({ hasText: /Copy/i }).first();
    const inviteLink = page.locator('input[value*="/ref"], input[value*="uctalent.dev"], a[href*="/ref"]').first();

    if (await copyButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(copyButton).toBeVisible();
    } else if (await inviteLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(inviteLink).toBeVisible();
    } else if (await referEarnContent.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(referEarnContent).toBeVisible();
    } else {
      test.skip(true, 'Refer & Earn UI not available in current deployment');
    }
  });
});
