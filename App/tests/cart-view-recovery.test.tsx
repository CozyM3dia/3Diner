/**
 * @vitest-environment jsdom
 */
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CartView from "../src/components/CartView";
import { createOrder, quoteOrder } from "@/lib/orders";
import { useCart } from "@/lib/cart";

const { routerPush, onlineState } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  onlineState: { value: true },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>{children}</a>
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
  useOnlineStatus: () => onlineState.value,
}));

vi.mock("@/lib/orders", () => ({
  createOrder: vi.fn(),
  quoteOrder: vi.fn(),
}));

vi.mock("@/lib/cart", () => ({
  useCart: vi.fn(),
}));

const clearCart = vi.fn();
const setQty = vi.fn();
const setTable = vi.fn();
const setNotes = vi.fn();
const createOrderMock = vi.mocked(createOrder);
const quoteOrderMock = vi.mocked(quoteOrder);
const useCartMock = vi.mocked(useCart);

const cafe = { id_cafe: "cafe-1", nama_cafe: "3Diner" } as never;
const cartImageUrl = "https://images.example.test/pasta.jpg";
const canonicalQuote = {
  quote_id: "44444444-4444-4444-8444-444444444444",
  request_hash: "a".repeat(64),
  expires_at: "2099-01-01T00:00:00.000Z",
  items: [{
    id_menu: "menu-1",
    nama_menu: "Pasta Kanonik",
    harga_menu: 26_000,
    qty: 2,
    options: [{ id_option_value: "option-1", group_name: "Ukuran", name: "Besar", price_delta: 1_000 }],
  }],
  subtotal: 52_000,
  service_pct: 5,
  service_amount: 2_600,
  tax_pct: 10,
  tax_amount: 5_460,
  prices_include_tax: false,
  total: 60_060,
};

let cartState: ReturnType<typeof useCart>;

function mockCart({ table = " 7 ", notes = "  tanpa bawang  ", imageUrl = cartImageUrl }: { table?: string; notes?: string; imageUrl?: string | null } = {}) {
  cartState = {
    items: [{
      line_key: "menu-1:option-1:",
      id_menu: "menu-1",
      nama_menu: "Nama lokal palsu",
      harga_menu: 1,
      image_url: imageUrl,
      qty: 2,
      options: [{ id_option_value: "option-1", group_name: "Palsu", name: "Palsu", price_delta: -99_999 }],
    }],
    count: 2,
    total: 2,
    table,
    notes,
    add: vi.fn(),
    setQty,
    remove: vi.fn(),
    setTable,
    setNotes,
    clear: clearCart,
  };
  useCartMock.mockImplementation(() => cartState);
}

function successfulOrder(total = canonicalQuote.total) {
  return {
    id_order: "order-1",
    cafe_id: "cafe-1",
    cafe_slug: "demo",
    cafe_name: "3Diner",
    table_number: "7",
    items: [],
    subtotal: total,
    tax_pct: 0,
    tax_amount: 0,
    service_pct: 0,
    service_amount: 0,
    prices_include_tax: false,
    total,
    status: "received" as const,
    payment_method: null,
    payment_status: "unpaid" as const,
    created_at: "2026-08-13T00:00:00.000Z",
    customer_token: "token-1",
  };
}

async function enterConfirmation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Lanjut" }));
  await screen.findByRole("heading", { name: "Konfirmasi & bayar" });
}

