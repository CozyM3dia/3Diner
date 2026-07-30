import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";
import type { OrderItem } from "@/types";

export const REPORT_MODES = ["penjualan", "tamu", "menu", "pajak"] as const;
export type ReportMode = (typeof REPORT_MODES)[number];

export const MODE_LABEL: Record<ReportMode, string> = {
  penjualan: "Penjualan",
  tamu: "Perilaku tamu",
  menu: "Menu",
  pajak: "Pajak",
};

export function parseMode(value: string | undefined): ReportMode {
  return REPORT_MODES.includes(value as ReportMode) ? (value as ReportMode) : "penjualan";
}

/** Periode dipilih, bukan dikunci mati.
 *
 *  Analitik lama terkunci di 14 hari tanpa jalan mengubahnya, jadi pertanyaan
 *  "bulan ini bagaimana" tidak pernah bisa dijawab dari dashboard. */
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(value: string | undefined): Period {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

export interface DailyPoint {
  /** Tanggal WIB, "yyyy-mm-dd". */
  day: string;
  label: string;
  value: number;
}

/** Deret harian yang MEMUAT hari kosong.
 *
 *  Melewati hari tanpa transaksi membuat grafik memadatkan waktu: dua batang
 *  bersebelahan bisa berjarak seminggu, dan bentuknya berbohong tentang tren. */
export function buildDailySeries(
  rows: { created_at: string; value: number }[],
  days: number,
  now = new Date()
): DailyPoint[] {
  const buckets = new Map<string, number>();
  const start = new Date(startOfTodayWIB(now));
  start.setUTCDate(start.getUTCDate() - (days - 1));

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    buckets.set(wibDayKey(d), 0);
  }

  for (const r of rows) {
    const key = wibDayKey(new Date(r.created_at));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + r.value);
  }

  return [...buckets.entries()].map(([day, value]) => ({
    day,
    label: day.slice(8) + "/" + day.slice(5, 7),
    value,
  }));
}

function wibDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Batang yang disorot: satu, dan yang tertinggi.
 *
 *  Efferd dan dua referensi lain melakukan hal yang sama — grafik monokrom
 *  dengan satu batang digelapkan. Sorotan itu bukan kategori; ia menjawab
 *  "mana yang paling menonjol" tanpa menambah hue. */
export function peakIndex(points: DailyPoint[]): number {
  let best = -1;
  let bestValue = 0;
  points.forEach((p, i) => {
    if (p.value > bestValue) {
      bestValue = p.value;
      best = i;
    }
  });
  return best;
}

/** Kalimat yang menjelaskan bentuk grafiknya.
 *
 *  Grafik memberi tahu bentuk; kalimat memberi tahu artinya. Panel tanpa
 *  kalimat memaksa pemilik menyimpulkan sendiri, dan kesimpulan yang salah
 *  lebih mahal daripada tidak menyimpulkan. */
export function describePeak(points: DailyPoint[], unit: "rupiah" | "count"): string {
  const idx = peakIndex(points);
  if (idx < 0) return "Belum ada transaksi di periode ini.";
  const peak = points[idx];
  const others = points.filter((_, i) => i !== idx);
  const avg = others.length
    ? others.reduce((s, p) => s + p.value, 0) / others.length
    : 0;
  if (avg <= 0) return `Semua aktivitas periode ini jatuh di ${peak.label}.`;
  const pct = Math.round(((peak.value - avg) / avg) * 100);
  const what = unit === "rupiah" ? "omzet" : "pesanan";
  return `${peak.label} tertinggi — ${what}nya ${pct}% di atas rata-rata hari lain.`;
}

export interface MenuTally {
  name: string;
  qty: number;
  revenue: number;
  share: number;
}

/** Menu teratas dihitung dari isi pesanan, bukan dari katalog.
 *
 *  Harga diambil dari baris pesanan, bukan dari harga menu hari ini: item yang
 *  harganya naik bulan lalu tidak boleh membuat penjualan lama ikut naik. */
