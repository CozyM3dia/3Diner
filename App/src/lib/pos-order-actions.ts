"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStaffCafeId, getStaffContext } from "@/lib/staff-context";
import { createNotifications } from "@/lib/notifications";
import type { SelectedOption } from "@/types";

export interface ExistingOrderLine {
  id_menu: string;
  nama_menu: string;
  harga_menu: number;
  qty: number;
  options: SelectedOption[];
}

export interface PosOrderActionResult {
  error?: string;
}

function readErr(msg: string): string {
  if (msg.includes("order_not_found")) return "Pesanan tidak ada lagi.";
  if (msg.includes("order_already_final")) return "Pesanan sudah selesai atau dibatalkan.";
  if (msg.includes("menu_unavailable")) return "Menu tidak tersedia (stok habis atau sedang tutup).";
  if (msg.includes("invalid_order_items")) return "Item tidak valid.";
  if (msg.includes("insufficient_inventory")) return "Stok bahan tidak cukup untuk item ini.";
  return "Gagal memperbarui pesanan.";
}

/** Tambah item ke pesanan yang SUDAH ada (dipakai POS: klik item aktif ->
 *  Item Details -> tambah). Ditulis ulang di server lalu diteruskan ke
 *  commit_order_atomic dengan idempotency key baru — stok & harga tetap
 *  divalidasi server penuh. */
export async function addLineToExistingOrder(
  cafeId: string,
  orderId: string,
  lines: ExistingOrderLine[],
): Promise<PosOrderActionResult> {
  const staffCafe = await getStaffCafeId();
  if (!staffCafe || staffCafe !== cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };

  const { data: cur, error: curErr } = await supabaseAdmin
    .from("Orders")
    .select("items,table_number,notes,status,payment_status")
    .eq("id_order", orderId)
    .eq("cafe_id", cafeId)
    .maybeSingle();

  if (curErr) return { error: readErr(curErr.message) };
  if (!cur) return { error: "Pesanan tidak ditemukan." };
  if (cur.status === "cancelled" || cur.status === "completed") {
    return { error: "Pesanan sudah selesai atau dibatalkan." };
  }
  if (cur.payment_status === "paid") return { error: "Pesanan sudah lunas." };

  type RawLine = {
    id_menu: string;
    nama_menu: string;
    harga_menu: number;
    qty: number;
    options?: SelectedOption[];
  };
  const existing = ((cur.items ?? []) as unknown as RawLine[]).map(l => ({
    id_menu: l.id_menu,
    qty: l.qty,
    options: (l.options ?? []).map(o => o.id_option_value),
  }));
  const additions = lines.map(l => ({
    id_menu: l.id_menu,
    qty: l.qty,
    options: l.options.map(o => o.id_option_value),
  }));

  // commit_order_atomic wajib quote_id: kunci idempotensi & potret harga.
  // Karena itu tambah-item = quote GABUNGAN (item existing + tambahan) lalu
  // commit ulang ke pesanan baru; order lama ditandai batal agar riwayat utuh.
  const combined = [...existing, ...additions];
  const { data: quoteRes, error: quoteErr } = await supabaseAdmin.rpc("issue_order_quote", {
    p_cafe_id: cafeId,
    p_table_number: cur.table_number,
    p_items: combined,
    p_notes: cur.notes ?? "",
    p_channel: "cashier",
  });
  if (quoteErr) return { error: readErr(quoteErr.message) };
  const quote = quoteRes as { error?: string; quote_id?: string } | null;
  if (quote?.error || !quote?.quote_id) return { error: "Gagal menghitung ulang pesanan." };

  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await supabaseAdmin.rpc("commit_order_atomic", {
    p_cafe_id: cafeId,
    p_table_number: cur.table_number,
    p_items: combined,
    p_notes: cur.notes ?? null,
    p_channel: "cashier",
    p_quote_id: quote.quote_id,
    p_idempotency_key: idempotencyKey,
  });

  if (error) return { error: readErr(error.message) };
  const result = data as { error?: string; order?: { id_order?: string; total?: number } } | null;
  if (result?.error === "insufficient_inventory") return { error: readErr("insufficient_inventory") };
  if (result?.error) return { error: readErr(result.error) };
  if (!result?.order?.id_order) return { error: "Gagal memperbarui pesanan." };

  const newId = result.order.id_order;
  await createNotifications(cafeId, [
    {
      type: "order",
      title: `Pesanan diperbarui · #${newId.slice(0, 5)}`,
      body: `${lines.length} item ditambahkan kasir via POS (total ${result.order.total != null ? Math.round(result.order.total).toLocaleString("id-ID") : "-"})`.replace("total -", "meja " + cur.table_number),
      href: "/dashboard-v2/pesanan",
    },
    { type: "kitchen", title: `Item baru untuk dapur · #${newId.slice(0, 5)}`, body: "Cek papan Dapur untuk item tambahan.", href: "/dashboard-v2/dapur" },
  ]);

  // Order lama dibatalkan (bukan dihapus) supaya riwayat & jejak stok tetap utuh.
  const actor = (await getStaffContext()).user_id ?? null;
  await supabaseAdmin.rpc("cancel_order", {
    p_cafe_id: cafeId,
    p_order_id: orderId,
    p_reason: "Diperbarui kasir via POS (item ditambahkan)",
    p_actor: actor,
  });

  return {};
}
