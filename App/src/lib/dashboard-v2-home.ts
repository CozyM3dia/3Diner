import { supabaseAdmin } from "@/lib/supabase-admin";
import { startOfTodayWIB } from "@/lib/dashboard-today";

/** Satu baris antrean "Perlu diurus".
 *
 *  Setiap baris WAJIB punya aksi yang bisa dikerjakan hari ini. Baris yang cuma
 *  melapor tidak boleh ada di sini — satu baris sampah merusak kepercayaan pada
 *  seluruh antrean, dan setelah itu antreannya berhenti dibaca. */
export interface HomeTask {
  id: string;
  /** Label kelompok pendek di kolom kiri. */
  kind: string;
  text: string;
  /** Keadaan yang menyebabkan baris ini ada, sebagai kata. */
  state: string;
  actionLabel: string;
  href: string;
  /** Makin kecil makin mendesak. Menentukan mana yang tampil saat lebih dari 3. */
  urgency: number;
}

export interface HomeFigure {
  value: number | null;
  label: string;
  /** Pembanding wajib: angka tanpa pembanding tidak bisa dinilai. */
  comparison: string;
}

export interface HomeData {
  tasks: HomeTask[];
  /** Jumlah baris yang tidak ditampilkan karena batas tiga. */
  hiddenTasks: number;
  figures: HomeFigure[] | null;
  /** Kenapa angkanya tidak tersedia, dalam bahasa manusia.
   *
   *  "—" tanpa alasan menyembunyikan kegagalan alih-alih menyatakannya: saat
   *  query ini salah kolom, layarnya tetap terlihat wajar dan bugnya baru
   *  ketahuan berjam-jam kemudian. */
  figuresError: string | null;
  cashierOnDuty: string | null;
  everSoldAnything: boolean;
}

/** Kelas A membatasi objek setara per kelompok di tiga.
 *
 *  Di atas itu mata beralih dari memindai ke membaca berurutan, dan "sekilas"
 *  jadi mustahil — yang justru satu-satunya alasan layar ini ada. */
export const MAX_TASKS = 3;

export function pickTasks(all: HomeTask[]): { shown: HomeTask[]; hidden: number } {
  const sorted = [...all].sort((a, b) => a.urgency - b.urgency);
  return { shown: sorted.slice(0, MAX_TASKS), hidden: Math.max(0, sorted.length - MAX_TASKS) };
}

/** Pembanding ditulis relatif terhadap hari yang sama minggu lalu.
 *
 *  Kafe bergerak mengikuti hari dalam minggu, bukan tanggal: membandingkan Sabtu
 *  dengan Jumat kemarin menghasilkan delta yang selalu salah baca. */
export function describeDelta(today: number, lastWeek: number, unit: "rupiah" | "count"): string {
  if (lastWeek === 0) return today === 0 ? "sama seperti pekan lalu" : "belum ada pembanding pekan lalu";
  const diff = today - lastWeek;
  if (diff === 0) return "sama seperti pekan lalu";
  const sign = diff > 0 ? "+" : "−";
  const magnitude = Math.abs(diff);
  if (unit === "count") return `${sign}${magnitude} vs pekan lalu`;
  const pct = Math.round((diff / lastWeek) * 100);
  return `${sign}${Math.abs(pct)}% vs pekan lalu`;
}

