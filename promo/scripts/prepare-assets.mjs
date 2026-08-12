// Copies brand assets and downloads real menu media into public/.
// Usage: node scripts/prepare-assets.mjs

import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

const MENU_URL = process.env.THREEDINER_MENU_URL ?? "https://3diner.vercel.app/senja-kopi";

const PUB = path.resolve("public");
const BRAND = "C:/Kerja/3Diner/brand";

const MENU_PHOTOS = {
  croissant:
    "https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/menu-media/597a7d92-1556-4ad2-a780-f8db9aceb627/image/1782315793959-croissantmenu.png",
  steak:
    "https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/menu-media/597a7d92-1556-4ad2-a780-f8db9aceb627/image/1782300552009-gambarmenusteak.png",
  pasta:
    "https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/menu-media/597a7d92-1556-4ad2-a780-f8db9aceb627/image/1782300445626-gambarmenupastameatball.png",
  kopi: "https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/menu-media/597a7d92-1556-4ad2-a780-f8db9aceb627/image/1782313565030-fotomenueskopisusu.png",
};

// The exported mark ships with an opaque #FDFDFD backing rect as its first
// path. Video needs it on navy, so that one rect is stripped.
async function transparentMark() {
  const src = await readFile(path.join(BRAND, "logos/3diner-logo-mark.svg"), "utf8");
  const stripped = src.replace(
    /<path d="M0 0 C413\.82 0[^/]*?\/>\s*/,
    "",
  );
  if (stripped === src) {
    console.warn("WARN: background rect not matched — mark keeps its white plate");
  }
  // The export has width/height but no viewBox, so any CSS sizing crops it
  // instead of scaling it.
  const scalable = stripped.replace(
    /<svg version="1.1" xmlns="http:\/\/www.w3.org\/2000\/svg" width="(\d+)" height="(\d+)">/,
    (_m, w, h) =>
      `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
  );
  if (!scalable.includes("viewBox")) {
    console.warn("WARN: could not add a viewBox to the mark");
  }
  await writeFile(path.join(PUB, "logo-mark.svg"), scalable, "utf8");
  console.log("wrote logo-mark.svg", scalable.length, "bytes, viewBox:", scalable.includes("viewBox"));
}

async function menuPhotos() {
  const dir = path.join(PUB, "photos");
  await mkdir(dir, { recursive: true });
  for (const [name, url] of Object.entries(MENU_PHOTOS)) {
    const res = await fetch(url);
    if (!res.ok) {
      console.log("SKIP", name, res.status);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(dir, `${name}.png`), buf);
    console.log("saved photo", name, (buf.length / 1024).toFixed(0) + "KB");
  }
}

async function brandBoard() {
  await copyFile(
    path.join(BRAND, "logos/3diner-logo-full.png"),
    path.join(PUB, "logo-full.png"),
  );
  console.log("copied logo-full.png");
}

/** A real, scannable QR for the seed cafe menu — not a decorative pattern. */
async function menuQr() {
  const svg = await QRCode.toString(MENU_URL, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark: "#022C60", light: "#00000000" },
  });
  await writeFile(path.join(PUB, "qr-menu.svg"), svg, "utf8");
  console.log("wrote qr-menu.svg ->", MENU_URL);
}

async function main() {
  await mkdir(PUB, { recursive: true });
  await transparentMark();
  await menuQr();
  await menuPhotos();
  await brandBoard();
  console.log("done ->", PUB);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
