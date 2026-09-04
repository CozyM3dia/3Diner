// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PosBoard, {
  type PosCategoryChip,
  type PosMenu,
  type PosMenuOption,
} from "@/components/pos/PosBoard";

/** Kontrak papan POS setelah rebuild tampilan (5 Sep 2026).
 *
 *  Yang dijaga di sini bukan piksel, melainkan hal-hal yang diam-diam bisa
 *  rusak saat markup ditata ulang:
 *  • Aritmetika blok "Total Pembayaran" — Subtotal yang tampil adalah harga
 *    KOTOR, lalu "Diskon menu" menurunkannya ke subtotal server. Kalau baris
 *    diskon dipasang tanpa menaikkan subtotal, angka di layar tidak
 *    berjumlah dan kasir kehilangan kepercayaan pada strukmu.
 *  • Nama pelanggan benar-benar ikut ke server sebagai `notes`, dengan isi
 *    yang SAMA pada quote dan commit — request_hash di `commit_order_atomic`
 *    ikut menghitung notes, jadi keduanya beda = setiap checkout ditolak.
 *  • Dine In tanpa nomor meja tidak boleh mengirim apa pun.
 *  • Take Away mengirim table_number "Bungkus" tanpa meminta nomor meja. */

vi.mock("next/image", () => ({
  default: ({ alt = "", ...rest }: Record<string, unknown> & { alt?: string }) => {
    const { src, width, height, sizes, loading, priority, ...safe } = rest as Record<string, unknown>;
    void src; void width; void height; void sizes; void loading; void priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...(safe as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/receipt-html", () => ({
  buildReceiptHtml: () => "<html></html>",
  printReceipt: vi.fn(),
}));

const MENU_DISKON: PosMenu = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Nasi Goreng Kampung",
  price: 40_000,
  discountPct: 10, // harga jual 36.000 → diskon 4.000 per porsi
  imageUrl: null,
  category: "Main Course",
  isActive: true,
  description: null,
};

const MENU_POLOS: PosMenu = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Es Kopi Susu",
  price: 22_000,
  discountPct: null,
  imageUrl: null,
  category: "Minuman",
  isActive: true,
  description: null,
};

const KATEGORI: PosCategoryChip[] = [
  { name: "Semua Menu", count: 2 },
  { name: "Main Course", count: 1 },
  { name: "Minuman", count: 1 },
];

const OPSI: PosMenuOption[] = [];

const QUOTE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

/** Ringkasan server untuk 1× menu diskon: subtotal SUDAH dipotong diskon. */
const QUOTE_BODY = {
  quote_id: QUOTE_ID,
  expires_at: new Date(Date.now() + 900_000).toISOString(),
  request_hash: "f".repeat(64),
  quote: {
    items: [],
    subtotal: 36_000,
    tax_pct: 10,
    tax_amount: 3_780,
    service_pct: 5,
    service_amount: 1_800,
    prices_include_tax: false,
    total: 41_580,
  },
};

type Panggilan = { url: string; body: Record<string, unknown>; headers: Record<string, string> };

let panggilan: Panggilan[] = [];

