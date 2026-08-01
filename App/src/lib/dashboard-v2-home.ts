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
  /** Nama pemenang di balik angkanya, kalau ada.
   *
   *  "Menu dibuka tamu · 64" tidak menyuruh siapa pun mengerjakan apa pun —
   *  ia lolos sebagai fakta dan gagal uji tindakan §0.3. "Paling sering
   *  dibuka: Es Kopi Susu" langsung memberi tahu apa yang layak difoto
   *  ulang, dinaikkan harganya, atau dijadikan promo.
   *
   *  Bentuknya diambil dari Admin Console 4D Smart Menu, yang menampilkan
   *  MOST VIEWED / MOST ORDERED / HIGHEST REVENUE sebagai tiga nama hidangan,
   *  bukan tiga angka. */
  detail?: string;
}

/** Menu yang paling sering dibuka hari ini, disebut namanya.
 *
 *  Mengembalikan `undefined` — bukan kalimat pengganti — kalau tidak ada
 *  pemenang yang jelas. Tiga keadaan sengaja diam: belum ada yang membuka
 *  menu, log tidak menyimpan `menu_id`, dan menu yang menang sudah dihapus
 *  dari katalog. Menyebut "tidak diketahui" di tiga keadaan itu menambah
 *  baris yang tidak membawa tindakan apa pun.
 *
 *  Seri terikat juga diam: kalau dua menu sama-sama teratas, tidak ada satu
 *  nama yang benar untuk disebut, dan memilih salah satunya diam-diam
 *  membuat pemilik mengejar menu yang keliru. */
export function topOpenedMenu(
  rows: { menu_id: string | null }[] | null,
  menus: { id_menu: string; nama_menu: string }[] | null
): string | undefined {
  if (!rows?.length || !menus?.length) return undefined;

  const tally = new Map<string, number>();
  for (const r of rows) {
    if (!r.menu_id) continue;
    tally.set(r.menu_id, (tally.get(r.menu_id) ?? 0) + 1);
  }
  if (tally.size === 0) return undefined;

  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return undefined;

  const name = menus.find((m) => m.id_menu === ranked[0][0])?.nama_menu;
  return name ? `paling sering dibuka: ${name}` : undefined;
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

  const [
    inventory,
    recipes,
    menus,
    cafe,
    ordersToday,
    ordersLastWeek,
    viewsToday,
    viewsLastWeek,
    everOrder,
    viewRowsToday,
  ] = await Promise.all([
      supabaseAdmin
        .from("Inventory_Items")
        .select("id_inventory_item,name,current_qty,minimum_qty")
        .eq("cafe_id", cafeId),
      supabaseAdmin.from("Menu_Recipes").select("menu_id,inventory_item_id").eq("cafe_id", cafeId),
      supabaseAdmin.from("Menus").select("id_menu,nama_menu,model_3d_url,is_active").eq("cafe_id", cafeId),
      supabaseAdmin.from("Cafes").select("tax_configured_at").eq("id_cafe", cafeId).maybeSingle(),
      supabaseAdmin
        .from("Orders")
        .select("total,status,payment_status")
        .eq("cafe_id", cafeId)
        .gte("created_at", todayStart),
      supabaseAdmin
        .from("Orders")
        .select("total,status,payment_status")
        .eq("cafe_id", cafeId)
        .gte("created_at", weekAgoStart)
        .lt("created_at", weekAgoEnd),
      supabaseAdmin
        .from("Analytics_Logs")
        .select("id_log", { count: "exact", head: true })
        .eq("cafe_id", cafeId)
        .eq("event_type", "click_menu")
        .gte("created_at", todayStart),
      supabaseAdmin
        .from("Analytics_Logs")
        .select("id_log", { count: "exact", head: true })
        .eq("cafe_id", cafeId)
        .eq("event_type", "click_menu")
        .gte("created_at", weekAgoStart)
        .lt("created_at", weekAgoEnd),
      supabaseAdmin
        .from("Orders")
        .select("id_order", { count: "exact", head: true })
        .eq("cafe_id", cafeId),
      /* Baris mentah hari ini, hanya kolom menu_id, untuk menemukan menu yang
         paling sering dibuka. Dibatasi supaya kafe ramai tidak menarik puluhan
         ribu baris cuma untuk menyebut satu nama; kalau batas ini terlampaui,
         pemenangnya tetap benar untuk potongan yang terbaca dan angka
         hitungannya tetap datang dari query `count` yang terpisah. */
      supabaseAdmin
        .from("Analytics_Logs")
        .select("menu_id")
        .eq("cafe_id", cafeId)
        .eq("event_type", "click_menu")
        .gte("created_at", todayStart)
        .limit(2000),
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

  const failure =
    ordersToday.error ?? ordersLastWeek.error ?? viewsToday.error ?? viewsLastWeek.error ?? null;

  const sum = (rows: { total: number | null }[] | null) =>
    (rows ?? []).reduce((s, r) => s + (r.total ?? 0), 0);
  const paid = (rows: { payment_status?: string; total: number | null }[] | null) =>
    (rows ?? []).filter((r) => r.payment_status === "paid");
  const completed = (rows: { status?: string }[] | null) =>
    (rows ?? []).filter((r) => r.status === "completed").length;

  const figures: HomeFigure[] | null = failure
    ? null
    : [
        {
          value: sum(paid(ordersToday.data)),
          label: "Omzet diterima hari ini · Rp",
          comparison: describeDelta(sum(paid(ordersToday.data)), sum(paid(ordersLastWeek.data)), "rupiah"),
        },
        {
          value: completed(ordersToday.data),
          label: "Pesanan selesai",
          comparison: describeDelta(completed(ordersToday.data), completed(ordersLastWeek.data), "count"),
        },
        {
          // Dinamai apa adanya. Yang direkam adalah menu dibuka, bukan QR
          // dipindai — menyebutnya "Scan QR" akan mengklaim data yang tidak ada.
          value: viewsToday.count ?? 0,
          label: "Menu dibuka tamu",
          comparison: describeDelta(viewsToday.count ?? 0, viewsLastWeek.count ?? 0, "count"),
          detail: topOpenedMenu(viewRowsToday.data, menus.data),
        },
      ];

  return {
    tasks: shown,
    hiddenTasks: hidden,
    figures,
    figuresError: failure ? failure.message : null,
    cashierOnDuty: null,
    everSoldAnything: (everOrder.count ?? 0) > 0,
  };
}
