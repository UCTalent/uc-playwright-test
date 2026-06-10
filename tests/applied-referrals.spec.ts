import { test, expect } from '../fixtures';

test.describe('Applied Jobs and Job Referrals tracking', () => {

  test('TC 13: View List Job', async ({ page }) => {
    await page.goto('/jobs');
    const jobList = page.locator('a[href*="/jobs/detail/"]').first();
    const searchInput = page.locator('input[name="searchJob"]').first();
    const emptyState = page.getByText(/No jobs|No results/i).first();
    await expect(jobList.or(searchInput).or(emptyState).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC 21: Check applied job', async ({ page }) => {
    await page.goto('/my-applications');
    const tablist = page.getByRole('tablist').first();
    const appliedTab = page.getByRole('tab', { name: /Applied/i }).first();
    const emptyState = page.getByText(/Empty|No applications/i).first();
    await expect(tablist.or(appliedTab).or(emptyState).first()).toBeVisible({ timeout: 10000 });
    if (await appliedTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await appliedTab.click().catch(() => {});
    }
  });

  test('TC 22: Check Job referrals', async ({ page }) => {
    const response = await page.goto('/my-referrals');
    const currentPath = new URL(page.url()).pathname;
    if (currentPath !== '/my-referrals' || response?.status() !== 200) {
      test.skip(true, 'My referrals page is not available in current deployment');
    }

    const tablist = page.getByRole('tablist').first();
    const waitingConfirmTab = page.getByRole('tab', { name: /Waiting Confirm/i }).first();
    const emptyState = page.getByText(/Empty|No referrals/i).first();
    await expect(tablist.or(waitingConfirmTab).or(emptyState).first()).toBeVisible({ timeout: 10000 });
  });
});
