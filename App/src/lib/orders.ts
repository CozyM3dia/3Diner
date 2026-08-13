import type { CartItem, Order, OrderItem, OrderQuote, PaymentMethod, SelectedOption } from "@/types";

const key = (id: string) => `3diner.order.${id}`;
const QRIS_HOSTS = new Set(["api.midtrans.com", "api.sandbox.midtrans.com"]);
const SAFE_QUOTE_ERRORS = new Set(["Menu tidak tersedia", "Data pesanan tidak valid"]);

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

function isOrder(value: unknown): value is Order {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const order = value as Record<string, unknown>;
  const statuses = new Set(["awaiting", "received", "preparing", "ready", "completed", "cancelled"]);
  const paymentMethods = new Set(["cash", "qris", "gopay", "shopeepay", "bank_transfer"]);
  const paymentStatuses = new Set(["unpaid", "awaiting_payment", "awaiting_checkin", "pending", "paid"]);

  return (
    typeof order.id_order === "string" && order.id_order.length > 0 &&
    typeof order.cafe_id === "string" && order.cafe_id.length > 0 &&
    typeof order.cafe_slug === "string" &&
    typeof order.cafe_name === "string" &&
    typeof order.table_number === "string" &&
    Array.isArray(order.items) && order.items.every(isOrderItem) &&
    isFiniteNonNegativeNumber(order.subtotal) &&
    isFiniteNonNegativeNumber(order.tax_pct) &&
    isFiniteNonNegativeNumber(order.tax_amount) &&
    isFiniteNonNegativeNumber(order.service_pct) &&
    isFiniteNonNegativeNumber(order.service_amount) &&
    typeof order.prices_include_tax === "boolean" &&
    isFiniteNonNegativeNumber(order.total) &&
    typeof order.status === "string" && statuses.has(order.status) &&
    (order.payment_method === null || (typeof order.payment_method === "string" && paymentMethods.has(order.payment_method))) &&
    typeof order.payment_status === "string" && paymentStatuses.has(order.payment_status) &&
    typeof order.created_at === "string" &&
    (!("payment_qr_url" in order) || order.payment_qr_url === null || typeof order.payment_qr_url === "string") &&
    (!("cancelled_reason" in order) || order.cancelled_reason === null || typeof order.cancelled_reason === "string")
  );
}

function isMidtransQrisUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && QRIS_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Cache lokal hanya menyimpan yang tidak ada di server: token pelanggan dan
 *  identitas kafe untuk tautan kembali. Status pesanan selalu diambil ulang dari
 *  server — localStorage tidak lagi jadi sumber kebenaran. */
interface OrderStub {
  id_order: string;
  cafe_slug: string;
  cafe_name: string;
  customer_token: string;
  qris_url?: string | null;
}

export async function createOrder(input: {
  cafeId: string;
  cafeSlug: string;
  cafeName: string;
  table: string;
  items: CartItem[];
  notes?: string;
  paymentChannel?: "online" | "cashier";
}): Promise<Order> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cafeId: input.cafeId,
      table: input.table,
      items: input.items.map(({ id_menu, qty, options }) => ({
        id_menu,
        qty,
        options: (options ?? []).map((o) => o.id_option_value),
      })),
      notes: input.notes,
      paymentChannel: input.paymentChannel ?? "online",
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "Gagal membuat pesanan");

  const order: Order = {
    ...data.order,
    cafe_slug: input.cafeSlug,
    cafe_name: input.cafeName,
    customer_token: data.orderToken,
    created_at: data.order.created_at || new Date().toISOString(),
  };
  saveStub(order);
  return order;
}

/** Requests the server's canonical, read-only total before the customer commits. */
export async function quoteOrder(input: {
  cafeId: string;
  items: CartItem[];
}): Promise<OrderQuote> {
  try {
    const response = await fetch("/api/orders/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cafeId: input.cafeId,
        items: input.items.map(({ id_menu, qty, options }) => ({
          id_menu,
          qty,
          options: (options ?? []).map((o) => o.id_option_value),
        })),
      }),
    });
    const data = (await response.json().catch(() => null)) as { quote?: unknown; error?: unknown } | null;
    if (!response.ok) {
      const error = typeof data?.error === "string" && SAFE_QUOTE_ERRORS.has(data.error)
        ? data.error
        : "Gagal memuat ringkasan pesanan";
      throw new Error(error);
    }
    if (!isOrderQuote(data?.quote)) {
      throw new Error("Gagal memuat ringkasan pesanan");
    }
    return data.quote;
  } catch (error) {
    if (error instanceof Error && SAFE_QUOTE_ERRORS.has(error.message)) throw error;
    throw new Error("Gagal memuat ringkasan pesanan");
  }
}

