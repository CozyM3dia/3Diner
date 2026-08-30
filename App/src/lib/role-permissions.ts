import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  PERMISSIONS,
  permissionDefaultCell,
  type StaffPermission,
} from "@/lib/permissions-default";
import { STAFF_ROLES, type StaffRole } from "@/types";

/** Matriks wewenang EFEKTIF: bawaan kode (PERMISSIONS di permissions-default.ts)
 *  digabung override runtime per-kafe dari tabel Role_Permissions.
 *
 *  Override disimpan per (cafe_id, permission) dalam kolom per-peran:
 *  owner_allowed, manager_allowed, cashier_allowed, kitchen_allowed,
 *  staff_allowed. Baris lama yang hanya punya owner/cashier tetap terbaca —
 *  kolom lain dianggap NULL dan mengikuti bawaan kode per peran.
 *  Kegagalan membaca override APAPUN jatuh kembali ke bawaan kode:
 *  konsol tidak boleh terkunci karena lapisan override mati. */

export type PermCell = Record<StaffRole, boolean> & { override: boolean };
export type EffectiveMatrix = Record<StaffPermission, PermCell>;

export interface EffectivePermissions {
  matrix: EffectiveMatrix;
  tableMissing: boolean;
}

const SEMUA_PERMISI = Object.keys(PERMISSIONS) as StaffPermission[];

function matriksBawaan(): EffectiveMatrix {
  const matrix = {} as EffectiveMatrix;
  for (const p of SEMUA_PERMISI) {
    matrix[p] = { ...permissionDefaultCell(p), override: false };
  }
  return matrix;
}

/** Matriks bawaan kode murni (tanpa DB) — dipakai halaman untuk mengirim
 *  pembanding "default" ke UI, agar Reset selalu pulih ke nilai kode, bukan
 *  ke override yang sedang aktif. */
export function getDefaultMatrix(): EffectiveMatrix {
  return matriksBawaan();
}

/** Satu request = satu bacaan DB walau dipanggil berkali-kali
 *  (requireStaffPermission bisa dipanggil beberapa kali per aksi). */
export const getEffectivePermissions = cache(
  async (cafeId: string): Promise<EffectivePermissions> => {
    const matrix = matriksBawaan();
    if (!cafeId) return { matrix, tableMissing: false };

    type Row = {
      permission: string;
      owner_allowed?: boolean | null;
      manager_allowed?: boolean | null;
      cashier_allowed?: boolean | null;
      kitchen_allowed?: boolean | null;
      staff_allowed?: boolean | null;
    };
    let rows: Row[];
    try {
      const { data, error } = await supabaseAdmin
        .from("Role_Permissions")
        .select(
          "permission,owner_allowed,manager_allowed,cashier_allowed,kitchen_allowed,staff_allowed"
        )
        .eq("cafe_id", cafeId);

      if (error) {
        // 42P01 = relation does not exist (migrasi belum dijalankan).
        const missing =
          (error as { code?: string }).code === "42P01" ||
          /does not exist|Could not find the table/i.test(error.message);
        // Error lain (koneksi dsb): bawaan kode tetap berlaku.
        return { matrix, tableMissing: missing };
      }
      rows = (data ?? []) as Row[];
    } catch {
      // Klien DB gagal keras (mis. mock test tanpa tabel ini) → bawaan kode.
      return { matrix, tableMissing: false };
    }

    const kolomPeran = {
      owner: "owner_allowed",
      manager: "manager_allowed",
      cashier: "cashier_allowed",
      kitchen: "kitchen_allowed",
      staff: "staff_allowed",
    } as const;

    for (const row of rows) {
      const p = row.permission as StaffPermission;
      if (!SEMUA_PERMISI.includes(p)) continue;
      const cell = { ...permissionDefaultCell(p), override: true };
      for (const role of STAFF_ROLES) {
        const v = row[kolomPeran[role]];
        if (typeof v === "boolean") cell[role] = v;
      }
      matrix[p] = cell;
    }
    return { matrix, tableMissing: false };
  },
);
