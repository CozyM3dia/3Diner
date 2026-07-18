import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const { orderId, orderToken } = (await req.json()) as {
      orderId?: unknown;
      orderToken?: unknown;
    };

    if (typeof orderId !== "string" || typeof orderToken !== "string" || !orderId || !orderToken) {
      return NextResponse.json({ error: "Data pesanan tidak valid" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("Orders")
      .select("id_order,customer_token,total,payment_status,items")
      .eq("id_order", orderId)
      .eq("customer_token", orderToken)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 403 });
    }
    if (order.payment_status !== "unpaid") {
      return NextResponse.json({ error: "QRIS sudah dibuat" }, { status: 409 });
    }

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) return NextResponse.json({ error: "Pembayaran belum dikonfigurasi" }, { status: 503 });
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const baseUrl = isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";

    const body = {
      payment_type: "qris",
      transaction_details: {
        order_id: order.id_order,
        gross_amount: order.total,
      },
      item_details: (order.items as { id_menu: string; harga_menu: number; qty: number; nama_menu: string }[]).map((it) => ({
        id: it.id_menu,
        price: it.harga_menu,
        quantity: it.qty,
        name: it.nama_menu.slice(0, 50),
      })),
    };

    const res = await fetch(`${baseUrl}/v2/charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(serverKey + ":").toString("base64")}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || parseInt(data.status_code ?? "200") >= 400) {
      return NextResponse.json(
        { error: data.status_message ?? "Midtrans error" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("Orders")
      .update({ payment_method: "qris", payment_status: "pending" })
      .eq("id_order", order.id_order)
      .eq("payment_status", "unpaid");
    if (updateError) {
      return NextResponse.json({ error: "Gagal memperbarui pesanan" }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