function pasangFetch(commitOk = true) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    panggilan.push({
      url,
      body,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    if (url === "/api/orders/quote") {
      return { ok: true, json: async () => QUOTE_BODY } as unknown as Response;
    }
    if (url === "/api/orders") {
      return commitOk
        ? ({
            ok: true,
            json: async () => ({
              order: { id_order: "abcdef01-2345-4678-9abc-def012345678" },
              orderToken: "tok_123",
            }),
          } as unknown as Response)
        : ({ ok: false, json: async () => ({ message: "Stok habis." }) } as unknown as Response);
    }
    throw new Error(`fetch tak terduga: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function papan(extra: Partial<React.ComponentProps<typeof PosBoard>> = {}) {
  return render(
    <PosBoard
      cafeId="99999999-9999-4999-8999-999999999999"
      cafeName="Senja Kopi"
      cafeAddress="Jl. Contoh 1"
      taxConfigured
      receiptSettings={null}
      staffName="Kasir Uji"
      menus={[MENU_DISKON, MENU_POLOS]}
      optionGroups={OPSI}
      categories={KATEGORI}
      recent={[]}
      tables={["4", "12"]}
      {...extra}
    />,
  );
}

const quotes = () => panggilan.filter(p => p.url === "/api/orders/quote");
const commits = () => panggilan.filter(p => p.url === "/api/orders");

function tambah(nama: string) {
  fireEvent.click(screen.getByRole("button", { name: `Masukkan ${nama} ke keranjang` }));
}

function isiMeja(nilai: string) {
  fireEvent.change(screen.getByRole("combobox", { name: /Lokasi Meja/i }), { target: { value: nilai } });
}

beforeEach(() => {
  panggilan = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PosBoard — ringkasan pembayaran", () => {
  it("menampilkan subtotal kotor, baris diskon, service, pajak, dan grand total yang berjumlah", async () => {
    pasangFetch();
    papan();
    tambah("Nasi Goreng Kampung");

    const kaki = document.querySelector(".pos-foot") as HTMLElement;
    await waitFor(() => expect(within(kaki).getByText("Subtotal")).toBeTruthy(), { timeout: 3000 });

    const baris = (label: RegExp) =>
      (within(kaki).getByText(label).closest(".pos-sum-row") as HTMLElement).querySelector("b")!.textContent;

    // Subtotal kotor = subtotal server (36.000) + diskon menu (4.000).
    expect(baris(/^Subtotal$/)).toBe("Rp 40.000");
    expect(baris(/^Diskon menu$/)).toBe("−Rp 4.000");
    expect(baris(/^Service \(5%\)$/)).toBe("Rp 1.800");
    expect(baris(/^Pajak \(10%\)/)).toBe("Rp 3.780");

    // 40.000 − 4.000 + 1.800 + 3.780 = 41.580 — angka di layar harus utuh.
    expect((document.querySelector(".pos-grand b") as HTMLElement).textContent).toBe("Rp 41.580");
  });

  it("tidak memunculkan baris diskon untuk menu tanpa potongan", async () => {
    pasangFetch();
    papan();
    tambah("Es Kopi Susu");

    const kaki = document.querySelector(".pos-foot") as HTMLElement;
    await waitFor(() => expect(within(kaki).getByText("Subtotal")).toBeTruthy(), { timeout: 3000 });
    expect(within(kaki).queryByText("Diskon menu")).toBeNull();
  });
});

describe("PosBoard — nama pelanggan menempel di catatan pesanan", () => {
  it("mengirim notes yang identik pada quote dan commit", async () => {
    pasangFetch();
    papan();

    fireEvent.change(screen.getByLabelText("Nama Pelanggan"), { target: { value: "  Budi  " } });
    isiMeja("12");
    tambah("Es Kopi Susu");

    await waitFor(() => expect(quotes().length).toBeGreaterThan(0), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: /Kirim Pesanan/i }));
    await waitFor(() => expect(commits().length).toBe(1), { timeout: 3000 });

    const commit = commits()[0];
    const quoteTerakhir = quotes()[quotes().length - 1];

    expect(commit.body.notes).toBe("Pelanggan: Budi");
    // request_hash commit_order_atomic ikut menghitung notes: beda sedikit saja
    // dan setiap checkout ditolak server.
    expect(quoteTerakhir.body.notes).toBe(commit.body.notes);
    expect(commit.body.quoteId).toBe(QUOTE_ID);
    expect(commit.body.table).toBe("12");
    expect(commit.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("mengirim notes null saat nama pelanggan dikosongkan", async () => {
    pasangFetch();
    papan();
    isiMeja("4");
    tambah("Es Kopi Susu");

    await waitFor(() => expect(quotes().length).toBeGreaterThan(0), { timeout: 3000 });
    expect(quotes()[0].body.notes).toBeNull();
  });
});

describe("PosBoard — tipe pesanan", () => {
  it("menolak kirim Dine In tanpa nomor meja dan tidak menyentuh /api/orders", async () => {
    pasangFetch();
    papan();
    tambah("Es Kopi Susu");
    await waitFor(() => expect(quotes().length).toBeGreaterThan(0), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: /Kirim Pesanan/i }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Nomor meja wajib diisi/i));
    expect(commits()).toHaveLength(0);
    expect(screen.getByRole("combobox", { name: /Lokasi Meja/i }).getAttribute("aria-invalid")).toBe("true");
  });

  it("Take Away mengirim table_number “Bungkus” tanpa meminta nomor meja", async () => {
    pasangFetch();
    papan();
    fireEvent.change(screen.getByLabelText("Tipe Pesanan"), { target: { value: "takeaway" } });
    tambah("Es Kopi Susu");

    await waitFor(() => expect(quotes().length).toBeGreaterThan(0), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: /Kirim Pesanan/i }));
    await waitFor(() => expect(commits().length).toBe(1), { timeout: 3000 });

    expect(commits()[0].body.table).toBe("Bungkus");
  });
});

describe("PosBoard — keranjang", () => {
  it("stepper kartu menentukan jumlah yang masuk keranjang lalu kembali nol", async () => {
    pasangFetch();
    papan();

    const naik = screen.getByRole("button", { name: "Naikkan jumlah Es Kopi Susu" });
    fireEvent.click(naik);
    fireEvent.click(naik);
    tambah("Es Kopi Susu");

    const baris = document.querySelector(".pos-line") as HTMLElement;
    expect(within(baris).getByText("×2")).toBeTruthy();
    expect(within(baris).getByText("Subtotal (Rp 22.000 × 2)")).toBeTruthy();
    expect(screen.getByText("2 item")).toBeTruthy();

    // Stepper kartu direset agar klik "Tambah" berikutnya tidak diam-diam
    // menambah dua porsi lagi.
    const stepperKartu = document.querySelectorAll(".pos-card .pos-stepper b");
    expect([...stepperKartu].every(b => b.textContent === "0")).toBe(true);
  });

  it("Kosongkan membuang seluruh baris", async () => {
    pasangFetch();
    papan();
    tambah("Es Kopi Susu");
    tambah("Nasi Goreng Kampung");
    expect(document.querySelectorAll(".pos-line")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Kosongkan/i }));
    expect(document.querySelectorAll(".pos-line")).toHaveLength(0);
    expect(screen.getByRole("button", { name: /Kirim Pesanan/i }).hasAttribute("disabled")).toBe(true);
  });
});

describe("PosBoard — setelah pesanan terkirim", () => {
  it("mengunci ringkasan yang dipakai commit dan membuka aksi pembayaran", async () => {
    pasangFetch();
    papan();
    isiMeja("4");
    tambah("Nasi Goreng Kampung");
    await waitFor(() => expect(quotes().length).toBeGreaterThan(0), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: /Kirim Pesanan/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/dikirim ke dapur/i), {
      timeout: 3000,
    });

    // Grand Total tidak boleh runtuh jadi "—" begitu keranjang dikosongkan:
    // kasir masih harus menagih angka yang sama.
    expect((document.querySelector(".pos-grand b") as HTMLElement).textContent).toBe("Rp 41.580");
    expect(screen.getByRole("button", { name: /Bayar Sekarang/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Kirim Pesanan/i })).toBeNull();

    // Baris diskon hanya milik keranjang berjalan; subtotal terkunci adalah
    // angka server apa adanya.
    const kaki = document.querySelector(".pos-foot") as HTMLElement;
    expect(within(kaki).queryByText("Diskon menu")).toBeNull();
    expect(
      (within(kaki).getByText("Subtotal").closest(".pos-sum-row") as HTMLElement).querySelector("b")!.textContent,
    ).toBe("Rp 36.000");
  });

  it("menahan pesan galat server dan tetap di keranjang saat commit ditolak", async () => {
    pasangFetch(false);
    papan();
    isiMeja("4");
    tambah("Es Kopi Susu");
    await waitFor(() => expect(quotes().length).toBeGreaterThan(0), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: /Kirim Pesanan/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Stok habis."), { timeout: 3000 });

    expect(document.querySelectorAll(".pos-line")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Kirim Pesanan/i })).toBeTruthy();
  });
});

describe("PosBoard — modal pembayaran & reset", () => {
  async function kirimPesanan() {
    pasangFetch();
    papan();
    isiMeja("4");
    tambah("Nasi Goreng Kampung");
    await waitFor(() => expect(quotes().length).toBeGreaterThan(0), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: /Kirim Pesanan/i }));
    await waitFor(() => expect(commits().length).toBe(1), { timeout: 3000 });
  }

  it("membuka modal bayar dengan total terkunci dan dua metode", async () => {
    await kirimPesanan();
    fireEvent.click(screen.getByRole("button", { name: /Bayar Sekarang/i }));

    const dialog = screen.getByRole("dialog", { name: "Pembayaran" });
    expect(within(dialog).getByText(/Rp 41\.580/)).toBeTruthy();
    expect(within(dialog).getByRole("tab", { name: "Tunai" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(within(dialog).getByRole("tab", { name: "QRIS" }));
    expect(within(dialog).getByRole("tab", { name: "QRIS" }).getAttribute("aria-selected")).toBe("true");
    // Tunai punya tombol konfirmasi; QRIS harus membuat kodenya dulu.
    expect(within(dialog).queryByRole("button", { name: /Lunas Tunai/i })).toBeNull();
    expect(within(dialog).getByRole("button", { name: /Buat Kode QRIS/i })).toBeTruthy();
  });

  it("“Pesanan Baru” mengosongkan meja, nama pelanggan, dan total terkunci", async () => {
    await kirimPesanan();
    fireEvent.click(screen.getByRole("button", { name: /Pesanan Baru/i }));

    expect(screen.getByRole("button", { name: /Kirim Pesanan/i })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: /Lokasi Meja/i }) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nama Pelanggan") as HTMLInputElement).value).toBe("");
    expect((document.querySelector(".pos-grand b") as HTMLElement).textContent).toBe("—");
  });
});
