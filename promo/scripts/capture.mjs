// Captures real 3Diner UI from production into public/shots/.
// Usage: node scripts/capture.mjs
// Only reads public customer-facing routes. Never creates orders.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.THREEDINER_BASE ?? "https://3diner.vercel.app";
const SLUG = process.env.THREEDINER_SLUG ?? "senja-kopi";
const OUT = path.resolve("public/shots");

const PHONE = {
  viewport: { width: 414, height: 896 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("saved", name);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...PHONE,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    locale: "id-ID",
    colorScheme: "light",
  });
  // Kill caret/scrollbar noise and freeze CSS animation so frames are deterministic.
  await ctx.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `*{caret-color:transparent!important}
      ::-webkit-scrollbar{display:none!important}
      *,*::before,*::after{animation-play-state:paused!important;transition:none!important}`;
    document.documentElement.appendChild(style);
  });

  const page = await ctx.newPage();

  // 1. Cafe home, hero visible
  await page.goto(`${BASE}/${SLUG}`, { waitUntil: "networkidle" });
  await sleep(2500);
  await shoot(page, "01-home");

  // 2. Same page scrolled to the menu grid
  await page.evaluate(() => window.scrollTo({ top: 520, behavior: "instant" }));
  await sleep(1200);
  await shoot(page, "02-home-grid");

  // 3. Dish detail — pick a menu without "(Compress)" / "Generate" in the name
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(400);
  const href = await page.evaluate((slug) => {
    const anchors = [...document.querySelectorAll(`a[href^="/${slug}/"]`)];
    const clean = anchors.find((a) => {
      const t = (a.textContent ?? "").toLowerCase();
      return !t.includes("compress") && !t.includes("generate") && t.trim().length > 0;
    });
    return (clean ?? anchors[0])?.getAttribute("href") ?? null;
  }, SLUG);
  if (!href) throw new Error("no menu link found on cafe home");
  console.log("dish:", href);

  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await sleep(2500);
  await shoot(page, "03-dish-detail");

  // 4. 3D viewer — model-viewer needs time to fetch + decode the GLB
  await page.goto(`${BASE}${href}/3d`, { waitUntil: "networkidle" });
  await sleep(14000);
  await shoot(page, "04-viewer-3d");

  // 4b. A short rotation burst, usable as an image sequence
  for (let i = 0; i < 6; i++) {
    await sleep(700);
    await shoot(page, `04-viewer-3d-r${i}`);
  }

  // 5. Cart (client-side only; nothing is written to the database)
  await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await sleep(2000);
  const added = await page
    .getByRole("button", { name: /tambah|keranjang|pesan/i })
    .first()
    .click({ timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  console.log("add to cart clicked:", added);
  await sleep(1200);
  await page.goto(`${BASE}/${SLUG}/keranjang`, { waitUntil: "networkidle" });
  await sleep(2000);
  await shoot(page, "05-cart");

  await browser.close();
  console.log("done ->", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
