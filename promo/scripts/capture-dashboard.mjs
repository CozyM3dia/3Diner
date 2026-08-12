// Captures the owner dashboard into public/shots/.
// Opens a real browser window and waits for YOU to log in. The script never
// reads, types, or stores your password — it only watches for the URL to
// change to /dashboard, then takes screenshots.
//
// Usage: node scripts/capture-dashboard.mjs

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.THREEDINER_BASE ?? "https://3diner.vercel.app";
const OUT = path.resolve("public/shots");
const LOGIN_TIMEOUT_MS = 6 * 60 * 1000;

const DESKTOP = { viewport: { width: 1512, height: 900 }, deviceScaleFactor: 2 };

const ROUTES = [
  ["/dashboard", "10-dash-home", 4500],
  ["/dashboard/orders", "11-dash-orders", 3500],
  ["/dashboard/menu", "12-dash-menu", 3500],
  ["/dashboard/revenue", "13-dash-revenue", 4500],
  ["/dashboard/inventory", "14-dash-inventory", 3500],
  ["/dashboard/scheduler", "15-dash-scheduler", 3000],
  ["/dashboard/menu/new", "16-dash-menu-new", 3500],
  ["/dashboard/settings", "17-dash-settings", 3500],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: false, args: ["--start-maximized"] });
  const ctx = await browser.newContext({ ...DESKTOP, locale: "id-ID" });
  await ctx.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `*{caret-color:transparent!important}
      ::-webkit-scrollbar{display:none!important}`;
    document.documentElement.appendChild(style);
  });

  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });

  console.log("\n=============================================");
  console.log(" Silakan LOGIN di jendela browser yang terbuka.");
  console.log(" Script menunggu sampai URL jadi /dashboard.");
  console.log(" Password tidak dibaca / disimpan script ini.");
  console.log("=============================================\n");

  await page.waitForURL(/\/dashboard/, { timeout: LOGIN_TIMEOUT_MS });
  console.log("login terdeteksi, mulai capture...");
  await sleep(3000);

  for (const [route, name, wait] of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 45000 });
      await sleep(wait);
      await page.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log("saved", name);
    } catch (err) {
      console.log("SKIP", name, "-", err.message.split("\n")[0]);
    }
  }

  await browser.close();
  console.log("done ->", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
