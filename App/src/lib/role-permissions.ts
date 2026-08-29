import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PERMISSIONS, type StaffPermission } from "@/lib/permissions-default";
import type { StaffRole } from "@/types";

/** Matriks wewenang EFEKTIF: bawaan kode (PERMISSIONS di permissions-default.ts)
 *  digabung override runtime per-kafe dari tabel Role_Permissions.
 *
 *  Tanpa tabel override (belum dimigrasi), matriks = persis bawaan kode dan
 *  tableMissing=true — UI menampilkan kartu setup, bukan switch palsu.
 *  Kegagalan membaca override APAPUN (koneksi, mock test, dsb) jatuh kembali
 *  ke bawaan kode: konsol tidak boleh terkunci karena lapisan override mati. */

export type PermCell = { owner: boolean; cashier: boolean; override: boolean };
export type EffectiveMatrix = Record<StaffPermission, PermCell>;

export interface EffectivePermissions {
  matrix: EffectiveMatrix;
  tableMissing: boolean;
}

const SEMUA_PERMISI = Object.keys(PERMISSIONS) as StaffPermission[];

function bawaan(permission: StaffPermission, role: StaffRole): boolean {
  return PERMISSIONS[permission].includes(role);
}

function matriksBawaan(): EffectiveMatrix {
  const matrix = {} as EffectiveMatrix;
  for (const p of SEMUA_PERMISI) {
    matrix[p] = { owner: bawaan(p, "owner"), cashier: bawaan(p, "cashier"), override: false };
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

    let rows: { permission: string; owner_allowed: boolean; cashier_allowed: boolean }[];
    try {
      const { data, error } = await supabaseAdmin
        .from("Role_Permissions")
        .select("permission,owner_allowed,cashier_allowed")
        .eq("cafe_id", cafeId);

      if (error) {
        // 42P01 = relation does not exist (migrasi belum dijalankan).
        const missing =
          (error as { code?: string }).code === "42P01" ||
          /does not exist|Could not find the table/i.test(error.message);
        // Error lain (koneksi dsb): bawaan kode tetap berlaku.
        return { matrix, tableMissing: missing };
      }
      rows = (data ?? []) as typeof rows;
    } catch {
      // Klien DB gagal keras (mis. mock test tanpa tabel ini) → bawaan kode.
      return { matrix, tableMissing: false };
    }

    for (const row of rows) {
      const p = row.permission as StaffPermission;
      if (!SEMUA_PERMISI.includes(p)) continue;
      matrix[p] = {
        owner: row.owner_allowed,
        cashier: row.cashier_allowed,
        override: true,
      };
    }
    return { matrix, tableMissing: false };
  },
);
