/**
 * Seed dish photos into Supabase Menus.image_url (demo).
 * Maps each menu name to a curated, stable Unsplash food photo.
 * Run: node scripts/seed-photos.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Parse .env.local manually (Node doesn't auto-load it).
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const U = (id) => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;

// keyword → photo
const MAP = [
  [["kopi susu", "latte", "kopi"], U("1511920170033-f8396924c348")],
  [["americano", "espresso", "hitam"], U("1510707577719-ae7c14805e3a")],
  [["cappuccino"], U("1572442388796-11668a67e53d")],
  [["matcha"], U("1536256263959-770b48d82b0a")],
  [["cold brew", "es kopi", "ice"], U("1461023058943-07fcbe16d735")],
  [["croissant", "roti"], U("1555507036-ab1f4038808a")],
  [["spaghetti", "aglio"], U("1621996346565-e3dbc646d9a9")],
  [["pasta", "meatball", "bola daging"], U("1551183053-bf91a1d81141")],
  [["nasi goreng", "nasi"], U("1603133872878-684f208fb84b")],
  [["teh", "tea"], U("1556679343-c7306c1976bc")],
  [["juice", "jus"], U("1600271886742-f049cd451bba")],
  [["cake", "dessert", "kue", "manis"], U("1578985545062-69928b1d9587")],
];
const FALLBACK = U("1504674900247-0877df9cc836");

function pick(name) {
  const n = (name || "").toLowerCase();
  for (const [keys, photo] of MAP) if (keys.some((k) => n.includes(k))) return photo;
  return FALLBACK;
}

const { data: menus, error } = await supabase.from("Menus").select("id_menu, nama_menu, image_url");
if (error) {
  console.error("Fetch error:", error.message);
  process.exit(1);
}

let updated = 0;
for (const m of menus) {
  const photo = pick(m.nama_menu);
  const { error: e } = await supabase.from("Menus").update({ image_url: photo }).eq("id_menu", m.id_menu);
  if (e) console.error(`  ✗ ${m.nama_menu}: ${e.message}`);
  else {
    updated++;
    console.log(`  ✓ ${m.nama_menu} → ${photo.split("/photo-")[1].slice(0, 14)}…`);
  }
}
console.log(`\nDone. Updated ${updated}/${menus.length} menus.`);
