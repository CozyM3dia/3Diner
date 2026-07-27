"use server";

import { getStaffContext } from "@/lib/staff-context";
import { homeRouteForRole } from "@/types";

/** Tujuan setelah login, ditentukan peran.
 *
 *  Tidak ada pemilih "saya kasir / saya pemilik" di layar masuk: itu pertanyaan
 *  yang jawabannya sudah dimiliki sistem, dan tiap salah pilih jadi tiket
 *  dukungan. Mengembalikan null kalau user bukan staf kafe mana pun — pemanggil
 *  yang memutuskan bagaimana mengatakannya. */
export async function resolveHomeRoute(): Promise<string | null> {
  const ctx = await getStaffContext();
  if (!ctx.is_active && ctx.role) return null;
  return homeRouteForRole(ctx.role ?? null);
}
