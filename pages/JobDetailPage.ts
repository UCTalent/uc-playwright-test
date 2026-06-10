import { Page, Locator } from '@playwright/test';

export class JobDetailPage {
  readonly page: Page;
  readonly applyButton: Locator;
  readonly referEarnButton: Locator;
  readonly copyReferralLinkButton: Locator;
  readonly cvUploadInput: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.applyButton = page.locator('button:has-text("Apply"):visible');
    this.referEarnButton = page.locator('button:has-text("Refer"):visible');
    this.copyReferralLinkButton = page.locator('button:has-text("Copy"):visible');
    this.cvUploadInput = page.locator('input[type="file"]');
  }

  async fillApplyForm(email: string, phone: string, salary: string) {
    await this.page.locator('input[name="email"]').fill(email);
    await this.page.locator('input[name="phoneNumber"]').fill(phone);
    await this.page.locator('input[name="salaryMin"]').fill(salary);
  }
}
