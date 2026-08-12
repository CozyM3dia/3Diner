// Renders a 360° turntable of real dish models straight out of the product's
// own <model-viewer>, as transparent PNG frames for compositing in Remotion.
//
// Usage: node scripts/capture-turntable.mjs

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.THREEDINER_BASE ?? "https://3diner.vercel.app";
const SLUG = process.env.THREEDINER_SLUG ?? "senja-kopi";
const OUT = path.resolve("public/turntable");
const FRAMES = 48; // 1.6s loop at 30fps
const ORBIT_ELEVATION = 72; // degrees from the top; slightly above the plate

// Menu ids on the seed cafe, resolved once from the public menu payload.
const DISHES = [
  { name: "croissant", id: "6eaa4a22-9d5d-498c-b69f-05fe3a215944" },
  { name: "steak", id: "8827d8dc-77f2-4d4d-9d0c-f87bcf157617" },
  { name: "pasta", id: "c5baf358-a17f-4897-9709-b38d357db7a1" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function captureDish(ctx, dish) {
  const dir = path.join(OUT, dish.name);
  await mkdir(dir, { recursive: true });

  const page = await ctx.newPage();
  await page.goto(`${BASE}/${SLUG}/${dish.id}/3d`, { waitUntil: "networkidle" });

  // Wait for model-viewer to exist and finish loading the GLB.
  await page.waitForSelector("model-viewer", { timeout: 60000 });
  await page.waitForFunction(
    () => {
      const mv = document.querySelector("model-viewer");
      return Boolean(mv && mv.loaded);
    },
    { timeout: 120000 },
  );
  await sleep(2500);

  // Strip the page down to the model on a transparent canvas.
  await page.evaluate(() => {
    const mv = document.querySelector("model-viewer");
    document.querySelectorAll("body *").forEach((el) => {
      if (el === mv || el.contains(mv)) return;
      if (mv && mv.contains(el)) return;
      el.style.visibility = "hidden";
    });
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    let node = mv?.parentElement;
    while (node && node !== document.body) {
      node.style.background = "transparent";
      node = node.parentElement;
    }
    if (mv) {
      mv.style.background = "transparent";
      mv.style.setProperty("--poster-color", "transparent");
      mv.removeAttribute("auto-rotate");
      mv.setAttribute("interpolation-decay", "1");
      mv.setAttribute("shadow-intensity", "0");
      Object.assign(mv.style, {
        position: "fixed",
        inset: "0",
        width: "100vw",
        height: "100vh",
        zIndex: "9999",
        visibility: "visible",
      });
    }
  });
  await sleep(1200);

  for (let i = 0; i < FRAMES; i++) {
    const theta = (360 / FRAMES) * i;
    await page.evaluate(
      ({ theta, elevation }) => {
        const mv = document.querySelector("model-viewer");
        if (!mv) return;
        mv.cameraOrbit = `${theta}deg ${elevation}deg auto`;
        if (typeof mv.jumpCameraToGoal === "function") mv.jumpCameraToGoal();
      },
      { theta, elevation: ORBIT_ELEVATION },
    );
    await sleep(160);
    await page.screenshot({
      path: path.join(dir, `f${String(i).padStart(3, "0")}.png`),
      omitBackground: true,
    });
  }

  console.log("saved turntable:", dish.name, FRAMES, "frames");
  await page.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 900, height: 900 },
    deviceScaleFactor: 2,
    locale: "id-ID",
  });

  for (const dish of DISHES) {
    try {
      await captureDish(ctx, dish);
    } catch (err) {
      console.log("FAIL", dish.name, "-", err.message.split("\n")[0]);
    }
  }

  await browser.close();
  console.log("done ->", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
