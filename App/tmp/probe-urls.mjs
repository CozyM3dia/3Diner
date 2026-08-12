/** Find the real search URLs for the galleries that were captured wrong. */
import { chromium } from 'playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TARGETS = [
  ['screensdesign-search-food', 'https://screensdesign.com/library?q=food'],
  ['screensdesign-search-2',    'https://screensdesign.com/search?q=food'],
  ['scrnshts-search-food',      'https://scrnshts.club/?q=food'],
  ['scrnshts-cat-food',         'https://scrnshts.club/categories/food-drink'],
  ['collectui-restaurant',      'https://collectui.com/challenges/restaurant'],
  ['collectui-food',            'https://collectui.com/challenges/food'],
  ['collectui-ecommerce-shop',  'https://collectui.com/challenges/e-commerce-shop'],
  ['behance-search-sorted',     'https://www.behance.net/search/projects?search=restaurant%20app%20ui&sort=appreciations'],
  ['mobbin-food-drink',         'https://mobbin.com/browse/ios/apps?filter=appCategory_Food%20%26%20Drink'],
  ['uplabs-food',               'https://www.uplabs.com/search?q=food%20app'],
  ['dribbble-tag-restaurant',   'https://dribbble.com/tags/restaurant-app'],
  ['pinterest-menu-design',     'https://www.pinterest.com/search/pins/?q=digital%20menu%20design%20mobile'],
];

const browser = await chromium.launch({
  executablePath: CHROME, headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });

for (const [name, url] of TARGETS) {
  const page = await ctx.newPage();
  let verdict;
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4500);
    // scroll once to trigger lazy tiles before counting
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      title: document.title.slice(0, 40),
      big: [...document.querySelectorAll('img')].filter((i) => i.clientWidth > 140 && i.clientHeight > 100).length,
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 110),
    }));
    verdict = `${res?.status()} big=${String(info.big).padStart(3)} | ${info.title} | ${info.text.slice(0, 60)}`;
  } catch (e) {
    verdict = `ERROR ${String(e.message).split('\n')[0].slice(0, 55)}`;
  }
  console.log(name.padEnd(26), verdict);
  await page.close().catch(() => {});
}
await browser.close();
