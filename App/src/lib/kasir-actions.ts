"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getStaffCafeId, getStaffContext } from "@/lib/staff-context";

export interface KasirResult {
  error?: string;
}

/** Pesan kegagalan RPC diterjemahkan di satu tempat.
 *
 *  Kode errornya berguna untuk log, tapi tidak untuk kasir yang sedang melayani
 *  antrean. Tiap pesan menyebut apa yang terjadi dan apa yang bisa dilakukan. */
const MESSAGES: Record<string, string> = {
  order_not_found: "Pesanan tidak ada lagi. Antrean akan menyegarkan diri.",
  order_already_final: "Pesanan ini sudah selesai atau dibatalkan.",
  order_already_completed: "Pesanan sudah diserahkan — pembatalan tidak berlaku lagi.",
  invalid_status_transition: "Perubahan status itu tidak berlaku dari keadaan sekarang.",
  cancel_reason_required: "Alasan pembatalan wajib diisi.",
  cash_only: "Hanya pesanan tunai yang dapat dilunasi kasir.",
  invalid_cash_payment_state: "Pesanan tunai tidak berada pada tahap pembayaran kasir.",
  cash_payment_required: "Pesanan tunai harus dilunasi dulu sebelum diselesaikan.",
};

function readError(message: string | undefined): string {
  if (!message) return "Gagal menyimpan. Coba lagi.";
  for (const [code, text] of Object.entries(MESSAGES)) {
    if (message.includes(code)) return text;
  }
  return "Gagal menyimpan. Coba lagi.";
}

function revalidateSurfaces() {
  revalidatePath("/kasir");
  revalidatePath("/dashboard/orders");
}

/** Memajukan pesanan satu tahap.
 *
 *  Transisi yang sah ditegakkan di database, bukan di sini: layar bisa usang
 *  beberapa detik, dan dua kasir bisa menekan tombol yang sama bersamaan. */
async function move(orderId: string, next: "preparing" | "ready" | "completed"): Promise<KasirResult> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };

  const { error } = await supabaseAdmin.rpc("advance_order_status", {
    p_cafe_id: cafeId,
    p_order_id: orderId,
    p_next: next,
    p_actor: (await getStaffContext()).user_id ?? null,
  });

  if (error) return { error: readError(error.message) };
  revalidateSurfaces();
  return {};
}

/** Kasir menerima pesanan yang masuk dari QR meja. */
export async function acceptOrder(orderId: string): Promise<KasirResult> {
  return move(orderId, "preparing");
}

/** Aksi terminal: pesanan diserahkan dan keluar dari antrean.
 *
 *  Ini satu-satunya jalan antrean bisa mencapai nol, dan itulah gunanya. */
export async function completeOrder(orderId: string): Promise<KasirResult> {
  return move(orderId, "completed");
}

/** Tahap opsional untuk kafe yang punya runner terpisah (K1).
 *
 *  UI default melompatinya. Disediakan supaya menyalakannya nanti tidak butuh
 *  server action baru. */
export async function markOrderReady(orderId: string): Promise<KasirResult> {
  return move(orderId, "ready");
}

/** Membatalkan pesanan, dengan alasan yang tersimpan dan stok dikembalikan.
 *
 *  Alasannya wajib di database juga — pembatalan tanpa jejak adalah lubang kas
 *  paling klasik di kafe, dan UI bukan tempat yang tepat untuk menjaganya. */
export async function cancelOrder(orderId: string, reason: string): Promise<KasirResult> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };

  const trimmed = reason.trim();
  if (!trimmed) return { error: MESSAGES.cancel_reason_required };

  const { error } = await supabaseAdmin.rpc("cancel_order", {
    p_cafe_id: cafeId,
    p_order_id: orderId,
    p_reason: trimmed,
    p_actor: (await getStaffContext()).user_id ?? null,
  });

  if (error) return { error: readError(error.message) };
  revalidateSurfaces();
  return {};
}

/** Kasir menerima uang tunai.
 *
 *  QRIS ditolak di database: hanya webhook Midtrans yang boleh menyatakan QRIS
 *  lunas, karena kasir tidak bisa melihat apakah dananya benar-benar masuk. */
export async function markCashPaid(orderId: string): Promise<KasirResult> {
  const cafeId = await getStaffCafeId();
  if (!cafeId) return { error: "Sesi tidak berlaku. Masuk ulang." };

  const { data, error } = await supabaseAdmin.rpc("mark_order_cash_paid", {
    p_cafe_id: cafeId,
    p_order_id: orderId,
  });

  if (error) return { error: readError(error.message) };

  const result = data as { error?: string; ok?: boolean } | null;
  if (result?.error) return { error: readError(result.error) };
  if (!result?.ok) return { error: "Gagal menandai lunas." };

  const { createNotifications } = await import("@/lib/notifications");
  await createNotifications(cafeId, [
    {
      type: "inbox",
      title: `Pembayaran tunai diterima · #${orderId.slice(0, 5)}`,
      body: "Pesanan ditandai lunas oleh kasir.",
      href: "/dashboard-v2/pesanan",
    },
  ]);

  revalidateSurfaces();
  return {};
}
