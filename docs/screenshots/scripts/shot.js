/* 批量截图：官网各页面 + 后台登录页 + 各角色功能页
 * 运行: node shot.js
 * 输出: E:\AITeacher\docs\screenshots\...
 */
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ADMIN = 'http://localhost:5173';
const WEBSITE = 'http://localhost:5174';
const API = 'http://localhost:3000/api/v1';
const OUT = 'E:/AITeacher/docs/screenshots';
const PWD = '123456';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function forceReveal(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
  });
}

async function fullShot(page, name) {
  await forceReveal(page);
  await sleep(600);
  await page.screenshot({ path: name, fullPage: true });
  console.log('shot:', name);
}

async function login(page, username) {
  await page.evaluate(
    async (u, p, api) => {
      const r = await fetch(api + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      const j = await r.json();
      if (j.code !== 0) throw new Error('login failed: ' + j.message);
      localStorage.setItem('admin_token', j.data.access_token);
      localStorage.setItem('admin_user', JSON.stringify(j.data.user));
    },
    username,
    PWD,
    API,
  );
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  /* ---------- 1. 官网 ---------- */
  {
    const page = await browser.newPage();
    const pages = [
      ['/', 'website/home.png'],
      ['/features', 'website/features.png'],
      ['/cases', 'website/cases.png'],
      ['/faq', 'website/faq.png'],
      ['/about', 'website/about.png'],
      ['/contact', 'website/contact.png'],
    ];
    for (const [route, file] of pages) {
      await page.goto(WEBSITE + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1200);
      await fullShot(page, OUT + '/' + file);
    }
    await page.close();
    console.log('[1/3] website done');
  }

  /* ---------- 2. 后台登录页 ---------- */
  {
    const page = await browser.newPage();
    await page.goto(ADMIN + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500); // 等待跳转 /login 与渲染
    await page.screenshot({ path: OUT + '/admin/login.png' });
    console.log('shot: admin/login.png');
    await page.close();
    console.log('[2/3] login done');
  }

  /* ---------- 3. 后台各角色功能页 ---------- */
  {
    const targets = [
      {
        user: 'superadmin',
        dir: 'superadmin',
        pages: [
          ['/dashboard', 'dashboard.png'],
          ['/schools', 'schools.png'],
          ['/subscription', 'subscription.png'],
          ['/leads', 'leads.png'],
          ['/site-config', 'site-config.png'],
          ['/work-orders', 'work-orders.png'],
          ['/devices', 'devices.png'],
          ['/reports', 'reports.png'],
        ],
      },
      {
        user: 'GZ001_admin',
        dir: 'school_admin',
        pages: [
          ['/dashboard', 'dashboard.png'],
          ['/schedules', 'schedules.png'],
          ['/textbooks', 'textbooks.png'],
        ],
      },
      {
        user: 'GZ001_grade1',
        dir: 'grade_admin',
        pages: [
          ['/dashboard', 'dashboard.png'],
          ['/assignments', 'assignments.png'],
        ],
      },
      {
        user: 'GZ001_math',
        dir: 'subject_admin',
        pages: [
          ['/dashboard', 'dashboard.png'],
          ['/question-bank', 'question-bank.png'],
        ],
      },
      {
        user: 'FS001_admin',
        dir: 'trial_school',
        pages: [['/dashboard', 'dashboard.png']],
      },
    ];

    for (const t of targets) {
      const page = await browser.newPage();
      await page.goto(ADMIN + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await login(page, t.user);
      for (const [route, file] of t.pages) {
        await page.goto(ADMIN + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(1800); // 等待 ECharts/表格渲染
        await fullShot(page, `${OUT}/admin/${t.dir}/${file}`);
      }
      await page.close();
      console.log(`role done: ${t.user}`);
    }
    console.log('[3/3] admin roles done');
  }

  await browser.close();
  console.log('ALL DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
