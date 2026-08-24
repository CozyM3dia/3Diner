import { NextResponse } from "next/server";
import { parseItems } from "@/lib/order-request";
import { clientIp, consumeRateLimits, tooManyRequests } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { OrderItem, OrderQuote, SelectedOption } from "@/types";

const QUOTES_PER_IP = { limit: 10, windowSeconds: 60 };
const QUOTES_PER_CAFE = { limit: 120, windowSeconds: 60 };

/** Sama seperti route commit: cafeId masuk key limiter, wajib UUID. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QuoteOrderBody {
  cafeId?: unknown;
  table?: unknown;
  notes?: unknown;
  paymentChannel?: unknown;
  items?: unknown;
}

interface RpcResponseEnvelope {
  data: unknown;
  error: unknown;
}

interface IssuedQuote {
  quote_id: string;
  request_hash: string;
  expires_at: string;
  quote: unknown;
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isSelectedOption(value: unknown): value is SelectedOption {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const option = value as Record<string, unknown>;
  return (
    typeof option.id_option_value === "string" && option.id_option_value.length > 0 &&
    typeof option.group_name === "string" &&
    typeof option.name === "string" &&
    typeof option.price_delta === "number" && Number.isFinite(option.price_delta)
  );
}

function isOrderItem(value: unknown): value is OrderItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id_menu === "string" && item.id_menu.length > 0 &&
    typeof item.nama_menu === "string" &&
    isFiniteNonNegativeNumber(item.harga_menu) &&
    typeof item.qty === "number" && Number.isInteger(item.qty) && item.qty >= 1 &&
    (!("options" in item) || (Array.isArray(item.options) && item.options.every(isSelectedOption)))
  );
}

function isOrderQuote(value: unknown): value is OrderQuote {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const quote = value as Record<string, unknown>;
  return (
    Array.isArray(quote.items) && quote.items.every(isOrderItem) &&
    isFiniteNonNegativeNumber(quote.subtotal) &&
    isFiniteNonNegativeNumber(quote.tax_pct) &&
    isFiniteNonNegativeNumber(quote.tax_amount) &&
    isFiniteNonNegativeNumber(quote.service_pct) &&
    isFiniteNonNegativeNumber(quote.service_amount) &&
    typeof quote.prices_include_tax === "boolean" &&
    isFiniteNonNegativeNumber(quote.total)
  );
}

function isIssuedQuote(value: unknown): value is IssuedQuote {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const issued = value as Record<string, unknown>;
  return typeof issued.quote_id === "string" &&
    /^[0-9a-f-]{36}$/i.test(issued.quote_id) &&
    typeof issued.request_hash === "string" &&
    /^[0-9a-f]{64}$/.test(issued.request_hash) &&
    typeof issued.expires_at === "string" &&
    isOrderQuote(issued.quote);
}

function isRpcResponseEnvelope(value: unknown): value is RpcResponseEnvelope {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) &&
    "data" in value && "error" in value
  );
}

function isInvalidOrderError(value: unknown): boolean {
  const message = typeof value === "object" && value !== null
    ? (value as { message?: unknown }).message
    : undefined;
  return typeof message === "string" && (
    message.includes("menu_unavailable") || message.includes("invalid_order")
  );
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as QuoteOrderBody | null;
  const cafeId = typeof body?.cafeId === "string" ? body.cafeId.trim() : "";
  const table = typeof body?.table === "string" ? body.table.trim().slice(0, 30) : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim().slice(0, 500) : "";
  const paymentChannel = body?.paymentChannel === "cashier" ? "cashier" : "online";
  const items = parseItems(body?.items);

  if (!cafeId || !table || !items) {
    return NextResponse.json({ error: "Data pesanan tidak valid" }, { status: 400 });
  }
  if (!UUID_RE.test(cafeId)) {
    return NextResponse.json({ error: "Data pesanan tidak valid" }, { status: 400 });
  }

  const limit = await consumeRateLimits(
    [
      { key: `order-quotes:ip:${clientIp(req)}`, limit: QUOTES_PER_IP.limit },
      { key: `order-quotes:cafe:${cafeId}`, limit: QUOTES_PER_CAFE.limit },
    ],
    QUOTES_PER_IP.windowSeconds
  );
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);

  let rpcResponse: unknown;
  try {
    rpcResponse = await supabaseAdmin.rpc("issue_order_quote", {
      p_cafe_id: cafeId,
      p_table_number: table,
      p_items: items,
      p_notes: notes,
      p_channel: paymentChannel,
    });
  } catch (err) {
    // Pesan ke pelanggan sengaja generik, tapi penyebabnya wajib tercatat:
    // bug `p_quote_id` (42703) dan pgcrypto search_path (42883) sama-sama
    // lolos tanpa jejak karena error RPC dulu dibuang di sini.
    console.error("[api/orders/quote] rpc threw", { cafeId, err });
    return NextResponse.json({ error: "Gagal memuat ringkasan pesanan" }, { status: 502 });
  }

  if (!isRpcResponseEnvelope(rpcResponse)) {
    console.error("[api/orders/quote] malformed rpc envelope", { cafeId });
    return NextResponse.json({ error: "Gagal memuat ringkasan pesanan" }, { status: 502 });
  }
  if (rpcResponse.error) {
    if (isInvalidOrderError(rpcResponse.error)) {
      return NextResponse.json({ error: "Menu tidak tersedia" }, { status: 400 });
    }
    console.error("[api/orders/quote] issue_order_quote failed", { cafeId, error: rpcResponse.error });
    return NextResponse.json({ error: "Gagal memuat ringkasan pesanan" }, { status: 502 });
  }
  if (!isIssuedQuote(rpcResponse.data)) {
    console.error("[api/orders/quote] unexpected quote shape", { cafeId });
    return NextResponse.json({ error: "Gagal memuat ringkasan pesanan" }, { status: 502 });
  }

  return NextResponse.json(rpcResponse.data);
}
