import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { clientIp, consumeRateLimits, tooManyRequests } from "@/lib/rate-limit";
import { parseItems } from "@/lib/order-request";

/** Rute publik tanpa autentikasi: siapa pun yang tahu cafeId bisa membuat
 *  baris pesanan. Batas per-IP menahan banjir, batas per-kafe menjaga satu
 *  IP dinamis tidak bisa membanjiri dashboard satu kafe. */
const ORDERS_PER_IP = { limit: 10, windowSeconds: 60 };
const ORDERS_PER_CAFE = { limit: 120, windowSeconds: 60 };

interface CreateOrderBody {
  cafeId?: unknown;
  table?: unknown;
  items?: unknown;
  notes?: unknown;
  paymentChannel?: unknown;
  quoteId?: unknown;
}

interface CreateOrderResult {
  error?: unknown;
  unavailableMenus?: unknown;
  order?: unknown;
  orderToken?: unknown;
  checkinCode?: unknown;
}

interface RpcResponseEnvelope {
  data: unknown;
  error: unknown;
}

function getCommitError(value: unknown): string | null {
  if (typeof value !== "string") return null;
  for (const code of ["quote_changed", "quote_already_consumed", "quote_mismatch", "idempotency_key_reused"]) {
    if (value.includes(code)) return code;
  }
  return null;
}

function isInvalidOrderError(value: unknown): boolean {
  return typeof value === "string" &&
    (value.includes("menu_unavailable") || value.includes("invalid_order"));
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
  const paymentChannel = body?.paymentChannel === "cashier" ? "cashier" : "online";
  const quoteId = typeof body?.quoteId === "string" ? body.quoteId.trim() : "";
  const idempotencyKey = req.headers.get("idempotency-key")?.trim() ?? "";

  if (!cafeId || !table || !items) {
    return NextResponse.json({ error: "Data pesanan tidak valid" }, { status: 400 });
  }
  if (!quoteId || !idempotencyKey) {
    return NextResponse.json({
      code: "checkout_metadata_required",
      error: "Ringkasan pesanan perlu dimuat ulang sebelum dikirim",
    }, { status: 400 });
  }

  // Validasi murah dijalankan lebih dulu supaya permintaan cacat tidak
  // membebani limiter dengan roundtrip database.
  const ip = clientIp(req);
  const limit = await consumeRateLimits(
    [
      { key: `orders:ip:${ip}`, limit: ORDERS_PER_IP.limit },
      { key: `orders:cafe:${cafeId}`, limit: ORDERS_PER_CAFE.limit },
    ],
    ORDERS_PER_IP.windowSeconds
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  let rpcResponse;
  try {
    rpcResponse = await supabaseAdmin.rpc("commit_order_atomic", {
      p_cafe_id: cafeId,
      p_table_number: table,
      p_items: items,
      p_notes: notes,
      p_channel: paymentChannel,
      p_quote_id: quoteId,
      p_idempotency_key: idempotencyKey,
    });
  } catch {
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  if (!isRpcResponseEnvelope(rpcResponse)) {
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 502 });
  }

  const { data, error } = rpcResponse;
  if (error) {
    const commitError = getCommitError(getRpcErrorMessage(error));
    if (commitError) {
      const status = commitError === "idempotency_key_reused" ? 409 : 422;
      return NextResponse.json({ code: commitError, error: "Ringkasan pesanan berubah. Muat ulang sebelum dikirim." }, { status });
    }
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

  return NextResponse.json(
    { order: result.order, orderToken: result.orderToken, checkinCode: result.checkinCode ?? null },
    { status: 201 }
  );
}
