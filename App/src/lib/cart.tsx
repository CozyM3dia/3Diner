"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { cartLineKey, type CartItem, type Menu, type SelectedOption } from "@/types";

interface CartState {
  items: CartItem[];
  table: string;
  notes: string;
  count: number;
  total: number;
  add: (menu: Menu, qty?: number, options?: SelectedOption[]) => void;
  /** Baris diidentifikasi lewat `line_key`, bukan `id_menu` — satu menu bisa
   *  muncul beberapa kali dengan varian berbeda. */
  setQty: (lineKey: string, qty: number) => void;
  remove: (lineKey: string) => void;
  setTable: (t: string) => void;
  setNotes: (n: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);

function storageKey(slug: string) {
  return `3diner.cart.${slug}`;
}

export function CartProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [table, setTableState] = useState("");
  const [notes, setNotesState] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(slug));
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: CartItem[]; table?: string; notes?: string };
        // Keranjang yang disimpan sebelum varian ada tidak punya line_key.
        setItems(
          (parsed.items ?? []).map((item) => ({
            ...item,
            options: item.options ?? [],
            line_key:
              item.line_key ??
              cartLineKey(item.id_menu, (item.options ?? []).map((o) => o.id_option_value)),
          }))
        );
        setTableState(parsed.table ?? "");
        setNotesState(parsed.notes ?? "");
      }
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, [slug]);

  // Persist on change (after hydration to avoid clobbering)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify({ items, table, notes }));
    } catch {
      /* storage full / unavailable */
    }
  }, [items, table, notes, slug, hydrated]);

  function add(menu: Menu, qty = 1, options: SelectedOption[] = []) {
    const lineKey = cartLineKey(
      menu.id_menu,
      options.map((o) => o.id_option_value)
    );
    // Harga satuan membekukan selisih varian saat item dimasukkan. Server tetap
    // menghitung ulang dari harga kanonik saat pesanan dibuat.
    const unitPrice =
      menu.harga_menu + options.reduce((sum, o) => sum + o.price_delta, 0);

    setItems((prev) => {
      const existing = prev.find((i) => i.line_key === lineKey);
      if (existing) {
        return prev.map((i) => (i.line_key === lineKey ? { ...i, qty: i.qty + qty } : i));
      }
      return [
        ...prev,
        {
          line_key: lineKey,
          id_menu: menu.id_menu,
          nama_menu: menu.nama_menu,
          harga_menu: unitPrice,
          image_url: menu.image_url ?? null,
          qty,
          options,
        },
      ];
    });
  }

  function setQty(lineKey: string, qty: number) {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.line_key !== lineKey)
        : prev.map((i) => (i.line_key === lineKey ? { ...i, qty } : i))
    );
  }

  function remove(lineKey: string) {
    setItems((prev) => prev.filter((i) => i.line_key !== lineKey));
  }

  function setTable(t: string) {
    setTableState(t);
  }

  function setNotes(n: string) {
    setNotesState(n);
  }

  function clear() {
    setItems([]);
    setTableState("");
    setNotesState("");
  }

  const { count, total } = useMemo(() => {
    let c = 0;
    let t = 0;
    for (const i of items) {
      c += i.qty;
      t += i.qty * i.harga_menu;
    }
    return { count: c, total: t };
  }, [items]);

  const value: CartState = {
    items,
    table,
    notes,
    count,
    total,
    add,
    setQty,
    remove,
    setTable,
    setNotes,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