export function tallyMenus(orders: { items: OrderItem[] }[], limit = 5): MenuTally[] {
  const map = new Map<string, { qty: number; revenue: number }>();
  for (const o of orders) {
    for (const it of Array.isArray(o.items) ? o.items : []) {
      const key = it.nama_menu ?? "(tanpa nama)";
      const prev = map.get(key) ?? { qty: 0, revenue: 0 };
      map.set(key, {
        qty: prev.qty + (it.qty ?? 0),
        revenue: prev.revenue + (it.harga_menu ?? 0) * (it.qty ?? 0),
      });
    }
  }
  const total = [...map.values()].reduce((s, v) => s + v.revenue, 0);
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      qty: v.qty,
      revenue: v.revenue,
      share: total > 0 ? v.revenue / total : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export interface FunnelStep {
  label: string;
  value: number;
  /** Bagian dari langkah pertama, 0–1. */
  ratio: number;
}

/** Corong dari membuka menu sampai memesan.
 *
 *  Ini satu-satunya wilayah yang tidak dimiliki POS mana pun: semuanya merekam
 *  transaksi yang SUDAH terjadi, tidak ada yang merekam bagian sebelumnya. */
export function buildFunnel(counts: { open: number; view3d: number; order: number }): FunnelStep[] {
  const base = counts.open;
  const ratio = (n: number) => (base > 0 ? n / base : 0);
  return [
    { label: "Membuka menu", value: counts.open, ratio: 1 },
    { label: "Melihat model 3D", value: counts.view3d, ratio: ratio(counts.view3d) },
    { label: "Mulai memesan", value: counts.order, ratio: ratio(counts.order) },
  ];
}

export function describeFunnel(steps: FunnelStep[]): string {
  const [open, view, order] = steps;
  if (open.value === 0) return "Belum ada tamu yang membuka menu di periode ini.";
  const per100 = (n: number) => Math.round((n / open.value) * 100);
  return `Dari setiap 100 tamu yang membuka menu, ${per100(view.value)} melihat model 3D dan ${per100(
    order.value
  )} mulai memesan.`;
}

export interface TaxSummary {
  subtotal: number;
  service: number;
  tax: number;
  total: number;
  /** Pesanan yang dihitung tanpa tarif sama sekali. */
  untaxedOrders: number;
  orders: number;
}

/** Ringkasan pajak dari POTRET tiap pesanan, bukan dari tarif kafe hari ini.
 *
 *  Itu sebabnya potretnya ada: laporan bulan lalu harus tetap menjumlah ke
 *  angka yang sama walau tarifnya berubah minggu ini. */
export function summarizeTax(
  orders: { subtotal?: number; service_amount?: number; tax_amount?: number; total: number; tax_pct?: number }[]
): TaxSummary {
  return orders.reduce<TaxSummary>(
    (acc, o) => ({
      subtotal: acc.subtotal + (o.subtotal ?? o.total),
      service: acc.service + (o.service_amount ?? 0),
      tax: acc.tax + (o.tax_amount ?? 0),
      total: acc.total + o.total,
      untaxedOrders: acc.untaxedOrders + ((o.tax_pct ?? 0) > 0 ? 0 : 1),
      orders: acc.orders + 1,
    }),
    { subtotal: 0, service: 0, tax: 0, total: 0, untaxedOrders: 0, orders: 0 }
  );
}

/** Batas baris kejadian yang ditarik untuk deret harian. Cacahnya tetap dari
 *  count() yang tidak terbatas, jadi angka besar tetap benar walau grafiknya
 *  dibangun dari cuplikan. */
export const EVENT_ROW_CAP = 5000;

export interface ReportRow {
  created_at: string;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string | null;
  items: OrderItem[];
  subtotal?: number;
  service_amount?: number;
  tax_amount?: number;
  tax_pct?: number;
}

export interface ReportPage {
  orders: ReportRow[];
  events: { open: number; view3d: number; order: number };
  /** Waktu tiap kali menu dibuka, untuk deret harian.
   *
   *  Dibatasi supaya kafe ramai tidak menarik puluhan ribu baris hanya untuk
   *  menggambar tiga puluh batang. */
  openTimestamps: string[];
  error: string | null;
}

export async function getReportPage(
  cafeId: string | null,
  days: Period,
  now = new Date()
): Promise<ReportPage> {
  const empty: ReportPage = {
    orders: [],
    events: { open: 0, view3d: 0, order: 0 },
    openTimestamps: [],
    error: null,
  };
  if (!cafeId) return { ...empty, error: "Kafe belum terhubung ke akun ini." };

  const start = new Date(startOfTodayWIB(now));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const since = start.toISOString();

  const countEvents = (type: string) =>
    supabaseAdmin
      .from("Analytics_Logs")
      .select("id_log", { count: "exact", head: true })
      .eq("cafe_id", cafeId)
      .eq("event_type", type)
      .gte("created_at", since);

  const [ordersResult, open, view3d, order, openRows] = await Promise.all([
    supabaseAdmin
      .from("Orders")
      .select(
        "created_at,total,status,payment_status,payment_method,items,subtotal,service_amount,tax_amount,tax_pct"
      )
      .eq("cafe_id", cafeId)
      .gte("created_at", since),
    countEvents("click_menu"),
    countEvents("view_3d"),
    countEvents("click_order"),
    supabaseAdmin
      .from("Analytics_Logs")
      .select("created_at")
      .eq("cafe_id", cafeId)
      .eq("event_type", "click_menu")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(EVENT_ROW_CAP),
  ]);

  if (ordersResult.error) return { ...empty, error: ordersResult.error.message };

  return {
    orders: (ordersResult.data ?? []) as ReportRow[],
    events: {
      open: open.count ?? 0,
      view3d: view3d.count ?? 0,
      order: order.count ?? 0,
    },
    openTimestamps: (openRows.data ?? []).map((r) => r.created_at as string),
    error: null,
  };
}

/** Uang yang benar-benar diterima, bukan yang dipesan.
 *
 *  Pesanan yang belum dibayar bukan omzet. Menjumlahkannya membuat laporan
 *  selalu lebih besar dari isi laci, dan selisihnya tidak pernah bisa dijelaskan. */
export function paidOrders(orders: ReportRow[]): ReportRow[] {
  return orders.filter((o) => o.payment_status === "paid");
}

export function completedOrders(orders: ReportRow[]): ReportRow[] {
  return orders.filter((o) => o.status === "completed");
}
