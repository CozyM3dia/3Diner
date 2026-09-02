import { STAFF_ROLES, type StaffRole } from "@/types";

/** Peta wewenang BAWAAN KODE per peran. Modul netral tanpa dependensi
 *  runtime (hanya tipe) supaya bisa diimpor authorization.ts maupun
 *  role-permissions.ts tanpa membuat ketergantungan melingkar.
 *
 *  Lima peran mengikuti Word §4. Manager = mata-mata operasional outlet
 *  (lihat semua, ubah menu & inventaris, tapi TIDAK mengatur toko/staf).
 *  Staff = operasional outlet, hak default setara kasir.
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
  operate_orders: ["owner", "manager", "cashier", "staff"],
  manage_menu: ["owner", "manager"],
  manage_inventory: ["owner", "manager"],
  manage_settings: ["owner"],
};

/** Bawaan matriks Lihat per permission dalam bentuk sel 5-peran —
 *  dipakai role-permissions.ts untuk menyusun matriks efektif. */
export function permissionDefaultCell(permission: StaffPermission): Record<StaffRole, boolean> {
  const out = {} as Record<StaffRole, boolean>;
  // STAFF_ROLES, bukan Object.keys(PERMISSIONS[p]): PERMISSIONS[p] adalah
  // array peran yang diizinkan, jadi keys-nya "0" dan "1". Sel owner/manager
  // jadi undefined, requireStaffPermission("manage_menu") menolak owner, dan
  // drawer Edit Menu menampilkan "Sesi tidak berlaku" padahal sesinya hidup.
  for (const role of STAFF_ROLES) {
    out[role] = PERMISSIONS[permission].includes(role);
  }
  return out;
}
