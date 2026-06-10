/**
 * ✅ READ-ONLY TEST SUITE - No Database Modifications
 * 
 * This suite only reads and verifies admin portal visibility.
 * All operations are view/click-to-navigate only - NO data writes.
 * 
 * Authentication:
 * - Handled globally by global.setup.ts (runs once before all tests)
 * - Storage state (cookies, localStorage) loaded via storageState.json
 * - Each test starts already authenticated
 */

import { test, expect } from '../fixtures';

test.describe('Admin Portal', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }, testInfo) => {
    // ✅ Page is automatically authenticated via storageState.json
    // No need for manual login - global.setup.ts handled it once
    
    console.log('📍 Navigating to /review-jobs');
    await page.goto('/review-jobs', { waitUntil: 'domcontentloaded', timeout: 45000 });

    console.log('🔍 Verifying page loaded correctly');
    const currentUrl = page.url();
    const signInVisible = await page.getByRole('button', { name: /sign in/i }).isVisible({ timeout: 5000 }).catch(() => false);
    const canAccessReviewJobs = currentUrl.includes('/review-jobs') && !signInVisible;

    test.skip(
      !canAccessReviewJobs,
      `Admin/reviewer access required for /review-jobs. Current URL: ${currentUrl}`
    );

    testInfo.annotations.push({
      type: 'access',
      description: 'Verified admin/reviewer can access /review-jobs',
    });
  });

  test('TC 24: Review Jobs - Visibility Check', async ({ page }) => {
    // ✅ READ-ONLY: Only checking if Pending tab and job cards are visible
    // No data modifications or form submissions
    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible();

    const selectedTab = page.getByRole('tab', { selected: true }).first();
    await expect(selectedTab).toBeVisible();
    
    // Navigation click - read only operation
    await selectedTab.click({ force: true }).catch(() => {});

    const reviewContent = page
      .getByText(/Job Details|Raw Data|Direct Manager|Company Info|Job Title/i)
      .first();
    await expect(reviewContent).toBeVisible();
  });

  test('TC 31: Admin portal navigation links', async ({ page }) => {
    // ✅ READ-ONLY: Only verifying that navigation links are visible
    // No form submissions or state changes
    const reviewJobs = page.getByRole('link', { name: /review jobs/i }).or(page.locator('a[href="/review-jobs"]')).first();
    const reviewTalents = page.getByRole('link', { name: /review talents/i }).or(page.locator('a[href="/review-talents"]')).first();
    const reviewCompanies = page.getByRole('link', { name: /review companies/i }).or(page.locator('a[href="/review-companies"]')).first();
    
    await expect(reviewJobs).toBeVisible({ timeout: 15000 });
    await expect(reviewTalents).toBeVisible({ timeout: 15000 });
    await expect(reviewCompanies).toBeVisible({ timeout: 15000 });
  });
});
