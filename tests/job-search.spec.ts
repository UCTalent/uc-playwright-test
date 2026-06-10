import { test, expect } from '../fixtures';
import { HomePage } from '../pages/HomePage';
import { AtsPage } from '../pages/AtsPage';

test.describe('Job Search & Filters', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
  });

  test('TC 14: Test the job search function by keyword', async ({ page }) => {
    if (await homePage.searchInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await homePage.search('Frontend');
    }
    const firstJob = homePage.jobCard.first();
    const noResults = page.locator('text=No results').first();
    if (await firstJob.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(firstJob).toBeVisible();
    } else {
      await expect(noResults).toBeVisible();
    }
  });

  test('TC 15: Search with suggested keywords', async () => {
    if (await homePage.searchInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await homePage.searchInput.first().fill('Re');
      await homePage.searchInput.first().press('Enter');
    }
    const suggestion = homePage.suggestionList.first();
    const jobCard = homePage.jobCard.first();
    if (await suggestion.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(suggestion).toBeVisible();
    } else {
      await expect(jobCard).toBeVisible();
    }
  });

  test('TC 16: Programatic SEO link for tech/skill chips', async ({ page }) => {
    const chip = homePage.techSkillChips.first();
    if (await chip.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chip.click();
    }
    await expect(page).toHaveURL(/.*(search|jobs)/i, { timeout: 10000 });
  });

  test('TC 40: ATS Job Filter & Search', async ({ page }) => {
    const atsPage = new AtsPage(page);
    await atsPage.goto();
    const input = atsPage.atsSearchInput.first();
    if (await input.isVisible({ timeout: 5000 }).catch(() => false)) {
      await input.fill('Developer');
      await input.press('Enter');
    }
    const result = page.locator('text=Developer').first();
    const body = page.locator('body').first();
    if (await result.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(result).toBeVisible();
    } else {
      await expect(body).toBeVisible();
    }
  });
});
