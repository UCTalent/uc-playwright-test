import { test, expect } from '../fixtures';
import { guestStorageState } from '../helpers/authModal';
import { LoginPage } from '../pages/LoginPage';

test.describe('Authentication - Google OAuth', () => {
  test.use({ storageState: guestStorageState });

  test('TC 3: Sign In with Google account', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.openSocialLogin();
    const googleButton = page.getByRole('button', { name: /login with google|google/i }).first();
    await expect(googleButton).toBeVisible({ timeout: 10000 });
  });
});
