"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireStaffPermission } from "@/lib/authorization";
import { parseItems } from "@/lib/order-request";
import { revalidatePath } from "next/cache";
import type { SelectedOption, OrderQuote } from "@/types";

export interface ExistingOrderLine {
  id_menu: string;
  nama_menu: string;
  harga_menu: number;
  qty: number;
  options: SelectedOption[];
  note?: string;
}

export interface PosOrderActionResult {
  error?: string;
  replacement?: { order: OrderQuote & { id_order: string; table_number: string }; orderToken: string };
}

/** Replace an unpaid, unstarted ticket in one database transaction. */
export async function addLineToExistingOrder(cafeId: string, orderId: string, lines: ExistingOrderLine[]): Promise<PosOrderActionResult> {
  try {
    const staff = await requireStaffPermission("operate_orders");
    if (staff.cafeId !== cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };
    const additions = parseItems(Array.isArray(lines) ? lines.map(l => ({
      id_menu: l.id_menu, qty: l.qty, note: l.note,
      options: Array.isArray(l.options) ? l.options.map(o => o.id_option_value) : null,
    })) : null);
    if (!additions || !orderId) return { error: "Item tidak valid." };
    const { data, error } = await supabaseAdmin.rpc("amend_pending_order", {
      p_cafe_id: cafeId, p_order_id: orderId, p_additions: additions, p_actor: staff.userId,
    });
    if (error) {
      if (error.message.includes("order_not_editable")) return { error: "Pesanan sudah diproses atau dibayar. Buat pesanan baru untuk item tambahan." };
      if (error.message.includes("insufficient_inventory")) return { error: "Stok bahan tidak cukup. Pesanan lama tetap tersimpan." };
      return { error: "Gagal menambahkan item. Pesanan lama tetap tersimpan." };
    }
    try {
      for (const path of ["/dashboard-v2/pos", "/dashboard-v2/pesanan", "/dashboard-v2/dapur", "/kasir", "/dapur"]) revalidatePath(path);
    } catch { /* Feed polling will refresh a successfully committed order. */ }
    const result = data as PosOrderActionResult["replacement"];
    return result?.order?.id_order && result.orderToken ? { replacement: result } : {};
  } catch {
    return { error: "Tidak dapat memperbarui pesanan. Periksa akses dan koneksi Anda." };
  }
}
