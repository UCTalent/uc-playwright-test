import { Page, Locator } from '@playwright/test';

export class AtsPage {
  readonly page: Page;
  readonly atsSearchInput: Locator;
  readonly candidateSearchInput: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.atsSearchInput = page.locator('input[placeholder*="Search by job title"]');
    this.candidateSearchInput = page.locator('input[placeholder*="Search name"], input[placeholder*="Search candidate"]');
  }
  
  async goto() { 
    const atsUrl = process.env.ATS_URL || 'https://business.uctalent.dev';
    await this.page.goto(atsUrl); 
  }

  async moveCandidateStatus(candidateName: string, targetStatus: string) {
    // Locate the card for the candidate
    const card = this.page.locator('div').filter({ hasText: candidateName }).first();
    await card.waitFor({ state: 'visible', timeout: 5000 });
    
    // Find the three dots menu button on the candidate card
    const menuButton = card.locator('button, div[role="button"]').filter({ has: this.page.locator('svg') }).first();
    if (await menuButton.isVisible()) {
      await menuButton.click();
      // Click "Move to <targetStatus>" menu item (e.g. "Move to Screening", "Move to Interview", etc.)
      const option = this.page.locator(`li, [role="menuitem"]`).filter({ hasText: new RegExp(`Move to ${targetStatus}`, 'i') });
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
    } else {
      // Fallback to drag-and-drop
      const targetColumn = this.page.locator(`div[id="${targetStatus.toLowerCase().replace(' ', '_')}"]`).first();
      await card.dragTo(targetColumn);
    }
  }
}
