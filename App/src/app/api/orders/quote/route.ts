import { NextResponse } from "next/server";
import { parseItems } from "@/lib/order-request";
import { clientIp, consumeRateLimits, tooManyRequests } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { OrderItem, OrderQuote, SelectedOption } from "@/types";

const QUOTES_PER_IP = { limit: 10, windowSeconds: 60 };
const QUOTES_PER_CAFE = { limit: 120, windowSeconds: 60 };

interface QuoteOrderBody {
  cafeId?: unknown;
  items?: unknown;
}

interface RpcResponseEnvelope {
  data: unknown;
  error: unknown;
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
  const items = parseItems(body?.items);

  if (!cafeId || !items) {
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
    rpcResponse = await supabaseAdmin.rpc("quote_order", {
      p_cafe_id: cafeId,
      p_items: items,
    });
  } catch {
    return NextResponse.json({ error: "Gagal memuat ringkasan pesanan" }, { status: 502 });
  }

  if (!isRpcResponseEnvelope(rpcResponse)) {
    return NextResponse.json({ error: "Gagal memuat ringkasan pesanan" }, { status: 502 });
  }
  if (rpcResponse.error) {
    if (isInvalidOrderError(rpcResponse.error)) {
      return NextResponse.json({ error: "Menu tidak tersedia" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal memuat ringkasan pesanan" }, { status: 502 });
  }
  if (!isOrderQuote(rpcResponse.data)) {
    return NextResponse.json({ error: "Gagal memuat ringkasan pesanan" }, { status: 502 });
  }

  return NextResponse.json({ quote: rpcResponse.data });
}
