// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PosBoard, {
  type PosCategoryChip,
  type PosMenu,
  type PosMenuOption,
} from "@/components/pos/PosBoard";

/** REPRO: item yang ditambah lewat modal Item Details (menu bervarian)
 *  harus tetap muncul sebagai baris keranjang — persis kasus screenshot:
 *  Pasta Meatball (Ukuran, wajib pilih) + Es Kopi Susu (polos). */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/image", () => ({
  default: ({ alt = "" }: { alt?: string }) => <img alt={alt ?? ""} />,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/lib/receipt-html", () => ({
  buildReceiptHtml: () => "<html></html>",
  printReceipt: vi.fn(),
}));

const MENU_VARIAN: PosMenu = {
  id: "0e930b07-e934-4a3b-b1d9-558754154063",
  name: "Pasta Meatball",
  price: 50_000,
  discountPct: 20,
  imageUrl: "https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/menu-media/menu-media/c5baf358-a17f-4897-9709-b38d357db7a1/card.jpg",
  category: "Main Course",
  isActive: true,
  description: null,
};
const MENU_POLOS: PosMenu = {
  id: "9218d320-8215-4c8c-8c1b-c2cf8cbbf53f",
  name: "Es Kopi Susu",
  price: 22_000,
  discountPct: null,
  imageUrl: "https://zvkmcbvckuupjsdftsyz.supabase.co/storage/v1/object/public/menu-media/menu-media/82a22e34-d530-489a-8212-73eef5343dc2/card.jpg",
  category: "Minuman",
  isActive: true,
  description: null,
};

const GRUP: PosMenuOption[] = [
  {
    id: "6e8d94e1-9985-44cc-afda-0f0cf0d66078",
    menuId: MENU_VARIAN.id,
    name: "Ukuran",
    minSelect: 1,
    maxSelect: 1,
    values: [
      { id: "val-regular", name: "Regular", priceDelta: 0 },
      { id: "val-large", name: "Large", priceDelta: 10_000 },
    ],
  },
];

const KATEGORI: PosCategoryChip[] = [{ name: "Semua Menu", count: 2 }];

vi.stubGlobal(
  "fetch",
  vi.fn(async (url: string) => {
    if (url === "/api/orders/quote") {
      return {
        ok: true,
        json: async () => ({
          quote_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          quote: { items: [], subtotal: 62_000, tax_pct: 0, tax_amount: 0, service_pct: 0, service_amount: 0, prices_include_tax: false, total: 62_000 },
        }),
      } as unknown as Response;
    }
    throw new Error(`fetch tak terduga: ${url}`);
  }),
);

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PosBoard — jalur modal Item Details (menu bervarian)", () => {
  it("menu bervarian via modal + menu polos via kartu = DUA baris keranjang", async () => {
    render(
      <PosBoard
        cafeId="05578160-0935-4f09-9225-9453f2826bae"
        cafeName="Senja Kopi (Demo)"
        cafeAddress={null}
        taxConfigured
        receiptSettings={null}
        staffName="Kasir Uji"
        menus={[MENU_VARIAN, MENU_POLOS]}
        optionGroups={GRUP}
        categories={KATEGORI}
        recent={[]}
        tables={["12"]}
      />,
    );

    // 1) Pasta Meatball (bervarian) -> modal terbuka -> pilih Ukuran -> tambah
    fireEvent.click(screen.getByRole("button", { name: "Masukkan Pasta Meatball ke keranjang" }));
    const dialog = await screen.findByRole("dialog", { name: "Item Details Pasta Meatball" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Regular/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Tambah ke Keranjang/i }));

    // 2) Es Kopi Susu (polos) langsung dari kartu
    fireEvent.click(screen.getByRole("button", { name: "Masukkan Es Kopi Susu ke keranjang" }));

    await waitFor(() => expect(screen.getByText("2 item")).toBeTruthy(), { timeout: 3000 });

    const rows = document.querySelectorAll(".pos-line");
    expect(rows).toHaveLength(2);
    const names = [...rows].map(r => r.querySelector(".pos-line-name")?.textContent);
    expect(names).toContain("Pasta Meatball");
    expect(names).toContain("Es Kopi Susu");
  });

  it("dua menu bervarian beda varian = dua baris terpisah", async () => {
    render(
      <PosBoard
        cafeId="05578160-0935-4f09-9225-9453f2826bae"
        cafeName="Senja Kopi (Demo)"
        cafeAddress={null}
        taxConfigured
        receiptSettings={null}
        staffName="Kasir Uji"
        menus={[MENU_VARIAN, MENU_POLOS]}
        optionGroups={GRUP}
        categories={KATEGORI}
        recent={[]}
        tables={["12"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Masukkan Pasta Meatball ke keranjang" }));
    let dialog = await screen.findByRole("dialog", { name: "Item Details Pasta Meatball" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Regular/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Tambah ke Keranjang/i }));

    fireEvent.click(screen.getByRole("button", { name: "Masukkan Pasta Meatball ke keranjang" }));
    dialog = await screen.findByRole("dialog", { name: "Item Details Pasta Meatball" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Large/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Tambah ke Keranjang/i }));

    expect(screen.getByText("2 item")).toBeTruthy();
    expect(document.querySelectorAll(".pos-line")).toHaveLength(2);
  });
});
