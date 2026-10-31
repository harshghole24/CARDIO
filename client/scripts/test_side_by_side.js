import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\HP\\.gemini\\antigravity\\brain\\c425bcd2-1fa5-4269-8d41-1458d603e7b4';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('Launching Chrome from:', CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1366,768']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 2 });

    // 1. Login
    console.log('Logging in at http://localhost:5173/login ...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder="Enter your username"]', { timeout: 5000 });
    await page.type('input[placeholder="Enter your username"]', 'harshghole');
    await page.type('input[placeholder="••••••••"]', 'Password@123');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {})
    ]);
    await new Promise(r => setTimeout(r, 1000));

    // 2. Go to /travel
    console.log('Navigating to http://localhost:5173/travel ...');
    await page.goto('http://localhost:5173/travel', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));

    // 3. Verify Empty State
    const originVal = await page.$eval('input[placeholder="From: city or airport code"]', el => el.value);
    const destVal = await page.$eval('input[placeholder="To: city or airport code"]', el => el.value);
    console.log('Initial Origin input value:', JSON.stringify(originVal));
    console.log('Initial Dest input value:', JSON.stringify(destVal));

    const emptyText = await page.$eval('body', el => el.innerText);
    const hasEmptyPrompt = emptyText.includes('Pick your route to see your boarding pass and best card recommendations');
    console.log('Empty state prompt visible:', hasEmptyPrompt);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'travel_1366x768_empty.png'),
      fullPage: false
    });
    console.log('Saved travel_1366x768_empty.png');

    // 4. Select Origin: DEL
    console.log('Selecting Origin: DEL...');
    const originInput = await page.$('input[placeholder="From: city or airport code"]');
    await originInput.click();
    await originInput.type('DEL');
    await new Promise(r => setTimeout(r, 600));

    // Click first dropdown item
    const originItem = await page.waitForSelector('div.shadow-2xl div.cursor-pointer', { timeout: 3000 });
    await originItem.click();
    await new Promise(r => setTimeout(r, 500));

    // 5. Select Destination: BOM
    console.log('Selecting Destination: BOM...');
    const destInput = await page.$('input[placeholder="To: city or airport code"]');
    await destInput.click();
    await destInput.type('BOM');
    await new Promise(r => setTimeout(r, 600));

    const destItem = await page.waitForSelector('div.shadow-2xl div.cursor-pointer', { timeout: 3000 });
    await destItem.click();
    await new Promise(r => setTimeout(r, 1500));

    // 6. Verify BoardingPass visible
    await page.waitForSelector('.bp-ticket', { timeout: 5000 });
    console.log('Boarding pass ticket rendered!');

    // Capture screenshot at 1366x768 showing sliders and boarding pass together without scroll
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'travel_1366x768_pass_in_view.png'),
      fullPage: false
    });
    console.log('Saved travel_1366x768_pass_in_view.png');

    // 7. Scroll down to test sticky behavior of left column
    console.log('Scrolling down 350px...');
    await page.evaluate(() => {
      const scrollables = Array.from(document.querySelectorAll('.overflow-auto'));
      const activeScroll = scrollables.find(el => el.scrollHeight > el.clientHeight) || scrollables[scrollables.length - 1];
      if (activeScroll) {
        activeScroll.scrollTop = 350;
      }
    });
    await new Promise(r => setTimeout(r, 800));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'travel_1366x768_sticky_scrolled.png'),
      fullPage: false
    });
    console.log('Saved travel_1366x768_sticky_scrolled.png');

    // 8. Test live slider adjustment
    console.log('Adjusting Monthly Spend slider...');
    // Scroll back up
    await page.evaluate(() => {
      const scrollables = Array.from(document.querySelectorAll('.overflow-auto'));
      const activeScroll = scrollables.find(el => el.scrollHeight > el.clientHeight) || scrollables[scrollables.length - 1];
      if (activeScroll) {
        activeScroll.scrollTop = 0;
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // Change monthly spend to 100,000 and travellers to 2
    await page.evaluate(() => {
      const sliders = document.querySelectorAll('input[type="range"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

      // Monthly spend to 100,000
      setter.call(sliders[0], '100000');
      sliders[0].dispatchEvent(new Event('input', { bubbles: true }));
      sliders[0].dispatchEvent(new Event('change', { bubbles: true }));

      // Travellers to 2
      setter.call(sliders[1], '2');
      sliders[1].dispatchEvent(new Event('input', { bubbles: true }));
      sliders[1].dispatchEvent(new Event('change', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'travel_1366x768_travellers_updated.png'),
      fullPage: false
    });
    console.log('Saved travel_1366x768_travellers_updated.png');

    console.log('ALL TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await browser.close();
  }
}

run();