function daysAgoIso(days: number): string {
  const d = new Date(startOfTodayWIB());
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

interface CafeSettings {
  tax_configured_at: string | null;
}

/** Merakit isi Beranda Konsol Owner.
 *
 *  Mengembalikan `figures: null` kalau angkanya gagal diambil — dibedakan dari
 *  nol yang benar, karena nol saat query gagal tidak terlihat seperti kegagalan
 *  dan pemilik menyimpulkan kafenya sepi. */
export async function getHomeData(cafeId: string | null): Promise<HomeData> {
  if (!cafeId) {
    return {
      tasks: [],
      hiddenTasks: 0,
      figures: null,
      figuresError: "Kafe belum terhubung ke akun ini.",
      cashierOnDuty: null,
      everSoldAnything: false,
    };
  }

  const todayStart = startOfTodayWIB();
  const weekAgoStart = daysAgoIso(7);
  const weekAgoEnd = daysAgoIso(6);

  // Tugas antrean butuh baris penuh (inventory/recipes/menus/cafe), tapi angka
  // figur semuanya agregat: satu RPC menggantikan lima query yang sebelumnya
  // menarik semua baris Orders hari ini + minggu lalu ke Node.
  const [inventory, recipes, menus, cafe, figuresResult] = await Promise.all([
    supabaseAdmin
      .from("Inventory_Items")
      .select("id_inventory_item,name,current_qty,minimum_qty")
      .eq("cafe_id", cafeId),
    supabaseAdmin.from("Menu_Recipes").select("menu_id,inventory_item_id").eq("cafe_id", cafeId),
    supabaseAdmin.from("Menus").select("id_menu,nama_menu,model_3d_url,is_active").eq("cafe_id", cafeId),
    supabaseAdmin.from("Cafes").select("tax_configured_at").eq("id_cafe", cafeId).maybeSingle(),
    supabaseAdmin.rpc("home_figures", {
      p_cafe_id: cafeId,
      p_today_start: todayStart,
      p_compare_start: weekAgoStart,
      p_compare_end: weekAgoEnd,
    }),
  ]);

  const tasks: HomeTask[] = [];

  // 1. Bahan di bawah minimum, dengan jumlah menu yang ikut mati.
  //    "Sisa 0,4 kg" tidak memberi tahu apa pun sampai kita tahu 2 menu mati.
  const lowItems = (inventory.data ?? []).filter(
    (i) => Number(i.current_qty) <= Number(i.minimum_qty)
  );
  if (lowItems.length > 0) {
    const lowIds = new Set(lowItems.map((i) => i.id_inventory_item));
    const affected = new Set(
      (recipes.data ?? []).filter((r) => lowIds.has(r.inventory_item_id)).map((r) => r.menu_id)
    );
    const first = lowItems[0];
    tasks.push({
      id: "stok",
      kind: "Stok",
      text:
        lowItems.length === 1
          ? `${first.name} ${first.current_qty} — di bawah minimum ${first.minimum_qty}`
          : `${lowItems.length} bahan di bawah minimum`,
      state: affected.size > 0 ? `${affected.size} menu terdampak` : "belum dipakai resep",
      actionLabel: "Buka Stok",
      href: "/dashboard-v2/stok",
      urgency: affected.size > 0 ? 0 : 3,
    });
  }

  // 2. Pajak belum pernah diputuskan. Satu-satunya pengaturan yang sengaja
  //    tidak punya default diam-diam: struk mencetak 0% tanpa ada yang memilihnya.
  if (cafe.data && !(cafe.data as CafeSettings).tax_configured_at) {
    tasks.push({
      id: "pajak",
      kind: "Pajak",
      text: "Pajak & service charge belum diatur — struk mencetak 0%",
      state: "wajib sebelum jualan serius",
      actionLabel: "Atur sekarang",
      href: "/dashboard-v2/pengaturan",
      urgency: 1,
    });
  }

  // 3. Menu tayang tanpa model 3D.
  //    Catatan jujur: kegagalan pembuatan model TIDAK disimpan di mana pun, jadi
  //    "6 model gagal diproses" di wireframe tidak punya sumber data. Yang bisa
  //    diukur adalah menu aktif yang belum punya model sama sekali — dan itu
  //    tetap bisa ditindaklanjuti hari ini.
  const missing3d = (menus.data ?? []).filter(
    (m) => m.is_active !== false && !String(m.model_3d_url ?? "").trim()
  );
  if (missing3d.length > 0) {
    tasks.push({
      id: "model3d",
      kind: "Model 3D",
      text:
        missing3d.length === 1
          ? `${missing3d[0].nama_menu} belum punya model 3D`
          : `${missing3d.length} menu tayang belum punya model 3D`,
      state: "tamu tidak bisa melihatnya",
      actionLabel: "Buka Menu",
      href: "/dashboard-v2/menu",
      urgency: 2,
    });
  }

  const { shown, hidden } = pickTasks(tasks);

  const failure = figuresResult.error ?? null;

  const fig = (figuresResult.data ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number => Number(v) || 0;
  const todayPaid = num(fig.today_paid_revenue);
  const comparePaid = num(fig.compare_paid_revenue);
  const todayCompleted = num(fig.today_completed);
  const compareCompleted = num(fig.compare_completed);
  const viewsTodayCount = num(fig.views_today);
  const viewsCompareCount = num(fig.views_compare);

  const figures: HomeFigure[] | null = failure
    ? null
    : [
        {
          value: todayPaid,
          label: "Omzet diterima hari ini · Rp",
          comparison: describeDelta(todayPaid, comparePaid, "rupiah"),
        },
        {
          value: todayCompleted,
          label: "Pesanan selesai",
          comparison: describeDelta(todayCompleted, compareCompleted, "count"),
        },
        {
          // Dinamai apa adanya. Yang direkam adalah menu dibuka, bukan QR
          // dipindai — menyebutnya "Scan QR" akan mengklaim data yang tidak ada.
          value: viewsTodayCount,
          label: "Menu dibuka tamu",
          comparison: describeDelta(viewsTodayCount, viewsCompareCount, "count"),
        },
      ];

  return {
    tasks: shown,
    hiddenTasks: hidden,
    figures,
    figuresError: failure ? failure.message : null,
    cashierOnDuty: null,
    everSoldAnything: num(fig.ever_orders) > 0,
  };
}
