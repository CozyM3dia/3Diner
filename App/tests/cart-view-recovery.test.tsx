/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CartView from "../src/components/CartView";
import { createOrder } from "@/lib/orders";
import { useCart } from "@/lib/cart";

const { routerPush } = vi.hoisted(() => ({
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    return React.createElement("img", { alt, ...imageProps });
  },
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("@/lib/orders", () => ({
  createOrder: vi.fn(),
}));

vi.mock("@/lib/cart", () => ({
  useCart: vi.fn(),
}));

const clearCart = vi.fn();
const createOrderMock = vi.mocked(createOrder);
const useCartMock = vi.mocked(useCart);

function mockCart() {
  useCartMock.mockReturnValue({
    items: [{ id_menu: "menu-1", nama_menu: "Pasta Meatball", harga_menu: 50_000, image_url: null, qty: 2 }],
    count: 2,
    total: 100_000,
    table: "7",
    notes: "",
    add: vi.fn(),
    setQty: vi.fn(),
    remove: vi.fn(),
    setTable: vi.fn(),
    setNotes: vi.fn(),
    clear: clearCart,
  });
}

describe("CartView order recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCart();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows inline feedback, preserves cart, and allows retry after stock failure", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    createOrderMock
      .mockRejectedValueOnce(new Error("Stok beberapa menu sedang tidak cukup. Silakan kurangi jumlah atau pilih menu lain."))
      .mockResolvedValueOnce({
        id_order: "order-1",
        cafe_id: "cafe-1",
        cafe_slug: "demo",
        cafe_name: "3Diner",
        table_number: "7",
        items: [],
        total: 100_000,
        status: "received",
        payment_method: null,
        payment_status: "unpaid",
        created_at: "2026-07-16T00:00:00.000Z",
        customer_token: "token-1",
      });

    render(<CartView cafe={{ id_cafe: "cafe-1", nama_cafe: "3Diner" } as never} slug="demo" />);

    await userEvent.click(screen.getByRole("button", { name: "Pesan Sekarang" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Stok beberapa menu sedang tidak cukup");
    expect(alertSpy).not.toHaveBeenCalled();
    expect(clearCart).not.toHaveBeenCalled();
    expect(screen.queryByText("Pasta Meatball")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Pesan Sekarang" }));

    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(clearCart).toHaveBeenCalledTimes(1));
    expect(routerPush).toHaveBeenCalledWith("/demo/pesanan/order-1");
  });
});
