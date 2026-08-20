"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffPermission } from "@/lib/authorization";

export interface TaxResult {
  error?: string;
  /** "immediately" untuk konfigurasi pertama, "scheduled" untuk perubahan. */
  applied?: "immediately" | "scheduled";
  effectiveFrom?: string;
}

/** Menyimpan tarif pajak dan service charge.
 *
 *  Aturan berlakunya ditegakkan database, bukan di sini: konfigurasi pertama
 *  langsung berlaku, perubahan berikutnya berlaku mulai hari berikutnya.
 *  Mengubah tarif di tengah hari membuat dua pesanan di hari yang sama punya
 *  perhitungan berbeda, dan laporan hari itu berhenti bisa direkonsiliasi. */
export async function saveTax(
  taxPct: number,
  servicePct: number,
  includedInPrice: boolean
): Promise<TaxResult> {
  let cafeId: string;
  try {
    cafeId = (await requireStaffPermission("manage_settings")).cafeId;
  } catch {
    return { error: "Sesi tidak berlaku. Masuk ulang." };
  }

  if (!Number.isFinite(taxPct) || taxPct < 0 || taxPct > 100) {
    return { error: "Pajak harus antara 0 dan 100." };
  }
  if (!Number.isFinite(servicePct) || servicePct < 0 || servicePct > 100) {
    return { error: "Service charge harus antara 0 dan 100." };
  }

  const { data, error } = await supabaseAdmin.rpc("set_cafe_tax", {
    p_cafe_id: cafeId,
    p_tax_pct: taxPct,
    p_service_pct: servicePct,
    p_include: includedInPrice,
  });

  if (error) {
    if (error.message.includes("invalid_tax_rate")) return { error: "Tarif tidak valid." };
    if (error.message.includes("cafe_not_found")) return { error: "Kafe tidak ditemukan." };
    return { error: error.message };
  }

  const result = data as { applied?: "immediately" | "scheduled"; effective_from?: string } | null;

  revalidatePath("/dashboard-v2/pengaturan");
  revalidatePath("/dashboard-v2/pengaturan/pajak");
  revalidatePath("/dashboard-v2");
  revalidatePath("/kasir");

  return { applied: result?.applied, effectiveFrom: result?.effective_from };
}
