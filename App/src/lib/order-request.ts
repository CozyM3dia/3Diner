/** Penguraian body `POST /api/orders`.
 *
 *  Dipisah dari route-nya supaya bisa diuji langsung: sebelumnya penguraian ini
 *  menyusun ulang tiap item menjadi `{ id_menu, qty }` dan diam-diam membuang
 *  `options`, sehingga varian yang dipilih tamu tidak pernah sampai ke RPC. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Batas ini mengikuti `create_order_with_inventory`, yang menolak lebih dari 20
 *  varian per baris dan 50 baris per pesanan. */
const MAX_ITEMS = 50;
const MAX_OPTIONS_PER_ITEM = 20;
const MAX_QTY = 50;

export interface RequestedOrderItem {
  id_menu: string;
  qty: number;
  options: string[];
  /** Catatan kasir/pembeli untuk item ini (opsional). Diteruskan utuh ke RPC:
   *  quote_order & create_order menyimpannya di Orders.items (kunci `notes`). */
  note?: string;
}

/** `null` berarti tolak permintaan; array kosong berarti item tanpa varian. */
function parseOptions(value: unknown): string[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_OPTIONS_PER_ITEM) return null;
  if (value.some((id) => typeof id !== "string" || !UUID_RE.test(id))) return null;

  // Duplikat dinormalkan di sini juga supaya batas max_select di server tidak
  // dilanggar hanya karena klien mengirim id yang sama dua kali.
  return [...new Set(value as string[])];
}

export function parseItems(value: unknown): RequestedOrderItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) return null;

  const items = value.map((item) => {
    if (!item || typeof item !== "object") return null;

    const candidate = item as { id_menu?: unknown; qty?: unknown; options?: unknown; note?: unknown };
    const options = parseOptions(candidate.options);
    if (!options) return null;

    const note =
      typeof candidate.note === "string" && candidate.note.trim()
        ? candidate.note.trim().slice(0, 140)
        : undefined;

    return {
      id_menu: typeof candidate.id_menu === "string" ? candidate.id_menu : "",
      qty: candidate.qty,
      options,
      note,
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
        item.qty > MAX_QTY
    )
  ) {
    return null;
  }

  return items as RequestedOrderItem[];
}
