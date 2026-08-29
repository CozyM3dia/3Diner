"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffPermission } from "@/lib/authorization";
import { SEMUA_PERMISI } from "@/lib/role-permissions-list";
import type { StaffPermission } from "@/lib/authorization";

/** Simpan override wewenang per-kafe ke tabel Role_Permissions.
 *  Guard penting: pemilik TIDAK BOLEH menarik manage_settings dari dirinya
 *  sendiri — satu-satunya peran yang bisa membuka halaman ini. Kalau itu
 *  terjadi, tidak ada lagi yang bisa memulihkannya dari dalam aplikasi. */

export interface PermResult {
  error?: string;
  tableMissing?: boolean;
}

export async function savePermission(
  permission: StaffPermission,
  next: { owner: boolean; cashier: boolean },
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

  // Anti-kunci-dirinya: siapa pun yang menyimpan WAJIB tetap punya manage_settings.
  if (selfRole === "owner" && !next.owner) {
    return { error: "Owner harus tetap punya akses Pengaturan — tanpa itu tidak ada yang bisa memulihkan wewenang." };
  }
  // Kasir tak boleh diberi manage_settings: halaman settings memanggil
  // requireStaffPermission("manage_settings") sebagai pemilik-akses; melonggarkan
  // ini dari UI membuat klaim halaman Roles & Permissions bohong.
  if (permission === "manage_settings" && next.cashier) {
    return { error: "Akses Pengaturan untuk Kasir tidak dapat diaktifkan dari sini." };
  }

  // 42P01 → migrasi belum dijalankan; UI mengarahkan ke kartu setup.
  const { error } = await supabaseAdmin
    .from("Role_Permissions")
    .upsert(
      {
        cafe_id: cafeId,
        permission,
        owner_allowed: next.owner,
        cashier_allowed: next.cashier,
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