describe("CartView checkout recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onlineState.value = true;
    mockCart();
    quoteOrderMock.mockResolvedValue(canonicalQuote);
  });

  afterEach(cleanup);

  it("quotes a valid cart before confirmation, focuses its heading, and shows only canonical pricing", async () => {
    const user = userEvent.setup();
    render(<CartView cafe={cafe} slug="demo" />);

    await enterConfirmation(user);

    expect(quoteOrderMock).toHaveBeenCalledWith({
      cafeId: "cafe-1",
      table: "7",
      items: cartState.items,
      notes: "tanpa bawang",
      paymentChannel: "online",
    });
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Konfirmasi & bayar" }));
    expect(screen.getByText(/Pasta Kanonik/)).toBeTruthy();
    expect(screen.queryByText(/Nama lokal palsu/)).toBeNull();
    expect(screen.getByText("Subtotal")).toBeTruthy();
    expect(screen.getByText(/Layanan \(5%\)/)).toBeTruthy();
    expect(screen.getByText(/Pajak \(10%\)/)).toBeTruthy();
    expect(screen.getAllByText(/60\.060/).length).toBeGreaterThan(0);
  });

  it("renders the cart image in review and reuses it for the canonical quote menu", async () => {
    const user = userEvent.setup();
    render(<CartView cafe={cafe} slug="demo" />);

    expect(screen.getByRole("img", { name: "Nama lokal palsu" }).getAttribute("src")).toBe(cartImageUrl);
    expect(screen.getByRole("img", { name: "Nama lokal palsu" }).getAttribute("loading")).toBe("eager");

    await enterConfirmation(user);

    expect(screen.getByRole("img", { name: "Pasta Kanonik" }).getAttribute("src")).toBe(cartImageUrl);
    expect(screen.queryByText(/Nama lokal palsu/)).toBeNull();
  });

  it("keeps the initial fallback when a menu has no image", () => {
    mockCart({ imageUrl: null });
    render(<CartView cafe={cafe} slug="demo" />);

    expect(screen.queryByRole("img", { name: "Nama lokal palsu" })).toBeNull();
    expect(screen.getByText("N")).toBeTruthy();
  });

  it("uses native payment radios, exposes the selected payment tile, and retains the cashier choice after editing", async () => {
    const user = userEvent.setup();
    render(<CartView cafe={cafe} slug="demo" />);
    await enterConfirmation(user);

    const qris = screen.getByRole("radio", { name: /QRIS/i });
    const cashier = screen.getByRole("radio", { name: /Bayar di kasir/i });
    expect(qris).toHaveProperty("checked", true);
    expect(cashier).toHaveProperty("checked", false);
    expect(qris.closest("label")?.getAttribute("data-selected")).toBe("true");
    expect(cashier.closest("label")?.getAttribute("data-selected")).toBe("false");
    expect(qris.closest("label")?.classList.contains("checkout-payment-tile--selected")).toBe(true);
    expect(cashier.closest("label")?.classList.contains("checkout-payment-tile--selected")).toBe(false);
    await user.click(cashier);
    expect(cashier).toHaveProperty("checked", true);
    expect(qris.closest("label")?.getAttribute("data-selected")).toBe("false");
    expect(cashier.closest("label")?.getAttribute("data-selected")).toBe("true");
    expect(qris.closest("label")?.classList.contains("checkout-payment-tile--selected")).toBe(false);
    expect(cashier.closest("label")?.classList.contains("checkout-payment-tile--selected")).toBe(true);
    expect(screen.getByRole("button", { name: "Kirim & tampilkan kode kasir" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Edit pesanan" }));
    expect((screen.getByRole("textbox", { name: "Nomor meja" }) as HTMLInputElement).value).toBe(" 7 ");
    expect((screen.getByRole("textbox", { name: /Catatan tambahan/i }) as HTMLTextAreaElement).value).toBe("  tanpa bawang  ");
    await enterConfirmation(user);
    expect(screen.getByRole("radio", { name: /Bayar di kasir/i })).toHaveProperty("checked", true);
  });

  it("invalidates the quote after editing quantity and requests a fresh quote", async () => {
    const user = userEvent.setup();
    setQty.mockImplementation((_lineKey, qty: number) => {
      cartState = { ...cartState, items: cartState.items.map((item) => ({ ...item, qty })), count: qty, total: qty };
    });
    const view = render(<CartView cafe={cafe} slug="demo" />);
    await enterConfirmation(user);
    await user.click(screen.getByRole("button", { name: "Edit pesanan" }));
    await user.click(screen.getByRole("button", { name: "Tambah Nama lokal palsu" }));
    view.rerender(<CartView cafe={cafe} slug="demo" />);
    await enterConfirmation(user);

    expect(quoteOrderMock).toHaveBeenCalledTimes(2);
    expect(quoteOrderMock).toHaveBeenLastCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ qty: 3 })],
    }));
  });

  it("keeps an empty table in review and focuses its invalid field", async () => {
    const user = userEvent.setup();
    mockCart({ table: "" });
    render(<CartView cafe={cafe} slug="demo" />);

    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    const table = screen.getByRole("textbox", { name: "Nomor meja" });
    expect(table.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(table);
    expect(screen.queryByRole("heading", { name: "Konfirmasi & bayar" })).toBeNull();
    expect(quoteOrderMock).not.toHaveBeenCalled();
  });

  it("blocks quote and submission while offline with an inline alert", async () => {
    const user = userEvent.setup();
    onlineState.value = false;
    render(<CartView cafe={cafe} slug="demo" />);

    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Hubungkan ke internet");
    expect(quoteOrderMock).not.toHaveBeenCalled();
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("keeps the customer in review and offers an explicit retry when quoting fails", async () => {
    const user = userEvent.setup();
    quoteOrderMock
      .mockRejectedValueOnce(new Error("Gagal memuat ringkasan pesanan"))
      .mockResolvedValueOnce(canonicalQuote);
    render(<CartView cafe={cafe} slug="demo" />);

    await user.click(screen.getByRole("button", { name: "Lanjut" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Gagal memuat ringkasan pesanan");
    expect(screen.getByRole("heading", { name: "Pesananmu" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByRole("heading", { name: "Konfirmasi & bayar" })).toBeTruthy();
    expect(quoteOrderMock).toHaveBeenCalledTimes(2);
  });

  it("discards an older quote when the cart changes while that quote is pending", async () => {
    const user = userEvent.setup();
    let resolveQuote: (quote: typeof canonicalQuote) => void = () => undefined;
    quoteOrderMock.mockImplementationOnce(() => new Promise((resolve) => { resolveQuote = resolve; }));
    setQty.mockImplementation((_lineKey, qty: number) => {
      cartState = {
        ...cartState,
        items: cartState.items.map((item) => ({ ...item, qty })),
        count: qty,
        total: qty,
      };
    });
    const view = render(<CartView cafe={cafe} slug="demo" />);

    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    await user.click(screen.getByRole("button", { name: "Lanjut" }));
    expect(quoteOrderMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Tambah Nama lokal palsu" }));
    view.rerender(<CartView cafe={cafe} slug="demo" />);
    resolveQuote(canonicalQuote);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Pesananmu" })).toBeTruthy());
    expect(screen.queryByRole("heading", { name: "Konfirmasi & bayar" })).toBeNull();
  });

  it("refuses submission when an equal-total cart has different selected items than its quote", async () => {
    const user = userEvent.setup();
    const view = render(<CartView cafe={cafe} slug="demo" />);
    await enterConfirmation(user);

    cartState = {
      ...cartState,
      items: [{
        ...cartState.items[0],
        line_key: "menu-2:option-1:",
        id_menu: "menu-2",
        nama_menu: "Substitusi total sama",
      }],
    };
    view.rerender(<CartView cafe={cafe} slug="demo" />);

    expect(createOrderMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Pesananmu" })).toBeTruthy();
  });

  it("prevents duplicate pending submission and sends the unchanged online payload", async () => {
    const user = userEvent.setup();
    let resolveOrder: (value: ReturnType<typeof successfulOrder>) => void = () => undefined;
    createOrderMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOrder = resolve; }));
    render(<CartView cafe={cafe} slug="demo" />);
    await enterConfirmation(user);

    const submit = screen.getByRole("button", { name: "Kirim & tampilkan QRIS" });
    await user.click(submit);
    await user.click(submit);
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock).toHaveBeenCalledWith({
      cafeId: "cafe-1",
      cafeSlug: "demo",
      cafeName: "3Diner",
      table: "7",
      items: cartState.items,
      notes: "tanpa bawang",
      paymentChannel: "online",
      quoteId: canonicalQuote.quote_id,
      idempotencyKey: expect.any(String),
    });

    resolveOrder(successfulOrder());
    await waitFor(() => expect(clearCart).toHaveBeenCalledTimes(1));
    expect(routerPush).toHaveBeenCalledWith("/demo/pesanan/order-1?token=token-1");
  });

  it("keeps the cart after stock failure, supports cashier retry, and marks a changed total for review", async () => {
    const user = userEvent.setup();
    createOrderMock
      .mockRejectedValueOnce(new Error("Stok beberapa menu sedang tidak cukup"))
      .mockResolvedValueOnce(successfulOrder(61_000));
    render(<CartView cafe={cafe} slug="demo" />);
    await enterConfirmation(user);
    await user.click(screen.getByRole("radio", { name: /Bayar di kasir/i }));

    const submit = screen.getByRole("button", { name: "Kirim & tampilkan kode kasir" });
    await user.click(submit);
    expect((await screen.findByRole("alert")).textContent).toContain("Stok beberapa menu sedang tidak cukup");
    expect(clearCart).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit pesanan" })).toBeTruthy();

    await user.click(submit);
    await waitFor(() => expect(clearCart).toHaveBeenCalledTimes(1));
    expect(createOrderMock).toHaveBeenLastCalledWith(expect.objectContaining({ paymentChannel: "cashier" }));
    expect(routerPush).toHaveBeenCalledWith("/demo/pesanan/order-1?token=token-1&reviewTotal=60060");
  });
});
