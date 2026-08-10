import type { CartItem, Order, PaymentMethod } from "@/types";

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        cb: {
          onSuccess?: (r: unknown) => void;
          onPending?: (r: unknown) => void;
          onError?: (r: unknown) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

const key = (id: string) => `3diner.order.${id}`;

/** Cache lokal hanya menyimpan yang tidak ada di server: token pelanggan dan
 *  identitas kafe untuk tautan kembali. Status pesanan selalu diambil ulang dari
 *  server — localStorage tidak lagi jadi sumber kebenaran. */
interface OrderStub {
  id_order: string;
  cafe_slug: string;
  cafe_name: string;
  customer_token: string;
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
    const stub: OrderStub = {
      id_order: order.id_order,
      cafe_slug: order.cafe_slug,
      cafe_name: order.cafe_name,
      customer_token: order.customer_token,
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

/** Meminta token transaksi Snap ke server untuk pembayaran online. Server yang
 *  memegang server-key Midtrans; klien hanya menerima token lalu membuka popup. */
export async function chargeOnline(orderId: string, token: string): Promise<string> {
  const res = await fetch("/api/payment/charge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, orderToken: token }),
  });
  const data = (await res.json().catch(() => null)) as { snap_token?: string; error?: string } | null;
  if (!res.ok || !data?.snap_token) {
    throw new Error(data?.error ?? "Gagal memulai pembayaran");
  }
  return data.snap_token;
}

/** Membuka popup Midtrans Snap. Melempar bila skrip Snap belum termuat — pemanggil
 *  menampilkan pesan agar pelanggan memuat ulang halaman. */
export function startSnapPayment(
  token: string,
  cb: {
    onSuccess?: () => void;
    onPending?: () => void;
    onError?: () => void;
    onClose?: () => void;
  },
): void {
  if (typeof window === "undefined" || !window.snap) {
    throw new Error("Pembayaran belum siap. Muat ulang halaman lalu coba lagi.");
  }
  window.snap.pay(token, {
    onSuccess: () => cb.onSuccess?.(),
    onPending: () => cb.onPending?.(),
    onError: () => cb.onError?.(),
    onClose: () => cb.onClose?.(),
  });
}
