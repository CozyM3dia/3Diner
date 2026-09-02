/**
 * Provision akun demo 3Diner: user Clerk terverifikasi + shadow Supabase user
 * + kafe demo terpisah + row Staff (owner) + menu contoh.
 *
 * Idempoten — aman dijalankan berulang. Jalankan:
 *   node scripts/provision-demo.mjs
 *
 * Output baris terakhir: JSON {email, password, cafe, slug, role}.
 */
import { readFileSync, randomBytes } from "node:fs";

// ── env ──────────────────────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const CLERK_SECRET = env.CLERK_SECRET_KEY;
const CLERK_API = (env.CLERK_API_URL || "https://api.clerk.com") + "/v1";
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!CLERK_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("CLERK_SECRET_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum lengkap di .env.local");
  process.exit(1);
}

// ── kredensial demo (dipakai ulang kalau user sudah ada) ─────────────────────
const DEMO_EMAIL = "demo@kafe.com";
const DEMO_PASSWORD = env.DEMO_PASSWORD || "demo1234";
const DEMO_NAME = "Demo Owner";
const CAFE_NAME = "Kafe Demo 3Diner";
const CAFE_SLUG = "kafe-demo-3diner";

// ── Clerk Backend API helpers (form-encoded; tanpa dependency ekstra) ────────
async function clerkApi(path, params) {
  const res = await fetch(CLERK_API + path, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === "object" ? JSON.stringify(data.errors ?? data) : text;
    throw new Error(`Clerk ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

async function findClerkUserByEmail(email) {
  const users = await clerkApi(
    `/users?email_address=${encodeURIComponent(email)}&limit=5`,
  );
  return Array.isArray(users) && users.length > 0 ? users[0] : null;
}

async function createClerkDemoUser() {
  return clerkApi("/users", {
    email_address: DEMO_EMAIL,
    email_address_verified: "true",
    password: DEMO_PASSWORD,
    first_name: "Demo",
    last_name: "Owner",
  });
}

// ── Supabase admin ───────────────────────────────────────────────────────────
const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findOrCreateShadowUser(clerkUserId) {
  // Pola sama dengan clerk-identity.ts: cocokkan lewat email, buat kalau belum ada.
  const existing = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const hit = existing.data?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === DEMO_EMAIL,
  );
  if (hit) return hit.id;

  const created = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: randomBytes(32).toString("base64url"), // tak pernah dipakai login langsung
    email_confirm: true,
    user_metadata: { clerk_user_id: clerkUserId },
  });
  if (created.error || !created.data?.user) {
    throw new Error("Gagal membuat shadow user: " + (created.error?.message ?? "?"));
  }
  return created.data.user.id;
}

async function ensureClerkIdentityRow(clerkUserId, supabaseUserId) {
  const { data } = await supabase
    .from("Clerk_Identities")
    .select("clerk_user_id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (data) return;
  const { error } = await supabase.from("Clerk_Identities").insert({
    clerk_user_id: clerkUserId,
    supabase_user_id: supabaseUserId,
    email: DEMO_EMAIL,
  });
  if (error) throw new Error("Gagal insert Clerk_Identities: " + error.message);
}

async function ensureDemoCafe(ownerId) {
  const { data: existing } = await supabase
    .from("Cafes")
    .select("id_cafe")
    .eq("slug_url", CAFE_SLUG)
    .maybeSingle();
  if (existing) return existing.id_cafe;

  const { data, error } = await supabase
    .from("Cafes")
    .insert({
      owner_id: ownerId,
      nama_cafe: CAFE_NAME,
      slug_url: CAFE_SLUG,
      greeting: "Selamat datang di Kafe Demo — silakan jelajahi!",
    })
    .select("id_cafe")
    .single();
  if (error || !data) throw new Error("Gagal membuat kafe demo: " + (error?.message ?? "?"));
  return data.id_cafe;
}

async function ensureStaffRow(cafeId, userId) {
  const { data: existing } = await supabase
    .from("Staff")
    .select("id_staff, role, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    if (!existing.is_active) {
      await supabase.from("Staff").update({ is_active: true }).eq("id_staff", existing.id_staff);
    }
    return existing.role;
  }
  const { error } = await supabase.from("Staff").insert({
    cafe_id: cafeId,
    user_id: userId,
    full_name: DEMO_NAME,
    role: "owner",
    is_active: true,
  });
  if (error) throw new Error("Gagal insert Staff: " + error.message);
  return "owner";
}

const DEMO_MENUS = [
  { nama: "Es Kopi Susu Demo", harga: 22000, kategori: "Minuman", deskripsi: "Kopi susu gula aren — andalan demo." },
  { nama: "Americano Demo", harga: 18000, kategori: "Minuman", deskripsi: "Double shot, air mineral." },
  { nama: "Cappuccino Demo", harga: 25000, kategori: "Minuman", deskripsi: "Rasio 1:1:1 klasik." },
  { nama: "Butter Croissant Demo", harga: 20000, kategori: "Pastry", deskripsi: "Lapisan renyah, mentega premium." },
  { nama: "Cinnamon Roll Demo", harga: 24000, kategori: "Pastry", deskripsi: "Kayu manis + cream cheese." },
  { nama: "Pasta Meatball Demo", harga: 45000, kategori: "Main Course", deskripsi: "Spaghetti, bolognese, basil." },
  { nama: "Grilled Salmon Demo", harga: 68000, kategori: "Main Course", deskripsi: "Salmon panggang, lemon butter." },
  { nama: "Nasi Goreng Kampung Demo", harga: 32000, kategori: "Main Course", deskripsi: "Terasi, telur mata sapi." },
];

async function seedDemoMenus(cafeId) {
  const { count, error } = await supabase
    .from("Menus")
    .select("id_menu", { count: "exact", head: true })
    .eq("cafe_id", cafeId);
  if (error) throw new Error("Gagal menghitung menu: " + error.message);
  if ((count ?? 0) > 0) return 0;

  const rows = DEMO_MENUS.map((m, i) => ({
    cafe_id: cafeId,
    nama_menu: m.nama,
    harga_menu: m.harga,
    description_menu: m.deskripsi,
    category: m.kategori,
    is_active: true,
    sort_order: i,
  }));
  const { error: insertError } = await supabase.from("Menus").insert(rows);
  if (insertError) throw new Error("Gagal seed menu demo: " + insertError.message);
  return rows.length;
}

// ── jalankan ─────────────────────────────────────────────────────────────────
let clerkUser = await findClerkUserByEmail(DEMO_EMAIL);
let createdClerk = false;
if (!clerkUser) {
  clerkUser = await createClerkDemoUser();
  createdClerk = true;
}
console.log(`Clerk user: ${clerkUser.id} (${createdClerk ? "dibuat" : "sudah ada"})`);

const supabaseUserId = await findOrCreateShadowUser(clerkUser.id);
console.log(`Shadow Supabase user: ${supabaseUserId}`);

await ensureClerkIdentityRow(clerkUser.id, supabaseUserId);

const cafeId = await ensureDemoCafe(supabaseUserId);
const role = await ensureStaffRow(cafeId, supabaseUserId);
const menus = await seedDemoMenus(cafeId);
console.log(`Kafe demo: ${cafeId} · role=${role} · menu baru=${menus}`);

console.log(
  JSON.stringify({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    cafe: CAFE_NAME,
    slug: CAFE_SLUG,
    role,
  }),
);
