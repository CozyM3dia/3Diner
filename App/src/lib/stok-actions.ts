"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStaffCafeId } from "@/lib/staff-context";

export interface StokResult {
  error?: string;
}

const RPC_MESSAGES: Record<string, string> = {
  inventory_not_found: "Bahan tidak ditemukan.",
  negative_stock: "Stok tidak boleh kurang dari 0.",
  invalid_adjustment: "Jumlah penyesuaian tidak valid.",
};

export type AdjustMode = "add" | "subtract" | "set";

/** Menyesuaikan stok satu bahan.
 *
 *  Berbeda dari versi lama: alasan WAJIB. Penyesuaian stok tanpa alasan adalah
 *  lubang yang persis dibuat POS untuk ditutup — selisih yang tidak bisa
 *  ditelusuri tidak bisa dibedakan dari kehilangan. Riwayatnya tersimpan di
 *  Inventory_Movements dan bisa dibaca pemilik.
 */
export async function adjustStock(
  itemId: string,
  mode: AdjustMode,
  quantity: number,
  reason: string
): Promise<StokResult> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };

  const trimmed = reason.trim();
  if (!trimmed) return { error: "Alasan wajib diisi." };

  if (!Number.isFinite(quantity) || quantity < 0) {
    return { error: "Jumlah penyesuaian tidak valid." };
  }
  if (mode !== "set" && quantity <= 0) {
    return { error: "Jumlah penyesuaian harus lebih dari 0." };
  }

  const { data, error } = await supabaseAdmin.rpc("adjust_inventory_stock", {
    p_cafe_id: cafeId,
    p_inventory_item_id: itemId,
    p_mode: mode,
    p_quantity: quantity,
    p_note: trimmed.slice(0, 300),
  });

  if (error) return { error: error.message };

  const rpcError = (data as { error?: string } | null)?.error;
  if (rpcError) return { error: RPC_MESSAGES[rpcError] ?? "Gagal menyimpan penyesuaian." };

  revalidatePath("/dashboard-v2/stok");
  revalidatePath("/dashboard-v2");
  return {};
}

/** Menandai bahan sudah dibelanjakan.
 *
 *  Jalur tercepat untuk pekerjaan yang paling sering: pulang dari pasar,
 *  masukkan jumlahnya. Alasannya sudah terisi sendiri karena memang cuma satu. */
export async function markPurchased(itemId: string, quantity: number): Promise<StokResult> {
  return adjustStock(itemId, "add", quantity, "Belanja masuk");
}
