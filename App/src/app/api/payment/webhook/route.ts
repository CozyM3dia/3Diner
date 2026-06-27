import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    const serverKey = process.env.MIDTRANS_SERVER_KEY!;
    const expected = crypto
      .createHash("sha512")
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest("hex");

    if (expected !== signature_key) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (transaction_status === "settlement" || transaction_status === "capture") {
      await supabaseAdmin
        .from("Orders")
        .update({ payment_status: "paid", status: "preparing", payment_method: "qris" })
        .eq("id_order", order_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
