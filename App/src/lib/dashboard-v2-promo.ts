import { supabaseAdmin } from "@/lib/supabase-admin";
import { isMenuAvailableNow } from "@/lib/menu-availability";
import { describeSchedule, parseDays } from "@/lib/menu-schedule-rules";
import type { Menu } from "@/types";

export const PROMO_TABS = ["berjalan", "terjadwal", "mati"] as const;
export type PromoTab = (typeof PROMO_TABS)[number];

export const PROMO_TAB_LABEL: Record<PromoTab, string> = {
  berjalan: "Berjalan",
  terjadwal: "Terjadwal",
  mati: "Tidak aktif",
};

export function parsePromoTab(value: string | undefined): PromoTab {
  return PROMO_TABS.includes(value as PromoTab) ? (value as PromoTab) : "berjalan";
}

/** Tiga jenis yang dulunya tiga rute terpisah.
 *
 *  Digabung karena ketiganya menjawab satu pertanyaan yang sama: "apa yang tamu
 *  lihat hari ini". Kafe tidak berpikir "ini pengumuman atau diskon" — mereka
 *  berpikir "apa yang tampil di menu". */
export type PromoKind = "diskon" | "jadwal" | "pengumuman";

export const KIND_LABEL: Record<PromoKind, string> = {
  diskon: "Diskon",
  jadwal: "Jadwal",
  pengumuman: "Pengumuman",
};

export interface PromoRow {
  id: string;
  kind: PromoKind;
  /** Nama yang dikenali pemilik, bukan id. */
  name: string;
  /** Apa yang disentuhnya: menu mana, atau di mana banner tampil. */
  scope: string;
  /** Kapan berlaku, ditulis sebagai kalimat. */
  when: string;
  /** Sedang terlihat tamu SEKARANG. */
  activeNow: boolean;
  /** Sudah dinyalakan pemilik, walau mungkin belum waktunya tampil. */
  enabled: boolean;
  /** Tujuan tombol aksinya. */
  href: string;
  actionLabel: string;
}

export function filterPromos(rows: PromoRow[], tab: PromoTab): PromoRow[] {
  if (tab === "berjalan") return rows.filter((r) => r.enabled && r.activeNow);
  if (tab === "terjadwal") return rows.filter((r) => r.enabled && !r.activeNow);
  return rows.filter((r) => !r.enabled);
}

export function promoCounts(rows: PromoRow[]): Record<PromoTab, number> {
  return {
    berjalan: rows.filter((r) => r.enabled && r.activeNow).length,
    terjadwal: rows.filter((r) => r.enabled && !r.activeNow).length,
    mati: rows.filter((r) => !r.enabled).length,
  };
}

/** Urutan: yang sedang terlihat tamu lebih dulu.
 *
 *  Layar ini dibuka untuk memeriksa apa yang tamu lihat sekarang, jadi yang
 *  sedang tampil naik ke atas. Sesudahnya diurutkan per jenis supaya yang
 *  sejenis berdekatan dan bisa dibandingkan. */
export function sortPromos(rows: PromoRow[]): PromoRow[] {
  const kindOrder: Record<PromoKind, number> = { diskon: 0, jadwal: 1, pengumuman: 2 };
  return [...rows].sort((a, b) => {
    if (a.activeNow !== b.activeNow) return a.activeNow ? -1 : 1;
    if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
    return a.name.localeCompare(b.name, "id");
  });
}

export interface PromoPage {
  rows: PromoRow[];
  counts: Record<PromoTab, number>;
  error: string | null;
}

export async function getPromoPage(cafeId: string | null, now = new Date()): Promise<PromoPage> {
  const empty: PromoPage = {
    rows: [],
    counts: { berjalan: 0, terjadwal: 0, mati: 0 },
    error: null,
  };
  if (!cafeId) return { ...empty, error: "Kafe belum terhubung ke akun ini." };

  const [menusResult, annResult] = await Promise.all([
    supabaseAdmin.from("Menus").select("*").eq("cafe_id", cafeId),
    supabaseAdmin.from("Announcements").select("*").eq("cafe_id", cafeId),
  ]);

  if (menusResult.error) return { ...empty, error: menusResult.error.message };

  const rows: PromoRow[] = [];

  for (const raw of menusResult.data ?? []) {
    const menu = raw as Menu;
    const live = isMenuAvailableNow(menu, now);

    if (menu.discount_pct && menu.discount_pct > 0) {
      rows.push({
        id: `diskon-${menu.id_menu}`,
        kind: "diskon",
        name: `${menu.nama_menu} −${menu.discount_pct}%`,
        scope: "1 menu",
        when: describeSchedule({
          isActive: menu.is_active !== false,
          days: parseDays(menu.schedule_days ?? null),
          start: menu.schedule_start ?? null,
          end: menu.schedule_end ?? null,
        }),
        activeNow: live,
        enabled: menu.is_active !== false,
        href: `/dashboard-v2/menu/${menu.id_menu}`,
        actionLabel: "Ubah diskon",
      });
    }

    const hasSchedule = Boolean(menu.schedule_days || menu.schedule_start || menu.schedule_end);
    if (hasSchedule) {
      rows.push({
        id: `jadwal-${menu.id_menu}`,
        kind: "jadwal",
        name: menu.nama_menu,
        scope: "1 menu",
        when: describeSchedule({
          isActive: menu.is_active !== false,
          days: parseDays(menu.schedule_days ?? null),
          start: menu.schedule_start ?? null,
          end: menu.schedule_end ?? null,
        }),
        activeNow: live,
        enabled: menu.is_active !== false,
        href: `/dashboard-v2/menu/${menu.id_menu}`,
        actionLabel: "Ubah jam",
      });
    }
  }

  // Pengumuman tidak punya jadwal sama sekali di skema: ia menyala sampai
  // dimatikan. Menampilkannya seolah punya masa berlaku akan mengarang aturan
  // yang tidak ada, jadi kolom "berlaku" mengatakan apa adanya.
  for (const raw of annResult.data ?? []) {
    const a = raw as { id: string; message: string; is_active: boolean };
    rows.push({
      id: `pengumuman-${a.id}`,
      kind: "pengumuman",
      name: a.message,
      scope: "banner menu tamu",
      when: a.is_active
        ? "Tampil sampai dimatikan — belum punya tanggal berakhir."
        : "Dimatikan.",
      activeNow: a.is_active,
      enabled: a.is_active,
      href: "/dashboard/announcements",
      actionLabel: "Ubah pengumuman",
    });
  }

  return {
    rows,
    counts: promoCounts(rows),
    error: annResult.error ? annResult.error.message : null,
  };
}
