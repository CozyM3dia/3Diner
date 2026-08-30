import { STAFF_ROLES, type StaffRole } from "@/types";

/** Label + deskripsi singkat 5 peran (Word §4) — sumber tunggal untuk
 *  dropdown Manage Staffs, tabel, dan komponen lain. */
export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Kasir",
  kitchen: "Dapur",
  staff: "Staf",
};

export const ROLE_DESKRIPSI: Record<StaffRole, string> = {
  owner: "Akses penuh konsol ini",
  manager: "Operasional outlet, laporan, stok & approval",
  cashier: "Melayani pesanan di /kasir",
  kitchen: "Antrean pesanan di /dapur (KDS)",
  staff: "Akses operasional outlet (default setara kasir)",
};

/** Pill kecil berwarna per peran — dipakai tabel & dropdown. */
export default function RolePill({ role }: { role: StaffRole }) {
  const warna: Record<StaffRole, string> = {
    owner: "dp-role-pill-owner",
    manager: "dp-role-pill-manager",
    cashier: "dp-role-pill-cashier",
    kitchen: "dp-role-pill-kitchen",
    staff: "dp-role-pill-staff",
  };
  return <span className={`dp-role-pill ${warna[role]}`}>{ROLE_LABELS[role]}</span>;
}

export { STAFF_ROLES };
