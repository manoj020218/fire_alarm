import pkg from 'file:///C:/Users/User/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pkg;

const SS_DIR = 'D:/IOT Device/fireguard/fireguard v1/screenshots/';
const BASE = 'http://localhost:5173';

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// Login
await page.goto(`${BASE}/login`);
await page.waitForLoadState('networkidle');
await page.fill('input[type="email"]', 'admin@abctowers.com');
await page.fill('input[type="password"]', 'Pass@123');
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 10000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${SS_DIR}dashboard.png`, fullPage: false });
console.log('dashboard.png saved');

// Alarms
await page.click('a[href="/alarms"]');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: `${SS_DIR}alarms.png`, fullPage: false });
console.log('alarms.png saved');

// Live Monitor
await page.click('a[href="/live-monitor"]');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: `${SS_DIR}live-monitor.png`, fullPage: false });
console.log('live-monitor.png saved');

// Trends
await page.click('a[href="/trends"]');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${SS_DIR}trends.png`, fullPage: false });
console.log('trends.png saved');

// Devices
await page.click('a[href="/devices"]');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(800);
await page.screenshot({ path: `${SS_DIR}devices.png`, fullPage: false });
console.log('devices.png saved');

await browser.close();
console.log('All screenshots done');
