const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERR:', err));
  console.log('Navigating...');
  await page.goto('http://localhost:3000/jobs', { waitUntil: 'load' });
  console.log('Done!');
  await browser.close();
})();
