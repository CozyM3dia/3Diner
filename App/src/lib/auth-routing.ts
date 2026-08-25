"use server";

import { getStaffContext } from "@/lib/staff-context";
import { homeRouteForRole } from "@/types";

/** Alasan sebuah sesi tidak boleh dilanjutkan dari layar masuk.
 *
 *  Tiga sebab punya tiga pesan berbeda di layar: mencampur "kamu bukan staf"
 *  dengan "sistem gagal memeriksa" melatih orang untuk tidak percaya pesan
 *  error mana pun. */
export type LoginRejectionReason = "bukan-staf" | "nonaktif" | "gagal-muat";

export type ResolveHomeResult =
  | { home: string; reason: null }
  | { home: null; reason: LoginRejectionReason };

/** Tujuan setelah login, ditentukan peran.
 *
 *  Tidak ada pemilih "saya kasir / saya pemilik" di layar masuk: itu pertanyaan
 *  yang jawabannya sudah dimiliki sistem, dan tiap salah pilih jadi tiket
 *  dukungan. Mengembalikan `reason` kalau user tidak boleh dilanjutkan —
 *  pemanggil yang memutuskan bagaimana mengatakannya. */
export async function resolveHomeRoute(): Promise<ResolveHomeResult> {
  const ctx = await getStaffContext();

  // Gagal muat ≠ bukan staf: jangan signOut, biarkan orang mencoba lagi.
  if (ctx.error) return { home: null, reason: "gagal-muat" };
  if (!ctx.role) return { home: null, reason: "bukan-staf" };
  if (ctx.is_active === false) return { home: null, reason: "nonaktif" };
  const home = homeRouteForRole(ctx.role);
  if (!home) return { home: null, reason: "bukan-staf" }; // defensif; role sudah non-null
  return { home, reason: null };
}