function saveStub(order: Order) {
  if (!order.customer_token) return;
  try {
    const existing = getStub(order.id_order);
    const stub: OrderStub = {
      id_order: order.id_order,
      cafe_slug: order.cafe_slug,
      cafe_name: order.cafe_name,
      customer_token: order.customer_token,
      qris_url: existing?.qris_url ?? null,
    };
    localStorage.setItem(key(order.id_order), JSON.stringify(stub));
  } catch {
    /* storage penuh atau tidak tersedia — pesanan tetap terbuka lewat tautan bertoken */
  }
}

export function getStub(id: string): OrderStub | null {
  try {
    const raw = localStorage.getItem(key(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrderStub>;
    return parsed.customer_token ? (parsed as OrderStub) : null;
  } catch {
    return null;
  }
}

/** QR dinamis bukan sumber kebenaran status, tetapi menyimpannya di perangkat
 *  membuat layar pembayaran tetap bisa dipulihkan setelah refresh tanpa
 *  membuat transaksi Midtrans kedua. */
export function setQrisUrl(id: string, qrisUrl: string): void {
  const stub = getStub(id);
  if (!stub || !isMidtransQrisUrl(qrisUrl)) return;
  try {
    localStorage.setItem(key(id), JSON.stringify({ ...stub, qris_url: qrisUrl }));
  } catch {
    /* storage penuh atau tidak tersedia — QR tetap bisa dipakai di state aktif */
  }
}

export function getQrisUrl(id: string): string | null {
  const qrisUrl = getStub(id)?.qris_url;
  return isMidtransQrisUrl(qrisUrl) ? qrisUrl : null;
}

export interface FetchedOrder {
  order: Order;
  reviewUrl: string | null;
}

export class OrderFetchError extends Error {
  constructor(public readonly kind: "not-found" | "transient") {
    super(kind === "not-found" ? "Pesanan tidak ditemukan" : "Gagal memuat pesanan");
    this.name = "OrderFetchError";
  }
}

/** Membaca pesanan dari server. Token boleh datang dari localStorage atau dari
 *  query string tautan — itu yang membuat pesanan tetap terbuka di perangkat lain. */
export async function fetchOrder(id: string, token: string): Promise<FetchedOrder> {
  try {
    const res = await fetch(
      `/api/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (res.status === 404) throw new OrderFetchError("not-found");
    if (!res.ok) throw new OrderFetchError("transient");

    const data = (await res.json()) as { order?: unknown; reviewUrl?: unknown };
    if (!isOrder(data.order) || !(data.reviewUrl === undefined || data.reviewUrl === null || typeof data.reviewUrl === "string")) {
      throw new OrderFetchError("transient");
    }

    const order: Order = { ...data.order, customer_token: token };
    saveStub(order);
    return { order, reviewUrl: data.reviewUrl ?? null };
  } catch (error) {
    if (error instanceof OrderFetchError) throw error;
    throw new OrderFetchError("transient");
  }
}

/** Mencatat pilihan tunai ke server. Mengembalikan pesan galat, atau null bila
 *  berhasil, supaya pemanggil bisa menampilkannya apa adanya. */
export async function setPaymentMethod(
  id: string,
  token: string,
  method: Extract<PaymentMethod, "cash">
): Promise<string | null> {
  const res = await fetch(`/api/orders/${encodeURIComponent(id)}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderToken: token, method }),
  });
  if (res.ok) return null;

  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Gagal menyimpan metode pembayaran";
}

/** Meminta URL QRIS dinamis ke server untuk pembayaran online. Server yang
 *  memegang server-key Midtrans; klien hanya menerima URL gambar QR. */
export async function chargeOnline(orderId: string, token: string): Promise<string> {
  const res = await fetch("/api/payment/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, orderToken: token }),
  });
  const data = (await res.json().catch(() => null)) as { qris_url?: string; error?: string } | null;
  if (!res.ok || !data?.qris_url) {
    throw new Error(data?.error ?? "Gagal memulai pembayaran");
  }
  return data.qris_url;
}
