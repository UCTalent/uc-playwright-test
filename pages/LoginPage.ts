import { Page, Locator } from '@playwright/test';
import { openAuthModal, openSocialLogin } from '../helpers/authModal';

export class LoginPage {
  readonly page: Page;
  readonly signInTriggerButton: Locator;
  readonly googleSignInButton: Locator;
  readonly githubSignInButton: Locator;
  readonly discordSignInButton: Locator;
  readonly telegramSignInButton: Locator;
  readonly metaMaskButton: Locator;
  readonly coinbaseWalletButton: Locator;
  readonly socialLoginButton: Locator;
  readonly emailInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signInTriggerButton = page.locator('#connect-button-thirdweb button, button:has-text("Sign In"), button:has-text("Connect Wallet")');
    this.googleSignInButton = page.getByRole('button', { name: /google/i });
    this.githubSignInButton = page.getByRole('button', { name: /github/i });
    this.discordSignInButton = page.getByRole('button', { name: /discord/i });
    this.telegramSignInButton = page.getByRole('button', { name: /telegram/i });
    this.metaMaskButton = page.getByRole('button', { name: /metamask/i });
    this.coinbaseWalletButton = page.getByRole('button', { name: /coinbase/i });
    this.socialLoginButton = page.getByRole('button', { name: /social login/i });
    this.emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    this.loginButton = page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Submit"), button:has-text("Verify"), button:has-text("->")');
  }

  async goto() {
    await openAuthModal(this.page);
  }

  async openSocialLogin() {
    await openSocialLogin(this.page);
  }

  async clickGoogleSignIn() {
    const google = this.page.getByRole('button', { name: /login with google|google/i }).first();
    await google.click();
  }

  async clickGithubSignIn() {
    await this.githubSignInButton.click();
  }

  async clickMetaMask() {
    await this.metaMaskButton.click();
  }
}
