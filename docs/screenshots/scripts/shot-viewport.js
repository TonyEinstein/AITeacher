/* 官网各页面视口截图（1440x900，供 README 排版） */
const puppeteer = require('puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const WEBSITE = 'http://localhost:5174';
const OUT = 'E:/AITeacher/docs/screenshots/website_viewport';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();
  const pages = [
    ['/', 'home.png'],
    ['/features', 'features.png'],
    ['/cases', 'cases.png'],
    ['/faq', 'faq.png'],
    ['/about', 'about.png'],
    ['/contact', 'contact.png'],
  ];
  for (const [route, file] of pages) {
    await page.goto(WEBSITE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500);
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible')));
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${file}` });
    console.log('shot:', file);
  }
  await browser.close();
  console.log('VIEWPORT DONE');
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
