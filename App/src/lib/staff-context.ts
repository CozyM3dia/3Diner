import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { StaffContext, StaffRole } from "@/types";

/** Konteks staf untuk request ini.
 *
 *  Menggantikan `getDashboardCafeContext()` untuk permukaan yang dipakai staf
 *  non-pemilik: kafe diambil dari baris `Staff`, bukan dari `Cafes.owner_id`,
 *  sehingga kasir yang bukan pemilik tetap punya kafe.
 *
 *  `role: null` berarti user terautentikasi tapi tidak terdaftar sebagai staf
 *  kafe mana pun. Itu keadaan yang sah dan berbeda dari gagal memuat — sejak
 *  26 Aug 2026 perbedaannya ada di kode, bukan cuma di komentar: kegagalan
 *  RPC mengembalikan `{ role: null, error: true }`, sehingga pemanggil bisa
 *  menawarkan "coba lagi" alih-alih mengusir orang dengan pesan salah.
 */
export const getStaffContext = cache(async (): Promise<StaffContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { role: null };

  // Fungsi RPC ditutup dari anon/authenticated; hanya service role yang boleh
  // memanggilnya, setelah sesi diverifikasi di atas.
  const { data, error } = await supabaseAdmin.rpc("get_staff_context", {
    p_user_id: user.id,
  });

  if (error || !data) return { role: null, error: true };
  return data as StaffContext;
});

/** Kafe yang boleh disentuh staf ini, atau null.
 *
 *  Setiap server action kasir memakai ini alih-alih menerima `cafe_id` dari
 *  klien: id kafe yang datang dari browser adalah id yang bisa ditukar. */
export async function getStaffCafeId(): Promise<string | null> {
  const ctx = await getStaffContext();
  if (!ctx.role || ctx.is_active === false) return null;
  return ctx.cafe_id ?? null;
}

/** Boleh membuka konsol kasir.
 *
 *  Pemilik ikut boleh: di kafe satu orang, pemiliklah kasirnya, dan memaksanya
 *  membuat akun kedua hanya untuk melayani meja adalah pekerjaan yang tidak
 *  menghasilkan apa-apa. `staff` = peran operasional outlet dengan hak
 *  default setara kasir (dapat diperketat per-kafe dari matriks wewenang). */
export function canOpenCashierConsole(role: StaffRole | null): boolean {
  return role === "cashier" || role === "staff" || role === "owner";
}

/** Boleh membuka papan dapur (KDS). Pemilik ikut boleh — sama seperti kasir,
 *  di outlet kecil pemilik kadang sekalian mengawasi antrean dapur. */
export function canOpenKitchenConsole(role: StaffRole | null): boolean {
  return role === "kitchen" || role === "owner";
}

/** Boleh membuka konsol pemilik. Manager masuk di sini juga: lingkup kerjanya
 *  operasional outlet, laporan, stok, dan approval (Word §4) — dan halaman
 *  khusus-pemilik (billing, staf, wewenang) tetap digerbangi
 *  requireStaffPermission("manage_settings") yang default-nya owner-only. */
export function canOpenOwnerConsole(role: StaffRole | null): boolean {
  return role === "owner" || role === "manager";
}
