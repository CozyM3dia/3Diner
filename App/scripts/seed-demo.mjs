#!/usr/bin/env node
/**
 * seed-demo — menyiapkan akun demo 3Diner beserta kafe dan datanya.
 *
 * Kenapa skrip, bukan langkah manual di dashboard Clerk: akun demo perlu ada
 * di TIGA tempat yang harus cocok satu sama lain — user Clerk (autentikasi),
 * user Supabase + baris `Clerk_Identities` (jembatan identitas), lalu baris
 * `Cafes` + `Staff` (otorisasi). Salah satu meleset, orang yang menekan
 * tombol demo mendarat di "akun belum terhubung ke kafe" dan tidak ada yang
 * tahu bagian mana yang kurang. Di sini keempatnya dibuat dalam satu jalan,
 * idempoten, dan bisa dijalankan ulang setelah kredensialnya dirotasi.
 *
 * Pakai:
 *   node scripts/seed-demo.mjs                     # akun + salin katalog kafe sumber
 *   node scripts/seed-demo.mjs --from-slug=senja-kopi
 *   node scripts/seed-demo.mjs --no-data           # akun + kafe kosong saja
 *   node scripts/seed-demo.mjs --password="..."    # tetapkan password sendiri
 *   node scripts/seed-demo.mjs --purge             # hapus kafe demo + isinya
 *
 * Katalog demo DISALIN dari kafe sungguhan (menu, foto, model 3D, varian),
 * bukan dibuat dari daftar makanan palsu. Pesanan di kafe sumber tidak
 * disalin — privasi tamu — melainkan diisi ulang dari menu yang sama agar
 * dapur/POS punya antrean contoh. Slug demo tetap `demo-3diner` supaya
 * teman tidak menginjak kafe produksi.
 *
 * Kredensial diambil dari argumen, lalu dari env (DEMO_EMAIL/DEMO_PASSWORD
 * atau NEXT_PUBLIC_DEMO_*), lalu bawaan. Password dicetak di akhir karena
 * memang untuk dibagikan; JANGAN pakai password yang dipakai di tempat lain.
 *
 * Env yang dibaca dari .env.local: CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY. Kunci Clerk menentukan INSTANCE yang disentuh —
 * sk_test menulis ke instance development, sk_live ke produksi. Untuk situs
 * yang sudah dideploy, jalankan dengan kunci live.
 */

import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ── Env ──────────────────────────────────────────────────────────────── */

function muatEnv(namaBerkas) {
  const jalur = resolve(ROOT, namaBerkas);
  if (!existsSync(jalur)) return;
  for (const baris of readFileSync(jalur, "utf8").split(/\r?\n/)) {
    const cocok = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(baris);
    if (!cocok) continue;
    const [, kunci, mentah] = cocok;
    if (process.env[kunci]) continue; // env nyata menang atas berkas
    process.env[kunci] = mentah.replace(/^["']|["']$/g, "");
  }
}

muatEnv(".env.local");

const arg = (nama, bawaan = null) => {
  const hit = process.argv.find(a => a.startsWith(`--${nama}=`));
  return hit ? hit.slice(nama.length + 3) : bawaan;
};
const flag = nama => process.argv.includes(`--${nama}`);

const EMAIL = (arg("email") ?? process.env.DEMO_EMAIL ?? process.env.NEXT_PUBLIC_DEMO_EMAIL ?? "demo@3diner.app")
  .trim()
  .toLowerCase();
const PASSWORD =
  arg("password") ?? process.env.DEMO_PASSWORD ?? process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "DemoKafe3Diner!26";
const NAMA_KAFE = arg("cafe", "Kopi Senja (Demo)");
const SLUG = arg("slug", "demo-3diner");
const SOURCE_SLUG = (arg("from-slug") ?? process.env.DEMO_SOURCE_SLUG ?? "").trim() || null;
const PERAN = arg("role", "owner");
const ISI_DATA = !flag("no-data");
const PURGE = flag("purge");

const CLERK_KEY = process.env.CLERK_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CLERK_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Env belum lengkap. Butuh CLERK_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: CLERK_KEY });
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const instans = CLERK_KEY.startsWith("sk_live") ? "PRODUKSI (sk_live)" : "development (sk_test)";

const log = (...isi) => console.log(...isi);
const gagal = pesan => {
  console.error(`\n✖ ${pesan}`);
  process.exit(1);
};

/* ── Langkah 1: user Clerk ────────────────────────────────────────────── */

