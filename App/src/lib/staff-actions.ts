"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffPermission } from "@/lib/authorization";
import type { StaffRole } from "@/types";
import { STAFF_ROLES } from "@/types";

/** Write-path Manage Staffs: tambah & kurangi staf kafe.
 *  Gate `manage_settings` (owner saja — sesuai PERMISSIONS yang ditegakkan).
 *
 *  Model data: baris "Staff" menautkan user auth (unique per cafe; user
 *  hanya boleh terdaftar di SATU kafe — unique index user_id). Akun auth
 *  dibuat bila belum ada; kalau sudah ada (mis. kasir lama yang pernah
 *  dilepas), baris Staff-nya saja yang diaktifkan kembali.
 *
 *  "Kurangi" = nonaktifkan (is_active=false): riwayat order tetap utuh dan
 *  user tak bisa masuk konsol lagi (get_staff_context hanya membaca is_active).
 *  Hapus permanen hanya bila user belum pernah membuat pesanan. */

export interface StaffResult {
  error?: string;
  /** Info tambahan untuk UI (mis. akun sudah ada → diaktifkan kembali). */
  reusedAccount?: boolean;
  /** Password sementara — hanya untuk akun baru, ditampilkan SEKALI. */
  tempPassword?: string;
}

export interface StaffMemberInput {
  email: string;
  fullName: string;
  role: StaffRole;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function revalidateStaff() {
  revalidatePath("/dashboard-v2/pengaturan/staf");
  revalidatePath("/dashboard-v2");
}

function buatPasswordSementara(): string {
  const alfabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => alfabet[b % alfabet.length]).join("") + "9a";
}

/** Tambah staf: buat akun auth bila perlu + baris Staff berperan cashier/owner. */
export async function addStaff(input: StaffMemberInput): Promise<StaffResult> {
  let cafeId: string;
  try {
    const auth = await requireStaffPermission("manage_settings");
    cafeId = auth.cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!EMAIL_RE.test(email)) return { error: "Format email tidak valid." };
  if (!fullName) return { error: "Nama staf wajib diisi." };
  if (fullName.length > 80) return { error: "Nama terlalu panjang." };
  if (!STAFF_ROLES.includes(input.role)) {
    return { error: `Peran harus salah satu dari: ${STAFF_ROLES.join(", ")}.` };
  }

  // 1) Cari akun auth by email lewat tabel Staff/audit? auth.users tak bisa
  //    di-query lewat PostgREST. Jalannya lewat admin API listUsers (paged).
  let existing: { id: string; email?: string } | null = null;
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { error: error.message };
    const hit = data.users.find(u => (u.email ?? "").toLowerCase() === email);
    if (hit) {
      existing = { id: hit.id, email: hit.email ?? undefined };
      break;
    }
    if (data.users.length < 200) break;
    page += 1;
    if (page > 50) return { error: "Terlalu banyak akun; hubungi dukungan." };
  }

  let userId: string;
  let tempPassword: string | undefined;
  let reused = false;

  if (existing) {
    // Akun auth sudah ada (staf lama / akun menu). Tetapkan ulang passwordnya
    // ke password sementara yang diberikan ke pemilik — else invite email
    // menimbulkan langkah verifikasi yang tidak bisa kita jamin terkirim.
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: buatPasswordSementara(),
    });
    if (pwErr) return { error: `Akun sudah terdaftar, tetapi reset password gagal: ${pwErr.message}` };
    userId = existing.id;
    reused = true;
  } else {
    tempPassword = buatPasswordSementara();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // pemilik menyerahkan kredensial langsung; tanpa email verifikasi
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created?.user) {
      return { error: createErr?.message ?? "Gagal membuat akun staf." };
    }
    userId = created.user.id;
  }

  // 2) Tautkan sebagai staf. Konflik unik (user sudah di kafe lain) dilaporkan jelas.
  const { error: staffErr } = await supabaseAdmin
    .from("Staff")
    .upsert(
      {
        cafe_id: cafeId,
        user_id: userId,
        full_name: fullName,
        role: input.role,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cafe_id,user_id" },
    )
    .select("id_staff")
    .single();

  if (staffErr) {
    const msg = staffErr.message;
    if (msg.includes("Staff_user_single_cafe_idx")) {
      return { error: "Email ini sudah terdaftar sebagai staf di kafe lain." };
    }
    // Gagal setelah akun dibuat: pemilik bisa mencoba lagi tanpa akun ganda.
    return { error: msg };
  }

  revalidateStaff();
  return { reusedAccount: reused, tempPassword };
}

/** Nonaktifkan staf (is_active=false) — "kurangi" tanpa menghapus jejak. */
export async function deactivateStaff(staffId: string): Promise<StaffResult> {
  let cafeId: string;
  let selfUserId: string;
  try {
    const auth = await requireStaffPermission("manage_settings");
    cafeId = auth.cafeId;
    selfUserId = auth.userId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  // Jaga-jaga: owner tidak boleh menonaktifkan dirinya sendiri (konsol terkunci).
  const { data: target } = await supabaseAdmin
    .from("Staff")
    .select("id_staff, user_id, role, full_name")
    .eq("id_staff", staffId)
    .eq("cafe_id", cafeId)
    .single();
  if (!target) return { error: "Staf tidak ditemukan." };
  if (target.user_id === selfUserId) {
    return { error: "Tidak bisa menonaktifkan akunmu sendiri." };
  }
  if (target.role === "owner") {
    return { error: "Owner tidak bisa dinonaktifkan lewat daftar ini." };
  }

  const { error } = await supabaseAdmin
    .from("Staff")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id_staff", staffId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };

  revalidateStaff();
  return {};
}

/** Aktifkan kembali staf yang nonaktif. */
export async function reactivateStaff(staffId: string): Promise<StaffResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_settings")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  const { error } = await supabaseAdmin
    .from("Staff")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id_staff", staffId)
    .eq("cafe_id", cafeId);
  if (error) return { error: error.message };

  revalidateStaff();
  return {};
}
