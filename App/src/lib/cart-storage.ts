import { cartLineKey, type CartItem, type SelectedOption } from "@/types";

/** Tamu QR dine-in biasanya selesai dalam satu kunjungan. Keranjang yang
 *  tertinggal dari berjam-jam lalu tidak boleh muncul lagi seolah baru
 *  ditambahkan. Dua jam cukup untuk refresh/tab tertutup tanpa menghapus
 *  pesanan yang sedang disusun. */
export const GUEST_CART_TTL_MS = 2 * 60 * 60 * 1000;

export function cartStorageKey(slug: string) {
  return `3diner.cart.${slug}`;
}

export type GuestCartSnapshot = {
  items: CartItem[];
  table: string;
  notes: string;
  updatedAt: number;
};

function isSelectedOption(value: unknown): value is SelectedOption {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const option = value as Record<string, unknown>;
  return (
    typeof option.id_option_value === "string" &&
    option.id_option_value.length > 0 &&
    typeof option.group_name === "string" &&
    typeof option.name === "string" &&
    typeof option.price_delta === "number" &&
    Number.isFinite(option.price_delta)
  );
}

function normalizeItem(value: unknown): CartItem | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id_menu !== "string" || item.id_menu.length === 0) return null;
  if (typeof item.nama_menu !== "string") return null;
  if (typeof item.harga_menu !== "number" || !Number.isFinite(item.harga_menu)) return null;
  if (typeof item.qty !== "number" || !Number.isInteger(item.qty) || item.qty < 1) return null;

  const options = Array.isArray(item.options)
    ? item.options.filter(isSelectedOption)
    : [];

  return {
    line_key:
      typeof item.line_key === "string" && item.line_key.length > 0
        ? item.line_key
        : cartLineKey(item.id_menu, options.map((option) => option.id_option_value)),
    id_menu: item.id_menu,
    nama_menu: item.nama_menu,
    harga_menu: item.harga_menu,
    image_url: typeof item.image_url === "string" ? item.image_url : null,
    qty: item.qty,
    options,
    notes: typeof item.notes === "string" ? item.notes : item.notes === null ? null : undefined,
  };
}

/** Snapshot tanpa `updatedAt` adalah sisa penyimpanan lama — anggap kedaluwarsa
 *  supaya kunjungan baru tidak mewarisi keranjang berjam-jam lalu. */
export function readGuestCart(raw: string | null, now = Date.now()): GuestCartSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const updatedAt =
      typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : null;
    if (updatedAt == null || now < updatedAt || now - updatedAt > GUEST_CART_TTL_MS) {
      return null;
    }

    const items = Array.isArray(parsed.items)
      ? parsed.items.map(normalizeItem).filter((item): item is CartItem => item != null)
      : [];

    return {
      items,
      table: typeof parsed.table === "string" ? parsed.table : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function writeGuestCart(
  snapshot: Omit<GuestCartSnapshot, "updatedAt">,
  now = Date.now(),
): string {
  return JSON.stringify({
    items: snapshot.items,
    table: snapshot.table,
    notes: snapshot.notes,
    updatedAt: now,
  });
}