function usernameDari(email) {
  const lokal = email.split("@")[0] ?? "demo";
  return lokal.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "demo";
}

async function pastikanUserClerk() {
  const daftar = await clerk.users.getUserList({ emailAddress: [EMAIL], limit: 10 });
  const adaSudah = daftar.data[0];

  if (adaSudah) {
    // Password disetel ulang tiap jalan supaya kredensial yang dicetak selalu
    // yang benar-benar berlaku — rotasi cukup dengan menjalankan ulang skrip.
    await clerk.users.updateUser(adaSudah.id, { password: PASSWORD, skipPasswordChecks: true });
    log(`• Clerk  : user sudah ada, password disegarkan (${adaSudah.id})`);
    return adaSudah.id;
  }

  const baru = await clerk.users.createUser({
    emailAddress: [EMAIL],
    password: PASSWORD,
    username: usernameDari(EMAIL),
    skipPasswordChecks: true,
    firstName: "Demo",
    lastName: "3Diner",
    publicMetadata: { demo: true },
  });
  log(`• Clerk  : user dibuat (${baru.id})`);
  return baru.id;
}

/* ── Langkah 2: identitas Supabase + jembatan ─────────────────────────── */

async function cariUserSupabase(email) {
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) gagal(`Gagal membaca daftar user Supabase: ${error.message}`);
    const hit = data.users.find(u => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function pastikanIdentitas(clerkUserId) {
  let userId = await cariUserSupabase(EMAIL);

  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { clerk_user_id: clerkUserId, demo: true },
    });
    if (error || !data.user) gagal(`Gagal membuat user Supabase: ${error?.message}`);
    userId = data.user.id;
    log(`• Supabase: user auth dibuat (${userId})`);
  } else {
    log(`• Supabase: user auth sudah ada (${userId})`);
  }

  const { error } = await db
    .from("Clerk_Identities")
    .upsert(
      { clerk_user_id: clerkUserId, supabase_user_id: userId, email: EMAIL, updated_at: new Date().toISOString() },
      { onConflict: "clerk_user_id" },
    );
  if (error) gagal(`Gagal menautkan identitas Clerk↔Supabase: ${error.message}`);
  log("• Jembatan: baris Clerk_Identities tersinkron");

  return userId;
}

/* ── Langkah 3: kafe + staf ───────────────────────────────────────────── */

async function pastikanKafe(ownerId) {
  const { data: adaSudah } = await db.from("Cafes").select("id_cafe").eq("slug_url", SLUG).maybeSingle();
  if (adaSudah) {
    log(`• Kafe   : sudah ada (${adaSudah.id_cafe})`);
    return adaSudah.id_cafe;
  }

  const { data, error } = await db
    .from("Cafes")
    .insert({
      nama_cafe: NAMA_KAFE,
      slug_url: SLUG,
      owner_id: ownerId,
      alamat_cafe: "Jl. Contoh Demo No. 3, Bandung",
      greeting: "Selamat datang di kafe demo 3Diner — semua isinya data contoh.",
      tax_rate_pct: 11,
      service_charge_pct: 5,
      prices_include_tax: false,
      tax_configured_at: new Date().toISOString(),
      subscription_type: "Tier 50k",
      status_lunas: true,
    })
    .select("id_cafe")
    .single();
  if (error) gagal(`Gagal membuat kafe demo: ${error.message}`);
  log(`• Kafe   : dibuat (${data.id_cafe})`);
  return data.id_cafe;
}

