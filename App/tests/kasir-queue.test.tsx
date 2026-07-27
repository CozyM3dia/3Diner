// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const acceptOrder = vi.fn(async () => ({}));
const completeOrder = vi.fn(async () => ({}));
const markCashPaid = vi.fn(async () => ({}));
const cancelOrder = vi.fn(async () => ({}));

vi.mock("@/lib/kasir-actions", () => ({
  acceptOrder: (...a: unknown[]) => acceptOrder(...(a as [])),
  completeOrder: (...a: unknown[]) => completeOrder(...(a as [])),
  markCashPaid: (...a: unknown[]) => markCashPaid(...(a as [])),
  cancelOrder: (...a: unknown[]) => cancelOrder(...(a as [])),
}));

let subscribeCallback: ((status: string) => void) | null = null;

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on() {
        return this;
      },
      subscribe(cb: (status: string) => void) {
        subscribeCallback = cb;
        return this;
      },
    }),
    removeChannel: () => undefined,
  }),
}));

import KasirQueue, { type KasirOrder, type KasirTotals } from "@/components/kasir/KasirQueue";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const order = (o: Partial<KasirOrder>): KasirOrder => ({
  id_order: "o-1",
  table_number: "A-2",
  items: [{ id_menu: "m1", nama_menu: "Kopi Susu", harga_menu: 18000, qty: 2 }],
  total: 36000,
  status: "received",
  payment_method: null,
  payment_status: "unpaid",
  created_at: minutesAgo(2),
  ...o,
});

const totals: KasirTotals = {
  completedCount: 37,
  receivedAmount: 1_480_000,
  cashAmount: 620_000,
  qrisAmount: 860_000,
};

function renderQueue(
  orders: KasirOrder[],
  t: KasirTotals | null = totals,
  taxConfigured = true
) {
  return render(
    <KasirQueue
      initial={orders}
      totals={t}
      cafeId="cafe-1"
      cafeName="Senja Kopi"
      staffName="Rina"
      taxConfigured={taxConfigured}
      openingHours="07.00–22.00"
    />
  );
}

function openSheet(o: KasirOrder) {
  renderQueue([o]);
  fireEvent.click(screen.getByRole("button", { name: /Buka rincian pesanan/ }));
  return screen.getByRole("dialog");
}

beforeEach(() => {
  vi.clearAllMocks();
  subscribeCallback = null;
});
afterEach(() => cleanup());

