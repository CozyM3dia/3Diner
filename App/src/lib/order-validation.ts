import { createHash, timingSafeEqual } from "node:crypto";

export interface MenuForOrder {
  id_menu: string;
  cafe_id: string;
  nama_menu: string;
  harga_menu: number;
  discount_pct: number | null;
  is_active: boolean;
}

export interface RequestedOrderItem {
  id_menu: string;
  qty: number;
}

export interface CanonicalOrderItem {
  id_menu: string;
  nama_menu: string;
  harga_menu: number;
  qty: number;
}

export interface MidtransSignatureNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
}

export function calculateOrderTotal(
  menus: MenuForOrder[],
  items: RequestedOrderItem[]
): CanonicalOrderItem[] {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    throw new Error("Menu tidak tersedia");
  }

  return items.map(({ id_menu, qty }) => {
    const menu = menus.find((candidate) => candidate.id_menu === id_menu && candidate.is_active);
    if (!menu || !Number.isInteger(qty) || qty < 1 || qty > 50) {
      throw new Error("Menu tidak tersedia");
    }

    const discount = Math.min(Math.max(menu.discount_pct ?? 0, 0), 100);
    return {
      id_menu: menu.id_menu,
      nama_menu: menu.nama_menu,
      harga_menu: Math.round(menu.harga_menu * (1 - discount / 100)),
      qty,
    };
  });
}

export function verifyMidtransSignature(
  notification: MidtransSignatureNotification,
  serverKey: string
): boolean {
  const expected = createHash("sha512")
    .update(
      `${notification.order_id}${notification.status_code}${notification.gross_amount}${serverKey}`
    )
    .digest("hex");

  const sigBuf = Buffer.from(notification.signature_key);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;

  return timingSafeEqual(sigBuf, expBuf);
}
