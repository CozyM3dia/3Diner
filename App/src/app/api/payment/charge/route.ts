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
      .select("id_order,customer_token,total,subtotal,tax_amount,service_amount,prices_include_tax,payment_status,items")
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
    // .select() lets us see whether a row was actually claimed: without it, a second
    // concurrent/retry charge on an already-"pending" order would match 0 rows, get no
    // error, and proceed to call Snap again then blindly revert on cleanup.
    const { data: claimedRows, error: claimError } = await supabaseAdmin
      .from("Orders")
      .update({ payment_status: "pending" })
      .eq("id_order", order.id_order)
      .eq("payment_status", "awaiting_payment")
      .select("id_order");
    if (claimError) {
      return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
    }
    if (!claimedRows || claimedRows.length === 0) {
      return NextResponse.json({ error: "Pembayaran sedang diproses" }, { status: 409 });
    }

    const items = (Array.isArray(order.items) ? order.items as {
      id_menu: string; harga_menu: number; qty: number; nama_menu: string }[] : []);
    const itemDetails = items.map((it) => ({
      id: it.id_menu, price: it.harga_menu, quantity: it.qty, name: it.nama_menu.slice(0, 50),
    }));
    const serviceAmount = Number(order.service_amount ?? 0);
    const taxAmount = order.prices_include_tax ? 0 : Number(order.tax_amount ?? 0);
    if (!Number.isInteger(serviceAmount) || serviceAmount < 0 || !Number.isInteger(taxAmount) || taxAmount < 0) {
      await supabaseAdmin.from("Orders")
        .update({ payment_status: "awaiting_payment" })
        .eq("id_order", order.id_order).eq("payment_status", "pending");
      return NextResponse.json({ error: "Total pesanan tidak valid" }, { status: 500 });
    }
    if (serviceAmount > 0) itemDetails.push({ id: "service-charge", price: serviceAmount, quantity: 1, name: "Service charge" });
    if (taxAmount > 0) itemDetails.push({ id: "tax", price: taxAmount, quantity: 1, name: "Tax" });
    const itemDetailsTotal = itemDetails.reduce((sum, it) => sum + it.price * it.quantity, 0);
    if (itemDetailsTotal !== Number(order.total)) {
      await supabaseAdmin.from("Orders")
        .update({ payment_status: "awaiting_payment" })
        .eq("id_order", order.id_order).eq("payment_status", "pending");
      return NextResponse.json({ error: "Rincian total pesanan tidak valid" }, { status: 500 });
    }
    const body = {
      transaction_details: { order_id: order.id_order, gross_amount: order.total },
      item_details: itemDetails,
      enabled_payments: ONLINE_ENABLED_PAYMENTS,
    };

    let res: Response;
    let data: { token?: string; error_messages?: unknown } | null;
    try {
      res = await fetch(snapUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      });
      data = await res.json() as { token?: string; error_messages?: unknown } | null;
    } catch {
      await supabaseAdmin.from("Orders")
        .update({ payment_status: "awaiting_payment" })
        .eq("id_order", order.id_order).eq("payment_status", "pending");
      return NextResponse.json({ error: "Gagal menghubungi pembayaran" }, { status: 502 });
    }

    if (!res.ok || !data?.token) {
      await supabaseAdmin.from("Orders")
        .update({ payment_status: "awaiting_payment" })
        .eq("id_order", order.id_order).eq("payment_status", "pending");
      const msgs = data?.error_messages;
      const msg = Array.isArray(msgs) ? msgs.join(", ") : "Midtrans error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ snap_token: data.token });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
