import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PRESETS, presetRange, isoDay, parseDay, addDays, type PresetKey } from "@/lib/date-range";
import type { MenuRow, OrderRow } from "@/lib/dashboard-metrics";

/** Pengambilan data untuk dua halaman analitik konsol (Ringkasan & Penjualan).
 *
 *  Keduanya membaca rentang yang sama dari URL, menarik Orders dua periode
 *  (terpilih + pembanding) dalam satu kueri, dan membaca peristiwa tamu
 *  (Analytics_Logs) lewat RPC agregasi. Ditaruh di satu modul supaya kedua
 *  halaman tidak bisa diam-diam berbeda definisi rentang atau pembanding.
 */

export type Rentang = {
  fromIso: string;
  toIso: string;
  preset: PresetKey;
  spanDays: number;
  /** ISO timestamp awal rentang terpilih. */
  since: string;
  /** ISO timestamp awal rentang pembanding (tepat sebelum rentang terpilih). */
  sincePrev: string;
  until: string;
};

/** Rentang aktif dari URL (?from&to, YYYY-MM-DD). Default 7 hari, bukan 30:
 *  pada volume kafe kecil, 30 hari menghasilkan dua batang dan 28 nol — grafik
 *  seperti itu memfitnah kafenya alih-alih menerangkan apa pun. */
export function resolveRentang(params: { from?: string; to?: string }): Rentang {
  const RE = /^\d{4}-\d{2}-\d{2}$/;
  const from = params.from && RE.test(params.from) ? params.from : null;
  const to = params.to && RE.test(params.to) ? params.to : null;

  let fromIso: string;
  let toIso: string;
  let preset: PresetKey;
  if (from && to && from <= to) {
    const hit = PRESETS.find((p) => {
      if (p.key === "custom") return false;
      const r = presetRange(p.key);
      return r.from === from && r.to === to;
    });
    fromIso = from;
    toIso = to;
    preset = hit?.key ?? "custom";
  } else {
    const fallback = presetRange("7d");
    fromIso = fallback.from;
    toIso = fallback.to;
    preset = "7d";
  }

  const spanDays = Math.round((parseDay(toIso).getTime() - parseDay(fromIso).getTime()) / 864e5) + 1;
  const prevFromIso = isoDay(addDays(parseDay(fromIso), -spanDays));
  return {
    fromIso,
    toIso,
    preset,
    spanDays,
    since: new Date(`${fromIso}T00:00:00`).toISOString(),
    sincePrev: new Date(`${prevFromIso}T00:00:00`).toISOString(),
    until: new Date(parseDay(toIso).getTime() + 864e5 - 1).toISOString(),
  };
}

export type PesananDuaPeriode = { kini: OrderRow[]; lalu: OrderRow[]; menus: MenuRow[] };

/** Orders dua periode + Menus dalam satu perjalanan paralel ke database.
 *  Melempar bila salah satu gagal — halaman memilih menampilkan layar gagal,
 *  bukan angka yang setengah benar. */
export async function muatPesanan(cafeId: string, r: Rentang): Promise<PesananDuaPeriode> {
  const [ordersRes, menusRes] = await Promise.all([
    supabaseAdmin
      .from("Orders")
      .select("id_order,total,status,payment_status,payment_method,table_number,items,created_at")
      .eq("cafe_id", cafeId)
      .gte("created_at", r.sincePrev)
      .lte("created_at", r.until)
      .order("created_at", { ascending: false })
      .limit(4000),
    supabaseAdmin
      .from("Menus")
      .select("id_menu,nama_menu,harga_menu,image_url,category,is_active")
      .eq("cafe_id", cafeId)
      .limit(300),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (menusRes.error) throw menusRes.error;

  const semua = (ordersRes.data ?? []) as OrderRow[];
  return {
    kini: semua.filter((o) => o.created_at >= r.since),
    lalu: semua.filter((o) => o.created_at < r.since),
    menus: (menusRes.data ?? []) as MenuRow[],
  };
}

export type TotalPeristiwa = { click_menu: number; view_3d: number; click_order: number };

export type PeristiwaTamu = {
  kini: TotalPeristiwa;
  lalu: TotalPeristiwa;
  /** Per menu pada rentang terpilih — untuk peringkat "paling dilirik". */
  perMenu: { id: string; nama: string; thumb: string | null; klik: number; lihat3d: number; pesan: number }[];
  /** 24 slot: cacah semua peristiwa per jam WIB. */
  perJam: number[];
  /** Benar bila RPC gagal — UI menampilkan penjelasan, bukan nol palsu. */
  gagal: boolean;
};

const NOL: TotalPeristiwa = { click_menu: 0, view_3d: 0, click_order: 0 };

/** Peristiwa tamu (buka menu, lihat 3D, mulai pesan) untuk rentang terpilih
 *  dan pembandingnya. Dua panggilan RPC — `this_week/last_week` bawaan RPC
 *  terpaku pada 7 hari terakhir dan tidak mengikuti rentang yang dipilih. */
export async function muatPeristiwa(cafeId: string, r: Rentang, menus: MenuRow[]): Promise<PeristiwaTamu> {
  const [kiniRes, laluRes] = await Promise.all([
    supabaseAdmin.rpc("dashboard_analytics", { p_cafe_id: cafeId, p_start: r.since, p_end: r.until }),
    supabaseAdmin.rpc("dashboard_analytics", { p_cafe_id: cafeId, p_start: r.sincePrev, p_end: r.since }),
  ]);
  if (kiniRes.error || laluRes.error) {
    return { kini: NOL, lalu: NOL, perMenu: [], perJam: Array(24).fill(0), gagal: true };
  }

  const num = (v: unknown) => Number(v) || 0;
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const totals = (agg: Record<string, unknown>): TotalPeristiwa => {
    const t = obj(agg.totals);
    return { click_menu: num(t.click_menu), view_3d: num(t.view_3d), click_order: num(t.click_order) };
  };

  const aggKini = obj(kiniRes.data);
  const aggLalu = obj(laluRes.data);
  const byId = new Map(menus.map((m) => [m.id_menu, m]));

  const perMenu = arr(aggKini.per_dish)
    .map((row) => {
      const d = obj(row);
      const id = String(d.menu_id ?? "");
      const m = byId.get(id);
      return {
        id,
        nama: m?.nama_menu ?? "Menu terhapus",
        thumb: m?.image_url ?? null,
        klik: num(d.clicks),
        lihat3d: num(d.views),
        pesan: num(d.orders),
      };
    })
    .filter((d) => d.id && d.klik + d.lihat3d + d.pesan > 0)
    .sort((a, b) => b.klik - a.klik || b.lihat3d - a.lihat3d)
    .slice(0, 6);

  const perJam = arr(aggKini.hourly).map(num);
  while (perJam.length < 24) perJam.push(0);

  return { kini: totals(aggKini), lalu: totals(aggLalu), perMenu, perJam: perJam.slice(0, 24), gagal: false };
}
