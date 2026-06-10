import { Page, Locator } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly locationInput: Locator;
  readonly searchButton: Locator;
  readonly suggestionList: Locator;
  readonly jobCard: Locator;
  readonly techSkillChips: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('input[name="searchJob"]');
    this.locationInput = page.locator('input[name="searchLocation"]');
    this.searchButton = page.locator('[aria-label="Search"]');
    this.suggestionList = page.locator('[data-search-result-item="true"]');
    this.jobCard = page.locator('a[href*="/jobs/detail/"]');
    this.techSkillChips = page.locator('div').filter({ hasText: /React|Frontend|Backend/i });
  }

  async goto(path = '/jobs') { 
    await this.page.goto(path); 
  }
  
  async search(keyword: string) {
    await this.searchInput.first().fill(keyword);
    await this.searchInput.first().press('Enter');
  }
}
