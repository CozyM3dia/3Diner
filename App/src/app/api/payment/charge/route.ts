import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { orderId, amount, items } = await req.json();

    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const baseUrl = isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";

    const body = {
      payment_type: "qris",
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      item_details: items.map((it: { id_menu: string; harga_menu: number; qty: number; nama_menu: string }) => ({
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

    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
