/** Feasibility probe: can a real (headful) Chrome reach the pages that blocked headless fetch? */
import { chromium } from 'playwright-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TARGETS = [
  ['gofood', 'https://gofood.co.id/bandar-lampung/restaurant'],
  ['grabfood', 'https://food.grab.com/id/id/'],
  ['shopeefood', 'https://shopee.co.id/m/shopeefood'],
  ['swiggy', 'https://www.swiggy.com/'],
  ['zomato', 'https://www.zomato.com/'],
  ['doordash-merchant-photos', 'https://merchants.doordash.com/en-us/learning-center/menu-photos'],
];

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  locale: 'id-ID',
});

for (const [name, url] of TARGETS) {
  const page = await ctx.newPage();
  let verdict;
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(6000);
    const title = await page.title();
    const text = await page.evaluate(() => document.body.innerText.slice(0, 300));
    const blocked = /checking your browser|just a moment|are you a robot|access denied|verify you are human|captcha/i.test(title + text);
    verdict = `${res?.status()} | ${blocked ? 'BLOCKED' : 'OK'} | "${title.slice(0, 45)}" | ${text.replace(/\s+/g, ' ').slice(0, 90)}`;
  } catch (e) {
    verdict = `ERROR ${String(e.message).split('\n')[0].slice(0, 70)}`;
  }
  console.log(name.padEnd(26), verdict);
  await page.close().catch(() => {});
}

await browser.close();
