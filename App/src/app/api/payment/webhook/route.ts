import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyMidtransSignature } from "@/lib/order-validation";

const PAYMENT_SURFACES = ["/dapur", "/dashboard-v2/dapur", "/dashboard-v2/pesanan", "/kasir"] as const;

/** Settlement database adalah sumber kebenaran. Invalidasi UI bersifat
 * best-effort dan tidak boleh mengubah webhook yang sudah sah menjadi 500,
 * karena provider akan mengulang callback yang sebenarnya sudah selesai. */
function revalidatePaymentSurfaces() {
  for (const path of PAYMENT_SURFACES) {
    try {
      revalidatePath(path);
    } catch (error) {
      console.warn("[api/payment/webhook] cache revalidation failed", { path, error });
    }
  }
}

type MidtransNotification = {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  transaction_status?: unknown;
  payment_type?: unknown;
  transaction_id?: unknown;
};

const ACTIVE_ORDER_STATUSES = ["awaiting", "received", "preparing"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: Request) {
  try {
    // Notifikasi rusak harus 400 agar Midtrans berhenti mengulang; 500 justru
    // memicu retry storm.
    const body = await req.json().catch(() => null) as MidtransNotification | null;
    if (!body) return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
    const { order_id, status_code, gross_amount, signature_key, transaction_status, payment_type, transaction_id } = body;
    if (
      !isNonEmptyString(order_id) || !isNonEmptyString(status_code) ||
      !isNonEmptyString(gross_amount) || !/^\d+(?:\.\d{1,2})?$/.test(gross_amount) ||
      !isNonEmptyString(signature_key) || !isNonEmptyString(transaction_status) ||
      !isNonEmptyString(payment_type)
    ) {
      return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
    }

    const isSuccessfulPayment = transaction_status === "settlement" || transaction_status === "capture";
    if (isSuccessfulPayment && status_code !== "200") {
      return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
    }
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey || !verifyMidtransSignature({ order_id, status_code, gross_amount, signature_key }, serverKey)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { data: order, error: orderReadError } = await supabaseAdmin
      .from("Orders").select("total,payment_status,status,payment_transaction_id").eq("id_order", order_id).maybeSingle();
    if (orderReadError) {
      console.error("[api/payment/webhook] read order failed", orderReadError);
      return NextResponse.json({ error: "Gagal membaca pesanan" }, { status: 503 });
    }
    if (!order) {
      // Order tidak dikenal = 4xx, bukan 5xx, supaya Midtrans berhenti retry.
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }
    if (Number(gross_amount) !== Number(order.total)) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }
    if (isSuccessfulPayment && !ACTIVE_ORDER_STATUSES.includes(order.status)) {
      // The RPC repeats this fence under a row lock. Acknowledging here avoids
      // needless retries for a cancelled/completed/ready order.
      return NextResponse.json({ ok: true });
    }

    if (isSuccessfulPayment && !isNonEmptyString(transaction_id)) {
      // Successful QRIS notifications carry the Midtrans transaction identity.
      // Without it, acknowledging the callback is safer than attaching an old
      // payment to a newer attempt. A still-pending row is retryable: the
      // client/status reconciliation can persist the identity before Midtrans
      // sends the next notification. A reset/awaiting row is an old attempt;
      // acknowledge it so it cannot block a newer payment forever.
      return order.payment_status === "pending"
        ? NextResponse.json({ error: "Payment identity is still being reconciled" }, { status: 409 })
        : NextResponse.json({ ok: true });
    }

    if (!isSuccessfulPayment && ["expire", "cancel", "deny", "failure"].includes(transaction_status) &&
        !isNonEmptyString(transaction_id)) {
      // A terminal callback without an attempt identity cannot be safely
      // applied: it might belong to an older transaction for the same order.
      return NextResponse.json({ ok: true });
    }
    if (order.payment_transaction_id && transaction_id !== order.payment_transaction_id) {
      return NextResponse.json({ ok: true });
    }

    if (isSuccessfulPayment && !order.payment_transaction_id) {
      // An active QRIS attempt without a persisted Midtrans transaction ID is
      // not safe to settle. Keep the notification retryable while the charge
      // recovery path queries Midtrans and pairs the identity.
      return order.payment_status === "pending"
        ? NextResponse.json({ error: "Payment identity is still being reconciled" }, { status: 409 })
        : NextResponse.json({ ok: true });
    }

    if (isSuccessfulPayment) {
      // The RPC locks the order, verifies this transaction identity, confirms
      // inventory, and marks the payment paid in one database transaction.
      // This prevents a delayed settlement from clearing a newer QR attempt.
      const { data: settlementData, error: settlementRpcErr } = await supabaseAdmin.rpc("settle_payment_order", {
        p_order_id: order_id,
        p_transaction_id: transaction_id,
        p_payment_type: payment_type,
      });
      if (settlementRpcErr) {
        return NextResponse.json({ error: "Gagal konfirmasi pesanan" }, { status: 502 });
      }
      const settlementError = (settlementData as { error?: string } | null)?.error;
      if (settlementError && settlementError !== "insufficient_inventory") {
        return NextResponse.json({ error: "Gagal konfirmasi pesanan" }, { status: 502 });
      }
      revalidatePaymentSurfaces();
      // A stale callback after an expired/reset attempt is acknowledged by
      // the RPC without changing the currently active order state.
    } else if (["expire", "cancel", "deny", "failure"].includes(transaction_status)) {
      // Tanpa cabang ini, QRIS yang kedaluwarsa membuat pesanan tersangkut di
      // "pending" selamanya: pelanggan tidak bisa membuat QRIS baru maupun
      // memilih bayar tunai, karena kedua jalur menuntut status "awaiting_payment".
      const { data: resetRows, error: resetError } = await supabaseAdmin
        .from("Orders")
        .update({
          payment_status: "awaiting_payment",
          payment_method: null,
          payment_qr_url: null,
          payment_transaction_id: null,
          payment_idempotency_key: null,
        })
        .eq("id_order", order_id)
        .eq("payment_transaction_id", transaction_id)
        .eq("payment_status", "pending")
        .in("status", ACTIVE_ORDER_STATUSES)
        .select("id_order");
      if (resetError || !resetRows || resetRows.length > 1) {
        return NextResponse.json({ error: "Gagal mereset pembayaran" }, { status: 502 });
      }
      // Zero rows means another state transition won the compare-and-set
      // (for example, a newer QRIS attempt or settlement). Acknowledge the
      // stale callback without clearing that newer state.
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[api/payment/webhook] unhandled error", err);
    return NextResponse.json({ error: "Gagal memproses notifikasi" }, { status: 500 });
  }
}
