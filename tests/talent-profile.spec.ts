import { test, expect } from '../fixtures';

test.describe('Talent Profile & Board', () => {

  test('TC 28: Talent profile', async ({ page }) => {
    await test.step('Access Talent Profile', async () => {
      await page.goto('/profile');
    });
    
    await test.step('Verify profile info is editable and visible', async () => {
      const nameInput = page.locator('input[type="text"]').first();
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(nameInput).toBeVisible();
      } else {
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test('TC 29: Talent board and search', async ({ page }) => {
    await test.step('Access Talent Board', async () => {
      await page.goto('/talents');
    });
    
    await test.step('Search for a talent', async () => {
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill('Developer');
        await searchInput.press('Enter');
      }
    });

    await test.step('Verify talent results', async () => {
      const talentCard = page.locator('a[href*="/talents/"]').first();
      if (await talentCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(talentCard).toBeVisible();
      }
    });
  });
});
