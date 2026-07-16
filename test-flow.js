const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3000/jobs...");
  await page.goto('http://localhost:3000/jobs', { waitUntil: 'networkidle' });

  // Take initial screenshot
  await page.screenshot({ path: path.join(__dirname, 'screenshot-1-initial.png') });
  console.log("Screenshot 1 saved.");

  // Find the Toggle Button for Bounty Board
  console.log("Clicking Bounty Board toggle...");
  const bountyBoardButton = page.locator('text=Bounty Board');
  await bountyBoardButton.click();

  // Wait for URL navigation to complete
  console.log("Waiting for navigation to **/jobs/bounties...");
  await page.waitForURL('**/jobs/bounties', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.screenshot({ path: path.join(__dirname, 'screenshot-2-bounty-board.png') });
  console.log("Screenshot 2 saved.");

  // Open "All Filters"
  console.log("Waiting for 'All Filters' button to be visible...");
  const allFiltersButton = page.locator('text=All Filters');
  await allFiltersButton.waitFor({ state: 'visible' });
  
  console.log("Clicking 'All Filters'...");
  await allFiltersButton.click({ force: true });
  
  console.log("Waiting for filter list to be visible...");
  const filterList = page.locator('#job-board-filter-list');
  await filterList.waitFor({ state: 'visible', timeout: 5000 });

  // Take screenshot of filter list
  await page.screenshot({ path: path.join(__dirname, 'screenshot-3-filters-open.png') });
  console.log("Screenshot 3 saved.");

  // Click on the "Skills" item in the filter list to open its flyout
  console.log("Clicking 'Skills' filter item...");
  const skillsMenuItem = filterList.locator('text=Skills');
  await skillsMenuItem.waitFor({ state: 'visible' });
  await skillsMenuItem.click();
  
  // Wait for the search input to appear in the DOM
  console.log("Waiting for Skills filter search input...");
  const searchSkillsInput = page.locator('input[placeholder="Search skills"]');
  await searchSkillsInput.waitFor({ state: 'visible', timeout: 5000 });

  // Take screenshot after clicking Skills
  await page.screenshot({ path: path.join(__dirname, 'screenshot-3.5-skills-flyout.png') });
  console.log("Screenshot 3.5 saved.");

  console.log("Typing 'Nodejs' in search skills...");
  await searchSkillsInput.fill('Nodejs');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, 'screenshot-4-search-skills.png') });
  console.log("Screenshot 4 saved.");

  // Click on the matching skill option (which will contain text Nodejs or Node.js)
  console.log("Clicking Nodejs skill option...");
  const nodejsOption = page.locator('li:has-text("Nodejs"), li:has-text("Node.js"), label:has-text("Nodejs"), label:has-text("Node.js")').first();
  await nodejsOption.waitFor({ state: 'visible' });
  await nodejsOption.click();
  console.log("Clicked Nodejs option.");
  
  await page.waitForTimeout(3000);

  // Close All Filters drawer to view results clearly
  console.log("Closing 'All Filters' drawer...");
  await allFiltersButton.click();
  await page.waitForTimeout(2000);

  // Take screenshot after selection and closing
  await page.screenshot({ path: path.join(__dirname, 'screenshot-5-results.png') });
  console.log("Screenshot 5 saved.");

  await browser.close();
  console.log("Browser closed successfully.");
})().catch(err => {
  console.error("Error running script:", err);
  process.exit(1);
});
