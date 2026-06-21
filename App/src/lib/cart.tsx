"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, Menu } from "@/types";

interface CartState {
  items: CartItem[];
  table: string;
  count: number;
  total: number;
  add: (menu: Menu, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  setTable: (t: string) => void;
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
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(slug));
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: CartItem[]; table?: string };
        setItems(parsed.items ?? []);
        setTableState(parsed.table ?? "");
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
      localStorage.setItem(storageKey(slug), JSON.stringify({ items, table }));
    } catch {
      /* storage full / unavailable */
    }
  }, [items, table, slug, hydrated]);

  function add(menu: Menu, qty = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.id_menu === menu.id_menu);
      if (existing) {
        return prev.map((i) =>
          i.id_menu === menu.id_menu ? { ...i, qty: i.qty + qty } : i
        );
      }
      return [
        ...prev,
        {
          id_menu: menu.id_menu,
          nama_menu: menu.nama_menu,
          harga_menu: menu.harga_menu,
          image_url: menu.image_url ?? null,
          qty,
        },
      ];
    });
  }

  function setQty(id: string, qty: number) {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.id_menu !== id)
        : prev.map((i) => (i.id_menu === id ? { ...i, qty } : i))
    );
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id_menu !== id));
  }

  function setTable(t: string) {
    setTableState(t);
  }

  function clear() {
    setItems([]);
    setTableState("");
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
    count,
    total,
    add,
    setQty,
    remove,
    setTable,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
