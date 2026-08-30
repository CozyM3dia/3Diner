"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffPermission } from "@/lib/authorization";
import { SEMUA_PERMISI } from "@/lib/role-permissions-list";
import { permissionDefaultCell } from "@/lib/permissions-default";
import type { StaffPermission } from "@/lib/authorization";
import { STAFF_ROLES, type StaffRole } from "@/types";

/** Simpan override wewenang per-kafe ke tabel Role_Permissions.
 *
 *  Sel disimpan per-peran penuh (5 kolom: owner, manager, cashier, kitchen,
 *  staff). Guard penting:
 *  - Pemilik TIDAK BOLEH menarik manage_settings dari perannya sendiri —
 *    satu-satunya peran yang bisa membuka halaman ini. Kalau itu terjadi,
 *    tidak ada lagi yang bisa memulihkannya dari dalam aplikasi.
 *  - Kasir & Staf tidak bisa diberi manage_settings dari UI: halaman
 *    pengaturan memanggil requireStaffPermission("manage_settings") sebagai
 *    akses-pemilik; melonggarkannya di sini membuat klaim halaman bohong.
 *  - Peran tanpa akses manage_settings tak bisa dimatikan akses-nya sendiri
 *    (manipulasi payload tak akan berlaku karena yang menulis harus pemilik). */

export interface PermResult {
  error?: string;
  tableMissing?: boolean;
}

export async function savePermission(
  permission: StaffPermission,
  next: Record<StaffRole, boolean>,
): Promise<PermResult> {
  let cafeId: string;
  let selfRole: string;
  try {
    const auth = await requireStaffPermission("manage_settings");
    cafeId = auth.cafeId;
    selfRole = auth.role;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  if (!SEMUA_PERMISI.includes(permission)) return { error: "Permission tidak dikenal." };

  // Normalisasi: hanya boolean yang diterima; sisanya bawaan kode.
  const bawaan = permissionDefaultCell(permission);
  const nextCell = { ...bawaan };
  for (const role of STAFF_ROLES) {
    if (typeof next?.[role] === "boolean") nextCell[role] = next[role];
  }

  // Anti-kunci-dirinya: peran PEMANGGIL (selalu owner — gerbang halaman ini)
  // WAJIB tetap punya manage_settings.
  if (permission === "manage_settings" && selfRole === "owner" && !nextCell.owner) {
    return { error: "Owner harus tetap punya akses Pengaturan — tanpa itu tidak ada yang bisa memulihkan wewenang." };
  }
  // Kasir & Staf tak boleh diberi manage_settings (lihat komentar di atas).
  if (permission === "manage_settings" && (nextCell.cashier || nextCell.staff)) {
    return { error: "Akses Pengaturan untuk Kasir/Staf tidak dapat diaktifkan dari sini." };
  }

  // 42P01 → migrasi belum dijalankan; UI mengarahkan ke kartu setup.
  const { error } = await supabaseAdmin
    .from("Role_Permissions")
    .upsert(
      {
        cafe_id: cafeId,
        permission,
        owner_allowed: nextCell.owner,
        manager_allowed: nextCell.manager,
        cashier_allowed: nextCell.cashier,
        kitchen_allowed: nextCell.kitchen,
        staff_allowed: nextCell.staff,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cafe_id,permission" },
    );

  if (error) {
    const missing =
      (error as { code?: string }).code === "42P01" ||
      /does not exist|Could not find the table/i.test(error.message);
    if (missing) return { tableMissing: true };
    return { error: error.message };
  }

  revalidatePath("/dashboard-v2/pengaturan/peran");
  revalidatePath("/dashboard-v2");
  return {};
}

/** Hapus override → kembali ke bawaan kode untuk permission itu. */
export async function resetPermission(permission: StaffPermission): Promise<PermResult> {
  let cafeId: string;
  try {
    const auth = await requireStaffPermission("manage_settings");
    cafeId = auth.cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  // Anti-kunci-dirinya juga berlaku saat menghapus override: menghapus
  // manage_settings mengembalikan ke bawaan kode (owner=true) — aman.
  const { error } = await supabaseAdmin
    .from("Role_Permissions")
    .delete()
    .eq("cafe_id", cafeId)
    .eq("permission", permission);

  if (error) {
    const missing =
      (error as { code?: string }).code === "42P01" ||
      /does not exist|Could not find the table/i.test(error.message);
    if (missing) return { tableMissing: true };
    return { error: error.message };
  }

  revalidatePath("/dashboard-v2/pengaturan/peran");
  revalidatePath("/dashboard-v2");
  return {};
}
