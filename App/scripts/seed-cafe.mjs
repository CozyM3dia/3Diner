/** Seed cafe cover + greeting (demo). Run: node scripts/seed-cafe.mjs */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const cover = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80&auto=format&fit=crop";
const greeting = "Selamat datang di Senja Kopi";

const { data, error } = await supabase
  .from("Cafes")
  .update({ cover_url: cover, greeting })
  .eq("slug_url", "senja-kopi")
  .select("nama_cafe");

if (error) console.error(error.message);
else console.log("Updated cafe:", data);
