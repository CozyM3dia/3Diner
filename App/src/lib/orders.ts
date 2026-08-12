import type { CartItem, Order, PaymentMethod } from "@/types";

const key = (id: string) => `3diner.order.${id}`;
const QRIS_HOSTS = new Set(["api.midtrans.com", "api.sandbox.midtrans.com"]);

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

/** Membaca pesanan dari server. Token boleh datang dari localStorage atau dari
 *  query string tautan — itu yang membuat pesanan tetap terbuka di perangkat lain. */
export async function fetchOrder(id: string, token: string): Promise<FetchedOrder | null> {
  const res = await fetch(
    `/api/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { order?: Order; reviewUrl?: string | null };
  if (!data.order) return null;

  const order: Order = { ...data.order, customer_token: token };
  saveStub(order);
  return { order, reviewUrl: data.reviewUrl ?? null };
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
