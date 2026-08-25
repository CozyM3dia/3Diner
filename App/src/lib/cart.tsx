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
import { cartStorageKey, readGuestCart, writeGuestCart } from "@/lib/cart-storage";

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

type CartSnapshot = { items: CartItem[]; table: string; notes: string };

const EMPTY_CART: CartSnapshot = { items: [], table: "", notes: "" };
const listeners = new Map<string, Set<() => void>>();
const snapshotCache = new Map<string, { raw: string | null; value: CartSnapshot }>();

const CartContext = createContext<CartState | null>(null);

function emitCart(slug: string) {
  snapshotCache.delete(slug);
  for (const listener of listeners.get(slug) ?? []) listener();
}

function subscribeCart(slug: string, onStoreChange: () => void) {
  try {
    const key = cartStorageKey(slug);
    const raw = localStorage.getItem(key);
    if (raw && !readGuestCart(raw)) {
      localStorage.removeItem(key);
      snapshotCache.delete(slug);
    }
  } catch {
    /* ignore corrupt storage */
  }

  let set = listeners.get(slug);
  if (!set) {
    set = new Set();
    listeners.set(slug, set);
  }
  set.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === cartStorageKey(slug)) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function readSnapshot(slug: string): CartSnapshot {
  try {
    const raw = localStorage.getItem(cartStorageKey(slug));
    const cached = snapshotCache.get(slug);
    if (cached && cached.raw === raw) return cached.value;

    const parsed = readGuestCart(raw);
    const value: CartSnapshot = parsed
      ? { items: parsed.items, table: parsed.table, notes: parsed.notes }
      : EMPTY_CART;
    snapshotCache.set(slug, { raw, value });
    return value;
  } catch {
    return EMPTY_CART;
  }
}

function writeSnapshot(slug: string, next: CartSnapshot) {
  try {
    localStorage.setItem(cartStorageKey(slug), writeGuestCart(next));
  } catch {
    /* storage full / unavailable */
  }
  emitCart(slug);
}

function updateCart(slug: string, updater: (prev: CartSnapshot) => CartSnapshot) {
  writeSnapshot(slug, updater(readSnapshot(slug)));
}

export function CartProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeCart(slug, onStoreChange),
    [slug],
  );
  const getSnapshot = useCallback(() => readSnapshot(slug), [slug]);
  const getServerSnapshot = useCallback(() => EMPTY_CART, []);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((menu: Menu, qty = 1, options: SelectedOption[] = []) => {
    if (qty <= 0) return;
    const lineKey = cartLineKey(
      menu.id_menu,
      options.map((o) => o.id_option_value)
    );
    // Harga satuan membekukan selisih varian saat item dimasukkan. Server tetap
    // menghitung ulang dari harga kanonik saat pesanan dibuat.
    const unitPrice =
      menu.harga_menu + options.reduce((sum, o) => sum + o.price_delta, 0);

    updateCart(slug, (prev) => {
      const existing = prev.items.find((i) => i.line_key === lineKey);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((i) => (i.line_key === lineKey ? { ...i, qty: i.qty + qty } : i)),
        };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
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
  }, [slug]);

  const setQty = useCallback((lineKey: string, qty: number) => {
    updateCart(slug, (prev) => ({
      ...prev,
      items:
        qty <= 0
          ? prev.items.filter((i) => i.line_key !== lineKey)
          : prev.items.map((i) => (i.line_key === lineKey ? { ...i, qty } : i)),
    }));
  }, [slug]);

  const remove = useCallback((lineKey: string) => {
    updateCart(slug, (prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.line_key !== lineKey),
    }));
  }, [slug]);

  const setTable = useCallback((t: string) => {
    updateCart(slug, (prev) => ({ ...prev, table: t }));
  }, [slug]);

  const setNotes = useCallback((n: string) => {
    updateCart(slug, (prev) => ({ ...prev, notes: n }));
  }, [slug]);

  const clear = useCallback(() => {
    writeSnapshot(slug, EMPTY_CART);
  }, [slug]);

  const { count, total } = useMemo(() => {
    let c = 0;
    let t = 0;
    for (const i of snapshot.items) {
      c += i.qty;
      t += i.qty * i.harga_menu;
    }
    return { count: c, total: t };
  }, [snapshot.items]);

  const value: CartState = {
    items: snapshot.items,
    table: snapshot.table,
    notes: snapshot.notes,
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
