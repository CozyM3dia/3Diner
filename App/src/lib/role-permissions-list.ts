import { PERMISSIONS, type StaffPermission } from "@/lib/permissions-default";

/** Daftar permission yang diatur matriks Roles & Permissions.
 *  Aman diimpor komponen klien: sumbernya permissions-default.ts yang murni
 *  (types + konstanta, tanpa dependensi server). JANGAN mengimpor
 *  authorization.ts di sini — modul itu menyeret supabase server ke bundle klien. */
export const SEMUA_PERMISI = Object.keys(PERMISSIONS) as StaffPermission[];

export const LABEL_PERMISI: Record<StaffPermission, { nama: string; deskripsi: string }> = {
  operate_orders: {
    nama: "Pesanan",
    deskripsi: "Membuka antrean dan memproses pembayaran di Kasir",
  },
  manage_menu: {
    nama: "Menu",
    deskripsi: "Menyunting menu, kategori, dan addon",
  },
  manage_inventory: {
    nama: "Inventaris",
    deskripsi: "Menyesuaikan stok bahan",
  },
  manage_settings: {
    nama: "Pengaturan",
    deskripsi: "Profil toko, pajak, service charge, staf, dan wewenang",
  },
};
