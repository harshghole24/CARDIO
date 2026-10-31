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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();

  // 1. Visit /login and submit credentials
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

  // 2. Navigate to /travel
  console.log('Navigating to http://localhost:5173/travel ...');
  await page.goto('http://localhost:5173/travel', { waitUntil: 'networkidle0' });

  // Wait for the boarding pass container to be rendered
  await page.waitForSelector('.bp-ticket', { timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));

  const viewports = [
    { name: 'boarding_pass_1440px', width: 1440, height: 900 },
    { name: 'boarding_pass_1024px', width: 1024, height: 800 },
    { name: 'boarding_pass_768px', width: 768, height: 1024 },
    { name: 'boarding_pass_390px', width: 390, height: 1200 }
  ];

  for (const vp of viewports) {
    console.log(`Setting viewport: ${vp.width}x${vp.height}`);
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });
    await new Promise(r => setTimeout(r, 600));

    // Capture the boarding pass element
    const element = await page.$('.bp-container');
    if (element) {
      await page.evaluate((el) => {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, element);
      await new Promise(r => setTimeout(r, 600));

      const filePath = path.join(SCREENSHOT_DIR, `${vp.name}.png`);
      await element.screenshot({ path: filePath });
      console.log(`Saved screenshot: ${filePath}`);
    } else {
      console.error('Could not find .bp-container');
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
}

run().catch(err => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
