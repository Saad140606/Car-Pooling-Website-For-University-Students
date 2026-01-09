const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.error('PAGE CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', (err) => {
    errors.push(String(err));
    console.error('PAGE ERROR:', err);
  });

  try {
    await page.goto('http://localhost:9002/dashboard/my-rides', { waitUntil: 'networkidle' });

    // Wait for the list of rides (or the page with no rides)
    await page.waitForTimeout(1000);

    // Find all "View Route & Pickups" buttons
    const buttons = await page.locator('button:has-text("View Route & Pickups")');
    const count = await buttons.count();
    if (count === 0) {
      console.log('No View Route buttons found on page. Exiting test.');
      await browser.close();
      process.exit(0);
    }

    console.log('Found', count, 'View Route buttons. Clicking repeatedly...');

    // Click the first found button repeatedly (open/close cycle)
    const button = buttons.first();
    for (let i = 0; i < 30; i++) {
      try {
        await button.click();
        // Wait for modal to open
        await page.waitForSelector('text=Your Route & Passenger Pickups', { timeout: 2000 });
        // wait a bit for map to initialize
        await page.waitForTimeout(300 + (i % 5) * 50);
        // Close the dialog by clicking the Close button or pressing Escape
        // Try close button first
        const closeBtn = await page.locator('button:has-text("Close")').first();
        if ((await closeBtn.count()) > 0) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(100);
      } catch (err) {
        console.error('Iteration', i, 'error:', err);
      }
    }

    if (errors.length === 0) console.log('No console errors captured.');
    else console.log('Captured errors:', errors);

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    await browser.close();
    process.exit(1);
  }
})();