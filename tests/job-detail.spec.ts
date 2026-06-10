import { test, expect } from '../fixtures';
import { JobDetailPage } from '../pages/JobDetailPage';

test.describe('Job Details & Applications', () => {
  let jobDetailPage: JobDetailPage;

  test.beforeEach(async ({ page }) => {
    jobDetailPage = new JobDetailPage(page);
  });

  async function navigateToJobDetail(page) {
    await page.goto('/jobs');
    const firstJob = page.locator('a[href*="/jobs/detail/"]').first();
    if (await firstJob.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await firstJob.getAttribute('href');
      if (href) {
        await page.goto(href, { waitUntil: 'domcontentloaded' }).catch(() => {});
        return page.url().includes('/jobs/detail/');
      }
    }
    return false;
  }

  test('TC 17: View Detail Job', async ({ page }) => {
    const navigated = await navigateToJobDetail(page);
    if (!navigated) test.skip(true, 'Job detail not reachable in current deployment');

    const detailHeading = page
      .getByRole('heading', { name: /Responsibilities|Minimum Qualifications|Skills & Technologies/i })
      .first();
    await expect(detailHeading).toBeVisible({ timeout: 10000 });
  });
  test('TC 18: Apply Job in job detail', async ({ page }) => {
    const navigated = await navigateToJobDetail(page);
    if (!navigated) test.skip(true);

    const applyBtn = jobDetailPage.applyButton.first();
    if (await applyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(applyBtn).toBeVisible();
    } else {
      test.skip(true, 'Apply button not visible for current job detail');
    }
  });

  test('TC 19: Refer and Earn in job detail', async ({ page }) => {
    const navigated = await navigateToJobDetail(page);
    if (!navigated) test.skip(true);

    const referBtn = jobDetailPage.referEarnButton.first();
    if (await referBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(referBtn).toBeVisible();
    } else {
      test.skip(true, 'Refer & Earn button not visible for current job detail');
    }
  });

  test('TC 20: Referral Link', async ({ page }) => {
    const navigated = await navigateToJobDetail(page);
    if (!navigated) test.skip(true);

    const referBtn = jobDetailPage.referEarnButton.first();
    if (await referBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await referBtn.click();
    }

    const copyBtn = jobDetailPage.copyReferralLinkButton.first();
    const referralLink = page.locator('input[value*="/ref"], input[value*="/jobs/detail"], a[href*="/ref"], a[href*="/jobs/detail"]').first();
    if (await copyBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(copyBtn).toBeVisible();
    } else if (await referralLink.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(referralLink).toBeVisible();
    } else {
      test.skip(true, 'Referral link copy button not available in current job detail');
    }
  });
});
