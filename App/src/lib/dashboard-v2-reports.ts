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

/** Batas baris kejadian yang ditarik untuk deret harian.
 *  @deprecated Deret harian kini diagregasi di Postgres (analytics_event_summary);
 *  konstanta ini hanya tersisa untuk kompatibilitas. */
export const EVENT_ROW_CAP = 5000;

export interface ReportPage {
  /** Uang yang DITERIMA (pesanan lunas) dan jumlahnya. */
  paidRevenue: number;
  paidCount: number;
  completedCount: number;
  hasOrders: boolean;
  /** Ringkasan pajak dari potret tiap pesanan. */
  tax: TaxSummary;
  /** Deret omzet harian (WIB), hanya hari yang punya data — pemanggil mengisi hari kosong. */
  dailyRevenue: { day: string; value: number }[];
  /** Kontribusi per menu (harga dari baris pesanan), urut menurun omzet. */
  perItem: { name: string; qty: number; revenue: number }[];
  events: { open: number; view3d: number; order: number };
  /** Cacah klik menu per hari (WIB), exact — bukan cuplikan terbatas. */
  openDaily: { day: string; value: number }[];
  error: string | null;
}

export async function getReportPage(
  cafeId: string | null,
  days: Period,
  now = new Date()
): Promise<ReportPage> {
  const empty: ReportPage = {
    paidRevenue: 0,
    paidCount: 0,
    completedCount: 0,
    hasOrders: false,
    tax: { subtotal: 0, service: 0, tax: 0, total: 0, untaxedOrders: 0, orders: 0 },
    dailyRevenue: [],
    perItem: [],
    events: { open: 0, view3d: 0, order: 0 },
    openDaily: [],
    error: null,
  };
  if (!cafeId) return { ...empty, error: "Kafe belum terhubung ke akun ini." };

  const start = new Date(startOfTodayWIB(now));
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const since = start.toISOString();

  // Dua roundtrip total: report_analytics untuk Orders, analytics_event_summary
  // untuk corong tamu + deret harian click_menu (exact, digrouping di Postgres).
  const [ordersResult, eventResult] = await Promise.all([
    supabaseAdmin.rpc("report_analytics", { p_cafe_id: cafeId, p_start: since, p_end: null }),
    supabaseAdmin.rpc("analytics_event_summary", { p_cafe_id: cafeId, p_start: since }),
  ]);

  if (ordersResult.error) return { ...empty, error: ordersResult.error.message };

  const agg = (ordersResult.data ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number => Number(v) || 0;
  const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const taxRaw = (agg.tax && typeof agg.tax === "object" ? agg.tax : {}) as Record<string, unknown>;
  const orderCount = num(agg.order_count);

  const ev = (eventResult.data ?? {}) as Record<string, unknown>;

  return {
    paidRevenue: num(agg.paid_revenue),
    paidCount: num(agg.paid_count),
    completedCount: num(agg.completed_count),
    hasOrders: orderCount > 0,
    tax: {
      subtotal: num(taxRaw.subtotal),
      service: num(taxRaw.service),
      tax: num(taxRaw.tax),
      total: num(taxRaw.total),
      untaxedOrders: num(taxRaw.untaxed_orders),
      orders: orderCount,
    },
    dailyRevenue: asArray(agg.daily_revenue).map((d) => {
      const r = d as Record<string, unknown>;
      return { day: r.day as string, value: num(r.value) };
    }),
    perItem: asArray(agg.per_item).map((p) => {
      const r = p as Record<string, unknown>;
      return { name: r.name as string, qty: num(r.qty), revenue: num(r.revenue) };
    }),
    events: {
      open: num(ev.open),
      view3d: num(ev.view3d),
      order: num(ev.order),
    },
    openDaily: asArray(ev.open_daily).map((d) => {
      const r = d as Record<string, unknown>;
      return { day: r.day as string, value: num(r.value) };
    }),
    error: eventResult.error ? eventResult.error.message : null,
  };
}
