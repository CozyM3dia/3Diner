import type { StaffPermission } from "@/lib/permissions-default";

/** Model UI matriks Roles & Permissions ala Dream POS (role-permission.html):
 *  kartu daftar peran di kiri + tabel Modul × aksi ber-checkbox di kanan.
 *
 *  Peran mengikuti Business Plan §4 (Owner/Admin, Manager, Cashier,
 *  Kitchen/Bar, Staff) — kini LIMA peran nyata. Modul mengikuti modul
 *  nyata dashboard 3Diner.
 *
 *  Keterkaitan backend (JANGAN mengarang): sel LIHAT modul ber-permission
 *  untuk KELIMA peran tersimpan 5 kolom di tabel Role_Permissions dan
 *  ditegakkan requireStaffPermission. Sel aksi granular (Tambah/Ubah/Hapus/
 *  Ekspor/Setujui) tetap pratinjau UI — komponen wajib menyampaikan itu
 *  dengan jujur. Guard anti-kunci-dirinya tetap dijaga server-side. */

export const PERM_ROLES = [
  {
    key: "owner",
    nama: "Owner / Admin",
    ket: "Akses penuh: semua outlet, paket, billing, laporan, pengguna, dan pengaturan.",
  },
  {
    key: "manager",
    nama: "Manager",
    ket: "Operasional outlet, laporan, stok, shift, dan approval tertentu.",
  },
  {
    key: "cashier",
    nama: "Kasir",
    ket: "POS/kasir, order, pembayaran, struk, dan shift sendiri.",
  },
  {
    key: "kitchen",
    nama: "Kitchen / Bar",
    ket: "KDS/ticket sesuai station dan update status produksi.",
  },
  {
    key: "staff",
    nama: "Staf",
    ket: "Akses terbatas sesuai permission yang diberikan.",
  },
] as const;

export type UiRoleKey = (typeof PERM_ROLES)[number]["key"];

export interface UiModule {
  key: string;
  nama: string;
  ket: string;
  /** Permission backend yang menegakkan kolom LIHAT untuk owner/cashier.
   *  Modul tanpa perm belum punya penegakan di server (pratinjau). */
  perm?: StaffPermission;
}

export const PERM_MODULES: UiModule[] = [
  { key: "beranda", nama: "Beranda", ket: "Ringkasan penjualan & aktivitas harian" },
  {
    key: "orders",
    nama: "Pesanan & Kasir",
    ket: "Antrean order, pembayaran, dan struk",
    perm: "operate_orders",
  },
  { key: "menu", nama: "Menu", ket: "Item, kategori, addon, dan QR", perm: "manage_menu" },
  { key: "inventory", nama: "Inventaris", ket: "Bahan baku, resep, dan stok", perm: "manage_inventory" },
  { key: "reports", nama: "Laporan", ket: "Penjualan, produk, payment, dan shift" },
  {
    key: "settings",
    nama: "Pengaturan",
    ket: "Profil toko, pajak, staf, dan wewenang",
    perm: "manage_settings",
  },
];

export const PERM_ACTIONS = [
  { key: "lihat", nama: "Lihat" },
  { key: "tambah", nama: "Tambah" },
  { key: "ubah", nama: "Ubah" },
  { key: "hapus", nama: "Hapus" },
  { key: "ekspor", nama: "Ekspor" },
  { key: "setujui", nama: "Setujui / Batalkan" },
] as const;

export type UiActionKey = (typeof PERM_ACTIONS)[number]["key"];

/** Sel UI: satu peran × satu modul × satu aksi. */
export type PermRow = Record<UiActionKey, boolean>;
/** Satu modul dilihat dari satu peran. */
export type PermRoleMatrix = Record<string, PermRow>;
/** Seluruh peran. */
export type PermUiMatrix = Record<UiRoleKey, PermRoleMatrix>;

/** Pola akses pratinjau per modul: peran mana yang boleh LIHAT (mengikuti
 *  pembagian kerja §3). Aksi granular di luar "lihat" pratinjaunya:
 *  owner penuh; peran lain kosong sampai backend granular ada. */
const POLA_LIHAT: Record<string, UiRoleKey[]> = {
  beranda: ["owner", "manager", "cashier", "kitchen", "staff"],
  orders: ["owner", "manager", "cashier", "kitchen"],
  menu: ["owner", "manager"],
  inventory: ["owner", "manager"],
  reports: ["owner", "manager"],
  settings: ["owner"],
};

/** Matriks pratinjau penuh per peran: setiap peran melihat SEMUA modul,
 *  sel lihat-nya mengikuti pola §3; aksi lain hanya untuk owner. */
export function buildPreviewMatrix(): PermUiMatrix {
  const out = {} as PermUiMatrix;
  for (const role of PERM_ROLES) {
    const rm = {} as PermRoleMatrix;
    for (const m of PERM_MODULES) {
      const bolehLihat = (POLA_LIHAT[m.key] ?? ["owner"]).includes(role.key);
      const row = {} as PermRow;
      for (const a of PERM_ACTIONS) {
        row[a.key] = a.key === "lihat" ? bolehLihat : role.key === "owner";
      }
      rm[m.key] = row;
    }
    out[role.key] = rm;
  }
  return out;
}
