import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  calculateOrderTotal,
  type RequestedOrderItem,
} from "@/lib/order-validation";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface CreateOrderBody {
  cafeId?: unknown;
  table?: unknown;
  items?: unknown;
  notes?: unknown;
}

function parseItems(value: unknown): RequestedOrderItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;

  const items = value.map((item) => {
    const candidate = item as { id_menu?: unknown; qty?: unknown };
    return {
      id_menu: typeof candidate.id_menu === "string" ? candidate.id_menu : "",
      qty: candidate.qty,
    };
  });

  if (
    items.some(
      (item) => !item.id_menu || !Number.isInteger(item.qty) || typeof item.qty !== "number"
    )
  ) {
    return null;
  }

  return items as RequestedOrderItem[];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateOrderBody | null;
  const cafeId = typeof body?.cafeId === "string" ? body.cafeId.trim() : "";
  const table = typeof body?.table === "string" ? body.table.trim().slice(0, 30) : "";
  const items = parseItems(body?.items);
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) : null;

  if (!cafeId || !table || !items) {
    return NextResponse.json({ error: "Data pesanan tidak valid" }, { status: 400 });
  }

  const menuIds = [...new Set(items.map((item) => item.id_menu))];
  const { data: menus, error: menuError } = await supabaseAdmin
    .from("Menus")
    .select("id_menu,cafe_id,nama_menu,harga_menu,discount_pct,is_active")
    .eq("cafe_id", cafeId)
    .in("id_menu", menuIds);

  if (menuError || !menus) {
    return NextResponse.json({ error: "Gagal memuat menu" }, { status: 502 });
  }

  let canonicalItems;
  try {
    canonicalItems = calculateOrderTotal(menus, items);
  } catch {
    return NextResponse.json({ error: "Menu tidak tersedia" }, { status: 400 });
  }

  const total = canonicalItems.reduce((sum, item) => sum + item.harga_menu * item.qty, 0);
  const idOrder = randomUUID();
  const customerToken = randomUUID();
  const order = {
    id_order: idOrder,
    cafe_id: cafeId,
    table_number: table,
    items: canonicalItems,
    total,
    status: "received",
    payment_method: null,
    payment_status: "unpaid",
    notes,
    customer_token: customerToken,
  };

  const { error: insertError } = await supabaseAdmin.from("Orders").insert(order);
  if (insertError) {
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  return NextResponse.json({ order, orderToken: customerToken }, { status: 201 });
}
