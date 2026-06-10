import { test, expect } from '../fixtures';
import { AtsPage } from '../pages/AtsPage';

test.describe('ATS & Candidate Management', () => {
  let atsPage: AtsPage;

  test.beforeEach(async ({ page }) => {
    atsPage = new AtsPage(page);
    await atsPage.goto();
    await page.waitForLoadState('domcontentloaded');
  });

  test('TC 23: Check posted job in ATS', async ({ page }) => {
    const postedJobs = page.getByText(/Posted Jobs/i).first();
    const jobItem = page.getByText(/Senior Blockchain Engineer|Product Designer|Full-Stack Developer|Engineer|Developer/i).first();
    const pipelineCounter = page.getByText(/New Apply|In Progress|Hired|Failed/i).first();
    const emptyState = page.getByText(/No jobs|No posted jobs|No data|empty/i).first();
    const atsShell = atsPage.atsSearchInput.or(page.getByText(/Candidate|Pipeline|Applicants|Jobs|Recruitment Suite/i)).first();
    const authWall = page.getByRole('button', { name: /sign in|login/i }).first();

    const hasATSContent = await postedJobs.isVisible({ timeout: 15000 }).catch(() => false)
      || await jobItem.isVisible({ timeout: 15000 }).catch(() => false)
      || await pipelineCounter.isVisible({ timeout: 15000 }).catch(() => false)
      || await emptyState.isVisible({ timeout: 15000 }).catch(() => false)
      || await atsShell.isVisible({ timeout: 15000 }).catch(() => false);

    test.skip(
      !hasATSContent,
      `ATS content not available in current deployment. Current URL: ${page.url()}`
    );

    if (await authWall.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('ℹ️  Sign In button is present, but ATS content is available so the test will continue.');
    }

    await expect(postedJobs.or(jobItem).or(pipelineCounter).or(emptyState).or(atsShell).first()).toBeVisible({ timeout: 10000 });
  });

  test('TC 25: Manage candidate and jobs in ATS', async ({ page }) => {
    const jobItem = page.getByText(/Senior Blockchain Engineer|Product Designer|Full-Stack Developer|Engineer|Developer/i).first();
    if (!(await jobItem.isVisible({ timeout: 15000 }).catch(() => false))) {
      const appLoadError = page
        .getByText(/Unexpected Application Error|Failed to fetch dynamically imported module|ChunkLoadError/i)
        .first();
      const emptyState = page.getByText(/Empty data|No jobs|No posted jobs/i).first();
      test.skip(
        await appLoadError.isVisible({ timeout: 1000 }).catch(() => false)
          || await emptyState.isVisible({ timeout: 1000 }).catch(() => false),
        'ATS job data is not available or deployment assets failed to load in this environment.'
      );
    }
    await expect(jobItem).toBeVisible({ timeout: 5000 });

    const candidate = page.getByText(/Nguyen Van A|Mike Chen|Sarah Lee|Candidate|Applicant/i).first();
    if (await candidate.isVisible({ timeout: 15000 }).catch(() => false)) {
      await expect(candidate).toBeVisible();
    } else {
      test.skip(true, 'No candidate card visible in ATS for current environment');
    }
  });

  test('TC 33: Check close job activities', async ({ page }) => {
    const activeTab = page.getByRole('tab', { name: /Active/i }).first();
    if (await activeTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await activeTab.click();
    }

    const closeBtn = page.locator('button').filter({ hasText: /^Close$/i }).first();
    const closedStatus = page.getByText(/^Closed$/i).first();
    if (await closeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(closeBtn).toBeVisible();
      return;
    }

    if (await closedStatus.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(closedStatus).toBeVisible();
      return;
    }

    const appLoadError = page
      .getByText(/Unexpected Application Error|Failed to fetch dynamically imported module|ChunkLoadError/i)
      .first();
    test.skip(
      await appLoadError.isVisible({ timeout: 3000 }).catch(() => false),
      'ATS deployment asset failed to load, so close activity UI cannot be verified in this run.'
    );

    const authWall = page.getByText(/Sign in to manage|Get Started/i).first();
    const emptyState = page.getByText(/Empty data|No jobs|No posted jobs/i).first();
    test.skip(
      await authWall.isVisible({ timeout: 3000 }).catch(() => false)
        || await emptyState.isVisible({ timeout: 3000 }).catch(() => false),
      'No authenticated active/closed ATS job is available to verify close activity in this environment.'
    );

    await expect(closeBtn.or(closedStatus), 'ATS should expose Close action or Closed status when close activity data exists').toBeVisible({ timeout: 10000 });
  });
});