describe("antrean kasir", () => {
  it("memisahkan pesanan masuk dari yang sedang disiapkan", () => {
    renderQueue([
      order({ id_order: "a", status: "received" }),
      order({ id_order: "b", status: "preparing", created_at: minutesAgo(12) }),
    ]);
    expect(screen.getByLabelText("Masuk")).toBeTruthy();
    expect(screen.getByLabelText("Disiapkan")).toBeTruthy();
  });

  it("tidak merender kelompok yang kosong", () => {
    // Panjang halaman harus sama dengan jumlah pekerjaan nyata. Header kelompok
    // kosong mengajari mata untuk melewatinya.
    renderQueue([order({ status: "preparing" })]);
    expect(screen.queryByLabelText("Masuk")).toBeNull();
    expect(screen.getByLabelText("Disiapkan")).toBeTruthy();
  });

  it("hanya punya satu h1", () => {
    renderQueue([order({})]);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("menampilkan tepat dua angka besar", () => {
    const { container } = renderQueue([order({})]);
    expect(container.querySelectorAll(".kasir-fig")).toHaveLength(2);
  });

  it("menerima pesanan masuk dengan satu ketuk", async () => {
    renderQueue([order({ id_order: "a", status: "received" })]);
    fireEvent.click(screen.getByRole("button", { name: /Terima$/ }));
    await waitFor(() => expect(acceptOrder).toHaveBeenCalledWith("a"));
  });

  it("meminta uang tunai sebelum menyerahkan pesanan yang belum lunas", () => {
    renderQueue([order({ status: "preparing", payment_status: "unpaid", payment_method: "cash" })]);
    expect(screen.getByRole("button", { name: "Terima tunai" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Selesai" })).toBeNull();
  });

  it("menyerahkan pesanan QRIS tanpa meminta tunai", () => {
    // Kasir tidak bisa melihat dana QRIS benar-benar masuk, jadi ia tidak boleh
    // menyatakannya lunas.
    renderQueue([order({ status: "preparing", payment_status: "pending", payment_method: "qris" })]);
    expect(screen.getByRole("button", { name: "Selesai" })).toBeTruthy();
  });

  it("mengeluarkan pesanan dari antrean setelah diselesaikan", async () => {
    renderQueue([order({ id_order: "a", status: "preparing", payment_status: "paid", payment_method: "cash" })]);
    fireEvent.click(screen.getByRole("button", { name: "Selesai" }));
    await waitFor(() => expect(completeOrder).toHaveBeenCalledWith("a"));
    // Aksi terminal membuat baris hilang — itu satu-satunya cara antrean bisa nol.
    await waitFor(() => expect(screen.getByText("Semua pesanan sudah ditangani")).toBeTruthy());
  });

  it("menyatakan antrean kosong sebagai hasil, tanpa mengajak bekerja lagi", () => {
    const { container } = renderQueue([]);
    expect(screen.getByText("Semua pesanan sudah ditangani")).toBeTruthy();
    // Tanpa CTA: ini kabar baik, dan tombol di sini membatalkan kabarnya.
    expect(container.querySelectorAll(".kasir-state .kasir-btn")).toHaveLength(0);
  });

  it("menandai umur pesanan dengan kata, bukan warna saja", () => {
    renderQueue([order({ status: "preparing", created_at: minutesAgo(18) })]);
    expect(screen.getByText(/Terlambat/)).toBeTruthy();
  });

  it("menampilkan catatan per item di baris", () => {
    renderQueue([
      order({
        items: [{ id_menu: "m1", nama_menu: "Kopi Susu", harga_menu: 18000, qty: 1, notes: "tanpa gula" }],
      }),
    ]);
    expect(screen.getByText(/tanpa gula/)).toBeTruthy();
  });

  it("menampilkan angka sebagai — saat totalnya tidak tersedia", () => {
    // Merender 0 saat query gagal tidak terlihat seperti kegagalan: kasir
    // menyimpulkan kafenya sepi padahal datanya tidak sampai.
    const { container } = renderQueue([order({})], null);
    const figures = [...container.querySelectorAll(".kasir-fig")].map((n) => n.textContent);
    expect(figures).toEqual(["—", "—"]);
  });

  it("menyatakan koneksi terputus sebagai keadaan menetap", async () => {
    renderQueue([order({})]);
    subscribeCallback?.("CHANNEL_ERROR");
    await waitFor(() => expect(screen.getByText("Pesanan baru tidak akan muncul")).toBeTruthy());
    // Baris yang sudah ada tetap bisa dikerjakan — yang hilang cuma pesanan baru.
    expect(screen.getByRole("button", { name: /Terima$/ })).toBeTruthy();
  });

  it("menyebut nomor meja dan nilainya saat mengonfirmasi pembatalan", () => {
    renderQueue([order({ table_number: "L-5", total: 52800 })]);
    fireEvent.click(screen.getByRole("button", { name: /Tindakan lain/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Batalkan pesanan" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("L-5");
    expect(dialog.textContent).toContain("52.800");
  });

  it("membuka rincian dari baris, tanpa berpindah rute", () => {
    // Bolak-balik rute untuk satu pesanan membuat kasir mengerjakan navigasi,
    // bukan pesanan. Rinciannya dibuka di atas antrean yang sama.
    renderQueue([order({ table_number: "A-2" })]);
    fireEvent.click(screen.getByRole("button", { name: /Buka rincian pesanan A-2/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("menolak membatalkan tanpa alasan", async () => {
    renderQueue([order({})]);
    fireEvent.click(screen.getByRole("button", { name: /Tindakan lain/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Batalkan pesanan" }));
    fireEvent.click(screen.getByRole("button", { name: "Batalkan pesanan" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Alasan wajib diisi"));
    expect(cancelOrder).not.toHaveBeenCalled();
  });
});

describe("rincian pesanan (lapis 2)", () => {
  it("menampilkan rincian pembayaran, termasuk pajak nol", () => {
    const sheet = openSheet(
      order({ subtotal: 60000, tax_pct: 0, tax_amount: 0, total: 60000 })
    );
    expect(sheet.textContent).toContain("Subtotal");
    expect(sheet.textContent).toContain("Pajak 0%");
    expect(sheet.textContent).toContain("Total");
  });

  it("mengatakan kalau pemilik belum pernah mengatur pajak", () => {
    renderQueue([order({})], totals, false);
    fireEvent.click(screen.getByRole("button", { name: /Buka rincian pesanan/ }));
    expect(screen.getByRole("dialog").textContent).toContain("belum diatur pemilik");
  });

  it("menampilkan varian dan catatan tiap item secara utuh", () => {
    const sheet = openSheet(
      order({
        items: [
          {
            id_menu: "m1",
            nama_menu: "Kopi Susu",
            harga_menu: 23000,
            qty: 1,
            notes: "gula sedikit, es normal",
            options: [{ id_option_value: "o1", group_name: "Ukuran", name: "Large", price_delta: 5000 }],
          },
        ],
      })
    );
    // Lapis 1 memotong dengan ellipsis; lapis 2 tidak boleh memotong apa pun.
    expect(sheet.textContent).toContain("gula sedikit, es normal");
    expect(sheet.textContent).toContain("Large");
  });

  it("memisahkan aksi merusak dari aksi utama", () => {
    const sheet = openSheet(order({ status: "preparing", payment_status: "paid" }));
    const buttons = [...sheet.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons).toContain("Batalkan pesanan");
    expect(buttons).toContain("Selesai");
    // Tepat satu tombol utama di lembar ini.
    expect(sheet.querySelectorAll(".kasir-btn-solid")).toHaveLength(1);
  });

  it("menawarkan cetak struk", () => {
    const sheet = openSheet(order({}));
    expect([...sheet.querySelectorAll("button")].map((b) => b.textContent)).toContain("Cetak struk");
  });

  it("menutup dengan Escape", async () => {
    openSheet(order({}));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
