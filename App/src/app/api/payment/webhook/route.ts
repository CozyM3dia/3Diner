import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyMidtransSignature } from "@/lib/order-validation";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
    } = body as {
      order_id: string;
      status_code: string;
      gross_amount: string;
      signature_key: string;
      transaction_status: string;
    };

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey || !verifyMidtransSignature({ order_id, status_code, gross_amount, signature_key }, serverKey)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { data: order } = await supabaseAdmin
      .from("Orders")
      .select("total,payment_status")
      .eq("id_order", order_id)
      .single();
    if (!order || Number(gross_amount) !== Number(order.total)) {
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    if (transaction_status === "settlement" || transaction_status === "capture") {
      await supabaseAdmin
        .from("Orders")
        .update({ payment_status: "paid", status: "preparing", payment_method: "qris" })
        .eq("id_order", order_id)
        .eq("payment_status", "pending");
    } else if (
      transaction_status === "expire" ||
      transaction_status === "cancel" ||
      transaction_status === "deny" ||
      transaction_status === "failure"
    ) {
      // Tanpa cabang ini, QRIS yang kedaluwarsa membuat pesanan tersangkut di
      // "pending" selamanya: pelanggan tidak bisa membuat QRIS baru maupun
      // memilih bayar tunai, karena kedua jalur menuntut status "unpaid".
      await supabaseAdmin
        .from("Orders")
        .update({ payment_status: "unpaid", payment_method: null })
        .eq("id_order", order_id)
        .eq("payment_status", "pending");
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
