/** Feasibility probe: which UI-reference galleries are reachable without a login. */
import { chromium } from 'playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const TARGETS = [
  ['mobbin-browse',      'https://mobbin.com/browse/ios/apps'],
  ['mobbin-search-food', 'https://mobbin.com/search/apps?filter=appCategory_Food+%26+Drink'],
  ['dribbble-food-menu', 'https://dribbble.com/search/food-menu-app'],
  ['dribbble-restaurant', 'https://dribbble.com/search/restaurant%20menu%20ui'],
  ['pinterest-food-ui',  'https://www.pinterest.com/search/pins/?q=food%20menu%20app%20ui'],
  ['behance-food-app',   'https://www.behance.net/search/projects/food%20app%20ui'],
  ['landbook-restaurant','https://land-book.com/?search=restaurant'],
  ['uisources',          'https://www.uisources.com/'],
  ['screensdesign',      'https://screensdesign.com/'],
  ['collectui-menu',     'https://collectui.com/challenges/menu'],
  ['refero-food',        'https://refero.design/'],
  ['nicelydone',         'https://nicelydone.club/'],
  ['savee-food-ui',      'https://savee.it/search/?q=food+app+ui'],
  ['lapa-ninja',         'https://www.lapa.ninja/category/food/'],
  ['godly',              'https://godly.website/'],
  ['mobile-patterns',    'https://www.mobile-patterns.com/'],
  ['pttrns',             'https://pttrns.com/'],
  ['scrnshts',           'https://scrnshts.club/'],
  ['uigarage-food',      'https://uigarage.net/?s=food'],
  ['awwwards-restaurant','https://www.awwwards.com/websites/restaurant/'],
  ['siteinspire-food',   'https://www.siteinspire.com/websites?categories=32'],
  ['21st-dev',           'https://21st.dev/?tab=components&q=menu'],
];

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'en-US',
});

const BLOCK = /just a moment|checking your browser|are you a robot|access denied|verify you are human|captcha|enable javascript|log in to continue|sign up to continue/i;

for (const [name, url] of TARGETS) {
  const page = await ctx.newPage();
  let verdict;
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(5000);
    const title = await page.title();
    const info = await page.evaluate(() => ({
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
      imgs: document.querySelectorAll('img').length,
      // a gallery that actually rendered results has many reasonably large images
      bigImgs: [...document.querySelectorAll('img')].filter((i) => i.clientWidth > 140 && i.clientHeight > 100).length,
      loginWall: !!document.querySelector('[class*="login" i],[id*="login" i],[data-test*="login" i]'),
    }));
    const blocked = BLOCK.test(title + info.text);
    verdict = `${res?.status()} ${blocked ? 'WALL ' : '     '} imgs=${String(info.imgs).padStart(3)} big=${String(info.bigImgs).padStart(3)} | ${info.text.slice(0, 70)}`;
  } catch (e) {
    verdict = `ERROR ${String(e.message).split('\n')[0].slice(0, 60)}`;
  }
  console.log(name.padEnd(22), verdict);
  await page.close().catch(() => {});
}

await browser.close();
