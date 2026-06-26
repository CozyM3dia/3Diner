/**
 * Order store — customer-side. Primary store is localStorage so the flow
 * works with zero backend dependency (no errors if the Orders table is absent).
 * Each write also best-effort syncs to Supabase `Orders` for the cafe POS
 * dashboard; failures are swallowed silently.
 */

import type {
  CartItem,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/types";

function key(id: string) {
  return `3diner.order.${id}`;
}

/** Short human-friendly order reference, e.g. "SJ-0241". */
function makeRef(cafeName: string): string {
  const initials =
    cafeName
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "OD";
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${initials}-${n}`;
}

interface CreateOrderInput {
  cafeId: string;
  cafeSlug: string;
  cafeName: string;
  table: string;
  items: CartItem[];
  total: number;
  notes?: string;
}

export function createOrder(input: CreateOrderInput): Order {
  const ref = makeRef(input.cafeName);
  const order: Order = {
    id_order: ref,
    cafe_id: input.cafeId,
    cafe_slug: input.cafeSlug,
    cafe_name: input.cafeName,
    table_number: input.table,
    items: input.items,
    total: input.total,
    status: "received",
    payment_method: null,
    payment_status: "unpaid",
    created_at: new Date().toISOString(),
    notes: input.notes || null,
  };

  try {
    localStorage.setItem(key(ref), JSON.stringify(order));
  } catch {
    /* ignore */
  }

  syncToSupabase(order);
  return order;
}

export function getOrder(id: string): Order | null {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}

export function updateOrder(
  id: string,
  patch: Partial<
    Pick<Order, "payment_method" | "payment_status" | "status">
  > & { payment_method?: PaymentMethod; payment_status?: PaymentStatus; status?: OrderStatus }
): Order | null {
  const current = getOrder(id);
  if (!current) return null;
  const next: Order = { ...current, ...patch };
  try {
    localStorage.setItem(key(id), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  syncToSupabase(next);
  return next;
}

/** Fire-and-forget upsert to Supabase. Never throws. */
function syncToSupabase(order: Order) {
  // Dynamic import keeps the customer flow independent of Supabase availability.
  import("./supabase")
    .then(({ supabase }) =>
      supabase
        .from("Orders")
        .upsert(
          {
            id_order: order.id_order,
            cafe_id: order.cafe_id,
            table_number: order.table_number,
            items: order.items,
            total: order.total,
            status: order.status,
            payment_method: order.payment_method,
            payment_status: order.payment_status,
            created_at: order.created_at,
            notes: order.notes,
          },
          { onConflict: "id_order" }
        )
        .then(() => {})
    )
    .catch(() => {
      /* table may not exist yet — POS dashboard is a later phase */
    });
}
