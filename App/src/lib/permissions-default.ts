import type { StaffRole } from "@/types";

/** Peta wewenang BAWAAN KODE per peran. Modul netral tanpa dependensi
 *  runtime (hanya tipe) supaya bisa diimpor authorization.ts maupun
 *  role-permissions.ts tanpa membuat ketergantungan melingkar.
 *
 *  Ini nilai default bila kafe tidak punya override di tabel Role_Permissions;
 *  getEffectivePermissions menggabungkannya dengan override runtime per-kafe
 *  yang disunting dari halaman Roles & Permissions. */
export type StaffPermission =
  | "operate_orders"
  | "manage_menu"
  | "manage_inventory"
  | "manage_settings";

export const PERMISSIONS: Record<StaffPermission, StaffRole[]> = {
  operate_orders: ["owner", "cashier"],
  manage_menu: ["owner"],
  manage_inventory: ["owner"],
  manage_settings: ["owner"],
};
