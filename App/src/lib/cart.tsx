"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
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

interface StoredCart {
  items: CartItem[];
  table: string;
  notes: string;
}

interface PersistedCart {
  items?: CartItem[];
  table?: string;
  notes?: string;
}

interface CartCacheEntry {
  raw: string | null;
  snapshot: StoredCart;
  memoryOnly?: boolean;
}

const EMPTY_CART: StoredCart = { items: [], table: "", notes: "" };
const cartCache = new Map<string, CartCacheEntry>();
const cartListeners = new Map<string, Set<() => void>>();

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseStoredCart(raw: string | null): StoredCart {
  if (!raw) return EMPTY_CART;

  try {
    const parsed = JSON.parse(raw) as PersistedCart;
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item) => ({
          ...item,
          options: item.options ?? [],
          // Keranjang yang disimpan sebelum varian ada tidak punya line_key.
          line_key:
            item.line_key ??
            cartLineKey(item.id_menu, (item.options ?? []).map((o) => o.id_option_value)),
        }))
      : [];

    return {
      items,
      table: parsed.table ?? "",
      notes: parsed.notes ?? "",
    };
  } catch {
    return EMPTY_CART;
  }
}

function getCartSnapshot(slug: string): StoredCart {
  const raw = readStorage(storageKey(slug));
  const cached = cartCache.get(slug);
  if (cached && (cached.memoryOnly || cached.raw === raw)) return cached.snapshot;

  const snapshot = parseStoredCart(raw);
  cartCache.set(slug, { raw, snapshot });
  return snapshot;
}

function notifyCartListeners(slug: string) {
  const listeners = cartListeners.get(slug);
  if (!listeners) return;
  for (const listener of listeners) listener();
}

function subscribeToCart(slug: string, listener: () => void) {
  let listeners = cartListeners.get(slug);
  if (!listeners) {
    listeners = new Set();
    cartListeners.set(slug, listeners);
  }
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== storageKey(slug)) return;
    cartCache.delete(slug);
    notifyCartListeners(slug);
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    listeners?.delete(listener);
    if (listeners?.size === 0) cartListeners.delete(slug);
  };
}

function updateCart(slug: string, update: (current: StoredCart) => StoredCart) {
  const current = getCartSnapshot(slug);
  const next = update(current);
  const raw = JSON.stringify(next);
  let memoryOnly = false;

  try {
    window.localStorage.setItem(storageKey(slug), raw);
  } catch {
    // Keep the current tab responsive even when storage is unavailable/full.
    memoryOnly = true;
  }

  cartCache.set(slug, {
    raw: memoryOnly ? readStorage(storageKey(slug)) : raw,
    snapshot: next,
    memoryOnly,
  });
  notifyCartListeners(slug);
}

const getServerCartSnapshot = () => EMPTY_CART;

export function CartProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToCart(slug, listener),
    [slug]
  );
  const getSnapshot = useCallback(() => getCartSnapshot(slug), [slug]);
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerCartSnapshot);
  const { items, table, notes } = cart;

  function add(menu: Menu, qty = 1, options: SelectedOption[] = []) {
    if (qty <= 0) return;
    const lineKey = cartLineKey(
      menu.id_menu,
      options.map((o) => o.id_option_value)
    );
    // Harga satuan membekukan selisih varian saat item dimasukkan. Server tetap
    // menghitung ulang dari harga kanonik saat pesanan dibuat.
    const unitPrice =
      menu.harga_menu + options.reduce((sum, o) => sum + o.price_delta, 0);

    updateCart(slug, (current) => {
      const existing = current.items.find((i) => i.line_key === lineKey);
      if (existing) {
        return {
          ...current,
          items: current.items.map((i) => (i.line_key === lineKey ? { ...i, qty: i.qty + qty } : i)),
        };
      }
      return {
        ...current,
        items: [
          ...current.items,
          {
            line_key: lineKey,
            id_menu: menu.id_menu,
            nama_menu: menu.nama_menu,
            harga_menu: unitPrice,
            image_url: menu.image_url ?? null,
            qty,
            options,
          },
        ],
      };
    });
  }

  function setQty(lineKey: string, qty: number) {
    updateCart(slug, (current) => ({
      ...current,
      items:
        qty <= 0
          ? current.items.filter((i) => i.line_key !== lineKey)
          : current.items.map((i) => (i.line_key === lineKey ? { ...i, qty } : i)),
    }));
  }

  function remove(lineKey: string) {
    updateCart(slug, (current) => ({
      ...current,
      items: current.items.filter((i) => i.line_key !== lineKey),
    }));
  }

  function setTable(t: string) {
    updateCart(slug, (current) => ({ ...current, table: t }));
  }

  function setNotes(n: string) {
    updateCart(slug, (current) => ({ ...current, notes: n }));
  }

  function clear() {
    updateCart(slug, () => ({ ...EMPTY_CART, items: [] }));
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