async function pastikanStaf(cafeId, userId) {
  const { error } = await db.from("Staff").upsert(
    {
      cafe_id: cafeId,
      user_id: userId,
      full_name: "Owner Demo",
      role: PERAN,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cafe_id,user_id" },
  );
  if (error) gagal(`Gagal membuat baris Staff: ${error.message}`);
  log(`• Staf   : peran ${PERAN} aktif di kafe demo`);
}

async function cariKafeSumber() {
  if (SOURCE_SLUG) {
    const { data, error } = await db
      .from("Cafes")
      .select("id_cafe, nama_cafe, slug_url")
      .eq("slug_url", SOURCE_SLUG)
      .maybeSingle();
    if (error) gagal(`Gagal mencari kafe sumber: ${error.message}`);
    if (!data) gagal(`Kafe sumber slug "${SOURCE_SLUG}" tidak ada.`);
    if (data.slug_url === SLUG) gagal("Kafe sumber tidak boleh sama dengan kafe demo.");
    return data;
  }

  const { data, error } = await db.from("Cafes").select("id_cafe, nama_cafe, slug_url").neq("slug_url", SLUG);
  if (error) gagal(`Gagal membaca daftar kafe: ${error.message}`);
  const kandidat = data ?? [];
  if (kandidat.length === 0) return null;

  let terbaik = kandidat[0];
  let skorTerbaik = -1;
  for (const k of kandidat) {
    const { count } = await db
      .from("Menus")
      .select("id_menu", { count: "exact", head: true })
      .eq("cafe_id", k.id_cafe)
      .not("model_3d_url", "is", null);
    const skor = count ?? 0;
    if (skor > skorTerbaik) {
      skorTerbaik = skor;
      terbaik = k;
    }
  }
  return terbaik;
}

async function salinWajahKafe(demoId, sumber) {
  const { data, error } = await db
    .from("Cafes")
    .select(
      "alamat_cafe, greeting, logo_url, cover_url, google_maps_review_url, tax_rate_pct, service_charge_pct, prices_include_tax, tax_configured_at",
    )
    .eq("id_cafe", sumber.id_cafe)
    .single();
  if (error) {
    log(`• Kafe   : wajah sumber dilewati (${error.message})`);
    return;
  }

  const { error: up } = await db
    .from("Cafes")
    .update({
      nama_cafe: `${sumber.nama_cafe} (Demo)`,
      alamat_cafe: data.alamat_cafe,
      greeting: data.greeting,
      logo_url: data.logo_url,
      cover_url: data.cover_url,
      google_maps_review_url: data.google_maps_review_url,
      tax_rate_pct: data.tax_rate_pct,
      service_charge_pct: data.service_charge_pct,
      prices_include_tax: data.prices_include_tax,
      tax_configured_at: data.tax_configured_at,
    })
    .eq("id_cafe", demoId);
  if (up) log(`• Kafe   : gagal menyalin wajah (${up.message})`);
  else log(`• Kafe   : wajah disalin dari ${sumber.nama_cafe} (${sumber.slug_url})`);
}

const KOLOM_MENU = [
  "nama_menu",
  "harga_menu",
  "description_menu",
  "model_3d_url",
  "usdz_url",
  "redirect_link",
  "image_url",
  "category",
  "prep_time_minutes",
  "calories",
  "ingredients",
  "is_active",
  "discount_pct",
  "schedule_days",
  "schedule_start",
  "schedule_end",
  "sort_order",
  "model_scale",
];

async function kosongkanKatalogDemo(cafeId) {
  for (const tabel of [
    "Analytics_Logs",
    "Orders",
    "Menu_Option_Recipes",
    "Menu_Option_Values",
    "Menu_Option_Groups",
    "Menus",
  ]) {
    const { error } = await db.from(tabel).delete().eq("cafe_id", cafeId);
    if (error && !/does not exist|Could not find the table|schema cache/i.test(error.message)) {
      log(`  ! ${tabel}: ${error.message}`);
    }
  }
}

async function salinKatalog(demoId, sumber) {
  const { data: sumberMenus, error: errMenu } = await db
    .from("Menus")
    .select(`id_menu, ${KOLOM_MENU.join(", ")}`)
    .eq("cafe_id", sumber.id_cafe)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("nama_menu", { ascending: true });
  if (errMenu) gagal(`Gagal membaca menu sumber: ${errMenu.message}`);
  if (!sumberMenus?.length) gagal(`Kafe ${sumber.slug_url} tidak punya menu untuk disalin.`);

  await kosongkanKatalogDemo(demoId);

  const idMenu = {};
  const seenCatalog = new Set();
  const barisMenu = sumberMenus.filter(m => {
    const key = `${String(m.nama_menu ?? "").trim().replace(/\s*\((?:compress|generate\s+\d+)\)\s*$/i, "").toLocaleLowerCase()}\u0000${String(m.image_url ?? "").trim()}`;
    if (!String(m.nama_menu ?? "").trim() || seenCatalog.has(key)) return false;
    seenCatalog.add(key);
    return true;
  }).map(m => {
    const id = randomUUID();
    idMenu[m.id_menu] = id;
    const salinan = { id_menu: id, cafe_id: demoId };
    for (const kolom of KOLOM_MENU) salinan[kolom] = m[kolom];
    return salinan;
  });

  const { data: menus, error: insMenu } = await db
    .from("Menus")
    .insert(barisMenu)
    .select("id_menu, nama_menu, harga_menu, model_3d_url");
  if (insMenu) gagal(`Gagal menyalin menu: ${insMenu.message}`);

  const dengan3d = (menus ?? []).filter(m => m.model_3d_url).length;
  log(`• Menu   : ${menus.length} item disalin dari ${sumber.nama_cafe} (${dengan3d} punya model 3D)`);

  const { data: groups, error: errG } = await db
    .from("Menu_Option_Groups")
    .select("id_option_group, menu_id, name, min_select, max_select, sort_order")
    .eq("cafe_id", sumber.id_cafe);
  if (errG) {
    log(`• Varian : dilewati (${errG.message})`);
    return menus;
  }

  const idGrup = {};
  const barisGrup = (groups ?? [])
    .filter(g => idMenu[g.menu_id])
    .map(g => {
      const id = randomUUID();
      idGrup[g.id_option_group] = id;
      return {
        id_option_group: id,
        cafe_id: demoId,
        menu_id: idMenu[g.menu_id],
        name: g.name,
        min_select: g.min_select,
        max_select: g.max_select,
        sort_order: g.sort_order,
      };
    });
  if (barisGrup.length) {
    const { error } = await db.from("Menu_Option_Groups").insert(barisGrup);
    if (error) log(`• Varian : grup gagal (${error.message})`);
  }

  const { data: values, error: errV } = await db
    .from("Menu_Option_Values")
    .select("option_group_id, name, price_delta, is_active, sort_order")
    .eq("cafe_id", sumber.id_cafe);
  if (errV) {
    log(`• Varian : nilai dilewati (${errV.message})`);
    return menus;
  }

  const barisNilai = (values ?? [])
    .filter(v => idGrup[v.option_group_id])
    .map(v => ({
      id_option_value: randomUUID(),
      cafe_id: demoId,
      option_group_id: idGrup[v.option_group_id],
      name: v.name,
      price_delta: v.price_delta,
      is_active: v.is_active,
      sort_order: v.sort_order,
    }));
  if (barisNilai.length) {
    const { error } = await db.from("Menu_Option_Values").insert(barisNilai);
    if (error) log(`• Varian : nilai gagal (${error.message})`);
    else log(`• Varian : ${barisGrup.length} grup, ${barisNilai.length} pilihan`);
  } else if (barisGrup.length) {
    log(`• Varian : ${barisGrup.length} grup tanpa pilihan`);
  }

  return menus;
}

/* ── Langkah 4: data contoh ───────────────────────────────────────────────
   Angka dibuat deterministik (PRNG berbenih tetap) supaya dua kali jalan
   menghasilkan grafik yang sama — demo yang berubah-ubah tiap dijalankan
   sulit dipakai untuk menunjukkan hal yang sama dua kali. */

function acak(benih) {
  let s = benih >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const MENU_DEMO = [
  { nama: "Nasi Goreng Gila", harga: 38000, kategori: "Makanan Berat", kalori: 620 },
  { nama: "Ayam Bakar Madu", harga: 45000, kategori: "Makanan Berat", kalori: 540 },
  { nama: "Mie Goreng Jawa", harga: 32000, kategori: "Makanan Berat", kalori: 580 },
  { nama: "Es Kopi Susu Senja", harga: 22000, kategori: "Kopi", kalori: 180 },
  { nama: "Americano Dingin", harga: 20000, kategori: "Kopi", kalori: 15 },
  { nama: "Matcha Latte", harga: 26000, kategori: "Non-Kopi", kalori: 210 },
  { nama: "Kentang Goreng Truffle", harga: 28000, kategori: "Camilan", kalori: 430 },
  { nama: "Cheesecake Stroberi", harga: 30000, kategori: "Dessert", kalori: 390 },
];

async function isiMenu(cafeId) {
  const { data: adaSudah } = await db.from("Menus").select("id_menu").eq("cafe_id", cafeId).limit(1);
  if (adaSudah?.length) {
    const { data } = await db.from("Menus").select("id_menu, nama_menu, harga_menu").eq("cafe_id", cafeId);
    log(`• Menu   : sudah terisi (${data.length} item), dilewati`);
    return data;
  }

  const baris = MENU_DEMO.map((m, i) => ({
    cafe_id: cafeId,
    nama_menu: m.nama,
    harga_menu: m.harga,
    category: m.kategori,
    calories: m.kalori,
    description_menu: "Item contoh untuk demo 3Diner.",
    is_active: i !== MENU_DEMO.length - 1, // satu item Offline supaya status terlihat berbeda
    sort_order: i,
    prep_time_minutes: 8 + (i % 5) * 3,
  }));

  const { data, error } = await db.from("Menus").insert(baris).select("id_menu, nama_menu, harga_menu");
  if (error) gagal(`Gagal mengisi menu demo: ${error.message}`);
  log(`• Menu   : ${data.length} item dibuat`);
  return data;
}

async function isiPesanan(cafeId, menus) {
  const { count } = await db
    .from("Orders")
    .select("id_order", { count: "exact", head: true })
    .eq("cafe_id", cafeId);
  if (count) {
    log(`• Pesanan: sudah ada ${count} baris, dilewati`);
    return;
  }

  const rnd = acak(3277);
  const sekarang = Date.now();
  const baris = [];

  for (let hariLalu = 20; hariLalu >= 0; hariLalu -= 1) {
    const tanggal = new Date(sekarang - hariLalu * 86_400_000);
    const akhirPekan = [0, 6].includes(tanggal.getDay());
    const jumlah = Math.round((akhirPekan ? 11 : 7) + rnd() * 5);

    for (let i = 0; i < jumlah; i += 1) {
      // Jam sibuk: makan siang dan makan malam, bukan sebaran rata.
      const jam = rnd() < 0.55 ? 11 + Math.floor(rnd() * 3) : 17 + Math.floor(rnd() * 4);
      const dibuat = new Date(tanggal);
      dibuat.setHours(jam, Math.floor(rnd() * 60), Math.floor(rnd() * 60), 0);

      const jumlahItem = 1 + Math.floor(rnd() * 3);
      const items = [];
      let subtotal = 0;
      for (let k = 0; k < jumlahItem; k += 1) {
        const m = menus[Math.floor(rnd() * menus.length)];
        const qty = 1 + Math.floor(rnd() * 2);
        const harga = Number(m.harga_menu);
        subtotal += harga * qty;
        items.push({ id_menu: m.id_menu, nama_menu: m.nama_menu, harga_menu: harga, qty });
      }

      const pajak = Math.round(subtotal * 0.11);
      const layanan = Math.round(subtotal * 0.05);
      const total = subtotal + pajak + layanan;

      // Distribusi status: mayoritas lunas, sisanya menunggu bayar, sedikit
      // batal. Hari ini menyisakan beberapa pesanan berjalan supaya papan
      // Pesanan, Dapur, dan panel "Butuh perhatian" tidak kosong.
      const undi = rnd();
      let status = "completed";
      let paymentStatus = "paid";
      let dibatalkan = null;

      if (hariLalu === 0 && undi < 0.35) {
        status = undi < 0.15 ? "preparing" : "ready";
        paymentStatus = undi < 0.08 ? "unpaid" : "paid";
      } else if (undi > 0.93) {
        status = "cancelled";
        paymentStatus = "unpaid";
        dibatalkan = dibuat.toISOString();
      } else if (undi > 0.86) {
        status = "received";
        paymentStatus = "unpaid";
      }

      baris.push({
        id_order: `DEMO-${hariLalu.toString().padStart(2, "0")}${i.toString().padStart(2, "0")}-${Math.floor(
          rnd() * 9000 + 1000,
        )}`,
        cafe_id: cafeId,
        table_number: rnd() < 0.15 ? "Take Away" : `Meja ${1 + Math.floor(rnd() * 14)}`,
        items,
        subtotal,
        tax_pct: 11,
        tax_amount: pajak,
        service_pct: 5,
        service_amount: layanan,
        prices_include_tax: false,
        total,
        status,
        payment_status: paymentStatus,
        payment_method: paymentStatus === "paid" ? (rnd() < 0.55 ? "qris" : "cash") : null,
        created_at: dibuat.toISOString(),
        completed_at: status === "completed" ? new Date(dibuat.getTime() + 25 * 60_000).toISOString() : null,
        cancelled_at: dibatalkan,
        cancelled_reason: dibatalkan ? "Tamu batal memesan" : null,
      });
    }
  }

  // Disisipkan bertahap: satu insert 250+ baris kadang ditolak batas payload.
  for (let i = 0; i < baris.length; i += 100) {
    const { error } = await db.from("Orders").insert(baris.slice(i, i + 100));
    if (error) gagal(`Gagal mengisi pesanan demo: ${error.message}`);
  }
  log(`• Pesanan: ${baris.length} baris dibuat (21 hari terakhir)`);
  return baris.length;
}

async function isiJejakTamu(cafeId, menus, jumlahPesanan) {
  const { count } = await db
    .from("Analytics_Logs")
    .select("id_log", { count: "exact", head: true })
    .eq("cafe_id", cafeId);
  if (count) {
    log(`• Jejak  : sudah ada ${count} baris, dilewati`);
    return;
  }

  const rnd = acak(9091);
  const sekarang = Date.now();
  const baris = [];

  for (let hariLalu = 20; hariLalu >= 0; hariLalu -= 1) {
    const bukaMenu = 18 + Math.floor(rnd() * 22);
    const lihat3d = Math.round(bukaMenu * (0.45 + rnd() * 0.2));
    const mulaiPesan = Math.round(bukaMenu * (0.22 + rnd() * 0.12));

    const tambah = (tipe, banyak) => {
      for (let i = 0; i < banyak; i += 1) {
        const t = new Date(sekarang - hariLalu * 86_400_000);
        t.setHours(10 + Math.floor(rnd() * 11), Math.floor(rnd() * 60), 0, 0);
        baris.push({
          cafe_id: cafeId,
          menu_id: menus[Math.floor(rnd() * menus.length)].id_menu,
          event_type: tipe,
          created_at: t.toISOString(),
        });
      }
    };

    tambah("click_menu", bukaMenu);
    tambah("view_3d", lihat3d);
    tambah("click_order", mulaiPesan);
  }

  for (let i = 0; i < baris.length; i += 200) {
    const { error } = await db.from("Analytics_Logs").insert(baris.slice(i, i + 200));
    if (error) {
      log(`• Jejak  : dilewati (${error.message})`);
      return;
    }
  }
  log(`• Jejak  : ${baris.length} peristiwa tamu dibuat untuk ${jumlahPesanan ?? "?"} pesanan`);
}

/* ── Purge ────────────────────────────────────────────────────────────── */

async function purge() {
  const { data: kafe } = await db.from("Cafes").select("id_cafe").eq("slug_url", SLUG).maybeSingle();
  if (!kafe) return log("Tidak ada kafe demo dengan slug tersebut. Tidak ada yang dihapus.");

  for (const tabel of ["Analytics_Logs", "Orders", "Menus", "Staff"]) {
    const { error } = await db.from(tabel).delete().eq("cafe_id", kafe.id_cafe);
    if (error) log(`  ! ${tabel}: ${error.message}`);
  }
  const { error } = await db.from("Cafes").delete().eq("id_cafe", kafe.id_cafe);
  if (error) gagal(`Gagal menghapus kafe demo: ${error.message}`);

  log(`Kafe demo ${kafe.id_cafe} beserta menu, pesanan, jejak, dan stafnya dihapus.`);
  log("User Clerk dan user Supabase-nya SENGAJA dibiarkan — hapus manual bila memang mau dicabut.");
}

/* ── Jalan ────────────────────────────────────────────────────────────── */

async function main() {
  log(`\n3Diner · seed akun demo`);
  log(`Instance Clerk : ${instans}`);
  log(`Supabase       : ${SUPABASE_URL.replace(/^https:\/\//, "")}`);
  log(`Email demo     : ${EMAIL}\n`);

  if (PURGE) return purge();

  const clerkUserId = await pastikanUserClerk();
  const userId = await pastikanIdentitas(clerkUserId);
  const cafeId = await pastikanKafe(userId);
  await pastikanStaf(cafeId, userId);

  if (ISI_DATA) {
    const sumber = await cariKafeSumber();
    let menus;
    if (sumber) {
      await salinWajahKafe(cafeId, sumber);
      menus = await salinKatalog(cafeId, sumber);
    } else {
      log("• Sumber : tidak ada kafe lain — memakai menu contoh");
      menus = await isiMenu(cafeId);
    }
    const jumlah = await isiPesanan(cafeId, menus);
    await isiJejakTamu(cafeId, menus, jumlah);
  } else {
    log("• Data   : dilewati (--no-data)");
  }

  log(`\n✔ Selesai. Kredensial demo:\n`);
  log(`    Email    : ${EMAIL}`);
  log(`    Password : ${PASSWORD}\n`);
  log(`Tempel ke environment supaya panel demo muncul di /login:\n`);
  log(`    NEXT_PUBLIC_DEMO_EMAIL=${EMAIL}`);
  log(`    NEXT_PUBLIC_DEMO_PASSWORD=${PASSWORD}\n`);
  log(`Kredensial ini publik begitu tayang. Katalognya salinan; akun demo TIDAK`);
  log(`ditautkan ke kafe produksi. Jangan pakai password yang dipakai di tempat lain.\n`);
}

main().catch(err => gagal(err?.message ?? String(err)));
