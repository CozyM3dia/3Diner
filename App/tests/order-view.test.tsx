// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { chargeOnline, fetchOrder, getQrisUrl, getStub, setQrisUrl } = vi.hoisted(() => ({
  chargeOnline: vi.fn(),
  fetchOrder: vi.fn(),
  getQrisUrl: vi.fn(),
  getStub: vi.fn(),
  setQrisUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/orders", () => ({ chargeOnline, fetchOrder, getQrisUrl, getStub, setQrisUrl }));

import OrderView from "@/components/OrderView";

const order = (overrides: Record<string, unknown> = {}) => ({
  id_order: "order-1",
  cafe_id: "cafe-1",
  cafe_slug: "senja-kopi",
  cafe_name: "Senja Kopi",
  table_number: "21",
  items: [{ id_menu: "menu-1", nama_menu: "Butter Croissant", harga_menu: 21250, qty: 1 }],
  subtotal: 21250,
  tax_pct: 0,
  tax_amount: 0,
  service_pct: 0,
  service_amount: 0,
  prices_include_tax: true,
  total: 21250,
  status: "awaiting",
  payment_method: null,
  payment_status: "awaiting_payment",
  payment_qr_url: null,
  created_at: "2026-08-12T10:00:00.000Z",
  ...overrides,
});

describe("OrderView QRIS entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStub.mockReturnValue({ customer_token: "token-1" });
    getQrisUrl.mockReturnValue(null);
    chargeOnline.mockResolvedValue("https://api.sandbox.midtrans.com/v2/qris/tx-1/qr-code");
  });

  afterEach(() => cleanup());

  it("opens QRIS directly and starts the charge without the intermediate screen", async () => {
    fetchOrder
      .mockResolvedValueOnce({ order: order(), reviewUrl: null })
      .mockResolvedValue({
        order: order({
          payment_status: "pending",
          payment_qr_url: "https://api.sandbox.midtrans.com/v2/qris/tx-1/qr-code",
        }),
        reviewUrl: null,
      });

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await waitFor(() => expect(chargeOnline).toHaveBeenCalledWith("order-1", "token-1"));
    await waitFor(() => expect(screen.getByAltText("Kode QRIS pembayaran")).toBeTruthy());

    expect(screen.queryByText("Tampilkan QRIS")).toBeNull();
    expect(screen.queryByText("Pesanan Dibuat")).toBeNull();
  });

  it("does not reuse a cached QR for a fresh awaiting-payment order", async () => {
    getQrisUrl.mockReturnValue("https://api.sandbox.midtrans.com/v2/qris/old-tx/qr-code");
    fetchOrder
      .mockResolvedValueOnce({ order: order(), reviewUrl: null })
      .mockResolvedValue({
        order: order({
          payment_status: "pending",
          payment_qr_url: "https://api.sandbox.midtrans.com/v2/qris/tx-1/qr-code",
        }),
        reviewUrl: null,
      });

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await waitFor(() => expect(chargeOnline).toHaveBeenCalledWith("order-1", "token-1"));
    expect(screen.queryByAltText("Kode QRIS pembayaran")?.getAttribute("src")).not.toContain("old-tx");
  });
});
