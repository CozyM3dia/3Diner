import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyMidtransSignature } from "@/lib/order-validation";
import { mapMidtransPaymentType } from "@/lib/payment-methods";

type MidtransNotification = {
  order_id?: unknown;
  status_code?: unknown;
  gross_amount?: unknown;
  signature_key?: unknown;
  transaction_status?: unknown;
  payment_type?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as MidtransNotification;
    const { order_id, status_code, gross_amount, signature_key, transaction_status, payment_type } = body;
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
      .from("Orders").select("total,payment_status,status").eq("id_order", order_id).single();
    if (orderReadError) {
      return NextResponse.json({ error: "Gagal membaca pesanan" }, { status: 503 });
    }
    if (!order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }
    if (Number(gross_amount) !== Number(order.total)) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    if (isSuccessfulPayment) {
      // Idempoten: confirm_order no-op jika sudah dikonfirmasi.
      const { data: confirmData, error: confirmRpcErr } = await supabaseAdmin.rpc("confirm_order", {
        p_order_id: order_id,
      });
      // Transient DB/transport failure: do NOT mark paid; 5xx so Midtrans retries (confirm_order is idempotent).
      if (confirmRpcErr) {
        return NextResponse.json({ error: "Gagal konfirmasi pesanan" }, { status: 502 });
      }
      const confirmError = (confirmData as { error?: string } | null)?.error;
      if (confirmError && confirmError !== "insufficient_inventory") {
        return NextResponse.json({ error: "Gagal konfirmasi pesanan" }, { status: 502 });
      }

      if (order.payment_status !== "paid") {
        // A settlement remains valid after a payment retry restored the row to
        // awaiting_payment. A zero-row write is a reconciliation failure, not an
        // acknowledgement Midtrans may safely stop retrying.
        const { data: paidRows, error: paidErr } = await supabaseAdmin
          .from("Orders")
          .update({ payment_status: "paid", payment_method: mapMidtransPaymentType(payment_type) })
          .eq("id_order", order_id)
          .neq("payment_status", "paid")
          .select("id_order");
        if (paidErr || !paidRows || paidRows.length > 1) {
          return NextResponse.json({ error: "Gagal memperbarui pembayaran" }, { status: 502 });
        }
        if (paidRows.length === 0) {
          const { data: currentOrder, error: currentOrderError } = await supabaseAdmin
            .from("Orders").select("payment_status").eq("id_order", order_id).single();
          if (currentOrderError || currentOrder?.payment_status !== "paid") {
            return NextResponse.json({ error: "Gagal memperbarui pembayaran" }, { status: 502 });
          }
        }
      }

      if (confirmError) {
        // Customer paid but stock could not be reserved (e.g. sold out after ordering).
        // Make the paid order visible to the kitchen so staff can reconcile (refund or
        // substitute) rather than hiding a paid order. Accepts rare inventory drift.
        const { data: forcedRows, error: forceReceivedError } = await supabaseAdmin
          .from("Orders")
          .update({ status: "received" })
          .eq("id_order", order_id)
          .eq("status", "awaiting")
          .select("id_order");
        if (forceReceivedError || !forcedRows || forcedRows.length > 1) {
          return NextResponse.json({ error: "Gagal merekonsiliasi pesanan" }, { status: 502 });
        }
        if (forcedRows.length === 0) {
          const { data: currentOrder, error: currentOrderError } = await supabaseAdmin
            .from("Orders").select("status").eq("id_order", order_id).single();
          if (currentOrderError || currentOrder?.status !== "received") {
            return NextResponse.json({ error: "Gagal merekonsiliasi pesanan" }, { status: 502 });
          }
        }
      }
    } else if (["expire", "cancel", "deny", "failure"].includes(transaction_status)) {
      // Tanpa cabang ini, QRIS yang kedaluwarsa membuat pesanan tersangkut di
      // "pending" selamanya: pelanggan tidak bisa membuat QRIS baru maupun
      // memilih bayar tunai, karena kedua jalur menuntut status "awaiting_payment".
      const { error: resetError } = await supabaseAdmin
        .from("Orders")
        .update({ payment_status: "awaiting_payment", payment_method: null, payment_qr_url: null })
        .eq("id_order", order_id)
        .eq("payment_status", "pending");
      if (resetError) {
        return NextResponse.json({ error: "Gagal mereset pembayaran" }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
