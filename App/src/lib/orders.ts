import type { CartItem, Order, OrderStatus, PaymentMethod, PaymentStatus } from "@/types";

const key = (id: string) => `3diner.order.${id}`;

export async function createOrder(input: { cafeId: string; cafeSlug: string; cafeName: string; table: string; items: CartItem[]; notes?: string }): Promise<Order> {
  const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cafeId: input.cafeId, table: input.table, items: input.items.map(({ id_menu, qty }) => ({ id_menu, qty })), notes: input.notes }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || data.error || "Gagal membuat pesanan");
  const order: Order = { ...data.order, cafe_slug: input.cafeSlug, cafe_name: input.cafeName, customer_token: data.orderToken, created_at: data.order.created_at || new Date().toISOString() };
  localStorage.setItem(key(order.id_order), JSON.stringify(order));
  return order;
}

export function getOrder(id: string): Order | null { try { const raw = localStorage.getItem(key(id)); return raw ? JSON.parse(raw) as Order : null; } catch { return null; } }

export function updateOrder(id: string, patch: Partial<Pick<Order, "payment_method" | "payment_status" | "status">> & { payment_method?: PaymentMethod; payment_status?: PaymentStatus; status?: OrderStatus }): Order | null {
  const current = getOrder(id); if (!current) return null;
  const next = { ...current, ...patch }; localStorage.setItem(key(id), JSON.stringify(next)); return next;
}
