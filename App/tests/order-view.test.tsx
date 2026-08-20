// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { chargeOnline, fetchOrder, getQrisUrl, getStub, navigation, OrderFetchError, setQrisUrl } = vi.hoisted(() => {
  class TestOrderFetchError extends Error {
    kind: "not-found" | "transient";

    constructor(kind: "not-found" | "transient") {
      super(kind);
      this.kind = kind;
    }
  }

  return {
    chargeOnline: vi.fn(),
    fetchOrder: vi.fn(),
    getQrisUrl: vi.fn(),
    getStub: vi.fn(),
    navigation: { search: "" },
    OrderFetchError: TestOrderFetchError,
    setQrisUrl: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/orders", () => ({ chargeOnline, fetchOrder, getQrisUrl, getStub, OrderFetchError, setQrisUrl }));

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
    navigation.search = "token=token-1";
    getStub.mockReturnValue(null);
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
    expect(screen.queryByText("Scan QR ini dengan aplikasi apa pun yang mendukung QRIS.")).toBeNull();
    for (const app of ["GoPay", "OVO", "DANA", "ShopeePay", "m-banking"]) {
      expect(screen.queryByText(app, { exact: true })).toBeNull();
    }
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

describe("OrderView recovery and terminal states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.search = "token=stub-token";
    getStub.mockReturnValue(null);
    getQrisUrl.mockReturnValue(null);
    chargeOnline.mockResolvedValue("https://api.sandbox.midtrans.com/v2/qris/tx-1/qr-code");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("offers a retry after a transient initial load and preserves the token from the URL", async () => {
    navigation.search = "token=url-token";
    fetchOrder
      .mockRejectedValueOnce(new OrderFetchError("transient"))
      .mockResolvedValueOnce({ order: order({ status: "received", payment_status: "paid" }), reviewUrl: null });

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    const heading = await screen.findByRole("heading", { name: "Pesanan belum dapat dimuat" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole("alert").textContent).toContain("coba lagi");
    fireEvent.click(screen.getByRole("button", { name: "Coba Lagi" }));

    await screen.findByRole("heading", { name: "Pembayaran Berhasil" });
    expect(fetchOrder).toHaveBeenNthCalledWith(1, "order-1", "url-token");
    expect(fetchOrder).toHaveBeenNthCalledWith(2, "order-1", "url-token");
  });

  it("shows a permanent missing-order state for a not-found response", async () => {
    fetchOrder.mockRejectedValue(new OrderFetchError("not-found"));

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    const heading = await screen.findByRole("heading", { name: "Pesanan tidak ditemukan" });
    expect(document.activeElement).toBe(heading);
    expect(screen.queryByRole("button", { name: "Coba Lagi" })).toBeNull();
  });

  it("keeps a loaded order visible when a status refresh has a transient failure", async () => {
    fetchOrder
      .mockResolvedValueOnce({ order: order({ status: "received", payment_status: "paid" }), reviewUrl: null })
      .mockRejectedValueOnce(new OrderFetchError("transient"));

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await screen.findByRole("heading", { name: "Pembayaran Berhasil" });
    fireEvent.click(screen.getByRole("button", { name: "Perbarui status pesanan" }));

    expect((await screen.findByRole("status")).textContent).toContain("belum dapat diperbarui");
    expect(screen.getByRole("heading", { name: "Pembayaran Berhasil" })).toBeTruthy();
  });

  it("requires acknowledgement of a changed approved total before one QRIS charge", async () => {
    navigation.search = "token=url-token&reviewTotal=20000";
    fetchOrder
      .mockResolvedValueOnce({ order: order({ total: 21_250 }), reviewUrl: null })
      .mockResolvedValue({
        order: order({ payment_status: "pending", payment_qr_url: "https://api.sandbox.midtrans.com/v2/qris/tx-1/qr-code" }),
        reviewUrl: null,
      });

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await screen.findByRole("heading", { name: "Total pesanan berubah" });
    expect(screen.getByText(/20\.000/)).toBeTruthy();
    expect(screen.getByText(/21\.250/)).toBeTruthy();
    expect(chargeOnline).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Lanjutkan ke QRIS" }));

    await waitFor(() => expect(chargeOnline).toHaveBeenCalledTimes(1));
    expect(chargeOnline).toHaveBeenCalledWith("order-1", "url-token");
  });

  it.each(["21250", "bukan-angka"]) ("does not gate QRIS for an equal or invalid review total marker (%s)", async (marker) => {
    navigation.search = `token=url-token&reviewTotal=${marker}`;
    fetchOrder
      .mockResolvedValueOnce({ order: order(), reviewUrl: null })
      .mockResolvedValue({
        order: order({ payment_status: "pending", payment_qr_url: "https://api.sandbox.midtrans.com/v2/qris/tx-1/qr-code" }),
        reviewUrl: null,
      });

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await waitFor(() => expect(chargeOnline).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Total pesanan berubah" })).toBeNull();
  });

  it("renders completed and cancelled orders as distinct terminal views", async () => {
    fetchOrder.mockResolvedValueOnce({
      order: order({ status: "completed", payment_status: "paid" }),
      reviewUrl: null,
    });
    const { rerender } = render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await screen.findByRole("heading", { name: "Pesanan selesai" });
    expect(screen.getByText("Pesananmu sudah selesai.")).toBeTruthy();

    fetchOrder.mockResolvedValueOnce({
      order: order({ status: "cancelled", cancelled_reason: "Bahan habis" }),
      reviewUrl: null,
    });
    rerender(<OrderView slug="senja-kopi" orderId="order-2" />);

    await screen.findByRole("heading", { name: "Pesanan dibatalkan" });
    expect(screen.getByText("Bahan habis")).toBeTruthy();
    expect(screen.queryByText("Sedang Disiapkan")).toBeNull();
  });

  it.each([
    ["completed", "paid"],
    ["cancelled", "unpaid"],
  ])("does not poll terminal kitchen state %s", async (status, payment_status) => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    fetchOrder.mockResolvedValue({ order: order({ status, payment_status }), reviewUrl: null });

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await screen.findByRole("heading", { level: 1 });
    expect(setIntervalSpy).not.toHaveBeenCalledWith(expect.any(Function), 15_000);
  });

  it("keeps polling ready orders until the server reports completion", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    fetchOrder
      .mockResolvedValueOnce({ order: order({ status: "ready", payment_status: "paid" }), reviewUrl: null })
      .mockResolvedValueOnce({ order: order({ status: "completed", payment_status: "paid" }), reviewUrl: null });

    render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await waitFor(() => expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15_000));
    const poll = setIntervalSpy.mock.calls.find((call) => call[1] === 15_000)?.[0] as (() => void) | undefined;
    expect(poll).toBeDefined();
    poll?.();

    await screen.findByRole("heading", { name: "Pesanan selesai" });
    expect(fetchOrder).toHaveBeenCalledTimes(2);
  });

  it("polls active states and clears the interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    fetchOrder.mockResolvedValue({ order: order({ status: "received", payment_status: "paid" }), reviewUrl: null });

    const { unmount } = render(<OrderView slug="senja-kopi" orderId="order-1" />);

    await screen.findByRole("heading", { name: "Pembayaran Berhasil" });
    expect(setIntervalSpy.mock.calls.some((call) => call[1] === 15_000)).toBe(true);
    const pollHandle = setIntervalSpy.mock.results.find(
      (_result, index) => setIntervalSpy.mock.calls[index]?.[1] === 15_000
    )?.value;
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledWith(pollHandle);
  });
});
