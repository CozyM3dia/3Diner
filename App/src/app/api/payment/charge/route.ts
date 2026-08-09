import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, consumeRateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ONLINE_ENABLED_PAYMENTS } from "@/lib/payment-methods";

const CHARGE_PER_IP = { limit: 6, windowSeconds: 60 };

export async function POST(req: Request) {
  try {
    const { orderId, orderToken } = (await req.json()) as {
      orderId?: unknown; orderToken?: unknown;
    };
    if (typeof orderId !== "string" || typeof orderToken !== "string" || !orderId || !orderToken) {
      return NextResponse.json({ error: "Data pesanan tidak valid" }, { status: 400 });
    }

    const limit = await consumeRateLimit(`charge:ip:${clientIp(req)}`, CHARGE_PER_IP.limit, CHARGE_PER_IP.windowSeconds);
    if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

    const { data: order, error } = await supabaseAdmin
      .from("Orders")
      .select("id_order,customer_token,total,payment_status,items")
      .eq("id_order", orderId)
      .eq("customer_token", orderToken)
      .single();
    if (error || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 403 });
    }
    if (order.payment_status === "paid") {
      return NextResponse.json({ error: "Pembayaran pesanan ini sudah lunas" }, { status: 409 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) return NextResponse.json({ error: "Pembayaran belum dikonfigurasi" }, { status: 503 });
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const authHeader = `Basic ${Buffer.from(serverKey + ":").toString("base64")}`;

    // Klaim atomik: hanya order yang masih menunggu bayar yang boleh di-charge.
    // Mencegah dua tab membuat dua transaksi Snap untuk order yang sama.
    const { error: claimError } = await supabaseAdmin
      .from("Orders")
      .update({ payment_status: "pending" })
      .eq("id_order", order.id_order)
      .eq("payment_status", "awaiting_payment");
    if (claimError) {
      return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
    }

    const items = (Array.isArray(order.items) ? order.items as {
      id_menu: string; harga_menu: number; qty: number; nama_menu: string }[] : []);
    const body = {
      transaction_details: { order_id: order.id_order, gross_amount: order.total },
      item_details: items.map((it) => ({
        id: it.id_menu, price: it.harga_menu, quantity: it.qty, name: it.nama_menu.slice(0, 50),
      })),
      enabled_payments: ONLINE_ENABLED_PAYMENTS,
    };

    const res = await fetch(snapUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authHeader },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok || !data.token) {
      await supabaseAdmin.from("Orders")
        .update({ payment_status: "awaiting_payment" })
        .eq("id_order", order.id_order).eq("payment_status", "pending");
      const msg = Array.isArray(data.error_messages) ? data.error_messages.join(", ") : "Midtrans error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ snap_token: data.token });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
