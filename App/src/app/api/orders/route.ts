import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface CreateOrderBody {
  cafeId?: unknown;
  table?: unknown;
  items?: unknown;
  notes?: unknown;
}

interface RequestedOrderItem {
  id_menu: string;
  qty: number;
}

interface CreateOrderResult {
  error?: unknown;
  unavailableMenus?: unknown;
  order?: unknown;
  orderToken?: unknown;
}

interface RpcResponseEnvelope {
  data: unknown;
  error: unknown;
}

function parseItems(value: unknown): RequestedOrderItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;

  const items = value.map((item) => {
    if (!item || typeof item !== "object") return null;

    const candidate = item as { id_menu?: unknown; qty?: unknown };
    return {
      id_menu: typeof candidate.id_menu === "string" ? candidate.id_menu : "",
      qty: candidate.qty,
    };
  });

  if (
    items.some(
      (item) =>
        !item ||
        !item.id_menu ||
        typeof item.qty !== "number" ||
        !Number.isInteger(item.qty) ||
        item.qty < 1 ||
        item.qty > 50
    )
  ) {
    return null;
  }

  return items as RequestedOrderItem[];
}

function isInvalidOrderError(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.includes("menu_unavailable") || value.includes("invalid_order"))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRpcResponseEnvelope(value: unknown): value is RpcResponseEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "data" in value &&
    "error" in value
  );
}

function getRpcErrorMessage(value: unknown): unknown {
  return typeof value === "object" && value !== null
    ? (value as { message?: unknown }).message
    : undefined;
}

function isOrder(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;

  const order = value as Record<string, unknown>;
  return (
    isNonEmptyString(order.id_order) &&
    isNonEmptyString(order.cafe_id) &&
    isNonEmptyString(order.table_number) &&
    Array.isArray(order.items) &&
    typeof order.total === "number" &&
    Number.isFinite(order.total) &&
    order.total >= 0 &&
    isNonEmptyString(order.status)
  );
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

  let rpcResponse;
  try {
    rpcResponse = await supabaseAdmin.rpc("create_order_with_inventory", {
      p_cafe_id: cafeId,
      p_table_number: table,
      p_items: items,
      p_notes: notes,
    });
  } catch {
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  if (!isRpcResponseEnvelope(rpcResponse)) {
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  const { data, error } = rpcResponse;
  if (error) {
    if (isInvalidOrderError(getRpcErrorMessage(error))) {
      return NextResponse.json({ error: "Menu tidak tersedia" }, { status: 400 });
    }

    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  const result = data as CreateOrderResult | null;
  if (result?.error === "insufficient_inventory") {
    const unavailableMenus = Array.isArray(result.unavailableMenus)
      ? result.unavailableMenus.filter((name): name is string => typeof name === "string")
      : [];
    const menuNames = unavailableMenus.length > 0 ? ` Menu: ${unavailableMenus.join(", ")}.` : "";

    return NextResponse.json(
      {
        code: "insufficient_inventory",
        error: "Menu tidak tersedia",
        message: `Stok beberapa menu sedang tidak cukup.${menuNames} Silakan kurangi jumlah atau pilih menu lain.`,
        unavailableMenus,
      },
      { status: 409 }
    );
  }

  if (isInvalidOrderError(result?.error)) {
    return NextResponse.json({ error: "Menu tidak tersedia" }, { status: 400 });
  }

  if (!isOrder(result?.order) || !isNonEmptyString(result.orderToken)) {
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  return NextResponse.json({ order: result.order, orderToken: result.orderToken }, { status: 201 });
}
